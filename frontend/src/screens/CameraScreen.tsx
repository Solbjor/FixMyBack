import * as Haptics from 'expo-haptics';
import { StyleSheet, Text, View, Dimensions, Pressable, Modal, Alert } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { WebView } from 'react-native-webview';
import { api } from '../api';
import { STREAM_URL } from '../config';
import { colors, fontSize, radius, brand } from '../../constants/theme';

const feedHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      * { margin: 0; padding: 0; }
      body { background: #1a1a1a; width: 100vw; height: 100vh; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: monospace; color: #fff; }
      #status { position: absolute; top: 10px; left: 10px; background: rgba(0,0,0,0.7); padding: 8px 12px; border-radius: 4px; font-size: 12px; max-width: 300px; }
      #feed { width: 100%; height: 100%; object-fit: cover; }
      #container { width: 100%; height: 100%; position: relative; }
    </style>
  </head>
  <body>
    <div id="container">
      <img id="feed" />
      <div id="status">Initializing...</div>
    </div>
    <script>
      console.log('WebView script loaded');
      let frameCount = 0;
      window.setFrame = function(dataUrl) {
        try {
          frameCount++;
          const img = document.getElementById('feed');
          img.src = dataUrl;
          const status = document.getElementById('status');
          status.textContent = '✓ Frame ' + frameCount + ' loaded';
        } catch (e) {
          document.getElementById('status').textContent = 'Error: ' + e.message;
        }
      };
    </script>
  </body>
  </html>
`;

export default function CameraScreen() {
  const [connected, setConnected] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationCountdown, setCalibrationCountdown] = useState(10);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [alert, setAlert] = useState<{ visible: boolean; message: string; severity: string }>({
    visible: false,
    message: '',
    severity: 'medium',
  });
  const webViewRef = useRef<WebView>(null);
  const socketRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const calibrationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const calibrationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAlertRef = useRef<number>(0);
  const screenWidth = Dimensions.get('window').width;

  const formatElapsed = (totalSeconds: number) => {
    const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const s = String(totalSeconds % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const showAlert = (message: string, severity: string = 'medium') => {
    const now = Date.now();
    // Rate limit: minimum 2 seconds between alerts
    if (now - lastAlertRef.current < 2000) return;
    
    lastAlertRef.current = now;
    setAlert({ visible: true, message, severity });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    
    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      setAlert(prev => ({ ...prev, visible: false }));
    }, 4000);
  };

  useEffect(() => {
    socketRef.current = io(STREAM_URL);
    
    socketRef.current.on('connect', () => {
      setConnected(true);
      console.log('[Socket] Connected to relay');
    });
    
    socketRef.current.on('disconnect', () => {
      setConnected(false);
      console.log('[Socket] Disconnected from relay');
    });
    
    socketRef.current.on('frame', (data: string) => {
      const escapedData = data.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      webViewRef.current?.injectJavaScript(`window.setFrame('${escapedData}'); true;`);
    });
    
    // Listen for calibration completion
    socketRef.current.on('calibration-complete', (data: any) => {
      console.log('[Calibration] Complete:', data.message);
      setIsCalibrating(false);
      if (calibrationTimerRef.current) {
        clearInterval(calibrationTimerRef.current);
        calibrationTimerRef.current = null;
      }
      if (calibrationTimeoutRef.current) {
        clearTimeout(calibrationTimeoutRef.current);
        calibrationTimeoutRef.current = null;
      }
      showAlert('✅ Baseline established! Starting session...', 'success');
      
      // Now start the actual session
      setTimeout(() => {
        handleStartSession();
      }, 1500);
    });

    socketRef.current.on('calibration-failed', (data: any) => {
      console.log('[Calibration] Failed:', data?.message);
      setIsCalibrating(false);
      if (calibrationTimerRef.current) {
        clearInterval(calibrationTimerRef.current);
        calibrationTimerRef.current = null;
      }
      if (calibrationTimeoutRef.current) {
        clearTimeout(calibrationTimeoutRef.current);
        calibrationTimeoutRef.current = null;
      }
      showAlert(data?.message || 'Calibration failed. Please try again.', 'high');
    });
    
    // Listen for posture alerts from AI
    socketRef.current.on('posture-alert', (data: any) => {
      console.log('[Alert]', data.message, `[${data.severity}]`);
      showAlert(data.message, data.severity);
    });
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (calibrationTimerRef.current) clearInterval(calibrationTimerRef.current);
      if (calibrationTimeoutRef.current) clearTimeout(calibrationTimeoutRef.current);
      socketRef.current?.disconnect();
    };
  }, []);

  const handleStartCalibration = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    
    console.log('[Calibration] Starting 15-second baseline collection (100 samples)...');
    setIsCalibrating(true);
    setCalibrationCountdown(15);
    
    // Emit calibrate-start to the relay, which forwards to AI
    socketRef.current?.emit('calibrate-start');
    
    // Countdown timer
    calibrationTimerRef.current = setInterval(() => {
      setCalibrationCountdown((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          if (calibrationTimerRef.current) {
            clearInterval(calibrationTimerRef.current);
            calibrationTimerRef.current = null;
          }
        }
        return next;
      });
    }, 1000);

    // Failsafe: if AI never confirms calibration, unblock UI and show actionable error.
    calibrationTimeoutRef.current = setTimeout(() => {
      setIsCalibrating(false);
      if (calibrationTimerRef.current) {
        clearInterval(calibrationTimerRef.current);
        calibrationTimerRef.current = null;
      }
      showAlert('Calibration timed out. Check AI bridge connection and camera pose visibility.', 'high');
    }, 22000);
  };

  const handleStartSession = async () => {
    try {
      setSessionError(null);
      const session = await api.startSession();
      setSessionId(session.sessionId ?? session.id ?? null);
      setElapsedSeconds(0);
      setIsAnalyzing(true);
      timerRef.current = setInterval(() => setElapsedSeconds((c) => c + 1), 1000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to start session.';
      setSessionError(message);
      showAlert(`Could not start session: ${message}`, 'high');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  };

  const handleAiToggle = async () => {
    if (isAnalyzing) {
      // Stop session
      socketRef.current?.emit('session-stop');
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      try {
        if (sessionId) await api.endSession(sessionId);
      } catch (error) {
        setSessionError(error instanceof Error ? error.message : 'Unable to end session.');
      } finally {
        setIsAnalyzing(false);
        setSessionId(null);
      }
      return;
    }

    // Not analyzing -> start calibration
    if (!isCalibrating) {
      await handleStartCalibration();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.centerColumn}>
        <View style={styles.previewCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.eyebrow}>Camera</Text>
            <View
              style={[
                styles.connectionPill,
                { backgroundColor: connected ? '#dcfce7' : '#fee2e2' },
              ]}
            >
              <View
                style={[
                  styles.connectionDot,
                  { backgroundColor: connected ? brand.green : brand.red },
                ]}
              />
              <Text
                style={[
                  styles.connectionText,
                  { color: connected ? '#166534' : '#991b1b' },
                ]}
              >
                {connected ? 'Connected' : 'Disconnected'}
              </Text>
            </View>
          </View>

          <Text style={styles.title}>Scan posture</Text>

          <View
            style={[styles.feedContainer, { height: (screenWidth - 48) * 0.75 }]}
          >
            <WebView
              ref={webViewRef}
              source={{ html: feedHtml }}
              style={{ flex: 1 }}
              scrollEnabled={false}
              javaScriptEnabled={true}
              onMessage={(e) => console.log('[WebView]', e.nativeEvent.data)}
              onError={(e) => console.log('[WebView Error]', e)}
            />
          </View>
        </View>

        <View style={styles.controls}>
          <Text style={[styles.timerText, isAnalyzing && styles.timerActive]}>
            {isCalibrating ? `Calibrating: ${calibrationCountdown}s` : formatElapsed(elapsedSeconds)}
          </Text>

          <View style={styles.shutterStack}>
            <Pressable
              onPress={handleAiToggle}
              disabled={isCalibrating}
              style={({ pressed }) => [
                styles.shutterOuter,
                isAnalyzing && styles.shutterOuterActive,
                isCalibrating && styles.shutterOuterDisabled,
                pressed && !isCalibrating && styles.shutterPressed,
              ]}
            >
              <View
                style={[
                  styles.shutterRing,
                  isAnalyzing && styles.shutterRingActive,
                  isCalibrating && styles.shutterRingCalibrating,
                ]}
              >
                <View
                  style={[
                    styles.shutterInner,
                    isAnalyzing && styles.shutterInnerActive,
                  ]}
                />
              </View>
            </Pressable>

            <Text style={styles.aiButtonLabel}>
              {isCalibrating
                ? 'Calibrating...'
                : isAnalyzing
                ? 'Tap to stop'
                : 'Tap to start'}
            </Text>
          </View>

          {isAnalyzing && (
            <View style={styles.analyzingBadge}>
              <View style={styles.analyzingDot} />
              <Text style={styles.analyzingText}>AI posture scan running</Text>
            </View>
          )}
        </View>
      </View>

      {/* Alert Modal */}
      <Modal
        visible={alert.visible}
        transparent
        animationType="fade"
      >
        <View style={styles.alertOverlay}>
          <View
            style={[
              styles.alertBox,
              alert.severity === 'high' && styles.alertBoxHigh,
              alert.severity === 'success' && styles.alertBoxSuccess,
            ]}
          >
            <Text style={styles.alertText}>{alert.message}</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    gap: 20,
  },
  centerColumn: {
    alignItems: 'center',
    alignSelf: 'center',
    maxWidth: 390,
    width: '100%',
  },

  // ── Card ──
  previewCard: {
    backgroundColor: colors.bgCard,
    borderColor: colors.borderLight,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 4,
    width: '100%',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  eyebrow: {
    fontSize: fontSize.base,
    fontWeight: '500',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  connectionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  connectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  connectionText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  title: {
    fontSize: fontSize['3xl'],
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 14,
    lineHeight: 40,
  },
  feedContainer: {
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },

  // ── Controls ──
  controls: {
    alignItems: 'center',
    gap: 12,
    marginTop: 18,
  },
  timerText: {
    fontSize: fontSize['2xl'],
    fontWeight: '600',
    color: colors.textMuted,
    fontVariant: ['tabular-nums'] as any,
    letterSpacing: 1,
  },
  timerActive: {
    color: colors.textPrimary,
  },

  shutterStack: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  aiButtonLabel: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.textMuted,
    textAlign: 'center',
  },

  // ── Shutter button — light outer, white inner ──
  shutterOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f4f0e8',
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  shutterOuterActive: {
    backgroundColor: '#fff3f0',
    borderColor: '#f1b2a7',
  },
  shutterOuterDisabled: {
    backgroundColor: '#e8e8e8',
    opacity: 0.6,
  },
  shutterRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: '#d7d0c3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterRingActive: {
    borderColor: '#d94040',
  },
  shutterRingCalibrating: {
    borderColor: '#3b82f6',
    borderWidth: 3,
  },
  shutterInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#ffffff',   // white circle inside
  },
  shutterInnerActive: {
    width: 24,
    height: 24,
    borderRadius: 6,              // becomes a rounded square when recording (stop icon)
    backgroundColor: '#ffffff',
  },
  shutterPressed: {
    transform: [{ scale: 0.94 }],
  },

  // Analyzing badge
  analyzingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fdecea',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  analyzingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: brand.red,
  },
  analyzingText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: brand.red,
  },

  // Alert Modal
  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertBox: {
    maxWidth: '80%',
    backgroundColor: '#fef08a',
    borderRadius: radius.lg,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#eab308',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  alertBoxHigh: {
    backgroundColor: '#fee2e2',
    borderLeftColor: brand.red,
  },
  alertBoxSuccess: {
    backgroundColor: '#dcfce7',
    borderLeftColor: brand.green,
  },
  alertText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
});

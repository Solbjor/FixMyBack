import * as Haptics from 'expo-haptics';
import { StyleSheet, Text, View, Dimensions, Pressable, Vibration, Modal } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { WebView } from 'react-native-webview';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
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
      let frameCount = 0;
      window.setFrame = function(dataUrl) {
        try {
          frameCount++;
          document.getElementById('feed').src = dataUrl;
          document.getElementById('status').textContent = '✓ Frame ' + frameCount;
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
  const [calibrationCountdown, setCalibrationCountdown] = useState(15);
  const [poseStatus, setPoseStatus] = useState('idle');
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
  const buzzIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const soundModeRef = useRef<'off' | 'caution' | 'bad'>('off');
  const isAnalyzingRef = useRef(false);
  const sessionSummaryRef = useRef<any>(null);
  const screenWidth = Dimensions.get('window').width;
  const warningPlayer = useAudioPlayer(require('../../assets/warning.wav'));

  const syncIsAnalyzing = (value: boolean) => {
    isAnalyzingRef.current = value;
    setIsAnalyzing(value);
  };

  const showAlert = (message: string, severity: string = 'medium') => {
    setAlert({ visible: true, message, severity });
    setTimeout(() => {
      setAlert((current) => ({ ...current, visible: false }));
    }, 2500);
  };

  // ── Vibration helpers ────────────────────────────────────────────────────────

  const stopBuzz = () => {
    console.log('[CameraScreen] stopBuzz called');
    if (buzzIntervalRef.current) {
      clearInterval(buzzIntervalRef.current);
      buzzIntervalRef.current = null;
    }
    Vibration.cancel();
  };

  const stopWarningSound = async () => {
    soundModeRef.current = 'off';
    try {
      warningPlayer.pause();
    } catch {}
    try {
      warningPlayer.seekTo(0);
    } catch {}
  };

  const playWarningSound = async (mode: 'caution' | 'bad') => {
    if (soundModeRef.current === mode) {
      return;
    }

    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
      });
      warningPlayer.loop = true;
      warningPlayer.volume = mode === 'bad' ? 1 : 0.45;
      warningPlayer.seekTo(0);
      warningPlayer.play();
      soundModeRef.current = mode;
    } catch (error) {
      console.log('[WarningSound]', error);
    }
  };

  // Fire immediately then repeat every `intervalMs` using setInterval.
  // This avoids relying on Vibration's built-in repeat (unreliable on iOS).
  const startBuzz = (pattern: number[], intervalMs: number) => {
    console.log('[CameraScreen] startBuzz called', { pattern, intervalMs });
    stopBuzz(); // clear any previous buzz first

    // Fire immediately — no delay
    console.log('[CameraScreen] buzzing immediately');
    Vibration.vibrate(pattern);

    // Then repeat on our own schedule
    buzzIntervalRef.current = setInterval(() => {
      console.log('[CameraScreen] buzz tick');
      Vibration.vibrate(pattern);
    }, intervalMs);
  };

  // ── Cleanup on unmount ───────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopBuzz();
      soundModeRef.current = 'off';
      try {
        warningPlayer.pause();
      } catch {}
    };
  }, [warningPlayer]);

  const formatElapsed = (totalSeconds: number) => {
    const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const s = String(totalSeconds % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const getStatusLabel = (status: string) => {
    if (status === 'good')        return 'GOOD';
    if (status === 'caution')     return 'CAUTION';
    if (status === 'bad')         return 'BAD';
    if (status === 'no_pose')     return 'NO POSE';
    if (status === 'calibrating') return 'CALIBRATING';
    return 'WAITING';
  };

  const getStatusColors = (status: string) => {
    if (status === 'good')        return { bg: '#dcfce7', fg: '#166534' };
    if (status === 'caution')     return { bg: '#fef3c7', fg: '#92400e' };
    if (status === 'bad')         return { bg: '#fee2e2', fg: '#991b1b' };
    if (status === 'calibrating') return { bg: '#dbeafe', fg: '#1d4ed8' };
    return { bg: '#e5e7eb', fg: '#374151' };
  };

  useEffect(() => {
    socketRef.current = io(STREAM_URL);
    socketRef.current.on('connect',    () => setConnected(true));
    socketRef.current.on('disconnect', () => setConnected(false));

    socketRef.current.on('frame', (data: string) => {
      const escapedData = data.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      webViewRef.current?.injectJavaScript(`window.setFrame('${escapedData}'); true;`);
    });

    socketRef.current.on('posture-update', (payload: any) => {
      console.log('[CameraScreen] posture-update payload', payload);
      let nextStatus = 'idle';
      if (payload?.calibrating)  nextStatus = 'calibrating';
      else if (payload?.status)  nextStatus = payload.status;

      if (nextStatus === 'bad') {
        console.log('[CameraScreen] payload.status is BAD, starting alert');
        startBuzz([0, 300, 150, 300], 1200);
        void playWarningSound('bad');
      } else if (nextStatus === 'caution') {
        console.log('[CameraScreen] payload.status is CAUTION, starting alert');
        startBuzz([0, 180], 2200);
        void playWarningSound('caution');
      } else {
        console.log('[CameraScreen] payload.status does not require alert', nextStatus);
        stopBuzz();
        void stopWarningSound();
      }

      console.log('[CameraScreen] setting poseStatus', nextStatus);
      setPoseStatus(nextStatus);
    });

    socketRef.current.on('calibration-complete', (payload: any) => {
      if (calibrationTimerRef.current) {
        clearInterval(calibrationTimerRef.current);
        calibrationTimerRef.current = null;
      }
      if (calibrationTimeoutRef.current) {
        clearTimeout(calibrationTimeoutRef.current);
        calibrationTimeoutRef.current = null;
      }
      setIsCalibrating(false);
      setCalibrationCountdown(15);
      setPoseStatus('idle');
      showAlert(payload?.message || 'Calibration complete.', 'success');
      void handleStartSession();
    });

    socketRef.current.on('calibration-failed', (payload: any) => {
      if (calibrationTimerRef.current) {
        clearInterval(calibrationTimerRef.current);
        calibrationTimerRef.current = null;
      }
      if (calibrationTimeoutRef.current) {
        clearTimeout(calibrationTimeoutRef.current);
        calibrationTimeoutRef.current = null;
      }
      setIsCalibrating(false);
      setCalibrationCountdown(15);
      setPoseStatus('idle');
      showAlert(payload?.message || 'Calibration failed.', 'high');
    });

    socketRef.current.on('session-summary', (payload: any) => {
      sessionSummaryRef.current = payload;
    });

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (calibrationTimerRef.current) clearInterval(calibrationTimerRef.current);
      if (calibrationTimeoutRef.current) clearTimeout(calibrationTimeoutRef.current);
      stopBuzz();
      void stopWarningSound();
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

    calibrationTimeoutRef.current = setTimeout(async () => {
      if (calibrationTimerRef.current) {
        clearInterval(calibrationTimerRef.current);
        calibrationTimerRef.current = null;
      }
      setIsCalibrating(false);
      setCalibrationCountdown(15);

      if (isAnalyzingRef.current) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        stopBuzz();
        void stopWarningSound();
        try {
          if (sessionId) await api.endSession(sessionId);
        } catch (error) {
          setSessionError(error instanceof Error ? error.message : 'Unable to end session.');
        } finally {
          syncIsAnalyzing(false);
          setSessionId(null);
          setPoseStatus('idle');
        }
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
      setPoseStatus('idle');
      syncIsAnalyzing(true);
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
      // Stop session — emit stop signal and wait briefly for AI summary
      socketRef.current?.emit('session-stop');
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // Wait up to 2.5s for the AI to emit session-summary before saving
      const capturedSessionId = sessionId;
      const capturedElapsed = elapsedSeconds;
      setIsAnalyzing(false);
      setSessionId(null);

      setTimeout(async () => {
        try {
          if (capturedSessionId) {
            const summary = sessionSummaryRef.current;
            const overallScore = summary?.overallScore;
            const feedbackSummary = overallScore !== undefined
              ? `Session score: ${overallScore.toFixed(1)}% over ${capturedElapsed}s`
              : undefined;
            await api.endSession(capturedSessionId, overallScore, feedbackSummary);
            console.log('[Session] Ended with score:', overallScore, 'duration:', capturedElapsed);
          }
        } catch (error) {
          setSessionError(error instanceof Error ? error.message : 'Unable to end session.');
        } finally {
          sessionSummaryRef.current = null;
        }
      }, 2500);
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
            <View style={[styles.connectionPill, { backgroundColor: connected ? '#dcfce7' : '#fee2e2' }]}>
              <View style={[styles.connectionDot, { backgroundColor: connected ? brand.green : brand.red }]} />
              <Text style={[styles.connectionText, { color: connected ? '#166534' : '#991b1b' }]}>
                {connected ? 'Connected' : 'Disconnected'}
              </Text>
            </View>
          </View>

          <Text style={styles.title}>Scan posture</Text>

          <View style={[styles.feedContainer, { height: (screenWidth - 48) * 0.75 }]}>
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

          <View style={[styles.statusBadge, { backgroundColor: getStatusColors(poseStatus).bg }]}>
            <Text style={[styles.statusBadgeText, { color: getStatusColors(poseStatus).fg }]}>
              {getStatusLabel(poseStatus)}
            </Text>
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
              <View style={[styles.shutterRing, isAnalyzing && styles.shutterRingActive]}>
                <View style={[styles.shutterInner, isAnalyzing && styles.shutterInnerActive]} />
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

          {sessionError ? <Text style={styles.sessionError}>{sessionError}</Text> : null}
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
  connectionDot: { width: 6, height: 6, borderRadius: 3 },
  connectionText: { fontSize: fontSize.xs, fontWeight: '600' },
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
  statusBadge: {
    alignSelf: 'center',
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  statusBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
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
  timerActive: { color: colors.textPrimary },
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
  shutterOuterActive: { backgroundColor: '#fff3f0', borderColor: '#f1b2a7' },
  shutterOuterDisabled: {
    opacity: 0.55,
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
  shutterRingActive: { borderColor: '#d94040' },
  shutterInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#ffffff',
  },
  shutterInnerActive: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#ffffff',
  },
  shutterPressed: { transform: [{ scale: 0.94 }] },
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
  sessionError: {
    color: colors.alertError,
    fontSize: fontSize.xs,
    textAlign: 'center',
  },
  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.32)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  alertBox: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#fff7ed',
    borderColor: '#fdba74',
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  alertBoxHigh: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
  },
  alertBoxSuccess: {
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
  },
  alertText: {
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    fontWeight: '600',
    textAlign: 'center',
  },
});

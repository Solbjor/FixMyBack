import { StyleSheet, Text, View, Dimensions } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { WebView } from 'react-native-webview';
import { SERVER_URL } from '../config';

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
          console.log('Frame set:', frameCount, dataUrl.substring(0, 50) + '...');
        } catch (e) {
          document.getElementById('status').textContent = 'Error: ' + e.message;
          console.error('Error setting frame:', e);
        }
      };
      console.log('setFrame function ready');
    </script>
  </body>
  </html>
`;

export default function CameraScreen() {
  const [connected, setConnected] = useState(false);
  const webViewRef = useRef<WebView>(null);
  const socketRef = useRef<any>(null);
  const screenWidth = Dimensions.get('window').width;

  useEffect(() => {
    // Create socket connection inside useEffect
    socketRef.current = io(SERVER_URL);

    socketRef.current.on('connect', () => {
      console.log('[CameraScreen] Connected to relay');
      setConnected(true);
    });

    socketRef.current.on('disconnect', () => {
      console.log('[CameraScreen] Disconnected from relay');
      setConnected(false);
    });

    socketRef.current.on('frame', (data: string) => {
      // Proper escaping for WebView injection
      const escapedData = data.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      const js = `window.setFrame('${escapedData}'); true;`;
      console.log('[CameraScreen] Injecting frame, size:', data.length);
      webViewRef.current?.injectJavaScript(js);
    });

    socketRef.current.on('error', (error: any) => {
      console.log('[CameraScreen] Socket error:', error);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.previewCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.eyebrow}>Camera</Text>
          <Text style={[styles.connectionBadge, {color:connected ? '#22c55e' : "#ef4444" }]}>
            {connected ? 'Connected' : 'Disconnected'}
          </Text>
        </View>
        <Text style={styles.title}>Scan posture</Text>
        <View style={[styles.feedContainer, { height: (screenWidth - 48) * 0.75 }]}>
          <WebView
            ref={webViewRef}
            source={{html:feedHtml}}
            style={{flex : 1}}
            scrollEnabled={false}
            javaScriptEnabled={true}
            onMessage={(event) => console.log('[WebView Message]', event.nativeEvent.data)}
            onError={(error) => console.log('[WebView Error]', error)}
          />
        </View>

        <Text style={styles.body}>
          Use this center tab for posture photos, movement capture, or guided
          assessments.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  previewCard: {
    backgroundColor: '#ffffff',
    borderColor: '#ddd6c8',
    borderRadius: 28,
    borderWidth: 1,
    padding: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  eyebrow: {
    color: '#7a7466',
    fontSize: 15,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  connectionBadge: {
    fontSize: 13,
    fontWeight: '600',
  },
  title: {
    color: '#111111',
    fontSize: 34,
    fontWeight: '700',
    marginBottom: 12,
  },
  feedContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#222',
    marginBottom: 16,
  },
  body: {
    color: '#3f3a31',
    fontSize: 17,
    lineHeight: 26,
  },
});

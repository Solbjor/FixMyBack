import { StyleSheet, Text, View, Dimensions } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { WebView } from 'react-native-webview';
import { SERVER_URL } from '../config';

const socket = io(SERVER_URL);

const feedHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      * { margin: 0; padding: 0; }
      body { background: #222; width: 100vw; height: 100vh; overflow: hidden; }
      img { width: 100%; height: 100%; object-fit: cover; }
    </style>
  </head>
  <body>
    <img id="feed" />
  </body>
  </html>
`;

export default function CameraScreen() {
  const [connected, setConnected] = useState(false);
  const webViewRef = useRef<WebView>(null);
  const screenWidth = Dimensions.get('window').width;

  useEffect(() => {
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('frame', (data: string) => {
      webViewRef.current?.injectJavaScript(`
        document.getElementById('feed').src = '${data}'; true;
      `);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('frame');
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

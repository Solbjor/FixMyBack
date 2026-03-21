import { StyleSheet, Text, View } from 'react-native';

export default function CameraScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.previewCard}>
        <Text style={styles.eyebrow}>Camera</Text>
        <Text style={styles.title}>Scan posture</Text>
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
    minHeight: 240,
    padding: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
  },
  eyebrow: {
    color: '#7a7466',
    fontSize: 15,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  title: {
    color: '#111111',
    fontSize: 34,
    fontWeight: '700',
    marginBottom: 12,
  },
  body: {
    color: '#3f3a31',
    fontSize: 17,
    lineHeight: 26,
  },
});

import { StyleSheet, Text, View } from 'react-native';

export default function ProfileScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>Profile</Text>
      <Text style={styles.title}>Your account</Text>
      <Text style={styles.body}>
        This tab can hold profile details, history, notifications, and app
        settings.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
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

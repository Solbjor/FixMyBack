import { Pressable, StyleSheet, Text, View } from 'react-native';

interface ProfileScreenProps {
  email?: string;
  onLogout?: () => void;
}

export default function ProfileScreen({
  email,
  onLogout,
}: ProfileScreenProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>Profile</Text>
      <Text style={styles.title}>Your account</Text>
      <Text style={styles.body}>
        This tab can hold profile details, history, notifications, and app
        settings.
      </Text>
      {email ? <Text style={styles.meta}>Signed in as {email}</Text> : null}
      {onLogout ? (
        <Pressable onPress={onLogout} style={styles.button}>
          <Text style={styles.buttonText}>Log out</Text>
        </Pressable>
      ) : null}
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
    marginBottom: 18,
  },
  meta: {
    color: '#7a7466',
    fontSize: 14,
    marginBottom: 18,
  },
  button: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#111111',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 18,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
});

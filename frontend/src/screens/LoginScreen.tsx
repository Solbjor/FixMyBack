import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { brand, colors, fontSize, radius } from '../../constants/theme';

interface LoginScreenProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onSignup: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<void>;
}

type AuthMode = 'login' | 'signup';

export default function LoginScreen({
  onLogin,
  onSignup,
}: LoginScreenProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setError(
        mode === 'login'
          ? 'Enter your email and password.'
          : 'Fill in every field to create your account.',
      );
      return;
    }
    if (mode === 'signup' && !displayName.trim()) {
      setError('Add your name to create an account.');
      return;
    }

    setLoading(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    try {
      if (mode === 'login') {
        await onLogin(email.trim(), password);
      } else {
        await onSignup(email.trim(), password, displayName.trim());
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : mode === 'login'
            ? 'Login failed'
            : 'Sign up failed',
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => {},
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.screen}>
          <View style={styles.hero}>
            <Text style={styles.eyebrow}>FixMyBack</Text>
            <Text style={styles.title}>
              {mode === 'login' ? 'Login to continue' : 'Create your account'}
            </Text>
            <Text style={styles.subtitle}>
              {mode === 'login'
                ? 'Sign in to open your recovery dashboard, posture camera, and alerts.'
                : 'Sign up to start tracking your posture, sessions, and recovery progress.'}
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.segmentedShell}>
              <Pressable
                onPress={() => {
                  setMode('login');
                  setError(null);
                }}
                style={[
                  styles.segment,
                  mode === 'login' && styles.segmentActive,
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    mode === 'login' && styles.segmentTextActive,
                  ]}
                >
                  Log In
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setMode('signup');
                  setError(null);
                }}
                style={[
                  styles.segment,
                  mode === 'signup' && styles.segmentActive,
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    mode === 'signup' && styles.segmentTextActive,
                  ]}
                >
                  Sign Up
                </Text>
              </Pressable>
            </View>

            {mode === 'signup' ? (
              <>
                <Text style={styles.label}>Name</Text>
                <TextInput
                  autoCapitalize="words"
                  onChangeText={setDisplayName}
                  placeholder="Andrew"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                  value={displayName}
                />
              </>
            ) : null}

            <Text style={styles.label}>Email</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              value={email}
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              autoCapitalize="none"
              onChangeText={setPassword}
              placeholder="Enter password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              style={styles.input}
              value={password}
            />

            {error && <Text style={styles.error}>{error}</Text>}

            <Pressable
              disabled={loading}
              onPress={handleSubmit}
              style={({ pressed }) => [
                styles.button,
                pressed && !loading && styles.buttonPressed,
                loading && styles.buttonDisabled,
              ]}
            >
              {loading ? (
                <ActivityIndicator color={colors.textOnDark} />
              ) : (
                <Text style={styles.buttonText}>
                  {mode === 'login' ? 'Log In' : 'Create Account'}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bgPage,
  },
  screen: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  hero: {
    marginBottom: 26,
  },
  eyebrow: {
    color: colors.textMuted,
    fontSize: fontSize.base,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.textPrimary,
    fontSize: 36,
    fontWeight: '700',
    marginBottom: 10,
  },
  subtitle: {
    color: colors.textBody,
    fontSize: fontSize.lg,
    lineHeight: 26,
    maxWidth: 320,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderColor: colors.borderLight,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 22,
  },
  segmentedShell: {
    backgroundColor: '#e5e3df',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
    padding: 4,
  },
  segment: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
    minHeight: 34,
  },
  segmentActive: {
    backgroundColor: brand.orange,
  },
  segmentText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: colors.textOnDark,
  },
  label: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: colors.bgSubtle,
    borderColor: colors.borderLight,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.textPrimary,
    fontSize: fontSize.md,
    marginBottom: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  error: {
    color: brand.red,
    fontSize: fontSize.sm,
    marginBottom: 14,
  },
  button: {
    alignItems: 'center',
    backgroundColor: brand.orange,
    borderRadius: radius.full,
    justifyContent: 'center',
    minHeight: 52,
    marginTop: 6,
  },
  buttonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: colors.textOnDark,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
});

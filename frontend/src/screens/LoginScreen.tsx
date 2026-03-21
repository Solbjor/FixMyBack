import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  LayoutChangeEvent,
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
  const [segmentWidth, setSegmentWidth] = useState(0);
  const toggleAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(toggleAnim, {
      toValue: mode === 'login' ? 0 : 1,
      useNativeDriver: true,
      tension: 130,
      friction: 12,
    }).start();
  }, [mode, toggleAnim]);

  const switchMode = (nextMode: AuthMode) => {
    if (nextMode === mode || loading) {
      return;
    }

    Keyboard.dismiss();
    setError(null);

    Animated.timing(contentAnim, {
      toValue: 0,
      duration: 110,
      useNativeDriver: true,
    }).start(() => {
      setMode(nextMode);
      Animated.timing(contentAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
    });
  };

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

  const handleSegmentLayout = (event: LayoutChangeEvent) => {
    setSegmentWidth(event.nativeEvent.layout.width);
  };

  const highlightWidth = segmentWidth > 0 ? (segmentWidth - 8) / 2 : 0;
  const highlightTravel = highlightWidth;

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
            <View onLayout={handleSegmentLayout} style={styles.segmentedShell}>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.segmentHighlight,
                  segmentWidth > 0 && { width: highlightWidth },
                  {
                    transform: [
                      {
                        translateX: toggleAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, highlightTravel],
                        }),
                      },
                    ],
                  },
                ]}
              />
              <Pressable
                onPress={() => switchMode('login')}
                style={styles.segment}
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
                onPress={() => switchMode('signup')}
                style={styles.segment}
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

            <Animated.View
              style={[
                styles.formWrap,
                {
                  opacity: contentAnim,
                  transform: [
                    {
                      translateY: contentAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [10, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
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
            </Animated.View>
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
    marginBottom: 18,
    overflow: 'hidden',
    padding: 4,
    position: 'relative',
  },
  segmentHighlight: {
    backgroundColor: brand.orange,
    borderRadius: 8,
    bottom: 4,
    left: 4,
    position: 'absolute',
    top: 4,
  },
  segment: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
    minHeight: 34,
    zIndex: 1,
  },
  segmentText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: colors.textOnDark,
  },
  formWrap: {
    minHeight: 278,
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

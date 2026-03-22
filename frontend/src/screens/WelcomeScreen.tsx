import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { brand, colors, fontSize, radius } from '../../constants/theme';

interface WelcomeScreenProps {
  email: string;
  displayName?: string;
  onContinue: () => void;
  onLogout: () => void;
}

export default function WelcomeScreen({
  email,
  displayName,
  onContinue,
  onLogout,
}: WelcomeScreenProps) {
  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.screen}>
        <View style={styles.orbLarge} />
        <View style={styles.orbSmall} />

        <Text style={styles.eyebrow}>Welcome</Text>
        <Text style={styles.title}>
          {displayName ? `You’re in, ${displayName}.` : 'You’re in.'}
        </Text>
        <Text style={styles.subtitle}>
          Signed in as {email}. Head into the app when you&apos;re ready.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>What&apos;s next</Text>
          <Text style={styles.cardBody}>
            Track your posture, open the live camera tab, and check alerts from
            the home dashboard.
          </Text>
        </View>

        <Pressable
          onPress={() => {
            Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success,
            ).catch(() => {});
            onContinue();
          }}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.primaryButtonPressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>Continue to app</Text>
        </Pressable>

        <Pressable
          onPress={onLogout}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.secondaryButtonPressed,
          ]}
        >
          <Text style={styles.secondaryButtonText}>Back to login</Text>
        </Pressable>
      </View>
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
    overflow: 'hidden',
    paddingHorizontal: 24,
  },
  orbLarge: {
    backgroundColor: brand.orange,
    borderRadius: radius.full,
    height: 180,
    opacity: 0.18,
    position: 'absolute',
    right: -60,
    top: 70,
    width: 180,
  },
  orbSmall: {
    backgroundColor: brand.yellow,
    borderRadius: radius.full,
    height: 56,
    left: 26,
    opacity: 0.55,
    position: 'absolute',
    top: 150,
    width: 56,
  },
  eyebrow: {
    color: colors.textMuted,
    fontSize: fontSize.base,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.textPrimary,
    fontSize: 40,
    fontWeight: '700',
    marginBottom: 12,
  },
  subtitle: {
    color: colors.textBody,
    fontSize: fontSize.lg,
    lineHeight: 27,
    marginBottom: 22,
    maxWidth: 320,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderColor: colors.borderLight,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: 24,
    padding: 22,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.xl,
    fontWeight: '700',
    marginBottom: 10,
  },
  cardBody: {
    color: colors.textBody,
    fontSize: fontSize.md,
    lineHeight: 24,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: brand.orange,
    borderRadius: radius.full,
    justifyContent: 'center',
    minHeight: 54,
    marginBottom: 12,
  },
  primaryButtonPressed: {
    opacity: 0.9,
  },
  primaryButtonText: {
    color: colors.textOnDark,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: colors.borderLight,
    borderRadius: radius.full,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
  },
  secondaryButtonPressed: {
    opacity: 0.72,
  },
  secondaryButtonText: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
});

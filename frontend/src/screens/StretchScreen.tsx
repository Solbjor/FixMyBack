import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import YoutubePlayer from 'react-native-youtube-iframe';
import Svg, { Polyline } from 'react-native-svg';
import { colors, fontSize, radius } from '../../constants/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StretchExercise {
  title: string;
  duration: string;
  steps: string[];
  videoId: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const STRETCHES: StretchExercise[] = [
  {
    title: 'Thoracic Extension over Chair',
    duration: '3 × 10–15 sec hold',
    videoId: 'kCoTeRB8c-g',
    steps: [
      'Sit upright in a chair with your feet flat on the floor.',
      'Clasp your hands behind your head, elbows wide.',
      'Gently arch your upper back over the top edge of the chair backrest.',
      'Hold for 10–15 seconds, then slowly return upright.',
      'Repeat 3 times, moving up or down the chair to target different segments.',
    ],
  },
  {
    title: 'Thread the Needle',
    duration: '3 × 20–30 sec each side',
    videoId: '7C8-zj3nRro',
    steps: [
      'Start on all fours — wrists under shoulders, knees under hips.',
      'Inhale to prepare. On the exhale, slide your right arm underneath your body to the left.',
      'Let your right shoulder and ear drop toward the floor.',
      'Keep your left arm straight for support, hips level.',
      'Hold 20–30 seconds, then return and repeat on the other side.',
    ],
  },
  {
    title: "Child's Pose with Extended Arms",
    duration: '1 × 30–60 sec',
    videoId: 'b28CkrCUUj8',
    steps: [
      'Kneel on the floor and sit back toward your heels.',
      'Walk your hands as far forward as possible, letting your chest drop.',
      'Keep your arms straight and reach actively through your fingertips.',
      'Breathe deeply — feel your upper back expand with each inhale.',
      'Hold for 30–60 seconds, then slowly walk your hands back in.',
    ],
  },
];

const VIDEO_WIDTH = Dimensions.get('window').width - 44;
const VIDEO_HEIGHT = Math.round(VIDEO_WIDTH * 9 / 16);

// ─── Sub-components ───────────────────────────────────────────────────────────

function ChevronLeft() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Polyline
        points="13,4 7,10 13,16"
        stroke={colors.textPrimary}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

function ExerciseCard({ exercise, index }: { exercise: StretchExercise; index: number }) {
  return (
    <View style={styles.card}>
      {/* Card header */}
      <View style={styles.cardHeader}>
        <View style={styles.indexBadge}>
          <Text style={styles.indexBadgeText}>{index + 1}</Text>
        </View>
        <View style={styles.cardTitleBlock}>
          <Text style={styles.cardTitle}>{exercise.title}</Text>
          <Text style={styles.cardDuration}>{exercise.duration}</Text>
        </View>
      </View>

      {/* Inline YouTube player */}
      <YoutubePlayer
        height={VIDEO_HEIGHT}
        width={VIDEO_WIDTH}
        videoId={exercise.videoId}
        play={false}
        webViewStyle={styles.webview}
      />

      {/* Steps */}
      <View style={styles.stepsList}>
        {exercise.steps.map((step, i) => (
          <View key={i} style={styles.stepRow}>
            <View style={styles.stepDot} />
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

interface StretchScreenProps {
  onBack: () => void;
}

export default function StretchScreen({ onBack }: StretchScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
          <ChevronLeft />
        </TouchableOpacity>
        <View style={styles.headerTextBlock}>
          <Text style={styles.headerEyebrow}>Today's stretch</Text>
          <Text style={styles.headerTitle}>Upper Back</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {STRETCHES.map((exercise, index) => (
          <ExerciseCard key={exercise.videoId} exercise={exercise} index={index} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bgPage,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  headerTextBlock: {
    flex: 1,
  },
  headerEyebrow: {
    fontSize: fontSize.xs,
    fontWeight: '500',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  // Scroll
  scroll: {
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 40,
    gap: 20,
  },

  // Cards
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  indexBadge: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.bgDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexBadgeText: {
    color: colors.textOnDark,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  cardTitleBlock: {
    flex: 1,
  },
  cardTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  cardDuration: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },

  // Video
  webview: {
    borderRadius: 0,
    marginBottom: -4,
  },

  // Steps
  stepsList: {
    padding: 16,
    paddingTop: 14,
    gap: 10,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  stepDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.bgDark,
    marginTop: 6,
    flexShrink: 0,
  },
  stepText: {
    flex: 1,
    fontSize: fontSize.base,
    color: colors.textBody,
    lineHeight: 20,
  },
});

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import Svg, { Circle, Polyline, Path, Line } from 'react-native-svg';
import { colors, fontSize, radius } from '../../constants/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

type DayStatus = 'complete' | 'pending' | 'today';

interface WeekDay {
  label: string;
  status: DayStatus;
}

interface Alert {
  id: string;
  message: string;
  time: string;
  severity: 'error' | 'warning';
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const WEEK_DAYS: WeekDay[] = [
  { label: 'Mon', status: 'complete' },
  { label: 'Tue', status: 'complete' },
  { label: 'Wed', status: 'today' },
  { label: 'Thu', status: 'pending' },
  { label: 'Fri', status: 'pending' },
  { label: 'Sat', status: 'pending' },
  { label: 'Sun', status: 'pending' },
];

const ALERTS: Alert[] = [
  { id: '1', message: 'Slouch detected', time: '10:42 AM', severity: 'error' },
  { id: '2', message: 'Stretch due',     time: '2:00 PM',  severity: 'warning' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function WeekDot({ day }: { day: WeekDay }) {
  const isComplete = day.status === 'complete';
  const isToday    = day.status === 'today';

  return (
    <View style={styles.dayCol}>
      <View
        style={[
          styles.dayDot,
          isComplete && styles.dayDotComplete,
          isToday    && styles.dayDotToday,
        ]}
      >
        {isComplete ? (
          <Svg width={14} height={14} viewBox="0 0 14 14">
            <Polyline
              points="2,7 5.5,10.5 12,3"
              stroke={colors.textOnDark}
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
          </Svg>
        ) : (
          <Text style={[styles.dayDotLabel, isToday && styles.dayDotLabelToday]}>
            {day.label[0]}
          </Text>
        )}
      </View>
      <Text style={styles.dayLabel}>{day.label}</Text>
    </View>
  );
}

function PostureRing() {
  const RADIUS        = 26;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const PROGRESS      = 0.8;
  const DASH          = CIRCUMFERENCE * PROGRESS;

  return (
    <View style={styles.ringWrapper}>
      <Svg width={68} height={68} viewBox="0 0 68 68">
        {/* Track */}
        <Circle
          cx="34" cy="34" r={RADIUS}
          fill="none"
          stroke={colors.borderLight}
          strokeWidth="5"
        />
        {/* Progress */}
        <Circle
          cx="34" cy="34" r={RADIUS}
          fill="none"
          stroke={colors.success}
          strokeWidth="5"
          strokeDasharray={`${DASH} ${CIRCUMFERENCE}`}
          strokeDashoffset={0}
          strokeLinecap="round"
          rotation="-90"
          origin="34,34"
        />
      </Svg>
      <View style={styles.ringIcon}>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 2C8 2 5 5.5 5 9c0 5 7 13 7 13s7-8 7-13c0-3.5-3-7-7-7z"
            stroke={colors.success}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <Circle cx="12" cy="9" r="2.5" fill={colors.success} />
        </Svg>
      </View>
    </View>
  );
}

function AlertItem({ alert }: { alert: Alert }) {
  const dotColor =
    alert.severity === 'error' ? colors.alertError : colors.alertWarning;
  return (
    <View style={styles.alertItem}>
      <View style={[styles.alertDot, { backgroundColor: dotColor }]} />
      <View style={styles.alertTextWrap}>
        <Text style={styles.alertMessage}>{alert.message}</Text>
        <Text style={styles.alertTime}>{alert.time}</Text>
      </View>
    </View>
  );
}

function ChevronRight() {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14">
      <Polyline
        points="4,2 10,7 4,12"
        stroke={colors.textOnDark}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.eyebrow}>Home</Text>
          <Text style={styles.title}>Track your{'\n'}posture!!</Text>

          {/* ── Main card ── */}
          <View style={styles.card}>

            {/* Welcome row */}
            <View style={styles.welcomeRow}>
              <View>
                <Text style={styles.welcomeLabel}>Welcome back</Text>
                <Text style={styles.welcomeName}>Andrew</Text>
              </View>
              <View style={styles.weekBadge}>
                <Text style={styles.weekBadgeLabel}>WEEK</Text>
                <Text style={styles.weekBadgeNumber}>02</Text>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Week tracker */}
            <Text style={styles.sectionLabel}>This week</Text>
            <View style={styles.weekRow}>
              {WEEK_DAYS.map((day) => (
                <WeekDot key={day.label} day={day} />
              ))}
            </View>

            <View style={styles.divider} />

            {/* Stats row */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <PostureRing />
                <Text style={styles.statLabel}>Posture</Text>
                <Text style={styles.statValue}>Good</Text>
              </View>

              <View style={[styles.statCard, styles.alertsCard]}>
                <Text style={styles.sectionLabel}>Alerts</Text>
                <View style={styles.alertsList}>
                  {ALERTS.map((alert) => (
                    <AlertItem key={alert.id} alert={alert} />
                  ))}
                </View>
              </View>
            </View>

          </View>

          {/* ── CTA pill ── */}
          <TouchableOpacity style={styles.ctaPill} activeOpacity={0.85}>
            <View>
              <Text style={styles.ctaLabel}>Today's stretch</Text>
              <Text style={styles.ctaTitle}>Upper back — 3 exercises</Text>
            </View>
            <View style={styles.ctaArrow}>
              <ChevronRight />
            </View>
          </TouchableOpacity>

        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bgPage },
  screen: { flex: 1, backgroundColor: colors.bgPage },
  scroll: {
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 110,
  },

  eyebrow: {
    fontSize: fontSize.base,
    fontWeight: '500',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
    marginTop: 8,
  },
  title: {
    fontSize: fontSize['3xl'],
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 40,
    marginBottom: 20,
  },

  card: {
    backgroundColor: colors.bgCard,
    borderColor: colors.borderLight,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 22,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 4,
  },

  welcomeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  welcomeLabel: {
    fontSize: fontSize.base,
    color: colors.textMuted,
    fontWeight: '500',
    marginBottom: 2,
  },
  welcomeName: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  weekBadge: {
    alignItems: 'flex-end',
  },
  weekBadgeLabel: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 0.8,
  },
  weekBadgeNumber: {
    fontSize: fontSize['2xl'],
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 28,
  },

  divider: {
    height: 1,
    backgroundColor: colors.borderSubtle,
    marginBottom: 18,
  },

  sectionLabel: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },

  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  dayCol: {
    alignItems: 'center',
    gap: 6,
  },
  dayDot: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: colors.bgPage,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayDotComplete: {
    backgroundColor: colors.successDot,
    borderColor: colors.successDot,
  },
  dayDotToday: {
    backgroundColor: colors.bgPage,
    borderColor: colors.success,
    borderWidth: 2,
  },
  dayDotLabel: {
    fontSize: fontSize.xs,
    fontWeight: '500',
    color: colors.textBody,
  },
  dayDotLabelToday: {
    color: colors.success,
    fontWeight: '700',
  },
  dayLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontWeight: '500',
  },

  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.bgSubtle,
    borderRadius: radius.md,
    padding: 16,
    alignItems: 'center',
  },
  alertsCard: {
    alignItems: 'flex-start',
  },
  statLabel: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginTop: 8,
    marginBottom: 2,
  },
  statValue: {
    fontSize: fontSize.lg - 1,
    fontWeight: '700',
    color: colors.success,
  },

  ringWrapper: {
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringIcon: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },

  alertsList: {
    gap: 8,
    width: '100%',
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: radius.sm,
    padding: 8,
    gap: 8,
  },
  alertDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
  },
  alertTextWrap: {
    flex: 1,
  },
  alertMessage: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.textBody,
    lineHeight: 16,
    flexShrink: 1,
  },
  alertTime: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontWeight: '400',
  },

  ctaPill: {
    backgroundColor: colors.bgDark,
    borderRadius: radius.md,
    padding: 16,
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ctaLabel: {
    fontSize: fontSize.sm,
    color: colors.textOnDarkDim,
    fontWeight: '500',
    marginBottom: 2,
  },
  ctaTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textOnDark,
  },
  ctaArrow: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

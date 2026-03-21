import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, {
  Rect,
  Line,
  Path,
  Circle,
  G,
  Text as SvgText,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';
import { colors, fontSize, radius, brand } from '../../constants/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DayData {
  day: string;
  posture: number;   // 0–100 score
  errors: number;    // count of posture errors
  warnings: number;  // count of warnings
}

interface ErrorEvent {
  time: string;
  type: 'error' | 'warning';
  message: string;
}

interface ProfileScreenProps {
  email?: string;
  onLogout?: () => void;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const WEEK_DATA: DayData[] = [
  { day: 'Mon', posture: 82, errors: 1, warnings: 2 },
  { day: 'Tue', posture: 74, errors: 3, warnings: 1 },
  { day: 'Wed', posture: 91, errors: 0, warnings: 1 },
  { day: 'Thu', posture: 68, errors: 4, warnings: 3 },
  { day: 'Fri', posture: 85, errors: 1, warnings: 2 },
  { day: 'Sat', posture: 78, errors: 2, warnings: 1 },
  { day: 'Sun', posture: 88, errors: 0, warnings: 0 },
];

const ERROR_LOG: { day: string; events: ErrorEvent[] }[] = [
  {
    day: 'Thursday',
    events: [
      { time: '9:14 AM',  type: 'error',   message: 'Severe slouch detected' },
      { time: '11:02 AM', type: 'warning', message: 'Head forward posture' },
      { time: '1:30 PM',  type: 'error',   message: 'Severe slouch detected' },
      { time: '2:45 PM',  type: 'warning', message: 'Rounded shoulders' },
      { time: '4:10 PM',  type: 'error',   message: 'Severe slouch detected' },
      { time: '5:22 PM',  type: 'error',   message: 'Neck strain position' },
    ],
  },
  {
    day: 'Tuesday',
    events: [
      { time: '10:05 AM', type: 'error',   message: 'Severe slouch detected' },
      { time: '12:18 PM', type: 'error',   message: 'Neck strain position' },
      { time: '3:40 PM',  type: 'error',   message: 'Severe slouch detected' },
      { time: '4:55 PM',  type: 'warning', message: 'Rounded shoulders' },
    ],
  },
  {
    day: 'Monday',
    events: [
      { time: '2:10 PM',  type: 'error',   message: 'Severe slouch detected' },
      { time: '4:30 PM',  type: 'warning', message: 'Head forward posture' },
      { time: '5:45 PM',  type: 'warning', message: 'Rounded shoulders' },
    ],
  },
];

// ─── Bar Chart ────────────────────────────────────────────────────────────────

const CHART_WIDTH  = 320;
const CHART_HEIGHT = 140;
const BAR_WIDTH    = 28;
const CHART_PAD    = 16;

function BarChart() {
  const usableWidth  = CHART_WIDTH - CHART_PAD * 2;
  const usableHeight = CHART_HEIGHT - 24; // reserve 24px for day labels
  const spacing      = usableWidth / WEEK_DATA.length;

  return (
    <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
      <Defs>
        <LinearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0"   stopColor={brand.teal}  stopOpacity="1" />
          <Stop offset="1"   stopColor={brand.teal}  stopOpacity="0.4" />
        </LinearGradient>
        <LinearGradient id="barGradWeak" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0"   stopColor={brand.red}   stopOpacity="0.7" />
          <Stop offset="1"   stopColor={brand.red}   stopOpacity="0.2" />
        </LinearGradient>
      </Defs>

      {/* Horizontal guide lines */}
      {[25, 50, 75, 100].map((v) => {
        const y = usableHeight - (v / 100) * usableHeight;
        return (
          <Line
            key={v}
            x1={CHART_PAD}
            y1={y}
            x2={CHART_WIDTH - CHART_PAD}
            y2={y}
            stroke="#ddd6c8"
            strokeWidth="1"
            strokeDasharray="3,4"
          />
        );
      })}

      {WEEK_DATA.map((d, i) => {
        const cx        = CHART_PAD + i * spacing + spacing / 2;
        const barHeight = (d.posture / 100) * usableHeight;
        const barY      = usableHeight - barHeight;
        const isWeak    = d.posture < 75;

        return (
          <G key={d.day}>
            {/* Bar */}
            <Rect
              x={cx - BAR_WIDTH / 2}
              y={barY}
              width={BAR_WIDTH}
              height={barHeight}
              rx={6}
              fill={isWeak ? 'url(#barGradWeak)' : 'url(#barGrad)'}
            />
            {/* Score label on top of bar */}
            <SvgText
              x={cx}
              y={barY - 4}
              fontSize={9}
              fontWeight="600"
              fill={isWeak ? brand.red : brand.teal}
              textAnchor="middle"
            >
              {d.posture}
            </SvgText>
            {/* Day label */}
            <SvgText
              x={cx}
              y={CHART_HEIGHT - 4}
              fontSize={10}
              fill="#7a7466"
              textAnchor="middle"
            >
              {d.day}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

// ─── Trend Line ───────────────────────────────────────────────────────────────

const TREND_WIDTH  = 320;
const TREND_HEIGHT = 100;

function TrendLine() {
  const usableWidth  = TREND_WIDTH  - 32;
  const usableHeight = TREND_HEIGHT - 24;
  const spacing      = usableWidth / (WEEK_DATA.length - 1);

  const points = WEEK_DATA.map((d, i) => ({
    x: 16 + i * spacing,
    y: usableHeight - (d.posture / 100) * usableHeight,
  }));

  // Build smooth SVG path
  const pathD = points.reduce((acc, pt, i) => {
    if (i === 0) return `M ${pt.x} ${pt.y}`;
    const prev = points[i - 1];
    const cpx  = (prev.x + pt.x) / 2;
    return `${acc} C ${cpx} ${prev.y} ${cpx} ${pt.y} ${pt.x} ${pt.y}`;
  }, '');

  // Area fill path (close below)
  const areaD = `${pathD} L ${points[points.length - 1].x} ${usableHeight} L ${points[0].x} ${usableHeight} Z`;

  return (
    <Svg width={TREND_WIDTH} height={TREND_HEIGHT}>
      <Defs>
        <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={brand.green} stopOpacity="0.25" />
          <Stop offset="1" stopColor={brand.green} stopOpacity="0" />
        </LinearGradient>
      </Defs>

      {/* Area fill */}
      <Path d={areaD} fill="url(#areaGrad)" />

      {/* Trend line */}
      <Path
        d={pathD}
        fill="none"
        stroke={brand.green}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Data points */}
      {points.map((pt, i) => (
        <Circle
          key={i}
          cx={pt.x}
          cy={pt.y}
          r={4}
          fill={WEEK_DATA[i].posture < 75 ? brand.red : brand.green}
          stroke="#ffffff"
          strokeWidth="2"
        />
      ))}

      {/* Day labels */}
      {WEEK_DATA.map((d, i) => (
        <SvgText
          key={d.day}
          x={points[i].x}
          y={TREND_HEIGHT - 4}
          fontSize={10}
          fill="#7a7466"
          textAnchor="middle"
        >
          {d.day}
        </SvgText>
      ))}
    </Svg>
  );
}

// ─── Error Log ────────────────────────────────────────────────────────────────

function ErrorLog() {
  return (
    <View style={styles.errorLog}>
      {ERROR_LOG.map((group) => (
        <View key={group.day} style={styles.errorGroup}>
          <Text style={styles.errorGroupDay}>{group.day}</Text>
          {group.events.map((ev, i) => (
            <View key={i} style={styles.errorRow}>
              <View
                style={[
                  styles.errorDot,
                  { backgroundColor: ev.type === 'error' ? colors.alertError : colors.alertWarning },
                ]}
              />
              <View style={styles.errorContent}>
                <Text style={styles.errorMessage}>{ev.message}</Text>
                <Text style={styles.errorTime}>{ev.time}</Text>
              </View>
              <View
                style={[
                  styles.errorBadge,
                  { backgroundColor: ev.type === 'error' ? '#fdecea' : '#fef9e7' },
                ]}
              >
                <Text
                  style={[
                    styles.errorBadgeText,
                    { color: ev.type === 'error' ? colors.alertError : '#9a6700' },
                  ]}
                >
                  {ev.type}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

// ─── Summary Stats ────────────────────────────────────────────────────────────

function SummaryStats() {
  const totalErrors   = WEEK_DATA.reduce((s, d) => s + d.errors,   0);
  const totalWarnings = WEEK_DATA.reduce((s, d) => s + d.warnings, 0);
  const avgScore      = Math.round(WEEK_DATA.reduce((s, d) => s + d.posture, 0) / WEEK_DATA.length);
  const bestDay       = WEEK_DATA.reduce((a, b) => (a.posture > b.posture ? a : b)).day;

  return (
    <View style={styles.statsGrid}>
      <View style={[styles.statTile, { borderLeftColor: brand.teal }]}>
        <Text style={styles.statTileValue}>{avgScore}</Text>
        <Text style={styles.statTileLabel}>Avg score</Text>
      </View>
      <View style={[styles.statTile, { borderLeftColor: brand.green }]}>
        <Text style={styles.statTileValue}>{bestDay}</Text>
        <Text style={styles.statTileLabel}>Best day</Text>
      </View>
      <View style={[styles.statTile, { borderLeftColor: brand.red }]}>
        <Text style={styles.statTileValue}>{totalErrors}</Text>
        <Text style={styles.statTileLabel}>Errors</Text>
      </View>
      <View style={[styles.statTile, { borderLeftColor: brand.yellow }]}>
        <Text style={styles.statTileValue}>{totalWarnings}</Text>
        <Text style={styles.statTileLabel}>Warnings</Text>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ProfileScreen({ email, onLogout }: ProfileScreenProps) {
  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={styles.eyebrow}>Profile</Text>
        <Text style={styles.title}>Your account</Text>

        {email ? <Text style={styles.meta}>Signed in as {email}</Text> : null}

        {/* Summary stats */}
        <SummaryStats />

        {/* Bar chart card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Weekly posture score</Text>
          <Text style={styles.cardSubtitle}>Teal = good  ·  Red = needs work</Text>
          <View style={styles.chartWrap}>
            <BarChart />
          </View>
        </View>

        {/* Trend line card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Score trend</Text>
          <Text style={styles.cardSubtitle}>How your posture has changed this week</Text>
          <View style={styles.chartWrap}>
            <TrendLine />
          </View>
        </View>

        {/* Error log card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Error log</Text>
          <Text style={styles.cardSubtitle}>Organised by day — most recent first</Text>
          <ErrorLog />
        </View>

        {/* Logout */}
        {onLogout ? (
          <Pressable onPress={onLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Log out</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bgPage,
  },
  scroll: {
    flex: 1,
    backgroundColor: colors.bgPage,
  },
  container: {
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 120,
  },

  // Header
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
    marginBottom: 4,
  },
  meta: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: 20,
  },

  // Summary stat tiles
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
    marginTop: 8,
  },
  statTile: {
    flex: 1,
    minWidth: '44%',
    backgroundColor: colors.bgCard,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderLeftWidth: 3,
    padding: 14,
  },
  statTileValue: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  statTileLabel: {
    fontSize: fontSize.xs,
    fontWeight: '500',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  // Cards
  card: {
    backgroundColor: colors.bgCard,
    borderColor: colors.borderLight,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 20,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  cardTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginBottom: 16,
  },
  chartWrap: {
    alignItems: 'center',
  },

  // Error log
  errorLog: {
    gap: 20,
  },
  errorGroup: {
    gap: 8,
  },
  errorGroupDay: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgSubtle,
    borderRadius: radius.sm,
    padding: 10,
    gap: 10,
  },
  errorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  errorContent: {
    flex: 1,
  },
  errorMessage: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.textBody,
    lineHeight: 16,
  },
  errorTime: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 1,
  },
  errorBadge: {
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  errorBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  // Logout
  logoutBtn: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.textPrimary,
    borderRadius: radius.full,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 20,
    marginTop: 8,
  },
  logoutText: {
    color: colors.textOnDark,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
});

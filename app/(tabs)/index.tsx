import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  TextInput,
  Modal,
} from 'react-native';
import { useTheme, type AppColors } from '../../src/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { BarChart } from 'react-native-gifted-charts';
import {
  getTopLevelStats,
  getPnlByMonth,
  getWinLossDistribution,
  getStrategyInsights,
  getTimeOfDayStats,
  getWinStreak,
  type PeriodFilter,
  type TopLevelStats,
  type MonthlyPnl,
  type WinLossDistribution,
  type StrategyInsight,
  type TimeSlotStat,
} from '../../src/services/analyticsService';

const GOAL_KEY = 'monthly_pnl_goal';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - 64; // 16px padding each side + 16px card padding each side

// ─── Period Filter Pills ──────────────────────────────────────────────────────

const PERIODS: { label: string; value: PeriodFilter }[] = [
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
  { label: 'All Time', value: 'all' },
];

function PeriodPills({ selected, onChange }: { selected: PeriodFilter; onChange: (v: PeriodFilter) => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.pillRow}>
      <View style={[styles.pillTrack, { backgroundColor: colors.surfaceHigh }]}>
        {PERIODS.map((p) => (
          <TouchableOpacity
            key={p.value}
            style={[styles.pill, selected === p.value && { backgroundColor: colors.surface, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onChange(p.value); }}
            activeOpacity={0.7}
          >
            <Text style={[styles.pillText, { color: selected === p.value ? colors.textPrimary : colors.textSecondary }]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── Hero P&L Card ────────────────────────────────────────────────────────────

function HeroPnlCard({ stats, totalTrades }: { stats: TopLevelStats | null; totalTrades: number }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const pnl = stats?.totalPnl ?? 0;
  const color = pnl > 0 ? colors.profit : pnl < 0 ? colors.loss : colors.textSecondary;
  const sign = pnl > 0 ? '+' : '';
  const absVal = Math.abs(pnl);
  const formatted = absVal >= 1000
    ? `${sign}$${(absVal / 1000).toFixed(2)}k`
    : `${sign}$${absVal.toFixed(2)}`;

  return (
    <View style={[styles.heroCard, { backgroundColor: colors.surface }]}>
      <Text style={[styles.heroLabel, { color: colors.textSecondary }]}>Total P&L</Text>
      <Text style={[styles.heroAmount, { color }]}>{pnl === 0 ? '$0.00' : formatted}</Text>
      <View style={[styles.heroDivider, { backgroundColor: colors.border }]} />
      <View style={styles.heroMetaRow}>
        <View style={styles.heroMetaItem}>
          <Text style={[styles.heroMetaVal, { color: stats && stats.winRate >= 50 ? colors.profit : colors.loss }]}>
            {stats ? `${stats.winRate.toFixed(1)}%` : '—'}
          </Text>
          <Text style={[styles.heroMetaLabel, { color: colors.textTertiary }]}>Win Rate</Text>
        </View>
        <View style={[styles.heroMetaDivider, { backgroundColor: colors.border }]} />
        <View style={styles.heroMetaItem}>
          <Text style={[styles.heroMetaVal, { color: colors.textPrimary }]}>{totalTrades}</Text>
          <Text style={[styles.heroMetaLabel, { color: colors.textTertiary }]}>
            Trades{stats?.openPositions ? ` · ${stats.openPositions} open` : ''}
          </Text>
        </View>
        <View style={[styles.heroMetaDivider, { backgroundColor: colors.border }]} />
        <View style={styles.heroMetaItem}>
          <Text style={[styles.heroMetaVal, { color: stats && stats.profitFactor >= 1 ? colors.profit : colors.loss }]}>
            {stats ? (isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : '∞') : '—'}
          </Text>
          <Text style={[styles.heroMetaLabel, { color: colors.textTertiary }]}>Prof. Factor</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Section Card wrapper ─────────────────────────────────────────────────────

function SectionCard({ title, icon, children }: { title: string; icon?: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <View style={styles.cardHeader}>
        {icon && <Ionicons name={icon as any} size={15} color={colors.primary} style={{ marginRight: 6 }} />}
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

// ─── Empty Chart Placeholder ──────────────────────────────────────────────────

function EmptyChart({ message }: { message: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.emptyChart}>
      <Text style={styles.emptyChartText}>{message}</Text>
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDollar(value: number, showSign = true): string {
  const abs = Math.abs(value);
  const sign = showSign ? (value < 0 ? '-' : value > 0 ? '+' : '') : '';
  if (abs >= 1000) {
    return `${sign}$${(abs / 1000).toFixed(1)}k`;
  }
  return `${sign}$${abs.toFixed(2)}`;
}

function pnlColor(value: number, colors: AppColors): string {
  if (value > 0) return colors.profit;
  if (value < 0) return colors.loss;
  return colors.textSecondary;
}

function profitFactorDisplay(pf: number): string {
  if (!isFinite(pf)) return '∞';
  return pf.toFixed(2);
}

// ─── Strategy Row ─────────────────────────────────────────────────────────────

function StrategyRow({ insight }: { insight: StrategyInsight }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isPositive = insight.totalPnl >= 0;
  return (
    <View style={styles.insightRow}>
      <View style={[styles.insightDot, { backgroundColor: isPositive ? colors.profit : colors.loss }]} />
      <View style={styles.insightCenter}>
        <Text style={styles.insightName} numberOfLines={1}>{insight.strategyName}</Text>
        <Text style={styles.insightSub}>
          {insight.totalTrades} trade{insight.totalTrades !== 1 ? 's' : ''}
          {'  ·  '}{insight.winRate.toFixed(0)}% win
        </Text>
      </View>
      <Text style={[styles.insightPnl, { color: isPositive ? colors.profit : colors.loss }]}>
        {formatDollar(insight.totalPnl, false)}
      </Text>
    </View>
  );
}

// ─── Time Slot Row ────────────────────────────────────────────────────────────

function TimeSlotRow({ stat }: { stat: TimeSlotStat }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isPositive = stat.avgPnl >= 0;
  return (
    <View style={styles.insightRow}>
      <Text style={styles.slotLabel}>{stat.slot}</Text>
      <Text style={styles.slotTrades}>{stat.trades}t</Text>
      <Text style={[styles.slotWinRate, { color: stat.winRate >= 50 ? colors.profit : colors.loss }]}>
        {stat.winRate.toFixed(0)}%
      </Text>
      <Text style={[styles.slotPnl, { color: isPositive ? colors.profit : colors.loss }]}>
        {formatDollar(stat.avgPnl, false)} avg
      </Text>
    </View>
  );
}

// ─── Streak + Goal Widget ─────────────────────────────────────────────────────

function StreakGoalRow({
  streak, isStreakActive, monthlyPnl, goal,
  onSetGoal,
}: {
  streak: number;
  isStreakActive: boolean;
  monthlyPnl: number;
  goal: number | null;
  onSetGoal: (g: number | null) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [editVisible, setEditVisible] = useState(false);
  const [inputVal, setInputVal] = useState('');

  const progress = goal && goal > 0 ? Math.min(monthlyPnl / goal, 1) : null;
  const progressColor = monthlyPnl >= 0 ? colors.profit : colors.loss;

  const handleSave = async () => {
    const val = parseFloat(inputVal);
    if (!isNaN(val) && val > 0) {
      await SecureStore.setItemAsync(GOAL_KEY, String(val));
      onSetGoal(val);
    } else if (inputVal === '') {
      await SecureStore.deleteItemAsync(GOAL_KEY);
      onSetGoal(null);
    }
    setEditVisible(false);
  };

  return (
    <>
      <View style={styles.streakGoalRow}>
        {/* Streak pill */}
        <View style={[styles.streakPill, { backgroundColor: streak > 0 ? colors.profit + '18' : colors.surfaceHigh }]}>
          <Text style={styles.streakEmoji}>{streak > 0 ? '🔥' : '📊'}</Text>
          <View>
            <Text style={[styles.streakCount, { color: streak > 0 ? colors.profit : colors.textPrimary }]}>
              {streak > 0 ? `${streak}-day streak` : 'No streak'}
            </Text>
            <Text style={[styles.streakSub, { color: colors.textSecondary }]}>
              {isStreakActive ? 'Active today' : streak > 0 ? 'Last active' : 'Win today to start'}
            </Text>
          </View>
        </View>

        {/* Goal pill */}
        <TouchableOpacity
          style={[styles.goalPill, { backgroundColor: colors.surfaceHigh }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setInputVal(goal ? String(goal) : ''); setEditVisible(true); }}
          activeOpacity={0.7}
        >
          {goal ? (
            <View style={{ flex: 1 }}>
              <View style={styles.goalHeader}>
                <Text style={[styles.goalLabel, { color: colors.textSecondary }]}>Monthly goal</Text>
                <Text style={[styles.goalValue, { color: progress !== null && progress >= 1 ? colors.profit : colors.textPrimary }]}>
                  {progress !== null ? `${Math.round(progress * 100)}%` : '—'}
                </Text>
              </View>
              {/* Progress bar */}
              <View style={[styles.goalBarBg, { backgroundColor: colors.border }]}>
                <View style={[styles.goalBarFill, {
                  width: `${Math.max(0, Math.min((progress ?? 0), 1) * 100)}%`,
                  backgroundColor: progressColor,
                }]} />
              </View>
              <Text style={[styles.goalSub, { color: colors.textTertiary }]}>
                {formatDollar(monthlyPnl, false)} / ${goal.toLocaleString()}
              </Text>
            </View>
          ) : (
            <View style={styles.goalEmpty}>
              <Text style={[styles.goalEmptyIcon, { color: colors.primary }]}>＋</Text>
              <Text style={[styles.goalEmptyLabel, { color: colors.textSecondary }]}>Set goal</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Goal editor modal */}
      <Modal visible={editVisible} transparent animationType="fade" onRequestClose={() => setEditVisible(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' }} activeOpacity={1} onPress={() => setEditVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.goalModal, { backgroundColor: colors.surface }]}>
            <Text style={[styles.goalModalTitle, { color: colors.textPrimary }]}>Monthly P&L Goal</Text>
            <View style={[styles.goalModalInput, { backgroundColor: colors.surfaceHigh, borderColor: colors.border }]}>
              <Text style={[{ fontSize: 18, color: colors.textSecondary }]}>$</Text>
              <TextInput
                style={[{ flex: 1, fontSize: 20, fontWeight: '600', color: colors.textPrimary, paddingLeft: 6 }]}
                placeholder="5,000"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
                value={inputVal}
                onChangeText={setInputVal}
                autoFocus
              />
            </View>
            <Text style={[{ fontSize: 12, color: colors.textTertiary, marginBottom: 16, textAlign: 'center' }]}>Leave blank to remove goal</Text>
            <TouchableOpacity
              style={[styles.goalModalBtn, { backgroundColor: colors.primary }]}
              onPress={handleSave}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Save</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [filter, setFilter] = useState<PeriodFilter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [stats, setStats] = useState<TopLevelStats | null>(null);
  const [monthly, setMonthly] = useState<MonthlyPnl[]>([]);
  const [distribution, setDistribution] = useState<WinLossDistribution | null>(null);
  const [strategyInsights, setStrategyInsights] = useState<StrategyInsight[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlotStat[]>([]);
  const [streak, setStreak] = useState(0);
  const [streakActive, setStreakActive] = useState(false);
  const [goal, setGoal] = useState<number | null>(null);

  const loadData = useCallback(
    async (currentFilter: PeriodFilter) => {
      try {
        const [s, m, d, si, ts, sk, savedGoal] = await Promise.all([
          getTopLevelStats(currentFilter),
          getPnlByMonth(6),
          getWinLossDistribution(currentFilter),
          getStrategyInsights(currentFilter),
          getTimeOfDayStats(currentFilter),
          getWinStreak(),
          SecureStore.getItemAsync(GOAL_KEY),
        ]);
        setStats(s);
        setMonthly(m);
        setDistribution(d);
        setStrategyInsights(si);
        setTimeSlots(ts);
        setStreak(sk.streak);
        setStreakActive(sk.isActive);
        if (savedGoal) setGoal(parseFloat(savedGoal));
      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadData(filter);
    }, []),
  );

  const handleFilterChange = (newFilter: PeriodFilter) => {
    setFilter(newFilter);
    loadData(newFilter);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData(filter);
  };

  // ── Monthly bar data for gifted-charts ────────────────────────────────────
  const barData = monthly.map((m) => ({
    value: Math.abs(m.pnl),
    frontColor: m.pnl >= 0 ? colors.profit : colors.loss,
    label: m.label,
    topLabelComponent: () => (
      <Text style={[styles.barTopLabel, { color: m.pnl >= 0 ? colors.profit : colors.loss }]}>
        {m.pnl !== 0 ? formatDollar(m.pnl) : ''}
      </Text>
    ),
  }));

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const totalTrades = stats?.totalTrades ?? 0;
  const winLossTotal = (distribution?.wins ?? 0) + (distribution?.losses ?? 0) + (distribution?.breakeven ?? 0);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Period filter */}
        <PeriodPills selected={filter} onChange={handleFilterChange} />

        {/* Streak + Goal */}
        <StreakGoalRow
          streak={streak}
          isStreakActive={streakActive}
          monthlyPnl={stats?.totalPnl ?? 0}
          goal={goal}
          onSetGoal={setGoal}
        />

        {/* Hero P&L */}
        <HeroPnlCard stats={stats} totalTrades={totalTrades} />

        {/* Monthly P&L */}
        <SectionCard title="Monthly P&L" icon="bar-chart-outline">
          {barData.every((b) => b.value === 0) ? (
            <EmptyChart message="No closed trades yet to show monthly P&L." />
          ) : (
            <View style={styles.chartContainer}>
              <BarChart
                data={barData}
                width={CHART_WIDTH}
                height={140}
                barWidth={Math.max(18, Math.floor(CHART_WIDTH / barData.length) - 12)}
                barBorderRadius={4}
                hideRules={false}
                rulesColor={colors.background}
                yAxisColor={colors.border}
                xAxisColor={colors.border}
                yAxisTextStyle={styles.axisLabel}
                xAxisLabelTextStyle={styles.axisLabel}
                noOfSections={3}
                yAxisLabelPrefix="$"
                formatYLabel={(v) => {
                  const n = parseFloat(v);
                  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(0)}k`;
                  return n.toFixed(0);
                }}
                isAnimated
                animationDuration={500}
              />
            </View>
          )}
        </SectionCard>

        {/* Win / Loss / Breakeven */}
        <SectionCard title="Outcome Distribution" icon="pie-chart-outline">
          {winLossTotal === 0 ? (
            <EmptyChart message="Close some trades to see your outcome distribution." />
          ) : (
            <View>
              {[
                { label: 'Wins', count: distribution?.wins ?? 0, color: colors.profit },
                { label: 'Losses', count: distribution?.losses ?? 0, color: colors.loss },
                { label: 'Breakeven', count: distribution?.breakeven ?? 0, color: colors.textTertiary },
              ].map(({ label, count, color }) => (
                <View key={label} style={styles.distBarItem}>
                  <Text style={[styles.distBarLabel, { color: colors.textPrimary }]}>{label}</Text>
                  <Text style={[styles.distBarCount, { color: colors.textSecondary }]}>{count}</Text>
                  <View style={[styles.distBarTrack, { backgroundColor: colors.surfaceHigh }]}>
                    <View style={[styles.distBarFill, {
                      width: `${winLossTotal > 0 ? (count / winLossTotal) * 100 : 0}%`,
                      backgroundColor: color,
                    }]} />
                  </View>
                  <Text style={[styles.distBarPct, { color: colors.textSecondary }]}>
                    {winLossTotal > 0 ? `${Math.round((count / winLossTotal) * 100)}%` : '—'}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </SectionCard>
        {/* Strategy Insights */}
        <SectionCard title="Strategy Insights" icon="bulb-outline">
          {strategyInsights.length === 0 ? (
            <EmptyChart message="Log trades with a strategy to see insights." />
          ) : (
            strategyInsights.map((s) => <StrategyRow key={s.strategyId} insight={s} />)
          )}
        </SectionCard>

        {/* Time of Day */}
        <SectionCard title="Time of Day" icon="time-outline">
          {timeSlots.length === 0 ? (
            <EmptyChart message="Log trades to see your peak performance windows." />
          ) : (
            timeSlots.map((t) => <TimeSlotRow key={t.slot} stat={t} />)
          )}
        </SectionCard>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scrollContent: { paddingBottom: 32 },

    // ── Period pills (segmented control) ───────────────────────────────────
    pillRow: {
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 10,
    },
    pillTrack: {
      flexDirection: 'row',
      borderRadius: 10,
      padding: 3,
    },
    pill: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 7,
      borderRadius: 8,
    },
    pillText: { fontSize: 13, fontWeight: '600' },

    // ── Hero P&L card ──────────────────────────────────────────────────────
    heroCard: {
      marginHorizontal: 16,
      marginBottom: 12,
      borderRadius: 16,
      padding: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.09,
      shadowRadius: 12,
      elevation: 4,
    },
    heroLabel: { fontSize: 12, fontWeight: '500', marginBottom: 6, letterSpacing: 0.3 },
    heroAmount: { fontSize: 38, fontWeight: '800', letterSpacing: -1, marginBottom: 18 },
    heroDivider: { height: StyleSheet.hairlineWidth, marginBottom: 16 },
    heroMetaRow: { flexDirection: 'row', alignItems: 'center' },
    heroMetaItem: { flex: 1, alignItems: 'center' },
    heroMetaDivider: { width: StyleSheet.hairlineWidth, height: 30 },
    heroMetaVal: { fontSize: 18, fontWeight: '700', marginBottom: 3 },
    heroMetaLabel: { fontSize: 11, fontWeight: '500' },

    // ── Section cards ──────────────────────────────────────────────────────
    card: {
      backgroundColor: c.surface,
      marginHorizontal: 16,
      marginBottom: 12,
      borderRadius: 14,
      padding: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 1,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    cardTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: c.textPrimary,
    },

    // ── Charts ─────────────────────────────────────────────────────────────
    chartContainer: { marginLeft: -4 },
    axisLabel: { fontSize: 10, color: c.textSecondary },
    barTopLabel: { fontSize: 8, color: c.textSecondary, textAlign: 'center' },

    // ── Empty chart ────────────────────────────────────────────────────────
    emptyChart: { height: 80, alignItems: 'center', justifyContent: 'center' },
    emptyChartText: { fontSize: 13, color: c.textSecondary, textAlign: 'center' },

    // ── Horizontal distribution bars ───────────────────────────────────────
    distBarItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 6,
      gap: 10,
    },
    distBarLabel: { fontSize: 13, fontWeight: '500', width: 74 },
    distBarCount: { fontSize: 13, fontWeight: '700', width: 24, textAlign: 'right' },
    distBarTrack: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
    distBarFill: { height: 8, borderRadius: 4 },
    distBarPct: { fontSize: 12, fontWeight: '600', width: 34, textAlign: 'right' },

    // ── Strategy / Time-of-Day rows ────────────────────────────────────────
    insightRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 9,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
      gap: 10,
    },
    insightDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
    insightCenter: { flex: 1, minWidth: 0 },
    insightName: { fontSize: 14, fontWeight: '600', color: c.textPrimary },
    insightSub: { fontSize: 11, color: c.textSecondary, marginTop: 1 },
    insightPnl: { fontSize: 14, fontWeight: '700', flexShrink: 0 },

    // ── Time slot row ──────────────────────────────────────────────────────
    slotLabel: { fontSize: 12, fontWeight: '600', color: c.textPrimary, width: 96 },
    slotTrades: { fontSize: 11, color: c.textSecondary, width: 24, textAlign: 'center' },
    slotWinRate: { fontSize: 12, fontWeight: '600', width: 36, textAlign: 'center' },
    slotPnl: { flex: 1, fontSize: 12, fontWeight: '600', textAlign: 'right' },

    // ── Streak + Goal ──────────────────────────────────────────────────────
    streakGoalRow: {
      flexDirection: 'row', gap: 10,
      paddingHorizontal: 16, paddingBottom: 12,
    },
    streakPill: {
      flex: 1, flexDirection: 'row', alignItems: 'center',
      borderRadius: 12, padding: 12, gap: 10,
    },
    streakEmoji: { fontSize: 22 },
    streakCount: { fontSize: 13, fontWeight: '700' },
    streakSub: { fontSize: 11, fontWeight: '400', marginTop: 1 },
    goalPill: {
      flex: 1.2, borderRadius: 12, padding: 12,
      justifyContent: 'center',
    },
    goalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    goalLabel: { fontSize: 11, fontWeight: '500' },
    goalValue: { fontSize: 13, fontWeight: '700' },
    goalBarBg: { height: 5, borderRadius: 3, overflow: 'hidden', marginBottom: 5 },
    goalBarFill: { height: 5, borderRadius: 3 },
    goalSub: { fontSize: 10 },
    goalEmpty: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 4 },
    goalEmptyIcon: { fontSize: 20, fontWeight: '300' },
    goalEmptyLabel: { fontSize: 13, fontWeight: '500' },
    goalModal: {
      margin: 32, borderRadius: 18, padding: 24,
      shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.25, shadowRadius: 20, elevation: 10,
    },
    goalModalTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 16 },
    goalModalInput: {
      flexDirection: 'row', alignItems: 'center',
      borderRadius: 12, borderWidth: 1, paddingHorizontal: 14,
      paddingVertical: 4, marginBottom: 8,
    },
    goalModalBtn: {
      borderRadius: 12, paddingVertical: 14,
      alignItems: 'center',
    },
  });
}

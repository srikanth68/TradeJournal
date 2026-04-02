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
} from 'react-native';
import { useTheme, type AppColors } from '../../src/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { BarChart } from 'react-native-gifted-charts';
import {
  getTopLevelStats,
  getPnlByMonth,
  getWinLossDistribution,
  getStrategyInsights,
  getTimeOfDayStats,
  type PeriodFilter,
  type TopLevelStats,
  type MonthlyPnl,
  type WinLossDistribution,
  type StrategyInsight,
  type TimeSlotStat,
} from '../../src/services/analyticsService';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - 64; // 16px padding each side + 16px card padding each side

// ─── Period Filter Pills ──────────────────────────────────────────────────────

const PERIODS: { label: string; value: PeriodFilter }[] = [
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
  { label: 'All Time', value: 'all' },
];

function PeriodPills({
  selected,
  onChange,
}: {
  selected: PeriodFilter;
  onChange: (v: PeriodFilter) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.pillRow}>
      {PERIODS.map((p) => (
        <TouchableOpacity
          key={p.value}
          style={[styles.pill, selected === p.value && styles.pillActive]}
          onPress={() => onChange(p.value)}
          activeOpacity={0.7}
        >
          <Text style={[styles.pillText, selected === p.value && styles.pillTextActive]}>
            {p.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  valueColor,
  sub,
}: {
  label: string;
  value: string;
  valueColor?: string;
  sub?: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, valueColor ? { color: valueColor } : undefined]}>{value}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

// ─── Section Card wrapper ─────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
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

  const loadData = useCallback(
    async (currentFilter: PeriodFilter) => {
      try {
        const [s, m, d, si, ts] = await Promise.all([
          getTopLevelStats(currentFilter),
          getPnlByMonth(6),
          getWinLossDistribution(currentFilter),
          getStrategyInsights(currentFilter),
          getTimeOfDayStats(currentFilter),
        ]);
        setStats(s);
        setMonthly(m);
        setDistribution(d);
        setStrategyInsights(si);
        setTimeSlots(ts);
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

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatCard
            label="Total P&L"
            value={stats ? formatDollar(stats.totalPnl, false) : '$0.00'}
            valueColor={stats ? pnlColor(stats.totalPnl, colors) : undefined}
          />
          <StatCard
            label="Win Rate"
            value={stats ? `${stats.winRate.toFixed(1)}%` : '0%'}
            valueColor={stats && stats.winRate >= 50 ? colors.profit : colors.loss}
          />
          <StatCard
            label="Trades"
            value={totalTrades.toString()}
            sub={stats ? `${stats.openPositions} open` : undefined}
          />
          <StatCard
            label="Prof. Factor"
            value={stats ? profitFactorDisplay(stats.profitFactor) : '—'}
            valueColor={stats && stats.profitFactor >= 1 ? colors.profit : colors.loss}
          />
        </View>

        {/* Monthly P&L */}
        <SectionCard title="Monthly P&L">
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
        <SectionCard title="Outcome Distribution">
          {winLossTotal === 0 ? (
            <EmptyChart message="Close some trades to see your outcome distribution." />
          ) : (
            <View style={styles.distributionRow}>
              <View style={styles.distItem}>
                <View style={[styles.distDot, { backgroundColor: '#34C759' }]} />
                <Text style={styles.distCount}>{distribution?.wins ?? 0}</Text>
                <Text style={styles.distLabel}>Wins</Text>
                <Text style={styles.distPct}>
                  {winLossTotal > 0
                    ? `${(((distribution?.wins ?? 0) / winLossTotal) * 100).toFixed(0)}%`
                    : '—'}
                </Text>
              </View>
              <View style={styles.distDivider} />
              <View style={styles.distItem}>
                <View style={[styles.distDot, { backgroundColor: '#FF3B30' }]} />
                <Text style={styles.distCount}>{distribution?.losses ?? 0}</Text>
                <Text style={styles.distLabel}>Losses</Text>
                <Text style={styles.distPct}>
                  {winLossTotal > 0
                    ? `${(((distribution?.losses ?? 0) / winLossTotal) * 100).toFixed(0)}%`
                    : '—'}
                </Text>
              </View>
              <View style={styles.distDivider} />
              <View style={styles.distItem}>
                <View style={[styles.distDot, { backgroundColor: '#8E8E93' }]} />
                <Text style={styles.distCount}>{distribution?.breakeven ?? 0}</Text>
                <Text style={styles.distLabel}>Breakeven</Text>
                <Text style={styles.distPct}>
                  {winLossTotal > 0
                    ? `${(((distribution?.breakeven ?? 0) / winLossTotal) * 100).toFixed(0)}%`
                    : '—'}
                </Text>
              </View>
            </View>
          )}
        </SectionCard>
        {/* Strategy Insights */}
        <SectionCard title="Strategy Insights">
          {strategyInsights.length === 0 ? (
            <EmptyChart message="Log trades with a strategy to see insights." />
          ) : (
            strategyInsights.map((s) => <StrategyRow key={s.strategyId} insight={s} />)
          )}
        </SectionCard>

        {/* Time of Day */}
        <SectionCard title="Time of Day">
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

    // Period pills
    pillRow: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 8,
    },
    pill: {
      paddingHorizontal: 16,
      paddingVertical: 7,
      borderRadius: 20,
      backgroundColor: c.surfaceHigh,
    },
    pillActive: { backgroundColor: c.primary },
    pillText: { fontSize: 13, fontWeight: '600', color: c.textPrimary },
    pillTextActive: { color: '#FFFFFF' },

    // Stats row
    statsRow: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    statCard: {
      flex: 1,
      backgroundColor: c.surface,
      borderRadius: 12,
      padding: 10,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 1,
    },
    statLabel: { fontSize: 10, color: c.textSecondary, marginBottom: 4, textAlign: 'center' },
    statValue: { fontSize: 15, fontWeight: '700', color: c.textPrimary, textAlign: 'center' },
    statSub: { fontSize: 10, color: c.textTertiary, marginTop: 2, textAlign: 'center' },

    // Section cards
    card: {
      backgroundColor: c.surface,
      marginHorizontal: 16,
      marginBottom: 12,
      borderRadius: 14,
      padding: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 1,
    },
    cardTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: c.textPrimary,
      marginBottom: 12,
    },

    // Charts
    chartContainer: { marginLeft: -4 },
    axisLabel: { fontSize: 10, color: c.textSecondary },
    barTopLabel: { fontSize: 8, color: c.textSecondary, textAlign: 'center' },

    // Empty chart
    emptyChart: {
      height: 80,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyChartText: {
      fontSize: 13,
      color: c.textSecondary,
      textAlign: 'center',
    },

    // Distribution
    distributionRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    distItem: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 8,
    },
    distDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginBottom: 6,
    },
    distCount: {
      fontSize: 22,
      fontWeight: '700',
      color: c.textPrimary,
    },
    distLabel: {
      fontSize: 11,
      color: c.textSecondary,
      marginTop: 2,
    },
    distPct: {
      fontSize: 12,
      fontWeight: '600',
      color: c.textPrimary,
      marginTop: 2,
    },
    distDivider: {
      width: StyleSheet.hairlineWidth,
      backgroundColor: c.separator,
      alignSelf: 'stretch',
      marginVertical: 8,
    },

    // Strategy / Time-of-Day rows
    insightRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 9,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.background,
      gap: 10,
    },
    insightDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      flexShrink: 0,
    },
    insightCenter: { flex: 1, minWidth: 0 },
    insightName: { fontSize: 14, fontWeight: '600', color: c.textPrimary },
    insightSub: { fontSize: 11, color: c.textSecondary, marginTop: 1 },
    insightPnl: { fontSize: 14, fontWeight: '700', flexShrink: 0 },

    // Time slot row
    slotLabel: { fontSize: 12, fontWeight: '600', color: c.textPrimary, width: 96 },
    slotTrades: { fontSize: 11, color: c.textSecondary, width: 24, textAlign: 'center' },
    slotWinRate: { fontSize: 12, fontWeight: '600', width: 36, textAlign: 'center' },
    slotPnl: { flex: 1, fontSize: 12, fontWeight: '600', textAlign: 'right' },
  });
}

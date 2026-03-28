import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { getPositions, type PositionWithEntries } from '../../src/services/positionService';
import { fromStoredPrice, formatPnl } from '../../src/utils/price';

// ─── Helpers ────────────────────────────────────────────────────────────────

function isoDate(d: Date | string): string {
  const dt = typeof d === 'string' ? new Date(d) : d;
  return dt.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

type DayData = {
  pnl: number;       // raw stored pnl sum
  count: number;     // number of closed trades that day
  positions: PositionWithEntries[];
};

function buildDayMap(positions: PositionWithEntries[]): Map<string, DayData> {
  const map = new Map<string, DayData>();
  for (const pos of positions) {
    if (pos.status !== 'closed' || pos.exitDate == null || pos.realizedPnl == null) continue;
    const key = isoDate(pos.exitDate);
    const existing = map.get(key) ?? { pnl: 0, count: 0, positions: [] };
    map.set(key, {
      pnl: existing.pnl + pos.realizedPnl,
      count: existing.count + 1,
      positions: [...existing.positions, pos],
    });
  }
  return map;
}

function generateMonths(fromDate: Date, count: number): Array<{ year: number; month: number }> {
  const months: Array<{ year: number; month: number }> = [];
  let y = fromDate.getFullYear();
  let m = fromDate.getMonth(); // 0-indexed
  for (let i = 0; i < count; i++) {
    months.push({ year: y, month: m });
    m--;
    if (m < 0) { m = 11; y--; }
  }
  return months;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay(); // 0=Sun
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// ─── Month Calendar ──────────────────────────────────────────────────────────

type MonthStats = { tradeDays: number; winDays: number; lossDays: number; totalPnl: number };

function MonthCalendar({
  year, month, dayMap, today,
}: {
  year: number; month: number;
  dayMap: Map<string, DayData>;
  today: string;
}) {
  const totalDays = daysInMonth(year, month);
  const startDow = firstDayOfWeek(year, month);

  // build stats for this month
  const stats: MonthStats = { tradeDays: 0, winDays: 0, lossDays: 0, totalPnl: 0 };
  for (let d = 1; d <= totalDays; d++) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const day = dayMap.get(key);
    if (day) {
      stats.tradeDays++;
      stats.totalPnl += day.pnl;
      if (day.pnl >= 0) stats.winDays++; else stats.lossDays++;
    }
  }

  const cells: Array<{ day: number | null; key: string | null }> = [];
  for (let i = 0; i < startDow; i++) cells.push({ day: null, key: null });
  for (let d = 1; d <= totalDays; d++) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, key });
  }
  // pad to full grid
  while (cells.length % 7 !== 0) cells.push({ day: null, key: null });

  const weeks: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const isCurrentMonth = today.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`);

  return (
    <View style={styles.monthCard}>
      {/* Month header */}
      <View style={styles.monthHeader}>
        <View>
          <Text style={styles.monthTitle}>{MONTH_NAMES[month]} {year}</Text>
          {isCurrentMonth && <Text style={styles.currentMonthTag}>This Month</Text>}
        </View>
        {stats.tradeDays > 0 && (
          <View style={styles.monthStats}>
            <Text style={[styles.monthPnl, fromStoredPrice(stats.totalPnl) >= 0 ? styles.pnlPos : styles.pnlNeg]}>
              {formatPnl(stats.totalPnl)}
            </Text>
            <Text style={styles.monthStatsSub}>
              {stats.winDays}W / {stats.lossDays}L
            </Text>
          </View>
        )}
      </View>

      {/* Day-of-week labels */}
      <View style={styles.dowRow}>
        {DAY_LABELS.map(d => (
          <Text key={d} style={styles.dowLabel}>{d}</Text>
        ))}
      </View>

      {/* Weeks */}
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.weekRow}>
          {week.map((cell, ci) => {
            if (!cell.day || !cell.key) {
              return <View key={ci} style={styles.cellEmpty} />;
            }
            const data = dayMap.get(cell.key);
            const isToday = cell.key === today;
            const isFuture = cell.key > today;

            let cellBg = 'transparent';
            if (data) {
              const pnlVal = fromStoredPrice(data.pnl);
              // intensity based on magnitude (soft cap at $500 for full saturation)
              const intensity = Math.min(Math.abs(pnlVal) / 500, 1);
              if (pnlVal >= 0) {
                const g = Math.round(180 + intensity * 75); // 180–255
                const rb = Math.round(80 - intensity * 60);  // 80–20
                cellBg = `rgb(${rb}, ${g}, ${rb})`;
              } else {
                const r = Math.round(180 + intensity * 75);
                const gb = Math.round(80 - intensity * 60);
                cellBg = `rgb(${r}, ${gb}, ${gb})`;
              }
            }

            return (
              <TouchableOpacity
                key={ci}
                style={[
                  styles.cell,
                  data ? { backgroundColor: cellBg } : null,
                  isToday && styles.cellToday,
                  isFuture && styles.cellFuture,
                ]}
                disabled={!data}
                onPress={() => {
                  // Navigate to trade log filtered by this date (future enhancement)
                  // For now just a no-op; could show a modal listing trades
                }}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.cellDay,
                  data ? styles.cellDayActive : null,
                  isFuture && styles.cellDayFuture,
                  isToday && styles.cellDayToday,
                ]}>
                  {cell.day}
                </Text>
                {data && (
                  <Text style={styles.cellCount}>{data.count}</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function CalendarScreen() {
  const [dayMap, setDayMap] = useState<Map<string, DayData>>(new Map());
  const [loading, setLoading] = useState(true);
  const today = isoDate(new Date());

  const load = useCallback(async () => {
    try {
      const positions = await getPositions();
      setDayMap(buildDayMap(positions));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Show 12 months back from current month
  const months = generateMonths(new Date(), 12);

  // Overall stats
  let totalPnl = 0;
  let winDays = 0;
  let lossDays = 0;
  dayMap.forEach(d => {
    totalPnl += d.pnl;
    if (d.pnl >= 0) winDays++; else lossDays++;
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary strip */}
        <View style={styles.summaryStrip}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Trade Days</Text>
            <Text style={styles.summaryValue}>{winDays + lossDays}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Win Days</Text>
            <Text style={[styles.summaryValue, styles.pnlPos]}>{winDays}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Loss Days</Text>
            <Text style={[styles.summaryValue, styles.pnlNeg]}>{lossDays}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>All-time P&L</Text>
            <Text style={[styles.summaryValue, fromStoredPrice(totalPnl) >= 0 ? styles.pnlPos : styles.pnlNeg]}>
              {formatPnl(totalPnl)}
            </Text>
          </View>
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#28A428' }]} />
            <Text style={styles.legendText}>Profitable day</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#C42020' }]} />
            <Text style={styles.legendText}>Loss day</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.legendDotEmpty]} />
            <Text style={styles.legendText}>No trades</Text>
          </View>
        </View>

        {months.map(({ year, month }) => (
          <MonthCalendar
            key={`${year}-${month}`}
            year={year}
            month={month}
            dayMap={dayMap}
            today={today}
          />
        ))}

        <Text style={styles.footer}>Scroll up for earlier months</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const CELL_SIZE = 42;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },

  summaryStrip: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginTop: 16,
    marginBottom: 12,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: StyleSheet.hairlineWidth, backgroundColor: '#E5E5EA', marginVertical: 4 },
  summaryLabel: { fontSize: 10, color: '#8E8E93', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.3 },
  summaryValue: { fontSize: 17, fontWeight: '700', color: '#1C1C1E' },

  legend: { flexDirection: 'row', gap: 16, paddingHorizontal: 4, marginBottom: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  legendDotEmpty: { backgroundColor: '#E5E5EA', borderWidth: 1, borderColor: '#C7C7CC' },
  legendText: { fontSize: 11, color: '#8E8E93' },

  monthCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  monthTitle: { fontSize: 17, fontWeight: '700', color: '#1C1C1E' },
  currentMonthTag: { fontSize: 11, color: '#007AFF', fontWeight: '600', marginTop: 2 },
  monthStats: { alignItems: 'flex-end' },
  monthPnl: { fontSize: 17, fontWeight: '700' },
  monthStatsSub: { fontSize: 11, color: '#8E8E93', marginTop: 2 },

  dowRow: { flexDirection: 'row', marginBottom: 4 },
  dowLabel: {
    width: CELL_SIZE, textAlign: 'center',
    fontSize: 11, fontWeight: '600', color: '#8E8E93',
  },

  weekRow: { flexDirection: 'row', marginBottom: 3 },
  cell: {
    width: CELL_SIZE, height: CELL_SIZE,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellEmpty: { width: CELL_SIZE, height: CELL_SIZE },
  cellToday: {
    borderWidth: 2, borderColor: '#007AFF',
  },
  cellFuture: { opacity: 0.3 },
  cellDay: { fontSize: 14, color: '#1C1C1E', fontWeight: '500' },
  cellDayActive: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  cellDayFuture: { color: '#C7C7CC' },
  cellDayToday: { color: '#007AFF', fontWeight: '700' },
  cellCount: { fontSize: 9, color: 'rgba(255,255,255,0.85)', marginTop: 1 },

  pnlPos: { color: '#34C759' },
  pnlNeg: { color: '#FF3B30' },
  footer: { textAlign: 'center', fontSize: 12, color: '#C7C7CC', marginTop: 8 },
});

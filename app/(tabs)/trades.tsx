import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { useTheme, type AppColors } from '../../src/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getPositions, type PositionWithEntries } from '../../src/services/positionService';
import { formatPrice, formatPnl, fromStoredPrice } from '../../src/utils/price';

// ─── CSV Export ───────────────────────────────────────────────────────────────

function escapeCSV(val: string | null | undefined): string {
  if (val == null || val === '') return '';
  let s = String(val);
  // Neutralize formula injection (Excel/Sheets executes cells starting with = + - @ |)
  if (/^[=+\-@|]/.test(s)) s = `'${s}`;
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

async function exportCSV(positions: PositionWithEntries[]) {
  const header = [
    'Date Opened', 'Date Closed', 'Ticker', 'Company', 'Trade Type',
    'Avg Entry Price', 'Exit Price', 'Shares', 'Realized P&L',
    'Strategy', 'Grade', 'Emotion', 'Setup Notes', 'Review Notes',
  ].join(',');

  const rows = positions.map(p => {
    const opened = p.createdAt ? new Date(p.createdAt).toISOString().slice(0, 10) : '';
    const closed = p.exitDate ? new Date(p.exitDate).toISOString().slice(0, 10) : '';
    const avgEntry = p.avgEntryPrice != null ? (p.avgEntryPrice / 10000).toFixed(4) : '';
    const exit = p.exitPrice != null ? (p.exitPrice / 10000).toFixed(4) : '';
    const pnl = p.realizedPnl != null ? (p.realizedPnl / 10000).toFixed(2) : '';
    return [
      opened, closed,
      escapeCSV(p.ticker),
      escapeCSV(p.companyName),
      p.tradeType === 'buy' ? 'LONG' : 'SHORT',
      avgEntry, exit,
      p.totalQuantity != null ? String(p.totalQuantity) : '',
      pnl,
      escapeCSV(p.strategyId ?? ''),
      escapeCSV(p.tradeGrade),
      escapeCSV(p.emotionTag),
      escapeCSV(p.setupNotes),
      escapeCSV(p.notes),
    ].join(',');
  });

  const csv = [header, ...rows].join('\n');
  const filename = `trades_${new Date().toISOString().slice(0, 10)}.csv`;
  const path = `${FileSystem.cacheDirectory}${filename}`;

  await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });

  const available = await Sharing.isAvailableAsync();
  if (!available) {
    Alert.alert('Not supported', 'Sharing is not available on this device.');
    return;
  }
  await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: 'Export Trades CSV' });
}

function TickerAvatar({ ticker, tradeType, logoUrl }: { ticker: string; tradeType: 'buy' | 'short'; logoUrl?: string | null }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const bg = tradeType === 'short' ? colors.shortBadgeBg : colors.longBadgeBg;
  const textColor = tradeType === 'short' ? colors.loss : colors.primary;
  if (logoUrl) {
    return <Image source={{ uri: logoUrl }} style={styles.avatar} resizeMode="contain" />;
  }
  return (
    <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: bg }]}>
      <Text style={[styles.avatarText, { color: textColor }]}>{ticker.slice(0, 2)}</Text>
    </View>
  );
}

function TradeTypeBadge({ type }: { type: 'buy' | 'short' }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[styles.badge, type === 'short' && styles.badgeShort]}>
      <Text style={[styles.badgeText, type === 'short' && styles.badgeTextShort]}>
        {type === 'buy' ? 'LONG' : 'SHORT'}
      </Text>
    </View>
  );
}

function PositionRow({ position }: { position: PositionWithEntries }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isClosed = position.status === 'closed';
  const pnl = position.realizedPnl;
  const avgEntry = position.avgEntryPrice;
  const pnlValue = pnl != null ? fromStoredPrice(pnl) : null;

  const accentColor = isClosed
    ? (pnlValue != null && pnlValue >= 0 ? colors.profit : colors.loss)
    : colors.open;

  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.7}
      onPress={() => router.push({ pathname: '/position/[id]', params: { id: position.id } })}
    >
      {/* Colored left accent stripe */}
      <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
      <TickerAvatar ticker={position.ticker} tradeType={position.tradeType} logoUrl={position.companyLogoUrl} />
      <View style={styles.rowCenter}>
        <View style={styles.rowTitleRow}>
          <Text style={styles.ticker}>{position.ticker}</Text>
          <TradeTypeBadge type={position.tradeType} />
        </View>
        <Text style={styles.rowSub} numberOfLines={1}>
          {avgEntry != null ? `Avg ${formatPrice(avgEntry)}` : 'No entry'}
          {position.totalQuantity != null ? `  ·  ${position.totalQuantity} sh` : ''}
          {position.companyName ? `  ·  ${position.companyName}` : ''}
        </Text>
      </View>
      <View style={styles.rowRight}>
        {isClosed && pnl != null ? (
          <>
            <Text style={[styles.pnl, pnlValue! >= 0 ? styles.pnlPositive : styles.pnlNegative]}>
              {formatPnl(pnl)}
            </Text>
            <Text style={styles.rowRightSub}>Realized</Text>
          </>
        ) : (
          <>
            <Text style={styles.openLabel}>Open</Text>
            <Text style={styles.rowRightSub}>{position.entries.length} entr{position.entries.length === 1 ? 'y' : 'ies'}</Text>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

function EmptyState({ message }: { message: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>📊</Text>
      <Text style={styles.emptyTitle}>No trades yet</Text>
      <Text style={styles.emptySubtitle}>{message}</Text>
    </View>
  );
}

type Section =
  | { key: 'header' }
  | { key: 'open-header' }
  | { key: 'open-empty' }
  | { key: 'closed-header' }
  | { key: 'closed-empty' }
  | { key: string; position: PositionWithEntries };

export default function TradeLogScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [openPositions, setOpenPositions] = useState<PositionWithEntries[]>([]);
  const [closedPositions, setClosedPositions] = useState<PositionWithEntries[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadPositions = async () => {
    try {
      const [open, closed] = await Promise.all([
        getPositions('open'),
        getPositions('closed'),
      ]);
      setOpenPositions(open);
      setClosedPositions(closed);
    } catch (error) {
      console.error('Failed to load positions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadPositions();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadPositions();
  };

  const totalRealizedPnl = closedPositions.reduce((sum, p) => sum + (p.realizedPnl ?? 0), 0);

  const sections: Section[] = [
    { key: 'header' },
    { key: 'open-header' },
    ...openPositions.map<Section>(p => ({ key: p.id, position: p })),
    ...(openPositions.length === 0 ? [{ key: 'open-empty' } as Section] : []),
    { key: 'closed-header' },
    ...closedPositions.map<Section>(p => ({ key: p.id, position: p })),
    ...(closedPositions.length === 0 ? [{ key: 'closed-empty' } as Section] : []),
  ];

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={sections}
        keyExtractor={item => item.key}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => {
          if (item.key === 'header') {
            return (
              <>
                <View style={styles.summaryCard}>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Open Positions</Text>
                    <Text style={styles.summaryValue}>{openPositions.length}</Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Total Closed</Text>
                    <Text style={styles.summaryValue}>{closedPositions.length}</Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Realized P&L</Text>
                    <Text style={[
                      styles.summaryValue,
                      fromStoredPrice(totalRealizedPnl) >= 0 ? styles.pnlPositive : styles.pnlNegative,
                    ]}>
                      {formatPnl(totalRealizedPnl)}
                    </Text>
                  </View>
                </View>
                {closedPositions.length > 0 && (
                  <TouchableOpacity
                    style={styles.exportBtn}
                    onPress={async () => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setExporting(true);
                      try {
                        await exportCSV([...openPositions, ...closedPositions]);
                      } catch (e) {
                        Alert.alert('Export failed', 'Could not generate CSV file.');
                        console.error(e);
                      } finally {
                        setExporting(false);
                      }
                    }}
                    disabled={exporting}
                    activeOpacity={0.7}
                  >
                    {exporting ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <>
                        <Ionicons name="download-outline" size={15} color={colors.primary} />
                        <Text style={styles.exportBtnText}>Export CSV</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </>
            );
          }

          if (item.key === 'open-header') {
            return (
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeader}>Open Positions</Text>
                {openPositions.length > 0 && (
                  <View style={[styles.sectionBadge, { backgroundColor: colors.openBadgeBg }]}>
                    <Text style={[styles.sectionBadgeText, { color: colors.open }]}>{openPositions.length}</Text>
                  </View>
                )}
              </View>
            );
          }

          if (item.key === 'closed-header') {
            return (
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeader}>Closed Positions</Text>
                {closedPositions.length > 0 && (
                  <View style={[styles.sectionBadge, { backgroundColor: colors.closedBadgeBg }]}>
                    <Text style={[styles.sectionBadgeText, { color: colors.profit }]}>{closedPositions.length}</Text>
                  </View>
                )}
              </View>
            );
          }

          if (item.key === 'open-empty') {
            return <EmptyState message="Add your first trade using the + tab." />;
          }

          if (item.key === 'closed-empty') {
            return (
              <View style={styles.emptyMinimal}>
                <Text style={styles.emptyMinimalText}>No closed trades yet.</Text>
              </View>
            );
          }

          if ('position' in item) {
            return (
              <View style={styles.rowWrapper}>
                <PositionRow position={item.position} />
              </View>
            );
          }

          return null;
        }}
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    listContent: { paddingBottom: 24 },
    summaryCard: {
      flexDirection: 'row',
      backgroundColor: c.surface,
      marginHorizontal: 16, marginTop: 16,
      borderRadius: 14, padding: 16,
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.07, shadowRadius: 6, elevation: 2,
    },
    summaryItem: { flex: 1, alignItems: 'center' },
    summaryDivider: {
      width: StyleSheet.hairlineWidth, backgroundColor: c.separator, marginVertical: 4,
    },
    summaryLabel: { fontSize: 11, color: c.textSecondary, marginBottom: 4 },
    summaryValue: { fontSize: 18, fontWeight: '700', color: c.textPrimary },
    sectionHeaderRow: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      marginTop: 20, marginBottom: 8, marginLeft: 20, marginRight: 16,
    },
    sectionHeader: {
      fontSize: 12, fontWeight: '700', color: c.sectionHeader,
      textTransform: 'uppercase', letterSpacing: 0.6,
    },
    sectionBadge: {
      paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10,
    },
    sectionBadgeText: { fontSize: 11, fontWeight: '700' },
    rowWrapper: {
      marginHorizontal: 16, backgroundColor: c.surface,
      borderRadius: 12, marginBottom: 8, overflow: 'hidden',
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
    },
    row: {
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: 12, paddingRight: 12, gap: 12,
    },
    accentBar: { width: 4, alignSelf: 'stretch', borderRadius: 0 },
    avatar: {
      width: 44, height: 44, borderRadius: 10, backgroundColor: c.surfaceHigh,
    },
    avatarFallback: { alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontWeight: '700', fontSize: 14 },
    rowCenter: { flex: 1, minWidth: 0 },
    rowTitleRow: {
      flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4,
    },
    ticker: { fontSize: 16, fontWeight: '700', color: c.textPrimary },
    badge: {
      backgroundColor: c.longBadgeBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
    },
    badgeShort: { backgroundColor: c.shortBadgeBg },
    badgeText: { fontSize: 10, fontWeight: '700', color: c.primary },
    badgeTextShort: { color: c.loss },
    rowSub: { fontSize: 12, color: c.textSecondary },
    rowRight: { alignItems: 'flex-end', minWidth: 70 },
    rowRightSub: { fontSize: 11, color: c.textTertiary, marginTop: 2 },
    pnl: { fontSize: 15, fontWeight: '600' },
    pnlPositive: { color: c.profit },
    pnlNegative: { color: c.loss },
    openLabel: { fontSize: 13, color: c.open, fontWeight: '600' },
    emptyState: {
      alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24,
    },
    emptyIcon: { fontSize: 40, marginBottom: 12 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: c.textPrimary, marginBottom: 6 },
    emptySubtitle: { fontSize: 14, color: c.textSecondary, textAlign: 'center' },
    emptyMinimal: { paddingVertical: 16, paddingHorizontal: 20 },
    emptyMinimalText: { fontSize: 14, color: c.textSecondary },
    exportBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      marginHorizontal: 16, marginTop: 8, marginBottom: 4,
      paddingVertical: 10, borderRadius: 10,
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
    },
    exportBtnText: { fontSize: 13, fontWeight: '600', color: c.primary },
  });
}

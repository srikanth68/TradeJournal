import { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { getPositions, type PositionWithEntries } from '../../src/services/positionService';
import { formatPrice, formatPnl, fromStoredPrice } from '../../src/utils/price';

function TickerAvatar({ ticker, tradeType, logoUrl }: { ticker: string; tradeType: 'buy' | 'short'; logoUrl?: string | null }) {
  if (logoUrl) {
    return (
      <Image
        source={{ uri: logoUrl }}
        style={styles.avatar}
        resizeMode="contain"
      />
    );
  }
  return (
    <View style={[styles.avatar, styles.avatarFallback, tradeType === 'short' && styles.avatarShort]}>
      <Text style={styles.avatarText}>{ticker.slice(0, 2)}</Text>
    </View>
  );
}

function TradeTypeBadge({ type }: { type: 'buy' | 'short' }) {
  return (
    <View style={[styles.badge, type === 'short' && styles.badgeShort]}>
      <Text style={[styles.badgeText, type === 'short' && styles.badgeTextShort]}>
        {type === 'buy' ? 'LONG' : 'SHORT'}
      </Text>
    </View>
  );
}

function PositionRow({ position }: { position: PositionWithEntries }) {
  const isClosed = position.status === 'closed';
  const pnl = position.realizedPnl;
  const avgEntry = position.avgEntryPrice;

  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.7}
      onPress={() => router.push({ pathname: '/position/[id]', params: { id: position.id } })}
    >
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
            <Text style={[styles.pnl, fromStoredPrice(pnl) >= 0 ? styles.pnlPositive : styles.pnlNegative]}>
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
  const [openPositions, setOpenPositions] = useState<PositionWithEntries[]>([]);
  const [closedPositions, setClosedPositions] = useState<PositionWithEntries[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
          <ActivityIndicator size="large" color="#007AFF" />
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
            );
          }

          if (item.key === 'open-header') {
            return <Text style={styles.sectionHeader}>Open Positions</Text>;
          }

          if (item.key === 'closed-header') {
            return <Text style={styles.sectionHeader}>Closed Positions</Text>;
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingBottom: 24 },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16, marginTop: 16,
    borderRadius: 12, padding: 16,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: {
    width: StyleSheet.hairlineWidth, backgroundColor: '#E5E5EA', marginVertical: 4,
  },
  summaryLabel: { fontSize: 11, color: '#8E8E93', marginBottom: 4 },
  summaryValue: { fontSize: 18, fontWeight: '700', color: '#1C1C1E' },
  sectionHeader: {
    fontSize: 13, fontWeight: '600', color: '#6D6D72',
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginTop: 20, marginBottom: 8, marginLeft: 20,
  },
  rowWrapper: {
    marginHorizontal: 16, backgroundColor: '#FFFFFF',
    borderRadius: 12, marginBottom: 8, overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    padding: 12, gap: 12,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 10, backgroundColor: '#F2F2F7',
  },
  avatarFallback: {
    alignItems: 'center', justifyContent: 'center',
  },
  avatarShort: { backgroundColor: '#FF3B30' },
  avatarText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  rowCenter: { flex: 1, minWidth: 0 },
  rowTitleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4,
  },
  ticker: { fontSize: 16, fontWeight: '700', color: '#1C1C1E' },
  badge: {
    backgroundColor: '#E5F1FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  badgeShort: { backgroundColor: '#FFE5E5' },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#007AFF' },
  badgeTextShort: { color: '#FF3B30' },
  rowSub: { fontSize: 12, color: '#8E8E93' },
  rowRight: { alignItems: 'flex-end', minWidth: 70 },
  rowRightSub: { fontSize: 11, color: '#C7C7CC', marginTop: 2 },
  pnl: { fontSize: 15, fontWeight: '600' },
  pnlPositive: { color: '#34C759' },
  pnlNegative: { color: '#FF3B30' },
  openLabel: { fontSize: 13, color: '#FF9500', fontWeight: '600' },
  emptyState: {
    alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24,
  },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1C1C1E', marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: '#8E8E93', textAlign: 'center' },
  emptyMinimal: { paddingVertical: 16, paddingHorizontal: 20 },
  emptyMinimalText: { fontSize: 14, color: '#8E8E93' },
});

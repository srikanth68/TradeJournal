import { eq, isNull, and, gte, asc } from 'drizzle-orm';
import { db, schema } from '../db';
import { fromStoredPrice } from '../utils/price';

export type PeriodFilter = 'week' | 'month' | 'all';

export type TopLevelStats = {
  totalPnl: number;
  winRate: number;
  totalTrades: number;
  profitFactor: number;
  openPositions: number;
};

export type MonthlyPnl = {
  label: string;
  pnl: number;
  wins: number;
  losses: number;
};

export type WinLossDistribution = {
  wins: number;
  losses: number;
  breakeven: number;
};

function getStartDate(filter: PeriodFilter): Date | null {
  if (filter === 'all') return null;
  const now = new Date();
  if (filter === 'week') {
    now.setDate(now.getDate() - 7);
  } else {
    now.setDate(now.getDate() - 30);
  }
  return now;
}

export async function getTopLevelStats(filter: PeriodFilter): Promise<TopLevelStats> {
  const startDate = getStartDate(filter);

  const whereClause = startDate
    ? and(
        eq(schema.positions.status, 'closed'),
        isNull(schema.positions.deletedAt),
        gte(schema.positions.exitDate, startDate),
      )
    : and(eq(schema.positions.status, 'closed'), isNull(schema.positions.deletedAt));

  const closedPositions = await db.query.positions.findMany({
    where: whereClause,
    columns: { realizedPnl: true },
  });

  const openCount = await db.query.positions.findMany({
    where: and(eq(schema.positions.status, 'open'), isNull(schema.positions.deletedAt)),
    columns: { id: true },
  });

  let totalPnlStored = 0;
  let grossWins = 0;
  let grossLosses = 0;
  let wins = 0;

  for (const p of closedPositions) {
    const pnl = p.realizedPnl ?? 0;
    totalPnlStored += pnl;
    if (pnl > 0) {
      wins++;
      grossWins += pnl;
    } else if (pnl < 0) {
      grossLosses += Math.abs(pnl);
    }
  }

  const totalTrades = closedPositions.length;
  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
  const profitFactor = grossLosses > 0 ? grossWins / grossLosses : grossWins > 0 ? Infinity : 0;

  return {
    totalPnl: fromStoredPrice(totalPnlStored),
    winRate,
    totalTrades,
    profitFactor,
    openPositions: openCount.length,
  };
}


export async function getPnlByMonth(months = 6): Promise<MonthlyPnl[]> {
  const closedPositions = await db.query.positions.findMany({
    where: and(eq(schema.positions.status, 'closed'), isNull(schema.positions.deletedAt)),
    columns: { exitDate: true, realizedPnl: true },
    orderBy: [asc(schema.positions.exitDate)],
  });

  // Build a map keyed by "YYYY-MM"
  const map = new Map<string, { pnl: number; wins: number; losses: number }>();

  for (const p of closedPositions) {
    if (!p.exitDate) continue;
    const d = p.exitDate as Date;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const existing = map.get(key) ?? { pnl: 0, wins: 0, losses: 0 };
    const pnl = fromStoredPrice(p.realizedPnl ?? 0);
    existing.pnl += pnl;
    if (pnl > 0) existing.wins++;
    else if (pnl < 0) existing.losses++;
    map.set(key, existing);
  }

  // Build last N months as ordered keys
  const result: MonthlyPnl[] = [];
  const now = new Date();
  const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const data = map.get(key) ?? { pnl: 0, wins: 0, losses: 0 };
    result.push({
      label: SHORT_MONTHS[d.getMonth()],
      pnl: data.pnl,
      wins: data.wins,
      losses: data.losses,
    });
  }

  return result;
}

export type StrategyInsight = {
  strategyId: string;
  strategyName: string;
  totalTrades: number;
  winRate: number;
  totalPnl: number;
  avgWin: number;
  avgLoss: number;
};

export type TimeSlotStat = {
  slot: string;
  trades: number;
  winRate: number;
  avgPnl: number;
};

export async function getStrategyInsights(filter: PeriodFilter): Promise<StrategyInsight[]> {
  const startDate = getStartDate(filter);

  const whereClause = startDate
    ? and(
        eq(schema.positions.status, 'closed'),
        isNull(schema.positions.deletedAt),
        gte(schema.positions.exitDate, startDate),
      )
    : and(eq(schema.positions.status, 'closed'), isNull(schema.positions.deletedAt));

  const positions = await db.query.positions.findMany({
    where: whereClause,
    columns: { strategyId: true, realizedPnl: true },
    with: { strategy: true },
  });

  const map = new Map<string, {
    name: string;
    pnlStored: number;
    count: number;
    wins: number;
    losses: number;
    sumWins: number;
    sumLosses: number;
  }>();

  for (const p of positions) {
    if (!p.strategyId || !p.strategy) continue;
    const pnl = p.realizedPnl ?? 0;
    const existing = map.get(p.strategyId) ?? {
      name: p.strategy.name,
      pnlStored: 0,
      count: 0,
      wins: 0,
      losses: 0,
      sumWins: 0,
      sumLosses: 0,
    };
    existing.pnlStored += pnl;
    existing.count++;
    if (pnl > 0) { existing.wins++; existing.sumWins += pnl; }
    else if (pnl < 0) { existing.losses++; existing.sumLosses += pnl; }
    map.set(p.strategyId, existing);
  }

  const results: StrategyInsight[] = [];
  for (const [strategyId, data] of map.entries()) {
    results.push({
      strategyId,
      strategyName: data.name,
      totalTrades: data.count,
      winRate: data.count > 0 ? (data.wins / data.count) * 100 : 0,
      totalPnl: fromStoredPrice(data.pnlStored),
      avgWin: data.wins > 0 ? fromStoredPrice(data.sumWins / data.wins) : 0,
      avgLoss: data.losses > 0 ? fromStoredPrice(data.sumLosses / data.losses) : 0,
    });
  }

  return results.sort((a, b) => b.totalPnl - a.totalPnl);
}

const TIME_SLOTS = [
  { slot: 'Pre-Market', start: 0, end: 570 },      // before 9:30
  { slot: '9:30–10:00', start: 570, end: 600 },
  { slot: '10:00–11:00', start: 600, end: 660 },
  { slot: '11:00–12:00', start: 660, end: 720 },
  { slot: '12:00–13:00', start: 720, end: 780 },
  { slot: '13:00–14:00', start: 780, end: 840 },
  { slot: '14:00–15:00', start: 840, end: 900 },
  { slot: '15:00–16:00', start: 900, end: 960 },
  { slot: 'After Hours', start: 960, end: 1440 },   // 16:00+
];

function getSlot(date: Date): string {
  const minutes = date.getHours() * 60 + date.getMinutes();
  for (const s of TIME_SLOTS) {
    if (minutes >= s.start && minutes < s.end) return s.slot;
  }
  return 'After Hours';
}

export async function getTimeOfDayStats(filter: PeriodFilter): Promise<TimeSlotStat[]> {
  const startDate = getStartDate(filter);

  const whereClause = startDate
    ? and(
        eq(schema.positions.status, 'closed'),
        isNull(schema.positions.deletedAt),
        gte(schema.positions.exitDate, startDate),
      )
    : and(eq(schema.positions.status, 'closed'), isNull(schema.positions.deletedAt));

  const positions = await db.query.positions.findMany({
    where: whereClause,
    columns: { realizedPnl: true },
    with: { entries: { columns: { entryDate: true }, orderBy: [asc(schema.positionEntries.entryDate)] } },
  });

  const map = new Map<string, { pnlStored: number; wins: number; count: number }>();

  for (const p of positions) {
    if (!p.entries || p.entries.length === 0) continue;
    const firstEntry = p.entries[0];
    if (!firstEntry.entryDate) continue;
    const slot = getSlot(firstEntry.entryDate as Date);
    const pnl = p.realizedPnl ?? 0;
    const existing = map.get(slot) ?? { pnlStored: 0, wins: 0, count: 0 };
    existing.pnlStored += pnl;
    existing.count++;
    if (pnl > 0) existing.wins++;
    map.set(slot, existing);
  }

  return TIME_SLOTS
    .filter((s) => map.has(s.slot))
    .map((s) => {
      const data = map.get(s.slot)!;
      return {
        slot: s.slot,
        trades: data.count,
        winRate: data.count > 0 ? (data.wins / data.count) * 100 : 0,
        avgPnl: data.count > 0 ? fromStoredPrice(data.pnlStored) / data.count : 0,
      };
    });
}

export async function getWinLossDistribution(filter: PeriodFilter): Promise<WinLossDistribution> {
  const startDate = getStartDate(filter);

  const whereClause = startDate
    ? and(
        eq(schema.positions.status, 'closed'),
        isNull(schema.positions.deletedAt),
        gte(schema.positions.exitDate, startDate),
      )
    : and(eq(schema.positions.status, 'closed'), isNull(schema.positions.deletedAt));

  const positions = await db.query.positions.findMany({
    where: whereClause,
    columns: { realizedPnl: true },
  });

  let wins = 0;
  let losses = 0;
  let breakeven = 0;

  for (const p of positions) {
    const pnl = p.realizedPnl ?? 0;
    if (pnl > 0) wins++;
    else if (pnl < 0) losses++;
    else breakeven++;
  }

  return { wins, losses, breakeven };
}

// ── Win Streak ─────────────────────────────────────────────────────────────────
// Returns the number of consecutive calendar days (ending today or yesterday)
// on which the trader had a net-positive P&L.
export async function getWinStreak(): Promise<{ streak: number; isActive: boolean }> {
  const positions = await db.query.positions.findMany({
    where: and(eq(schema.positions.status, 'closed'), isNull(schema.positions.deletedAt)),
    columns: { realizedPnl: true, exitDate: true },
    orderBy: [asc(schema.positions.exitDate)],
  });

  if (positions.length === 0) return { streak: 0, isActive: false };

  // Group by YYYY-MM-DD
  const dayMap = new Map<string, number>();
  for (const p of positions) {
    if (!p.exitDate) continue;
    const d = new Date(p.exitDate);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    dayMap.set(key, (dayMap.get(key) ?? 0) + fromStoredPrice(p.realizedPnl ?? 0));
  }

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // Walk backwards from today
  let streak = 0;
  let isActive = false;
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!dayMap.has(key)) {
      // No trades on this day — skip weekends/holidays for first day check
      if (streak === 0) continue; else break;
    }
    const pnl = dayMap.get(key)!;
    if (pnl > 0) {
      streak++;
      if (key === todayKey) isActive = true;
    } else {
      break;
    }
  }
  return { streak, isActive };
}

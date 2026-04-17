import { db, schema } from './index';
import { generateUUID } from '../utils/uuid';
import { toStoredPrice } from '../utils/price';

const PREDEFINED_STRATEGIES = [
  { name: 'Trend Following', description: 'Trading in the direction of the prevailing trend' },
  { name: 'Breakout', description: 'Entering when price breaks above resistance or below support' },
  { name: 'Pullback', description: 'Entering on a temporary reversal within a larger trend' },
  { name: 'Reversal', description: 'Trading a change in the prevailing trend direction' },
  { name: 'Support & Resistance', description: 'Trading bounces off key support or resistance levels' },
  { name: 'Range Trade', description: 'Buying at support and selling at resistance within a defined range' },
  { name: 'Momentum', description: 'Trading in the direction of strong price movement and volume' },
  { name: 'Gap Trade', description: 'Trading price gaps at market open' },
  { name: 'News Trade', description: 'Trading on significant news events or catalysts' },
  { name: 'Opening Range Breakout', description: 'Trading a breakout from the first 15-30 minutes range' },
  { name: 'VWAP Trade', description: 'Trading around the Volume Weighted Average Price' },
  { name: 'Scalp', description: 'Very short-term trades for small, quick profits' },
  { name: 'Day Trade', description: 'Intraday trade closed before market close' },
  { name: 'Swing Trade', description: 'Holding for days to weeks to capture price swings' },
  { name: 'Position Trade', description: 'Long-term trade held for weeks to months' },
  { name: 'Flag / Pennant', description: 'Trading continuation patterns after a strong move' },
  { name: 'Double Top / Bottom', description: 'Trading reversal at double top or double bottom pattern' },
  { name: 'Head & Shoulders', description: 'Trading the head and shoulders reversal pattern' },
  { name: 'Fibonacci', description: 'Trading retracements and extensions using Fibonacci levels' },
  { name: 'RSI Trade', description: 'Trading overbought/oversold signals using RSI' },
  { name: 'Earnings Play', description: 'Trading around earnings announcements' },
  { name: 'Mean Reversion', description: 'Trading price back toward its historical average' },
  { name: 'Options Trade', description: 'Using options contracts for directional or hedged positions' },
  { name: 'Arbitrage', description: 'Exploiting price differences across markets or instruments' },
  { name: 'Other', description: 'Custom or unlisted strategy' },
];

// ─── Demo trade seed (only runs when no positions exist) ─────────────────────

type DemoTrade = {
  id: string;             // fixed ID — makes seed idempotent
  ticker: string;
  companyName: string;
  tradeType: 'buy' | 'short';
  strategyName: string;
  entryPrice: number;
  exitPrice: number;
  qty: number;
  daysAgo: number;        // how many days ago the trade was closed
  entryHour: number;      // 24h hour of entry
  entryMinute: number;
  tradeGrade?: 'A' | 'B' | 'C' | 'D';
  emotionTag?: 'confident' | 'fomo' | 'hesitant' | 'revenge' | 'bored' | 'patient';
};

const DEMO_TRADES: DemoTrade[] = [
  // Breakout trades
  { id: 'demo-pos-01', ticker: 'AAPL', companyName: 'Apple Inc.', tradeType: 'buy', strategyName: 'Breakout', entryPrice: 190.50, exitPrice: 196.80, qty: 50, daysAgo: 45, entryHour: 9, entryMinute: 45, tradeGrade: 'A', emotionTag: 'confident' },
  { id: 'demo-pos-02', ticker: 'NVDA', companyName: 'NVIDIA Corp.', tradeType: 'buy', strategyName: 'Breakout', entryPrice: 480.00, exitPrice: 495.00, qty: 10, daysAgo: 38, entryHour: 10, entryMinute: 15, tradeGrade: 'B', emotionTag: 'confident' },
  { id: 'demo-pos-03', ticker: 'META', companyName: 'Meta Platforms', tradeType: 'buy', strategyName: 'Breakout', entryPrice: 380.00, exitPrice: 374.00, qty: 20, daysAgo: 32, entryHour: 10, entryMinute: 30, tradeGrade: 'C', emotionTag: 'fomo' },
  { id: 'demo-pos-04', ticker: 'AMD', companyName: 'Advanced Micro Devices', tradeType: 'short', strategyName: 'Breakout', entryPrice: 165.00, exitPrice: 159.00, qty: 40, daysAgo: 25, entryHour: 9, entryMinute: 35, tradeGrade: 'A', emotionTag: 'confident' },
  { id: 'demo-pos-05', ticker: 'TSLA', companyName: 'Tesla Inc.', tradeType: 'buy', strategyName: 'Breakout', entryPrice: 175.00, exitPrice: 183.00, qty: 30, daysAgo: 18, entryHour: 9, entryMinute: 50, tradeGrade: 'B', emotionTag: 'patient' },

  // Momentum trades
  { id: 'demo-pos-06', ticker: 'AMZN', companyName: 'Amazon.com', tradeType: 'buy', strategyName: 'Momentum', entryPrice: 178.00, exitPrice: 183.00, qty: 25, daysAgo: 42, entryHour: 10, entryMinute: 45, tradeGrade: 'A', emotionTag: 'confident' },
  { id: 'demo-pos-07', ticker: 'GOOGL', companyName: 'Alphabet Inc.', tradeType: 'buy', strategyName: 'Momentum', entryPrice: 142.00, exitPrice: 138.00, qty: 30, daysAgo: 28, entryHour: 11, entryMinute: 20, tradeGrade: 'C', emotionTag: 'hesitant' },
  { id: 'demo-pos-08', ticker: 'MSFT', companyName: 'Microsoft Corp.', tradeType: 'buy', strategyName: 'Momentum', entryPrice: 380.00, exitPrice: 391.00, qty: 15, daysAgo: 14, entryHour: 14, entryMinute: 30, tradeGrade: 'A', emotionTag: 'confident' },
  { id: 'demo-pos-09', ticker: 'NFLX', companyName: 'Netflix Inc.', tradeType: 'short', strategyName: 'Momentum', entryPrice: 620.00, exitPrice: 634.00, qty: 10, daysAgo: 8, entryHour: 14, entryMinute: 45, tradeGrade: 'D', emotionTag: 'revenge' },

  // VWAP trades
  { id: 'demo-pos-10', ticker: 'SPY', companyName: 'SPDR S&P 500 ETF', tradeType: 'buy', strategyName: 'VWAP Trade', entryPrice: 475.00, exitPrice: 478.00, qty: 50, daysAgo: 35, entryHour: 10, entryMinute: 0, tradeGrade: 'B', emotionTag: 'patient' },
  { id: 'demo-pos-11', ticker: 'QQQ', companyName: 'Invesco QQQ Trust', tradeType: 'buy', strategyName: 'VWAP Trade', entryPrice: 390.00, exitPrice: 386.00, qty: 30, daysAgo: 20, entryHour: 11, entryMinute: 5, tradeGrade: 'B', emotionTag: 'hesitant' },
  { id: 'demo-pos-12', ticker: 'IWM', companyName: 'iShares Russell 2000', tradeType: 'short', strategyName: 'VWAP Trade', entryPrice: 198.00, exitPrice: 194.00, qty: 40, daysAgo: 6, entryHour: 10, entryMinute: 0, tradeGrade: 'A', emotionTag: 'confident' },

  // Pullback trades
  { id: 'demo-pos-13', ticker: 'AAPL', companyName: 'Apple Inc.', tradeType: 'buy', strategyName: 'Pullback', entryPrice: 188.00, exitPrice: 192.00, qty: 40, daysAgo: 50, entryHour: 15, entryMinute: 10, tradeGrade: 'A', emotionTag: 'confident' },
  { id: 'demo-pos-14', ticker: 'NVDA', companyName: 'NVIDIA Corp.', tradeType: 'buy', strategyName: 'Pullback', entryPrice: 470.00, exitPrice: 462.00, qty: 10, daysAgo: 3, entryHour: 15, entryMinute: 30, tradeGrade: 'C', emotionTag: 'fomo' },

  // Scalp trades
  { id: 'demo-pos-15', ticker: 'SPY', companyName: 'SPDR S&P 500 ETF', tradeType: 'buy', strategyName: 'Scalp', entryPrice: 476.00, exitPrice: 477.50, qty: 100, daysAgo: 10, entryHour: 9, entryMinute: 35, tradeGrade: 'A', emotionTag: 'confident' },
  { id: 'demo-pos-16', ticker: 'QQQ', companyName: 'Invesco QQQ Trust', tradeType: 'short', strategyName: 'Scalp', entryPrice: 392.00, exitPrice: 391.00, qty: 80, daysAgo: 5, entryHour: 9, entryMinute: 40, tradeGrade: 'B', emotionTag: 'patient' },
  { id: 'demo-pos-17', ticker: 'TSLA', companyName: 'Tesla Inc.', tradeType: 'buy', strategyName: 'Scalp', entryPrice: 177.00, exitPrice: 175.00, qty: 20, daysAgo: 2, entryHour: 15, entryMinute: 45, tradeGrade: 'D', emotionTag: 'bored' },
];

export async function seedDemoTrades() {
  const strategies = await db.select().from(schema.strategies);
  const stratMap = new Map(strategies.map(s => [s.name, s.id]));

  const now = Date.now();

  for (const t of DEMO_TRADES) {
    const strategyId = stratMap.get(t.strategyName);
    const storedEntry = toStoredPrice(t.entryPrice);
    const storedExit = toStoredPrice(t.exitPrice);

    const realizedPnl = t.tradeType === 'buy'
      ? Math.round((storedExit - storedEntry) * t.qty)
      : Math.round((storedEntry - storedExit) * t.qty);

    // Exit date: N days ago at 15:55
    const exitDate = new Date(now - t.daysAgo * 86_400_000);
    exitDate.setHours(15, 55, 0, 0);

    // Entry date: same day, at specified hour/minute
    const entryDate = new Date(exitDate);
    entryDate.setHours(t.entryHour, t.entryMinute, 0, 0);

    const createdAt = new Date(entryDate);

    await db.insert(schema.positions)
      .values({
        id: t.id,
        ticker: t.ticker,
        companyName: t.companyName,
        tradeType: t.tradeType,
        status: 'closed',
        strategyId: strategyId ?? null,
        avgEntryPrice: storedEntry,
        totalQuantity: t.qty,
        exitPrice: storedExit,
        exitDate,
        realizedPnl,
        tradeGrade: t.tradeGrade,
        emotionTag: t.emotionTag,
        syncStatus: 'local',
        createdAt,
        updatedAt: exitDate,
      })
      .onConflictDoNothing();

    await db.insert(schema.positionEntries)
      .values({
        id: `${t.id}-entry`,
        positionId: t.id,
        entryPrice: storedEntry,
        quantity: t.qty,
        entryDate,
        createdAt,
        updatedAt: exitDate,
      })
      .onConflictDoNothing();
  }
}

export async function seedStrategies() {
  const existing = await db.select().from(schema.strategies);
  if (existing.length > 0) return;

  await db.insert(schema.strategies).values(
    PREDEFINED_STRATEGIES.map(s => ({
      id: generateUUID(),
      name: s.name,
      description: s.description,
      isPredefined: true,
      createdAt: new Date(),
    }))
  );
}

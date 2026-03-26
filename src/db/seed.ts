import { db, schema } from './index';

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

export async function seedStrategies() {
  const existing = await db.select().from(schema.strategies);
  if (existing.length > 0) return;

  await db.insert(schema.strategies).values(
    PREDEFINED_STRATEGIES.map(s => ({
      id: crypto.randomUUID(),
      name: s.name,
      description: s.description,
      isPredefined: true,
      createdAt: new Date(),
    }))
  );
}

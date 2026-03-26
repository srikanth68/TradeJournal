import { db, schema } from './index';

const PREDEFINED_STRATEGIES = [
  { name: 'Momentum', description: 'Trading in the direction of strong price movement' },
  { name: 'Breakout', description: 'Entering when price breaks above resistance or below support' },
  { name: 'Mean Reversion', description: 'Trading price back toward its historical average' },
  { name: 'Pullback', description: 'Entering on a temporary reversal within a larger trend' },
  { name: 'Gap & Go', description: 'Trading gaps at market open in the gap direction' },
  { name: 'Trend Following', description: 'Following established price trends' },
  { name: 'Support/Resistance', description: 'Trading bounces off key support or resistance levels' },
  { name: 'Earnings Play', description: 'Trading around earnings announcements' },
  { name: 'News Catalyst', description: 'Trading on significant news events' },
  { name: 'Swing Trade', description: 'Holding positions for days to weeks to capture price swings' },
  { name: 'Scalp', description: 'Very short-term trades for small, quick profits' },
  { name: 'VWAP Reclaim', description: 'Trading when price reclaims VWAP after losing it' },
  { name: 'Moving Average Crossover', description: 'Trading when fast MA crosses slow MA' },
  { name: 'Options Play', description: 'Using options contracts for leveraged positions' },
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

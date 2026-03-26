import { eq, desc, isNull } from 'drizzle-orm';
import { db, schema } from '../db';
import { toStoredPrice } from '../utils/price';
import type { NewPosition, NewPositionEntry, Position, PositionEntry } from '../db/schema';

export type PositionWithEntries = Position & { entries: PositionEntry[] };

type CreatePositionData = {
  ticker: string;
  companyName?: string;
  tradeType: 'buy' | 'short';
  entryPrice: number;
  quantity: number;
  entryDate: Date;
  strategyId?: string;
  setupNotes?: string;
  tradeGrade?: 'A' | 'B' | 'C' | 'D';
  emotionTag?: 'confident' | 'fomo' | 'hesitant' | 'revenge' | 'bored' | 'patient';
  stopLossPrice?: number;
  targetPrice?: number;
  commission?: number;
};

type AddEntryData = {
  entryPrice: number;
  quantity: number;
  entryDate: Date;
  commission?: number;
  notes?: string;
  executionType?: 'market' | 'limit' | 'stop';
};

export async function createPosition(data: CreatePositionData): Promise<string> {
  const positionId = crypto.randomUUID();
  const entryId = crypto.randomUUID();
  const now = new Date();
  const storedEntryPrice = toStoredPrice(data.entryPrice);

  const newPosition: NewPosition = {
    id: positionId,
    ticker: data.ticker.toUpperCase(),
    companyName: data.companyName,
    tradeType: data.tradeType,
    status: 'open',
    strategyId: data.strategyId,
    setupNotes: data.setupNotes,
    tradeGrade: data.tradeGrade,
    emotionTag: data.emotionTag,
    stopLossPrice: data.stopLossPrice != null ? toStoredPrice(data.stopLossPrice) : undefined,
    targetPrice: data.targetPrice != null ? toStoredPrice(data.targetPrice) : undefined,
    avgEntryPrice: storedEntryPrice,
    totalQuantity: data.quantity,
    syncStatus: 'local',
    createdAt: now,
    updatedAt: now,
  };

  const newEntry: NewPositionEntry = {
    id: entryId,
    positionId,
    entryPrice: storedEntryPrice,
    quantity: data.quantity,
    commission: data.commission != null ? toStoredPrice(data.commission) : undefined,
    entryDate: data.entryDate,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(schema.positions).values(newPosition);
  await db.insert(schema.positionEntries).values(newEntry);

  return positionId;
}

export async function addEntry(positionId: string, entryData: AddEntryData): Promise<void> {
  const position = await db.query.positions.findFirst({
    where: eq(schema.positions.id, positionId),
    with: { entries: true },
  });

  if (!position) throw new Error(`Position ${positionId} not found`);
  if (position.status !== 'open') throw new Error('Cannot add entry to a closed position');

  const storedEntryPrice = toStoredPrice(entryData.entryPrice);
  const now = new Date();

  await db.insert(schema.positionEntries).values({
    id: crypto.randomUUID(),
    positionId,
    entryPrice: storedEntryPrice,
    quantity: entryData.quantity,
    commission: entryData.commission != null ? toStoredPrice(entryData.commission) : undefined,
    entryDate: entryData.entryDate,
    notes: entryData.notes,
    executionType: entryData.executionType,
    createdAt: now,
    updatedAt: now,
  });

  // Recalculate weighted average entry price
  const entries = await db.select().from(schema.positionEntries).where(eq(schema.positionEntries.positionId, positionId));
  const totalQty = entries.reduce((sum, e) => sum + e.quantity, 0);
  const weightedSum = entries.reduce((sum, e) => sum + e.entryPrice * e.quantity, 0);
  const newAvg = Math.round(weightedSum / totalQty);

  await db
    .update(schema.positions)
    .set({ avgEntryPrice: newAvg, totalQuantity: totalQty, updatedAt: now })
    .where(eq(schema.positions.id, positionId));
}

export async function closePosition(
  positionId: string,
  exitPrice: number,
  exitDate: Date,
  exitCommission?: number,
): Promise<void> {
  const position = await db.query.positions.findFirst({
    where: eq(schema.positions.id, positionId),
  });

  if (!position) throw new Error(`Position ${positionId} not found`);
  if (position.status !== 'open') throw new Error('Position is already closed');

  const storedExitPrice = toStoredPrice(exitPrice);
  const storedExitCommission = exitCommission != null ? toStoredPrice(exitCommission) : 0;
  const qty = position.totalQuantity ?? 0;
  const avgEntry = position.avgEntryPrice ?? 0;

  let realizedPnl: number;
  if (position.tradeType === 'buy') {
    realizedPnl = Math.round((storedExitPrice - avgEntry) * qty - storedExitCommission);
  } else {
    realizedPnl = Math.round((avgEntry - storedExitPrice) * qty - storedExitCommission);
  }

  await db
    .update(schema.positions)
    .set({
      status: 'closed',
      exitPrice: storedExitPrice,
      exitDate,
      exitCommission: storedExitCommission > 0 ? storedExitCommission : undefined,
      realizedPnl,
      updatedAt: new Date(),
    })
    .where(eq(schema.positions.id, positionId));
}

export async function getPositions(status?: 'open' | 'closed'): Promise<PositionWithEntries[]> {
  const results = await db.query.positions.findMany({
    where: status
      ? eq(schema.positions.status, status)
      : isNull(schema.positions.deletedAt),
    with: { entries: true },
    orderBy: [desc(schema.positions.createdAt)],
  });

  return results as PositionWithEntries[];
}

export async function getPosition(id: string): Promise<PositionWithEntries | undefined> {
  const result = await db.query.positions.findFirst({
    where: eq(schema.positions.id, id),
    with: { entries: true },
  });

  return result as PositionWithEntries | undefined;
}

type UpdatePositionData = {
  setupNotes?: string | null;
  notes?: string | null;
  tradeGrade?: 'A' | 'B' | 'C' | 'D' | null;
  emotionTag?: 'confident' | 'fomo' | 'hesitant' | 'revenge' | 'bored' | 'patient' | null;
  targetPrice?: number | null;
  stopLossPrice?: number | null;
};

export async function updatePosition(id: string, data: UpdatePositionData): Promise<void> {
  await db
    .update(schema.positions)
    .set({
      setupNotes: data.setupNotes,
      notes: data.notes,
      tradeGrade: data.tradeGrade ?? undefined,
      emotionTag: data.emotionTag ?? undefined,
      targetPrice: data.targetPrice != null ? toStoredPrice(data.targetPrice) : undefined,
      stopLossPrice: data.stopLossPrice != null ? toStoredPrice(data.stopLossPrice) : undefined,
      updatedAt: new Date(),
    })
    .where(eq(schema.positions.id, id));
}

export async function softDeletePosition(id: string): Promise<void> {
  await db
    .update(schema.positions)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.positions.id, id));
}

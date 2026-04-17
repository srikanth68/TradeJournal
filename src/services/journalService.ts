import { eq, and, isNull, desc } from 'drizzle-orm';
import { db, schema } from '../db';
import { generateUUID } from '../utils/uuid';
import type { DailyJournal } from '../db/schema';

export type { DailyJournal };

export async function getJournalEntries(): Promise<DailyJournal[]> {
  return db
    .select()
    .from(schema.dailyJournals)
    .where(isNull(schema.dailyJournals.deletedAt))
    .orderBy(desc(schema.dailyJournals.date));
}

export async function getJournalEntry(date: string): Promise<DailyJournal | null> {
  const results = await db
    .select()
    .from(schema.dailyJournals)
    .where(and(eq(schema.dailyJournals.date, date), isNull(schema.dailyJournals.deletedAt)));
  return results[0] ?? null;
}

export async function upsertJournalEntry(
  date: string,
  data: { marketNotes?: string; mindsetNotes?: string; lessons?: string },
): Promise<void> {
  const existing = await getJournalEntry(date);
  const now = new Date();
  if (existing) {
    await db
      .update(schema.dailyJournals)
      .set({ ...data, updatedAt: now })
      .where(eq(schema.dailyJournals.id, existing.id));
  } else {
    await db.insert(schema.dailyJournals).values({
      id: generateUUID(),
      date,
      ...data,
      createdAt: now,
      updatedAt: now,
    });
  }
}

export async function deleteJournalEntry(id: string): Promise<void> {
  await db
    .update(schema.dailyJournals)
    .set({ deletedAt: new Date() })
    .where(eq(schema.dailyJournals.id, id));
}

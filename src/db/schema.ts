import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

export const strategies = sqliteTable('strategies', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull().unique(),
  description: text('description'),
  isPredefined: integer('is_predefined', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
});

export const positions = sqliteTable('positions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id'),
  ticker: text('ticker').notNull(),
  companyName: text('company_name'),
  companyLogoUrl: text('company_logo_url'),
  exchange: text('exchange'),
  currency: text('currency').notNull().default('USD'),
  tradeType: text('trade_type', { enum: ['buy', 'short'] }).notNull(),
  status: text('status', { enum: ['open', 'closed'] }).notNull().default('open'),
  strategyId: text('strategy_id').references(() => strategies.id),
  tags: text('tags', { mode: 'json' }).$type<string[]>(),
  avgEntryPrice: integer('avg_entry_price'),
  totalQuantity: real('total_quantity'),
  exitPrice: integer('exit_price'),
  exitDate: integer('exit_date', { mode: 'timestamp_ms' }),
  exitCommission: integer('exit_commission'),
  realizedPnl: integer('realized_pnl'),
  targetPrice: integer('target_price'),
  stopLossPrice: integer('stop_loss_price'),
  setupNotes: text('setup_notes'),
  notes: text('notes'),
  tradeGrade: text('trade_grade', { enum: ['A', 'B', 'C', 'D'] }),
  emotionTag: text('emotion_tag', { enum: ['confident', 'fomo', 'hesitant', 'revenge', 'bored', 'patient'] }),
  chartScreenshotUrl: text('chart_screenshot_url'),
  marketSession: text('market_session', { enum: ['regular', 'pre', 'post', 'overnight'] }),
  executionType: text('execution_type', { enum: ['market', 'limit', 'stop'] }),
  optionType: text('option_type', { enum: ['call', 'put'] }),
  strikePrice: integer('strike_price'),
  expiryDate: integer('expiry_date', { mode: 'timestamp_ms' }),
  contractMultiplier: integer('contract_multiplier').default(100),
  syncStatus: text('sync_status', { enum: ['local', 'synced', 'pending', 'conflict'] }).notNull().default('local'),
  lastSyncedAt: integer('last_synced_at', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
});

export const positionEntries = sqliteTable('position_entries', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  positionId: text('position_id').notNull().references(() => positions.id),
  entryPrice: integer('entry_price').notNull(),
  quantity: real('quantity').notNull(),
  commission: integer('commission'),
  entryDate: integer('entry_date', { mode: 'timestamp_ms' }).notNull(),
  notes: text('notes'),
  executionType: text('execution_type', { enum: ['market', 'limit', 'stop'] }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
});

export const strategiesRelations = relations(strategies, ({ many }) => ({
  positions: many(positions),
}));

export const positionsRelations = relations(positions, ({ one, many }) => ({
  strategy: one(strategies, { fields: [positions.strategyId], references: [strategies.id] }),
  entries: many(positionEntries),
}));

export const positionEntriesRelations = relations(positionEntries, ({ one }) => ({
  position: one(positions, { fields: [positionEntries.positionId], references: [positions.id] }),
}));

export type Strategy = typeof strategies.$inferSelect;
export type NewStrategy = typeof strategies.$inferInsert;
export type Position = typeof positions.$inferSelect;
export type NewPosition = typeof positions.$inferInsert;
export type PositionEntry = typeof positionEntries.$inferSelect;
export type NewPositionEntry = typeof positionEntries.$inferInsert;

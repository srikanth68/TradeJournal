# TradeJournal — Data Model

**Version:** 1.0
**Date:** 2026-03-22
**Status:** Active

This document defines the complete data model for TradeJournal, including all tables, fields, indexes, constraints, and the reasoning behind every significant design decision. This is a living document — it will be updated as the schema evolves across phases.

---

## Design Decisions

### 1. Primary Keys: UUIDs over Integers

**Decision:** All tables use UUID (text) primary keys.

**Why:** TradeJournal is offline-first in Phase 1 and migrates to cloud sync in Phase 2. If we used auto-incrementing integers, two devices could both generate `id = 1` independently, creating unresolvable collisions during sync. UUIDs are generated client-side, are globally unique, and migrate cleanly from SQLite to Supabase PostgreSQL with zero conflict risk.

```ts
id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID())
```

---

### 2. Price Storage: INTEGER Scaled ×10,000 (not REAL)

**Decision:** All monetary values (prices, P&L, commission) are stored as integers scaled by 10,000. `$149.99` is stored as `1,499,900`.

**Why:** Floating-point arithmetic is not safe for financial calculations. In IEEE 754:
```
0.1 + 0.2 = 0.30000000000000004
```
This kind of drift silently corrupts P&L totals, win rates, and equity curves. Storing integers eliminates it entirely.

**Utility functions** (add these to `src/utils/price.ts`):
```ts
export const toStoredPrice = (price: number): number =>
  Math.round(price * 10_000);

export const fromStoredPrice = (stored: number): number =>
  stored / 10_000;

export const formatPrice = (stored: number, currency = 'USD'): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency })
    .format(fromStoredPrice(stored));
```

All UI inputs accept decimal prices and call `toStoredPrice()` before writing to the DB. All UI displays call `fromStoredPrice()` before rendering.

---

### 3. Soft Deletes (deleted_at)

**Decision:** All tables use a `deleted_at` nullable timestamp instead of hard DELETE operations.

**Why:**
- A trade journal is an audit document. Hard-deleting a closed position silently corrupts all-time P&L, win rates, and equity curves.
- Soft deletes make Phase 2 cloud sync tractable. When Device A deletes a record, Device B has no way to know unless the deletion is recorded as a mutation.
- Enables undo/recovery — a user who accidentally deletes a trade can have it restored.

**Querying:** All queries must include `WHERE deleted_at IS NULL`. Drizzle makes this clean with a base query filter.

---

### 4. Cloud Sync Readiness

**Decision:** Add `user_id`, `sync_status`, and `last_synced_at` as nullable columns to the `positions` and `position_entries` tables now, even though they are unused in Phase 1.

**Why:** When Phase 2 arrives, making these required columns means a migration that touches every existing row. Adding them nullable now means the Phase 2 migration is:
1. Populate `user_id` on all local records from the new Supabase auth user ID
2. Push records to Supabase
3. Set `sync_status = 'synced'`

That's a data backfill, not a schema redesign.

---

### 5. Computed Fields: Stored + Recalculated

**Decision:** `avg_entry_price`, `total_quantity`, and `realized_pnl` are stored as columns on `positions` but recalculated and updated whenever their inputs change.

**Why:** Pure calculation on every read (summing entries on the fly) is fine for a single position but becomes expensive in Phase 2 when rendering a list of 500 positions with P&L for each. Stored values keep list rendering fast. The cost is maintaining consistency — any mutation to entries must trigger a recalculation.

**Recalculation triggers:**
- A `position_entry` is inserted, updated, or soft-deleted
- `exit_price` or `exit_commission` on a `position` is set or changed

---

### 6. Two Notes Fields: setup_notes + notes

**Decision:** `positions` has both `setup_notes` (pre-trade) and `notes` (post-trade).

**Why:** This is the difference between a trade *log* and a trade *journal*. `setup_notes` captures your thesis before you enter — "Breaking out of 3-week consolidation, volume confirming." `notes` captures your review after — "Entered too early, should have waited for the daily close." Keeping them separate makes it possible to compare pre-trade intent with post-trade outcome, which is the core of strategy improvement.

---

## Tables

### `strategies`

Predefined and custom trading strategies. Predefined entries are seeded at first app launch.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | text | PK, UUID | |
| `name` | text | NOT NULL, UNIQUE | |
| `description` | text | nullable | |
| `is_predefined` | integer | NOT NULL, default 1 | 1 = seeded, 0 = user-created |
| `created_at` | integer | NOT NULL | Unix timestamp ms |
| `deleted_at` | integer | nullable | Soft delete |

**Predefined strategies (seed data):**
Momentum, Breakout, Mean Reversion, Pullback, Gap & Go, Trend Following, Support/Resistance, Earnings Play, News Catalyst, Swing Trade, Scalp, VWAP Reclaim, Moving Average Crossover, Options Play

---

### `positions`

Represents a trader's complete position in a ticker — from first entry to close. A position can have multiple entries (see `position_entries`).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | text | PK, UUID | |
| `user_id` | text | nullable | Populated in Phase 2 on cloud sync |
| `ticker` | text | NOT NULL | Indexed |
| `company_name` | text | nullable | Auto-filled from Polygon.io |
| `company_logo_url` | text | nullable | From Clearbit |
| `exchange` | text | nullable | e.g. NYSE, NASDAQ, CRYPTO |
| `currency` | text | NOT NULL, default 'USD' | ISO 4217, 3 chars |
| `trade_type` | text | NOT NULL | 'buy' \| 'short' |
| `status` | text | NOT NULL | 'open' \| 'closed' |
| `strategy_id` | text | FK → strategies.id, nullable | Indexed |
| `tags` | text | nullable | JSON array of custom string tags |
| `avg_entry_price` | integer | nullable | Stored, scaled ×10,000. Recalculated. |
| `total_quantity` | real | nullable | Stored. Recalculated. |
| `exit_price` | integer | nullable | Scaled ×10,000 |
| `exit_date` | integer | nullable | Unix timestamp ms |
| `exit_commission` | integer | nullable | Scaled ×10,000 |
| `realized_pnl` | integer | nullable | Stored, scaled ×10,000. Recalculated. |
| `target_price` | integer | nullable | Pre-trade plan. Scaled ×10,000. |
| `stop_loss_price` | integer | nullable | Pre-trade plan. Scaled ×10,000. |
| `setup_notes` | text | nullable | Pre-trade thesis (WHY you entered) |
| `notes` | text | nullable | Post-trade review |
| `market_session` | text | nullable | 'regular' \| 'pre' \| 'post' \| 'overnight' |
| `execution_type` | text | nullable | 'market' \| 'limit' \| 'stop' |
| `option_type` | text | nullable | 'call' \| 'put' — options only |
| `strike_price` | integer | nullable | Scaled ×10,000 — options only |
| `expiry_date` | integer | nullable | Unix timestamp ms — options only |
| `contract_multiplier` | integer | nullable, default 100 | Options/futures only |
| `trade_grade` | text | nullable | 'A' \| 'B' \| 'C' \| 'D' — execution quality, independent of P&L outcome |
| `emotion_tag` | text | nullable | 'confident' \| 'fomo' \| 'hesitant' \| 'revenge' \| 'bored' \| 'patient' |
| `chart_screenshot_url` | text | nullable | Local file URI in Phase 1; remote URL in Phase 2 (Phase 2 feature) |
| `sync_status` | text | NOT NULL, default 'local' | 'local' \| 'synced' \| 'pending' \| 'conflict' |
| `last_synced_at` | integer | nullable | Unix timestamp ms |
| `created_at` | integer | NOT NULL | Unix timestamp ms. Indexed. |
| `updated_at` | integer | NOT NULL | Unix timestamp ms |
| `deleted_at` | integer | nullable | Soft delete. Indexed. |

---

### `position_entries`

Each individual buy or add to a position. A position must have at least one entry.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | text | PK, UUID | |
| `position_id` | text | FK → positions.id, NOT NULL | Indexed |
| `entry_price` | integer | NOT NULL, > 0 | Scaled ×10,000 |
| `quantity` | real | NOT NULL, > 0 | Number of shares/contracts |
| `commission` | integer | nullable | Scaled ×10,000 |
| `entry_date` | integer | NOT NULL | Unix timestamp ms. Indexed. |
| `notes` | text | nullable | Notes specific to this entry |
| `execution_type` | text | nullable | 'market' \| 'limit' \| 'stop' |
| `created_at` | integer | NOT NULL | Unix timestamp ms |
| `updated_at` | integer | NOT NULL | Unix timestamp ms |
| `deleted_at` | integer | nullable | Soft delete |

---

## Indexes

```sql
-- positions
CREATE INDEX idx_positions_ticker ON positions(ticker);
CREATE INDEX idx_positions_status ON positions(status);
CREATE INDEX idx_positions_strategy_id ON positions(strategy_id);
CREATE INDEX idx_positions_created_at ON positions(created_at);
CREATE INDEX idx_positions_user_id ON positions(user_id);
CREATE INDEX idx_positions_deleted_at ON positions(deleted_at);

-- position_entries
CREATE INDEX idx_entries_position_id ON position_entries(position_id);
CREATE INDEX idx_entries_entry_date ON position_entries(entry_date);
```

---

## Check Constraints

```sql
-- position_entries
CHECK (entry_price > 0)
CHECK (quantity > 0)

-- positions
CHECK (trade_type IN ('buy', 'short'))
CHECK (status IN ('open', 'closed'))
CHECK (length(currency) = 3)
CHECK (market_session IN ('regular', 'pre', 'post', 'overnight') OR market_session IS NULL)
CHECK (execution_type IN ('market', 'limit', 'stop') OR execution_type IS NULL)
CHECK (option_type IN ('call', 'put') OR option_type IS NULL)
CHECK (trade_grade IN ('A', 'B', 'C', 'D') OR trade_grade IS NULL)
CHECK (emotion_tag IN ('confident', 'fomo', 'hesitant', 'revenge', 'bored', 'patient') OR emotion_tag IS NULL)
```

---

## Computed Field Rules

**avg_entry_price** (on positions):
```
SUM(entry_price × quantity) / SUM(quantity)
-- across all position_entries WHERE position_id = ? AND deleted_at IS NULL
```

**total_quantity** (on positions):
```
SUM(quantity)
-- across all position_entries WHERE position_id = ? AND deleted_at IS NULL
```

**realized_pnl** (on positions, when closed):
```
-- For 'buy' positions:
(exit_price - avg_entry_price) × total_quantity - total_commissions

-- For 'short' positions:
(avg_entry_price - exit_price) × total_quantity - total_commissions

-- total_commissions = SUM(commission from all entries) + exit_commission
-- All values scaled ×10,000; result is also scaled ×10,000
```

**Recalculation triggers:**
- Any INSERT, UPDATE, or soft-DELETE on `position_entries`
- Any UPDATE to `exit_price` or `exit_commission` on `positions`

---

## Drizzle ORM Schema (TypeScript)

```ts
// src/db/schema.ts
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

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
  marketSession: text('market_session', { enum: ['regular', 'pre', 'post', 'overnight'] }),
  executionType: text('execution_type', { enum: ['market', 'limit', 'stop'] }),
  optionType: text('option_type', { enum: ['call', 'put'] }),
  strikePrice: integer('strike_price'),
  expiryDate: integer('expiry_date', { mode: 'timestamp_ms' }),
  contractMultiplier: integer('contract_multiplier').default(100),
  tradeGrade: text('trade_grade', { enum: ['A', 'B', 'C', 'D'] }),
  emotionTag: text('emotion_tag', { enum: ['confident', 'fomo', 'hesitant', 'revenge', 'bored', 'patient'] }),
  chartScreenshotUrl: text('chart_screenshot_url'),
  syncStatus: text('sync_status', { enum: ['local', 'synced', 'pending', 'conflict'] })
    .notNull()
    .default('local'),
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

// Type exports
export type Strategy = typeof strategies.$inferSelect;
export type NewStrategy = typeof strategies.$inferInsert;
export type Position = typeof positions.$inferSelect;
export type NewPosition = typeof positions.$inferInsert;
export type PositionEntry = typeof positionEntries.$inferSelect;
export type NewPositionEntry = typeof positionEntries.$inferInsert;
```

---

## Phase Migration Notes

### Phase 1 → Phase 2 (Cloud Sync)
1. User creates a Supabase account (email/password or OAuth)
2. One-time migration: push all local SQLite records to Supabase
3. Set `user_id` on all records to the new Supabase user UUID
4. Set `sync_status = 'synced'` after successful push
5. Handle duplicate prevention: check by `id` (UUID) before inserting
6. Handle conflicts: last-write-wins by `updated_at` for simplicity in Phase 2

### Phase 1.5 → Phase 2 (Chart Screenshots)
- `chart_screenshot_url` stores a local file URI in Phase 1 (e.g. `file:///...`)
- In Phase 2, upload to Supabase Storage and replace with remote URL
- No schema change required — just the value of the column changes

### Phase 2 additions
Add new tables:
```ts
// daily_journals — freeform daily trading notes
daily_journals: { id, user_id, date (unique), market_notes, mindset_notes,
                  lessons, created_at, updated_at, deleted_at }
```

### Phase 2 → Phase 3 (AI Analysis)
Add two new tables:
```ts
// trade_plans — pre-trade proposals
trade_plans: { id, user_id, ticker, direction, entry_target, stop_loss,
               take_profit, rationale, status, created_at, updated_at }

// ai_analyses — AI responses linked to plans or positions
ai_analyses: { id, user_id, entity_type, entity_id, model, prompt_version,
               response, created_at }
```

---

## What's NOT in This Schema (and Why)

| Omitted | Reason |
|---|---|
| `unrealized_pnl` | Requires live price data — Phase 2 feature with market data integration |
| `risk_reward_ratio` | Computed from `target_price` / `stop_loss_price` — no need to store |
| `percent_return` | Computed from `realized_pnl` / cost basis — no need to store |
| Separate `fills` table | `position_entries` serves this purpose at the resolution needed |
| `broker_id` / `account_id` | Broker integration is out of scope; add in a future phase if needed |

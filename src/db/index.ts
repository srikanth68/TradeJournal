import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import * as schema from './schema';

const expo = openDatabaseSync('tradejournal.db', { enableChangeListener: true });

// ─── Run migrations synchronously at module load ──────────────────────────────
// Ensures all tables exist before any component mounts and queries the DB.
expo.runSync(`CREATE TABLE IF NOT EXISTS strategies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_predefined INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  deleted_at INTEGER
)`);

expo.runSync(`CREATE TABLE IF NOT EXISTS positions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  ticker TEXT NOT NULL,
  company_name TEXT,
  company_logo_url TEXT,
  exchange TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  trade_type TEXT NOT NULL CHECK(trade_type IN ('buy','short')),
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
  strategy_id TEXT REFERENCES strategies(id),
  tags TEXT,
  avg_entry_price INTEGER,
  total_quantity REAL,
  exit_price INTEGER,
  exit_date INTEGER,
  exit_commission INTEGER,
  realized_pnl INTEGER,
  target_price INTEGER,
  stop_loss_price INTEGER,
  setup_notes TEXT,
  notes TEXT,
  trade_grade TEXT CHECK(trade_grade IN ('A','B','C','D')),
  emotion_tag TEXT CHECK(emotion_tag IN ('confident','fomo','hesitant','revenge','bored','patient')),
  chart_screenshot_url TEXT,
  market_session TEXT CHECK(market_session IN ('regular','pre','post','overnight')),
  execution_type TEXT CHECK(execution_type IN ('market','limit','stop')),
  option_type TEXT CHECK(option_type IN ('call','put')),
  strike_price INTEGER,
  expiry_date INTEGER,
  contract_multiplier INTEGER DEFAULT 100,
  sync_status TEXT NOT NULL DEFAULT 'local' CHECK(sync_status IN ('local','synced','pending','conflict')),
  last_synced_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
)`);

expo.runSync(`CREATE TABLE IF NOT EXISTS daily_journals (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,
  market_notes TEXT,
  mindset_notes TEXT,
  lessons TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
)`);

expo.runSync(`CREATE TABLE IF NOT EXISTS position_entries (
  id TEXT PRIMARY KEY,
  position_id TEXT NOT NULL REFERENCES positions(id),
  entry_price INTEGER NOT NULL,
  quantity REAL NOT NULL,
  commission INTEGER,
  entry_date INTEGER NOT NULL,
  notes TEXT,
  execution_type TEXT CHECK(execution_type IN ('market','limit','stop')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
)`);

export const db = drizzle(expo, { schema });
export { schema };

// No-op — migrations now run synchronously above. Kept for call-site compatibility.
export async function runMigrations() {}

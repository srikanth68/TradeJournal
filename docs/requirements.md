# TradeJournal — Product Requirements Document

**Version:** 1.0
**Date:** 2026-03-22
**Status:** Active

---

## 1. Product Overview

TradeJournal is a cross-platform mobile application (iOS and Android) designed to help individual traders log trades, analyse performance, and improve their strategy over time. It starts as a lightweight, offline-capable trade logger and evolves into an AI-assisted trading analysis tool.

### Goals

- Reduce the friction of logging trades on mobile (most existing solutions are desktop-first or spreadsheet-based)
- Give traders clear, actionable insights into their historical performance
- Enable data-driven trade planning through AI-assisted analysis
- Serve as a portfolio-quality demonstration of mobile, cloud, and AI engineering

### Target User

An individual retail trader who trades equities (and eventually options/futures), is comfortable with mobile apps, and wants to improve their performance through systematic self-review. They may trade on a desktop brokerage but want to log and review trades on their phone.

---

## 2. Phase 1 — MVP

### 2.1 Manual Trade Logging

**Description:** Users can log a single trade at a time through a mobile-optimised form.

**Fields:**
- Ticker / Symbol (required)
- Trade type: Buy / Short (required)
- Entry price (required)
- Exit price (optional at entry, required to close)
- Quantity (required)
- Date & time (required, defaults to now)
- Strategy tag (optional, selected from predefined list)
- Setup notes (optional — pre-trade thesis, WHY the user entered)
- Notes (optional — post-trade review)
- Trade grade (optional — A/B/C/D, rates execution quality independent of P&L)
- Emotion tag (optional — Confident / FOMO / Hesitant / Revenge / Bored / Patient)
- Stop loss price (optional)
- Target price (optional)
- Status: Open / Closed (system-managed)

**Acceptance Criteria:**
- User can open the Add Trade screen in ≤2 taps from the home screen
- All required fields are validated before submission
- A submitted trade appears immediately in the Trade Log
- Trades persist across app restarts (local SQLite storage)

### 2.2 Market Data Auto-fill

**Description:** When a user enters a ticker symbol, the app fetches the current/last price and pre-fills the entry price field.

**Acceptance Criteria:**
- Ticker lookup triggers after the user finishes typing (debounced, ≥2 characters)
- Fetched price pre-fills the entry price field (user can override)
- If the API is unavailable or the ticker is not found, a clear error message is shown and the field remains editable
- Results are cached for 15 minutes to prevent rate limit issues
- App remains fully functional offline (auto-fill gracefully disabled)

### 2.3 Trade Log View

**Description:** A scrollable list of all logged trades, ordered by date (most recent first).

**Acceptance Criteria:**
- Each row shows: ticker, trade type, entry price, exit price (or "Open"), P&L (or "—" for open trades), date
- Tapping a row opens the Trade Detail view
- Open and closed trades are visually distinguishable

### 2.4 Trade Detail View

**Description:** Full view of a single trade with all fields.

**Acceptance Criteria:**
- All logged fields are displayed
- Closed trades show calculated P&L and return %
- User can edit or delete a trade from the detail view
- Delete requires a confirmation step

### 2.5 Local Storage

**Description:** All data is stored locally on-device using SQLite via Drizzle ORM.

**Acceptance Criteria:**
- Data persists across app restarts and device reboots
- No internet connection required for any Phase 1 feature (except auto-fill)
- Schema supports nullable fields for options/futures (expiry, strike, contract_multiplier) even if UI doesn't expose them

---

## 3. Phase 2 — Analytics & Cloud Sync

### 3.1 Performance Summaries

- Weekly and monthly trade summaries (total trades, win rate, gross P&L, net P&L)
- Filterable by date range and strategy tag

### 3.2 Strategy Insights

- Win rate per strategy tag
- Average win and average loss per strategy
- P&L by strategy over time
- Best and worst performing strategies

### 3.3 Dashboard

- Chart views: equity curve, P&L by week/month, win/loss distribution
- Top-level stats: all-time win rate, total P&L, average R:R

### 3.4 Cloud Sync & Auth

- User account creation and login (Supabase Auth)
- On first login: one-time migration of local SQLite data to Supabase
- Data accessible from any device after migration
- Offline writes queue and sync when connectivity is restored

### 3.5 Chart Screenshot Attachment

- User can attach a screenshot of their chart setup to a position
- Phase 1: stored as a local file URI on-device
- Phase 2: uploaded to Supabase Storage, accessible across devices
- Displayed in the trade detail view

### 3.6 Daily Journal

- Freeform daily entry separate from individual trades
- Fields: market conditions, mindset notes, lessons learned
- One entry per day (date is unique key)
- Accessible from a dedicated Journal tab

### 3.7 Time-of-Day Analytics

- Analytics breakdown by hour of entry (9:30–10:00, 10:00–11:00, etc.)
- Surfaces win rate and average P&L by time slot
- Helps traders identify their peak performance windows

### 3.8 CSV / PDF Export

- User can export their full trade history as CSV (for spreadsheet analysis or taxes)
- User can export a monthly/weekly performance report as PDF
- Export is triggered from the dashboard or settings screen

---

## 4. Phase 3 — AI-Powered Trade Planning

### 4.1 Trade Plan Builder

- User creates a trade proposal: ticker, direction, entry target, stop loss, take profit, rationale
- Plans are saved and timestamped

### 4.2 Historical Analysis

- App compares the proposed trade against historical trades with similar characteristics (same ticker, same strategy tag, similar setup)
- Surfaces relevant stats: "You've traded this ticker 8 times with this strategy. Win rate: 62%. Avg return: 3.2%."

### 4.3 AI Analysis

- User can request AI analysis of a trade proposal
- AI model (accessed via Supabase Edge Functions) evaluates the proposal against the user's full trade history
- Returns: risk assessment, alignment with historical strengths, suggested improvements
- API keys are never stored on-device

---

## 5. Phase 4 — Web Portal

### 5.1 Web Application

- Full-featured web app (Next.js) sharing the same Supabase backend as the mobile app
- Accessible from any browser — no app install required
- Auth shared with mobile (same Supabase account)

### 5.2 Web-Specific Features

- Richer analytics dashboard with larger charts and data tables
- Trade log with advanced sorting, filtering, and bulk editing
- Trade plan management and AI analysis interface
- Settings and account management
- Better export UX (direct file downloads)

### 5.3 Shared API Layer

- Introduction of a dedicated Node.js API (or Supabase Edge Functions as API) consumed by both the mobile app and web portal
- Business logic (P&L calculation, trade validation, sync) centralised server-side
- Both clients call the same endpoints — no logic duplication

---

## 6. Phase 5 — Broker Integrations

### 6.1 Automatic Trade Import

- Connect to supported brokerages via OAuth
- Automatically import executed trades — no manual entry needed
- Map brokerage trade data to the TradeJournal position/entry schema
- User reviews and confirms imported trades before they are saved

### 6.2 Supported Brokerages (target)

- Alpaca (priority — best API, developer-friendly)
- Interactive Brokers (IBKR) — most powerful, complex API
- Schwab / TD Ameritrade — most popular retail brokerage

### 6.3 Real-time P&L on Open Positions

- Fetch live prices for open positions (via market data API)
- Display unrealized P&L on the trade log and dashboard
- Refresh on demand or on configurable interval

---

## 7. Out of Scope

- Excel/CSV bulk import (deferred — too complex for mobile MVP, revisit in Phase 2)
- Social features (sharing, following other traders)
- Paper trading / simulation mode
- Tax reporting (CSV export is in scope; full tax calculation is not)
- Full tax lot accounting (FIFO/LIFO/HIFO) — possible Phase 5+ addition

---

## 8. Non-Functional Requirements

| Requirement | Target |
|---|---|
| App launch time | < 2 seconds on mid-range device |
| Trade log load time | < 500ms for up to 1,000 trades |
| Offline capability | Full functionality except auto-fill and cloud sync |
| Platform support | iOS 16+ (Phase 1), Android 10+ (Phase 2) |
| Data security | No financial data transmitted in Phase 1; Supabase RLS in Phase 2+ |
| API key security | All third-party API keys server-side only (never in client bundle) |

---

## 9. Success Metrics

**Phase 1:**
- User can log a trade in under 60 seconds
- Zero data loss across app restarts
- Auto-fill succeeds for >95% of valid equity tickers

**Phase 2:**
- Cloud sync completes initial migration without data loss
- Dashboard loads in <1 second for up to 500 trades

**Phase 3:**
- AI analysis returns a response in <5 seconds
- Users who use trade plan analysis show improved win rates over 30-day periods (qualitative, self-reported)

# Architecture Decision Records — TradeJournal

This document captures the key architectural decisions made during the design and development of TradeJournal, along with the context, options considered, and rationale for each choice.

---

## ADR-001: React Native + Expo over Flutter

**Status:** Accepted
**Date:** 2026-03-22

**Context:**
TradeJournal needs to run on both iOS and Android from a single codebase. The developer is starting from scratch and wants to avoid maintaining separate native apps. The project is also a portfolio piece, so ecosystem visibility and community size matter.

**Decision:**
Use React Native with Expo (managed workflow).

**Options Considered:**
- React Native + Expo
- Flutter (Dart)
- Native Swift (iOS) + Kotlin (Android) — two separate codebases

**Rationale:**
- The JS/TS ecosystem has significantly better coverage for financial libraries (charting, number formatting, data manipulation)
- Expo's managed workflow eliminates weeks of native toolchain configuration
- Over-the-air (OTA) updates via Expo allow shipping fixes without an App Store resubmission cycle
- TypeScript is shared across the entire stack, reducing context switching
- React Native has broader adoption and community than Flutter, increasing portfolio visibility

**Consequences / Tradeoffs:**
- Expo managed workflow has some limitations for advanced native modules (mitigated by switching to bare workflow if needed in Phase 3)
- React Native performance is slightly below native for heavy animations, but this app is data-display-focused, not animation-heavy

---

## ADR-002: TypeScript Throughout

**Status:** Accepted
**Date:** 2026-03-22

**Context:**
The app handles financial data — prices, quantities, P&L calculations, percentages. Type errors in financial logic can cause subtle, hard-to-catch bugs (e.g. string concatenation instead of numeric addition).

**Decision:**
Use TypeScript for all code across the entire project — UI, data layer, services, and utilities.

**Options Considered:**
- TypeScript throughout
- JavaScript with JSDoc type annotations
- JavaScript (no types)

**Rationale:**
- Compile-time safety for financial calculations prevents an entire class of bugs
- Drizzle ORM is TypeScript-native and provides inferred types from the schema
- Better IDE support (autocomplete, refactoring) speeds up development
- TypeScript on a portfolio project signals professional habits to hiring managers

**Consequences / Tradeoffs:**
- Slightly more setup overhead upfront (tsconfig, strict mode)
- Type definitions for some libraries may be incomplete (minor, solvable with `as` casts when necessary)

---

## ADR-003: SQLite + Drizzle ORM for Phase 1 Local Storage

**Status:** Accepted
**Date:** 2026-03-22

**Context:**
Phase 1 MVP needs to store trade data persistently on-device. Requiring a backend and user authentication in Phase 1 adds significant complexity and delays shipping.

**Decision:**
Use SQLite (via `expo-sqlite`) with Drizzle ORM for the Phase 1 data layer.

**Options Considered:**
- SQLite + Drizzle ORM (local-first)
- Firebase Firestore (cloud-first)
- Supabase from day one (cloud-first)
- WatermelonDB (local + sync-ready)
- AsyncStorage (key-value, no querying)

**Rationale:**
- No login friction in Phase 1 — users can start logging trades immediately
- Works fully offline, no internet dependency for core functionality
- Drizzle ORM provides type-safe schema definitions and migrations, making the Phase 2 cloud migration non-destructive
- SQLite is fast enough for thousands of trade records on-device

**Consequences / Tradeoffs:**
- Data is at risk if the device is lost without a backup (acceptable for Phase 1, solved by Phase 2 cloud sync)
- No cross-device access until Phase 2
- WatermelonDB would have been sync-ready from day one but adds setup complexity not justified for MVP

---

## ADR-004: Supabase for Cloud Backend (Phase 2+)

**Status:** Accepted
**Date:** 2026-03-22

**Context:**
Phase 2 requires cloud storage, user authentication, and cross-device sync. Phase 3 requires server-side AI processing. A backend solution is needed that supports both.

**Decision:**
Use Supabase for the cloud backend starting in Phase 2.

**Options Considered:**
- Supabase (PostgreSQL + Auth + Edge Functions)
- Firebase (Firestore + Auth + Cloud Functions)
- Custom Node.js + PostgreSQL backend

**Rationale:**
- PostgreSQL is significantly more powerful than Firestore for the analytical queries needed in Phase 2 (aggregations, window functions for equity curves)
- Supabase Edge Functions are a natural fit for Phase 3 AI integration (server-side API key management, caching, rate limiting)
- Row-level security (RLS) ensures users only access their own trade data
- Generous free tier — sufficient for personal use and portfolio demonstration
- Open source — no vendor lock-in

**Consequences / Tradeoffs:**
- More initial setup than Firebase for simple use cases
- Requires managing a Supabase project and understanding PostgreSQL

---

## ADR-005: Market Data Auto-fill via Polygon.io / Alpaca

**Status:** Accepted
**Date:** 2026-03-22

**Context:**
Traders enter the same tickers repeatedly. Manually typing the current price every time is error-prone and tedious. A market data API can auto-fill the entry price field when a ticker is entered.

**Decision:**
Integrate a market data API (Polygon.io or Alpaca) with a 15-minute client-side cache for auto-fill functionality.

**Options Considered:**
- Polygon.io (broad data coverage, free tier available)
- Alpaca (brokerage + data API, free tier available)
- Yahoo Finance (unofficial API, unreliable)
- No auto-fill (manual entry only)

**Rationale:**
- Both Polygon.io and Alpaca have documented, stable free tiers sufficient for personal use
- 15-minute cache prevents rate limit issues during rapid trade entry
- Auto-fill reduces entry errors and improves UX significantly
- Demonstrates API integration capability in the portfolio
- App remains fully functional offline (auto-fill degrades gracefully)

**Consequences / Tradeoffs:**
- API key must be kept server-side in Phase 2+ (client bundle in Phase 1 is acceptable for personal use, but should be noted)
- Free tier data may be delayed 15 minutes for some exchanges (acceptable for post-trade logging)

---

## ADR-006: Server-side AI via Supabase Edge Functions (Phase 3)

**Status:** Accepted
**Date:** 2026-03-22

**Context:**
Phase 3 introduces AI analysis of trade proposals. The AI model needs access to the user's full trade history and must call third-party AI APIs (e.g. OpenAI, Anthropic).

**Decision:**
Run all AI logic server-side via Supabase Edge Functions.

**Options Considered:**
- On-device AI model (Core ML / TensorFlow Lite)
- Direct API calls from the React Native client to OpenAI/Anthropic
- Server-side via Supabase Edge Functions

**Rationale:**
- API keys (OpenAI, Anthropic) are never exposed in the client bundle — a security requirement
- Edge Functions can cache responses, reducing cost for repeated analyses
- The AI model can be swapped or updated without requiring an app store update
- Supabase Edge Functions run at the edge globally, keeping latency low
- On-device models are not powerful enough for the quality of analysis needed

**Consequences / Tradeoffs:**
- Requires internet connectivity for AI features (acceptable — this is a Phase 3, cloud-era feature)
- Adds latency vs direct client calls (mitigated by edge deployment)

---

## ADR-007: Nullable Options/Futures Fields in Schema from Day One

**Status:** Accepted
**Date:** 2026-03-22

**Context:**
Phase 1 targets equity trades only. However, many active traders also trade options and futures, which require additional fields (expiry date, strike price, contract multiplier, option type).

**Decision:**
Include options/futures fields as nullable columns in the trade schema from day one, even though the Phase 1 UI does not expose them.

**Options Considered:**
- Equities-only schema, add options fields in a future migration
- Full schema with nullable options/futures fields from day one
- Separate tables for equities, options, and futures

**Rationale:**
- Adding nullable columns to an existing SQLite table is straightforward, but migrating existing records when the schema fundamentally changes is painful
- Cost of including nullable fields upfront is zero (SQLite handles sparse data efficiently)
- Separate tables add query complexity without benefit at this stage
- Future-proofing the schema is a deliberate engineering decision worth documenting

**Consequences / Tradeoffs:**
- Slightly more fields in the schema than strictly needed for Phase 1
- No UI impact — nullable fields are simply not shown in Phase 1 forms

---

## ADR-008: Local-First in Phase 1, Cloud Sync in Phase 2

**Status:** Accepted
**Date:** 2026-03-22

**Context:**
The app needs persistent trade data. In Phase 1, requiring a login and cloud backend adds friction and delays shipping. However, users will eventually want their data accessible across devices and protected against phone loss or damage.

**Decision:**
Phase 1 uses SQLite on-device only. Phase 2 introduces Supabase cloud sync with user authentication. On first login, a one-time migration syncs local SQLite data to Supabase.

**Options Considered:**
- Cloud-first from day one (Firebase or Supabase)
- Local-only forever
- WatermelonDB (local-first with built-in sync primitives)
- SQLite Phase 1 → Supabase Phase 2 (chosen)

**Rationale:**
- Reduces Phase 1 scope significantly — no auth UI, no backend deployment, no internet dependency
- Drizzle ORM's type-safe migrations make the schema transition to Supabase non-destructive
- The Phase 1 → Phase 2 transition is a deliberate, documented decision — not an afterthought
- Apps like Bear, Notion, and Day One have successfully used the same local-first-then-sync pattern

This is also a deliberate portfolio decision: "I chose local-first to reduce friction in the MVP, then designed a clean migration path to cloud sync" is a stronger engineering narrative than "I added a backend from day one because it seemed right."

**Consequences / Tradeoffs:**
- Phase 1 users have no cross-device sync — data is lost if the device is unrecoverable
- The one-time migration must handle edge cases: interrupted uploads, duplicate prevention on re-login, conflict resolution if somehow both local and cloud data exist
- Users should be informed of the local-only limitation during Phase 1 (in-app messaging or onboarding)

---

## ADR-009: Trade Grade and Emotion Tag in Phase 1

**Status:** Accepted
**Date:** 2026-03-22

**Context:**
Most trade journals only capture financial outcomes (P&L, win/loss). This misses a critical dimension of trading improvement: execution quality and psychological state. A winning trade entered on FOMO is a bad habit reinforced. A losing trade that followed the plan perfectly is a good process outcome. Without capturing these signals, the app is a log — not a journal.

**Decision:**
Add `trade_grade` (A/B/C/D) and `emotion_tag` (Confident/FOMO/Hesitant/Revenge/Bored/Patient) as optional fields on the position form in Phase 1.

**Options Considered:**
- Defer to Phase 2 as analytics features
- Include in Phase 1 as optional form fields (chosen)
- Include in Phase 1 as required fields

**Rationale:**
- Both are simple enum fields — negligible implementation cost
- Data collection must start in Phase 1 for Phase 2 analytics to be meaningful (e.g. "Your FOMO trades return -4.2% on average" requires months of tagged data)
- Optional, not required — no friction added to the core log flow
- These fields are a strong differentiator vs generic trade loggers and a good interview talking point

**Consequences / Tradeoffs:**
- Adds two optional fields to the Add Trade form — requires thoughtful UX to keep the form from feeling overwhelming
- Emotion tag requires user self-awareness and consistency to be analytically useful — this is a user education problem, not an engineering one

---

## ADR-010: Chart Screenshot Storage (Local URI → Cloud in Phase 2)

**Status:** Accepted
**Date:** 2026-03-22

**Context:**
Traders want to attach a screenshot of their chart setup to each position. This visually documents the setup that led to the trade — essential for meaningful post-trade review. The challenge is that binary file storage across Phase 1 (local) and Phase 2 (cloud) requires a deliberate design.

**Decision:**
Store `chart_screenshot_url` as a text column. In Phase 1, the value is a local file URI (e.g. `file:///var/mobile/.../chart.jpg`). In Phase 2, files are uploaded to Supabase Storage and the column value is replaced with the remote URL.

**Options Considered:**
- Store image as a BLOB in SQLite — simple but bloats the database, slow for large images
- Store as a local file path with upload in Phase 2 (chosen)
- Defer chart screenshots entirely to Phase 2

**Rationale:**
- File system storage is far more efficient than SQLite BLOBs for images
- A single column value change (local URI → remote URL) is a clean, zero-schema-change migration
- Expo's `expo-image-picker` and `expo-file-system` handle local storage cleanly
- The feature is genuinely useful in Phase 1 even without cloud backup

**Consequences / Tradeoffs:**
- Chart screenshots are at risk of loss on device reset in Phase 1 (same limitation as all local data)
- Phase 2 migration must upload images before clearing local files

---

## ADR-011: CSV and PDF Export in Phase 2

**Status:** Accepted
**Date:** 2026-03-22

**Context:**
Traders need to export their trade history for tax purposes and for analysis in external tools (Excel, Google Sheets). A PDF performance report is also useful for personal review and potentially sharing with a coach or mentor.

**Decision:**
Add CSV export and PDF report generation in Phase 2.

**Options Considered:**
- CSV only (simpler)
- PDF only
- Both CSV and PDF (chosen)
- Defer export entirely to Phase 3

**Rationale:**
- CSV export covers the tax/analysis use case with minimal implementation effort
- PDF report demonstrates a more complex feature (document generation, charts) which is a stronger portfolio signal
- Both are Phase 2 because they depend on having meaningful data — exporting 3 trades is not useful
- Supabase cloud data makes export more reliable than local-only

**Consequences / Tradeoffs:**
- PDF generation on mobile requires a library (react-native-html-to-pdf or similar) — adds a dependency
- Export file handling on iOS requires careful use of the Share sheet API

---

## ADR-012: API Layer Strategy — Direct Supabase (Phase 1-3), Dedicated API (Phase 4+)

**Status:** Accepted
**Date:** 2026-03-22

**Context:**
TradeJournal started as a mobile-only app, where direct Supabase client access (with RLS for security) is the standard pattern. However, the roadmap now includes a web portal (Phase 4) and broker integrations (Phase 5). Once multiple clients exist, a shared API layer becomes necessary to avoid duplicating business logic across React Native and Next.js.

**Decision:**
- **Phase 1–3:** React Native talks directly to SQLite (local) and Supabase (cloud). Business logic lives in the app's `services/` layer. Supabase RLS enforces data security. Supabase Edge Functions handle server-side AI logic.
- **Phase 4:** Introduce a shared API layer (Node.js / Fastify or Supabase Edge Functions as REST endpoints) consumed by both the mobile app and the web portal.
- **Phase 5:** The API layer expands to handle broker OAuth flows, webhook processing, and background trade sync.

**Options Considered:**
- Direct Supabase from both clients forever — leads to duplicated business logic
- Custom API from day one — premature overhead for a single-client MVP
- BFF (Backend For Frontend) pattern — separate API per client — adds complexity without benefit at this scale
- Phased approach: direct Supabase → shared API when web portal arrives (chosen)

**Rationale:**
- A single-client MVP does not need an API layer — direct Supabase + RLS is secure and fast to ship
- The web portal is the trigger for the API layer because business logic must not be duplicated across two frontends
- Broker OAuth flows and webhooks require a server-side component regardless — the API layer in Phase 5 is inevitable
- Introducing the API at Phase 4 (not Phase 1) avoids premature abstraction while making the transition planned and documented

**Consequences / Tradeoffs:**
- Phase 1–3 mobile code will need minor refactoring in Phase 4 to route through the API instead of calling Supabase directly (mitigated by the `services/` abstraction layer — only the service implementations change, not the UI)
- The `services/` folder in the React Native app must be designed so that swapping from Supabase SDK calls to API calls is a one-file change per service
- Broker integrations in Phase 5 require careful OAuth token storage and refresh handling on the server — this is a security-sensitive area

---

## ADR-013: Next.js for Web Portal (Phase 4)

**Status:** Accepted
**Date:** 2026-03-22

**Context:**
Phase 4 introduces a web portal. The choice of web framework affects developer experience, SEO, performance, and how well it pairs with the existing React Native codebase.

**Decision:**
Use Next.js (App Router) for the web portal.

**Options Considered:**
- Next.js (React, SSR/SSG, file-based routing)
- Remix (React, edge-first)
- Plain React SPA (Vite)
- Expo Web (same codebase as React Native)

**Rationale:**
- React Native developers know React — Next.js is a natural extension with minimal new concepts
- Some UI components (forms, lists, modals) can be shared between the web and mobile codebases
- Next.js Server Components allow analytics queries to run server-side — important for performance on the dashboard
- Strong Supabase integration via `@supabase/ssr`
- Better portfolio signal than a plain SPA — SSR, API routes, and server components show full-stack thinking
- Expo Web was considered but sharing native mobile UI with a web dashboard creates more friction than benefit

**Consequences / Tradeoffs:**
- Separate codebase from React Native (not a monorepo universal app) — accepted tradeoff for cleaner separation
- Some shared logic (types, utility functions, service interfaces) can live in a shared `packages/` folder in a monorepo structure

# Prompts & AI Collaboration Log — TradeJournal

## What This File Is

This document logs the key prompts used throughout the development of TradeJournal, along with annotations explaining the thinking behind each one. It exists for two reasons:

1. **Transparency** — to show how AI assistance was used deliberately and systematically, not as a shortcut but as a force multiplier
2. **Portfolio signal** — the ability to clearly define requirements, ask the right questions at the right stage, and direct an AI tool toward a specific outcome is a skill in itself. This file demonstrates that skill.

The prompts here are polished versions of what was used, with added context on the reasoning behind each framing choice.

---

## Phase 1: Project Definition & Planning

### Prompt 1.1 — Initial Requirements (March 2026)

> "I want to build a trade journal. Initially it will allow users to just log trades manually, auto-fill if possible. Need a UI to log one trade — excel format is tough on mobile so let's put a pin on that for later.
>
> Down the line: I want this app to provide insights on the trade strategy the user has entered for future trades, give summaries of weekly and monthly trades. The user can set up a trade plan, then the app gives analysis based on past trades and their results. Slowly add AI model analysis for those trade proposals.
>
> Let's do this in plan mode."

**Why framed this way:**
The explicit phase structure ("initially", "down the line", "slowly add") was intentional — it signals to the AI that this is a phased product, not a monolithic spec. Saying "let's do this in plan mode" prevents the AI from jumping into code before the architecture is clear. Deferring the Excel-style UI with "put a pin on that" keeps the MVP scope tight.

---

### Prompt 1.2 — Cross-Platform Constraint

> "I want to build for both iOS and Android but want to start with iOS. Also don't want to rewrite logic for both operating systems."

**Why framed this way:**
Stating the constraint clearly ("don't want to rewrite logic") guides the AI toward cross-platform frameworks (React Native, Flutter) without having to name them. Letting the AI surface the options and recommend one produces a more defensible decision than just asking "should I use React Native?"

---

### Prompt 1.3 — Portfolio and Job Hunt Context

> "I want to use this as a portfolio project for my resume and job hunt too."

**Why framed this way:**
Adding this context mid-planning changes the architectural and documentation recommendations significantly. A portfolio project needs clean commit history, defensible tech choices, and artifacts that tell a story. Surfacing this early means the whole plan is shaped around it — not retrofitted at the end.

---

### Prompt 1.4 — Artifact Strategy

> "Even though I'm vibe coding, I want to show my system understanding and the way I give requirements to you and my questions to show my skill — maybe through prompts.md and other artifacts that we can generate."

**Why framed this way:**
This prompt explicitly names the meta-skill: using the quality of requirements and questions as portfolio evidence. By asking for prompts.md specifically, the developer is creating a living document of their own product thinking — something most developers never generate. The phrase "artifacts that we can generate" signals a systematic approach rather than ad-hoc documentation.

---

### Prompt 1.5 — Database Architecture Question

> "Is SQLite the best option for DB, or do we have other alternatives? Will that live on the device? What if the user wants to change device — how does existing data transfer? Can this be hosted, or is it too out of scope?"

**Why framed this way:**
This is a deliberate multi-part question that covers: technical alternatives, data residency, user experience implications (device switching), and deployment model. Asking all four in one prompt ensures the AI gives a holistic answer rather than a narrow one. The phrase "or is it too out of scope" invites the AI to push back on assumptions — a useful technique when exploring tradeoffs.

---

## Phase 2: MVP Build

*This section will be updated as Phase 1 is implemented. Prompts will cover: scaffolding the Expo project, implementing the trade data model, building the Add Trade form, integrating the market data API, and setting up the trade log view.*

---

## Phase 3: Analytics & Insights

*This section will be updated as Phase 2 is implemented. Prompts will cover: designing the analytics queries, building the dashboard UI, implementing cloud sync, and the local-to-Supabase migration.*

---

## Phase 4: AI Integration

*This section will be updated as Phase 3 is implemented. Prompts will cover: designing the trade plan schema, building the proposal analysis logic, integrating Supabase Edge Functions, and prompting the AI model for trade analysis.*

---

## Prompt Patterns

A few patterns that proved effective throughout this project:

**State constraints explicitly, not just goals.**
Instead of "build me a mobile app," say "build for iOS and Android without rewriting logic for each platform." Constraints narrow the solution space and produce better recommendations.

**Name what's out of scope.**
"Excel-style bulk entry is too complex for mobile MVP — let's put a pin on that." This tells the AI what not to do, which is often as important as what to do. It keeps responses focused and prevents scope creep.

**Use "plan mode" before "build mode."**
Asking for a plan before any code is written aligns expectations and surfaces architectural decisions that would be painful to reverse later. The plan is also a portfolio artifact in itself.

**Ask multi-part questions to get holistic answers.**
"Is X the best option? What are the alternatives? What happens if Y? Is Z out of scope?" produces a more complete picture than a single-dimension question.

**Add context that changes the framing.**
"I want to use this as a portfolio project" changed the entire documentation and architecture approach. Surfacing non-obvious context early leads to better recommendations throughout the project.

**Request tradeoffs, not just recommendations.**
"What are the tradeoffs of this approach?" produces more useful information than "what should I use?" It also gives you the language to defend your decisions in interviews.

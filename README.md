# Agent CaMate — StoreOps Decision Agent

> **Agent CaMate is not a weather chatbot. It is a StoreOps Decision Agent that turns weather and store operation signals into approved, evidence-backed actions for each KFC store.**

A **pilot-oriented prototype**, production-oriented Agentic AI build for the **Agentic AI Build Week 2026** hackathon
(F&B track, KFC). The system follows the agent loop — **Observe → Reason → Plan → Act → Verify → Report → Learn** —
running a 10-agent reasoning pipeline that turns live, micro-local weather signals + operations baseline
into a concrete store-level operations plan: prep sizing, staffing, delivery readiness, campaign focus,
with a full evidence trace, data provenance badges, a 30-second manager briefing, human approval gates,
and a bilingual (English / Vietnamese) operator dashboard.

> ⚠️ **Demo / pilot-oriented prototype build.** This is a hackathon pilot-oriented prototype build, **not an official KFC product**.
> The "KFC" name, store names, and addresses are used only to make the demo realistic in the F&B track
> context. Operational numbers (POS, demand shifts, before/after metrics) are **synthetic / simulated**
> and clearly labeled as such. Real KFC POS data can be plugged in via the `SponsorOpsAdapter` (env vars)
> or `CsvOpsAdapter` (CSV file). See [`CHANGELOG.md`](./CHANGELOG.md) for what's real vs simulated.

---

## Table of contents

- [The problem](#the-problem)
- [The solution](#the-solution)
- [Why this is agentic (not just a dashboard)](#why-this-is-agentic-not-just-a-dashboard)
- [Quick start (one command)](#quick-start-one-command)
- [Deploying to Vercel](#deploying-to-vercel)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [The 8 agents at a glance](#the-8-agents-at-a-glance)
- [Production readiness](#production-readiness)
- [Judge Q&A — the 7 questions](#judge-qa--the-7-questions)
- [Honesty & disclaimers](#honesty--disclaimers)
- [Roadmap (not in this build)](#roadmap-not-in-this-build)

---

## The problem

Ho Chi Minh City is a city of **micro-climates**: a 4pm thunderstorm can flood Bến Thành (Quận 1)
while Củ Chi stays dry. A KFC store manager who checks a generic city-level weather app at 9am
gets one number for a city of 10 million people — and then has to mentally translate that number
into "how many fried chicken batches do I drop at 11am?", "do I pull a counter staffer into
delivery packing?", and "should the 16:30 push notification push a rainy-day delivery combo or a
family dine-in bundle?".

Today, that translation is done in the manager's head, inconsistently, store by store. The result:

- **Over-prep & waste** when rain that "might come" doesn't hit a store's micro-area.
- **Stockouts** on delivery SKUs (buckets, combo boxes) when rain does hit and delivery surges.
- **Mis-staffed shifts** — over-staffed dine-in on a rain-suppressed day, under-staffed delivery.
- **Wasted campaigns** — pushing dine-in discounts on a day no one is walking in.

## The solution

A multi-agent pipeline that, for any chosen KFC store in TP.HCM:

1. **Observes** the store's profile (type, district, customer behavior, kitchen capacity, delivery share).
2. **Collects** a live micro-local weather signal from Open-Meteo (the live `WeatherModelProvider`),
   with a clearly-labeled deterministic fallback when the live API fails. The Weather Signal Layer
   blends providers, applies risk scoring, sets provenance, and persists a `WeatherSnapshot` to
   Prisma for audit.
3. **Analyzes** how that weather shifts walk-in vs delivery demand for each slot (lunch, dinner).
4. **Plans** prep batch sizing, inventory, packaging, and staffing per slot.
5. **Recommends** a campaign focus (delivery combo / cold beverage / dine-in family bundle / etc.).
6. **Explains** the plan in two LLM-augmented agents: a Risk Explanation narrative and a 30-second
   Manager Briefing (headline, TL;DR, top actions, watch items, confidence-aware closing note) —
   generated bilingually in English and Vietnamese via a deterministic `withVietnamese()` layer.

Every step is recorded in an **Agent Execution Trace** panel — the centerpiece of the demo — so
judges can see exactly what each agent received, computed, and emitted, including confidence,
data source (`live` / `fallback` / `computed` / `llm`), weather provenance, and duration. A
**Data Sources panel** renders the full data-source registry with mode badges (Live / Verified seed /
Simulated / Fallback / Planned), purpose, used-in, rate limit, license, fallback strategy, and a
reliability note per source — plus an active-store weather provenance strip.

## Why this is agentic (not just a dashboard)

| Property | A dashboard | This agent |
|---|---|---|
| Triggered by | User query / refresh | Auto-runs on store selection; observes signals |
| Workflow | One display step | 8-agent pipeline, 6 phases (Observe → Collect → Analyze → Plan → Recommend → Explain) |
| Tool use | None | Calls Open-Meteo via a pluggable `WeatherModelProvider`; calls LLM for explanation & briefing |
| Decision vs display | Displays data | **Outputs a decision** — prep %, staffing delta, campaign focus |
| Reasoning | None | Each agent logs input → output → confidence + provenance; LLM writes natural-language narrative |
| Failure handling | Crashes or shows blank | Degrades gracefully: live → fallback → deterministic fallback for LLM; never throws |
| Transparency | Black box | Full execution trace + Data Sources registry + weather provenance strip visible in the UI |

The agent does **not** try to be more accurate than weather apps at predicting weather. The value
proposition is: **Agent CaMate converts local weather and demand signals into actionable store
operations plans.** Weather is the input; the agent's job is to translate it into operations.

---

## Quick start (one command)

Requirements: **[Bun](https://bun.sh)** ≥ 1.3 (or Node 20+ with npm/pnpm as a fallback).

```bash
bun install && bun run dev
```

Then open <http://localhost:3000>.

What happens on first run:

- `bun install` installs dependencies (Next.js 16, React 19, Tailwind 4, shadcn/ui, Prisma,
  LLM Router clients, …).
- `bun run dev` starts the Next.js dev server on port 3000 and tees logs to `dev.log`.
- The first time you select a store (or it auto-selects `KFC Lê Lai`), the UI calls
  `POST /api/agent/run`, which fetches live Open-Meteo weather via the `OpenMeteoAdapter`
  (6s timeout, 2-attempt retry with exponential backoff, 5-min in-process cache), runs the
  Weather Signal Layer (risk scoring + provenance + `WeatherSnapshot` persistence), and then
  runs the 8-agent pipeline.
- If the Open-Meteo API is unreachable from your network, the adapter transparently switches to
  a deterministic fallback signal, persists a `WeatherSnapshot` with `isLive=false`, and the UI
  shows a `FALLBACK` badge — the demo always works.

> **Database (recommended).** The app persists every agent run to SQLite via Prisma
> (`prisma/db` → `db/custom.db`) and persists every weather fetch to the `WeatherSnapshot`
> table for audit. If the DB file is missing on first run, the API route **does not fail** — it
> silently skips persistence (best-effort). To set up the DB:
> ```bash
> bun run db:push     # create tables from prisma/schema.prisma
> ```

> **LLM (optional).** The Risk Explanation and Manager Briefing agents call the LLM through
> the LLM Router (supporting OpenAI-compatible / Gemini / Groq / OpenRouter) with 12s / 15s AbortController timeouts.
> If the LLM is unavailable (no key / network blocked), both agents fall back to a deterministic, hand-written narrative
> so the demo always produces a briefing.

> **Operations data (the CSV seam).** A sample operations CSV is shipped at
> `public/sample-operations-data.csv` (20 stores) — this is the seam for real KFC POS exports.
> The `CsvOpsAdapter` reads it; the `SyntheticOpsAdapter` is the default. Replace the CSV with a
> real KFC export of the same shape to go live. See `DATA_SOURCES.md`.

### Useful scripts

| Script | What it does |
|---|---|
| `bun run dev` | Start the dev server on `:3000`. |
| `bun run build` | Production build (Next.js standalone output). |
| `bun run start` | Run the standalone production server. |
| `bun run lint` | ESLint. |
| `bun run db:push` | Push the Prisma schema to SQLite. |
| `bun run db:generate` | Regenerate the Prisma client. |

---

## Deploying to Vercel

This project is a standard Next.js 16 App Router app and deploys cleanly to Vercel.

1. Push the repo to GitHub/GitLab.
2. In Vercel, **New Project → Import** the repo.
3. Framework preset: **Next.js**.
4. Build command: `next build` (the default; the repo's `bun run build` also copies static assets
   into `.next/standalone` for a self-hosted standalone server — Vercel doesn't need that step, so
   you can override the build command with `next build`).
5. Output directory: leave default (`.next`).
6. Install command: `bun install` (Vercel auto-detects Bun from `bun.lock`; alternatively
   `npm install`).
7. **Environment variables** — none are strictly required for the demo to run:
   - `DATABASE_URL` — needed to persist agent runs + weather snapshots. On Vercel, use a network DB
     (Postgres / Turso / Neon) instead of SQLite, since Vercel's serverless filesystem is
     read-only. Without it, the API simply skips DB persistence (best-effort).
   - `LLM_API_KEY` and `LLM_API_BASE_URL` — set these env vars to enable LLM completions via the LLM Router.
     If not configured, the LLM agents fall back to deterministic output.
8. Deploy. Open the preview URL.

> ⚠️ **Map component.** The map (`src/components/dashboard/store-map.tsx`) is dynamically
> imported with `ssr: false` so it only runs in the browser. No special Vercel config is needed.

---

## Tech stack

| Layer | Tech |
|---|---|
| Framework | **Next.js 16** (App Router, standalone output) |
| Language | **TypeScript 5** |
| UI | **React 19**, **Tailwind CSS 4**, **shadcn/ui** (Radix primitives) |
| State / data | **Zustand**, **TanStack Query**, React 19 hooks |
| Charts | **Recharts** |
| Maps | **Google Maps** (keyless Embed iframe) |
| Icons | **lucide-react** |
| Toasts | **sonner** |
| i18n | Custom React context (`src/lib/i18n/`) — English + Vietnamese, localStorage persistence, browser-language auto-detect |
| Backend API | Next.js Route Handlers (`src/app/api/*`) |
| Agent engine | Custom TypeScript pipeline (`src/lib/agent/engine.ts`) — 8 agents, 6 phases, bilingual output layer |
| Weather architecture | Pluggable `WeatherModelProvider` interface + `OpenMeteoAdapter` (live) + planned IMERG / Meteostat / METAR adapters + `WeatherSignalLayer` orchestrator + pure `riskScoring` functions |
| Operations data | Pluggable `OperationsDataAdapter` interface — `SyntheticOpsAdapter` (default, simulated) + `CsvOpsAdapter` (reads `public/sample-operations-data.csv` — the seam for real KFC POS exports) |
| Data sources | Single source of truth in `src/lib/dataSources/dataSourceRegistry.ts` (8 sources, each with mode / purpose / fallback / license / rate limit) |
| LLM | **LLM Router** (OpenAI-compatible/Gemini/Groq/OpenRouter) (chat completions, JSON output, 12–15s timeout + deterministic fallback) |
| Database | **Prisma 6** + **SQLite** (caches geocoding, persists weather snapshots for audit, persists agent runs) |
| Runtime / package manager | **Bun** (also works with npm/pnpm) |
| Validation | **Zod 4** |

---

## Project structure

```
my-project/
├── prisma/
│   └── schema.prisma                 # GeoCache, WeatherSnapshot, AgentRun models
├── db/                               # SQLite db file lives here (gitignored)
├── public/
│   ├── sample-operations-data.csv    # ★ CSV seam for real KFC POS exports (20 stores)
│   ├── logo.svg
│   └── robots.txt
├── src/
│   ├── app/
│   │   ├── page.tsx                  # Main dashboard UI (store selector, map, results)
│   │   ├── layout.tsx                # Root layout (LanguageProvider, ThemeProvider)
│   │   ├── globals.css               # Tailwind 4 entry + theme tokens
│   │   └── api/
│   │       ├── route.ts              # Health-check
│   │       ├── stores/route.ts       # GET — list 20 seed stores + highlights
│   │       ├── weather/route.ts      # GET ?storeId= — weather signal (live-first)
│   │       ├── agent/run/route.ts    # POST {storeId} — runs full 8-agent pipeline
│   │       ├── compare/route.ts      # POST {storeIds[]} — parallel multi-store run (≤4)
│   │       └── briefing/export/route.ts # POST {result} — Markdown briefing download
│   ├── components/
│   │   ├── ui/                       # shadcn/ui primitives
│   │   └── dashboard/
│   │       ├── store-selector.tsx
│   │       ├── store-map.tsx         # Google Maps Embed map (client-only)
│   │       ├── weather-signal-panel.tsx
│   │       ├── action-plan-panel.tsx
│   │       ├── agent-trace-panel.tsx # ★ the "this is agentic" panel
│   │       ├── before-after-panel.tsx
│   │       ├── manager-briefing-panel.tsx
│   │       ├── compare-view.tsx
│   │       ├── why-agentic.tsx
│   │       ├── data-sources-panel.tsx # ★ Full registry + active-store weather provenance
│   │       ├── language-toggle.tsx    # ★ EN/VI dropdown + pill toggle
│   │       └── shared.tsx            # Badges, formatters, color tokens
│   └── lib/
│       ├── agent/
│       │   └── engine.ts             # ★ 8-agent orchestration pipeline + withVietnamese()
│       ├── weather/
│       │   ├── weatherModelProvider.ts  # ★ Pluggable WeatherModelProvider interface
│       │   ├── weatherSignalLayer.ts    # ★ Orchestrator: blend providers, risk score, provenance, persist
│       │   ├── riskScoring.ts           # ★ Pure risk-score functions (rain/heat/delivery/walk-in)
│       │   ├── open-meteo.ts            # Backwards-compatible re-export
│       │   └── adapters/
│       │       ├── openMeteoAdapter.ts     # ★ Live Open-Meteo: 6s timeout, 2-attempt retry, 5-min cache
│       │       ├── nasaGpmImergAdapter.ts  # Planned rain-evidence adapter (interface ready)
│       │       ├── metostatAdapter.ts      # Planned historical adapter (interface ready)
│       │       └── metarAdapter.ts         # Planned aviation baseline adapter + METAR parser
│       ├── operations/
│       │   ├── operationsDataAdapter.ts   # ★ Pluggable OperationsDataAdapter interface
│       │   ├── syntheticOpsAdapter.ts     # Synthetic POS/inventory/staffing (default, simulated)
│       │   └── csvOpsAdapter.ts           # ★ CSV reader (seam for real KFC POS exports)
│       ├── i18n/
│       │   ├── dictionaries.ts            # ★ Full EN + VI dictionaries
│       │   └── language-provider.tsx      # ★ React context + localStorage + browser-lang auto-detect
│       ├── dataSources/
│       │   └── dataSourceRegistry.ts      # ★ Single source of truth (8 sources, modes, fallbacks)
│       ├── stores/seed-stores.ts          # 20 KFC TP.HCM stores, 3 highlighted for demo
│       ├── types/index.ts                 # All shared domain types (incl. WeatherProvenance)
│       ├── llm.ts                         # ★ LLM completions wrapper + JSON extractor
│       ├── db.ts                          # Prisma client singleton
│       └── utils.ts                       # cn() helper
├── package.json
├── bun.lock
├── next.config.ts                    # output: "standalone"
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.mjs
├── components.json                   # shadcn/ui config
└── .env                              # DATABASE_URL (SQLite path)
```

---

## The 8 agents at a glance

| # | Agent | Phase | Role | Data source |
|---|---|---|---|---|
| 1 | **Store Context Agent** | observe | Detects store type, district, customer behavior, kitchen capacity, peak windows | computed |
| 2 | **Weather Signal Agent** | collect | Pulls live/fallback micro-local weather, derives 4 risk scores (rain, heat, delivery disruption, walk-in drop), threads provenance + fallbackReason + reliabilityNote | live / fallback |
| 3 | **Demand Agent** | analyze | Predicts lunch & dinner walk-in / delivery % deltas from weather × store profile | computed |
| 4 | **Inventory & Prep Agent** | plan | Translates demand shift into batch sizing, packaging uplift, waste & stockout warnings | computed |
| 5 | **Staffing Agent** | plan | Sizes staffing per slot, assigns roles (counter → packing, etc.) | computed |
| 6 | **Campaign Agent** | recommend | Picks campaign focus (delivery combo / cold beverage / family bundle / balanced) | computed |
| 7 | **Risk Explanation Agent** | explain | Explains **why** — LLM narrative connecting top risk factors to store context | **llm** (fallback: computed) |
| 8 | **Manager Briefing Agent** | explain | Synthesizes a 30-second, action-oriented briefing (headline, TL;DR, top actions, watch items) in EN + VI | **llm** (fallback: computed) |

See [`AI_DOCUMENTATION.md`](./AI_DOCUMENTATION.md) for the full deep dive.

---

## Production readiness

This build is **pilot-oriented prototype**: it is structured for production deployment and real-pilot measurement,
while remaining honest that several data sources are still simulated or planned. The following
production-grade capabilities are implemented (not roadmap):

| Capability | Where | Notes |
|---|---|---|
| **Data source registry** | `src/lib/dataSources/dataSourceRegistry.ts` | Single source of truth for 8 data sources — each with id, name, url, type, purpose, mode, used-in, fallback strategy, reliability note, requiresApiKey, cacheTtlSec, rateLimit, license. Rendered in the Data Sources panel. |
| **Pluggable weather adapter interface** | `src/lib/weather/weatherModelProvider.ts` | `WeatherModelProvider` interface — the seam for advanced AI weather models (GraphCast / Aurora / Earth2Studio / RainNet / NowcastNet). See [`ADVANCED_WEATHER_AI_INTEGRATION.md`](./ADVANCED_WEATHER_AI_INTEGRATION.md). |
| **Pluggable operations adapter interface** | `src/lib/operations/operationsDataAdapter.ts` | `OperationsDataAdapter` interface — synthetic default + CSV adapter ready for real KFC POS exports. |
| **API timeout / retry** | `src/lib/weather/adapters/openMeteoAdapter.ts`, `src/lib/llm.ts` | Open-Meteo: 6s timeout + 2-attempt retry with exponential backoff. LLM: 12s (Agent 7) / 15s (Agent 8) AbortController timeouts. |
| **In-process caching** | `src/lib/weather/adapters/openMeteoAdapter.ts` | 5-min TTL cache keyed by store id (bounded). Fallback cached for 60s so live is retried sooner. |
| **Transparent fallback** | `weatherSignalLayer.ts`, `engine.ts` | Every output labels live vs fallback; `fallbackReason` and `reliabilityNote` fields on `WeatherSignal`; `dataSource` on every `AgentStep`. |
| **Confidence scoring** | `riskScoring.ts`, `engine.ts` | Per-agent confidence; overall = `min(0.95, 0.5 + weather.dataConfidence × 0.4)`. Manager briefing surfaces `confidenceLabel` (low/medium/high). |
| **Audit persistence** | `src/lib/weather/weatherSignalLayer.ts`, `src/app/api/agent/run/route.ts` | Every weather fetch persists a `WeatherSnapshot` (best-effort). Every agent run persists an `AgentRun` (best-effort). |
| **Bilingual output** | `src/lib/i18n/`, `src/lib/agent/engine.ts` (`withVietnamese`) | English + Vietnamese UI chrome via React context (localStorage + browser-lang auto-detect). Manager-facing outputs (headline, TL;DR, top actions, watch items, closing note) generated bilingually by the agent engine via a deterministic Vietnamese layer — no second LLM call. |
| **Provenance threading** | `src/lib/weather/weatherSignalLayer.ts`, `src/lib/types/index.ts` | `WeatherProvenance` (primarySource, primaryMode, contributors[]) attached to every `AgentRunResult`; Weather Signal Agent trace step records provenance + fallbackReason + reliabilityNote. |
| **Data Sources panel** | `src/components/dashboard/data-sources-panel.tsx` | Full registry rendered with mode badges (Live/Verified seed/Simulated/Fallback/Planned), purpose, used-in, rate limit, license, fallback strategy, reliability note + active-store weather provenance strip. |
| **Operations CSV seam** | `public/sample-operations-data.csv`, `src/lib/operations/csvOpsAdapter.ts` | Replace the sample CSV with a real KFC POS export of the same shape to go live — no code changes. |
| **Best-effort persistence everywhere** | All API routes | DB failures never break a response. Persistence is a bonus, not a dependency. |

---

## Judge Q&A — the 7 questions

> These are the questions a hackathon judge is most likely to ask. The answers are deliberately
> honest about what is real, what is simulated, and what is roadmap.

### Q1. What exactly does this agent do that a weather app + spreadsheet can't?

A weather app answers **"what will the weather be?"**. A spreadsheet answers **"if X happens,
what did we do last time?"**. This agent answers **"for THIS store, given THIS weather signal
at THIS minute, what concrete operations decisions should I make for the next two meal slots?"**
— and shows its work in the Agent Execution Trace. **Agent CaMate converts local weather and
demand signals into actionable store operations plans** — that translation is the value, not
weather prediction accuracy.

### Q2. Is the weather data real?

**Yes, when the network allows.** The `OpenMeteoAdapter` calls the free, no-API-key
**Open-Meteo** API for each store's exact lat/lng (`api.open-meteo.com/v1/forecast`), with
`past_days=1`, `forecast_days=3`, hourly + daily variables, in the `Asia/Ho_Chi_Minh` timezone,
a 6-second timeout, 2-attempt retry with exponential backoff, and a 5-minute in-process cache.
When the API is unreachable, the adapter returns a clearly-labeled **fallback signal**
(`isLive=false`, `source="fallback (live unavailable: ...)"`) and the UI shows a red `FALLBACK`
badge instead of a green `LIVE` one. **Every weather fetch is persisted as a `WeatherSnapshot`
for audit.** The Weather Signal Agent's trace step records the full `WeatherProvenance`
(primarySource, primaryMode, contributors[]). See [`DATA_SOURCES.md`](./DATA_SOURCES.md) and
[`ADVANCED_WEATHER_AI_INTEGRATION.md`](./ADVANCED_WEATHER_AI_INTEGRATION.md).

### Q3. Is the demand / POS / before-after data real?

**No — by default.** Demand shifts, before/after operational impact, and store-level POS numbers
are **synthetic and rule-based**, derived from the same risk scores the agent computed — they are
internally consistent, not external ground truth. **However, the architecture is pilot-oriented prototype:**
the `OperationsDataAdapter` interface accepts either the `SyntheticOpsAdapter` (default) or a
`CsvOpsAdapter` that reads `public/sample-operations-data.csv` (a sample schema shipped with 20
stores). Replace that CSV with a real KFC POS export of the same shape and the agent runs on real
data — no code changes. The before/after panel labels its simulated status explicitly in its
methodology footnote; see [`EVALUATION.md`](./EVALUATION.md) for how to replace it with real
measured metrics once POS data is connected.

### Q4. Where does the LLM come in, and what happens if it fails?

Two of the eight agents use the LLM (via the LLM Router):

- **Agent 7 — Risk Explanation**: writes a ≤180-word narrative connecting the top 2-3 risk
  factors to the store's context, in store-manager language.
- **Agent 8 — Manager Briefing**: writes a structured 30-second briefing (headline, TL;DR,
  top actions, watch items, closing note) in English and Vietnamese.

Both have **deterministic fallbacks**: if the LLM call fails or times out (12s / 15s AbortController
timeouts), the agent produces a hand-written narrative built from the same risk factors and slot
deltas. The trace shows `dataSource: "llm"` when the LLM was used and `dataSource: "computed"` when
the fallback fired. The Vietnamese translations of the manager-facing outputs are produced by a
deterministic `withVietnamese()` layer — **no second LLM call** — so the bilingual UI is free.

### Q5. Why is this "agentic" and not just a fancy dashboard?

Three reasons (also see the comparison table above):

1. **It acts, it doesn't display.** The output is a *decision* (prep −12%, staffing +1, push
   the rainy-day delivery combo), not a chart of weather variables.
2. **It runs a multi-step workflow with tool use.** Eight specialized agents run in sequence,
   six phases (Observe → Collect → Analyze → Plan → Recommend → Explain), each calling tools
   (pluggable `WeatherModelProvider`, LLM) and passing structured output to the next agent.
3. **It's transparent and resilient.** Every agent logs input, output, confidence, data source,
   provenance, and duration. Live data fails gracefully to fallback; LLM fails gracefully to
   deterministic. The agent never silently produces a worse answer — it labels its degraded modes.

### Q6. How is this different for a CBD store vs a suburban store?

The Store Context Agent tags each store with a `storeType`
(`urban-street`, `mall`, `residential`, `suburban`, `office-area`), and **every downstream agent
branches on it**. Examples:

- **Mall stores** (e.g. *KFC Centre Mall Củ Chi*): rain drives footfall **up** (shelter effect),
  so prep increases and the campaign pushes dine-in family bundles.
- **Urban-street stores** (e.g. *KFC Lê Lai*): rain crushes walk-in (−32% lunch) and surges
  delivery (+35%); prep drops, packaging upstaffs, campaign pushes delivery combo.
- **Suburban stores** (e.g. *KFC Huỳnh Tấn Phát 2, Nhà Bè*): long rider distances amplify
  delivery disruption; the agent adds a suburban penalty to delivery risk and flags long supply
  lead times.

The **3-store demo compare** button runs all three highlighted stores in parallel so judges can
see how the same weather signal produces three different plans.

### Q7. What's real vs roadmap?

| Real in this build | Roadmap (not built) |
|---|---|
| Live Open-Meteo weather per store (6s timeout, retry, 5-min cache) | IoT / camera-based real-time footfall & kitchen telemetry |
| Pluggable `WeatherModelProvider` seam (Open-Meteo live; IMERG/Meteostat/METAR interface-ready) | Live ingestion of NASA GPM IMERG / Meteostat / METAR |
| Pluggable `OperationsDataAdapter` + sample CSV seam for real KFC POS | Direct POS / inventory / workforce API connectors |
| 8-agent pipeline with execution trace + weather provenance | Closed-loop execution (auto-write the prep roster to the POS) |
| LLM-augmented Risk Explanation + Manager Briefing (EN + VI) | Multi-day forecasting agent (currently 3-day Open-Meteo horizon) |
| Before/after simulated impact (clearly labeled) | Real measured A/B metrics against actual POS data — see [`EVALUATION.md`](./EVALUATION.md) |
| Data source registry + Data Sources panel | — |
| Bilingual EN/VI operator dashboard | Vietnamese LLM-generated narrative (currently deterministic) |
| 20 seed stores in TP.HCM | All Vietnam stores; multi-city rollout |
| Markdown briefing export | Push briefing to manager's app / email / Zalo OA |
| SQLite persistence of agent runs + weather snapshots | Postgres / Turso for production multi-tenant |
| Advanced AI weather models (GraphCast / Aurora / Earth2Studio / RainNet / NowcastNet) | **Documented as future integration paths** via the `WeatherModelProvider` seam — see [`ADVANCED_WEATHER_AI_INTEGRATION.md`](./ADVANCED_WEATHER_AI_INTEGRATION.md). None are integrated. |

See [`AI_DOCUMENTATION.md`](./AI_DOCUMENTATION.md) and [`ARCHITECTURE.md`](./ARCHITECTURE.md)
for the full technical picture.

---

## Honesty & disclaimers

- **Not an official KFC product.** KFC branding, store names, and addresses are used only in
  the F&B track context of a hackathon. Operational numbers are not real KFC data.
- **Weather: live when possible, fallback when not.** The UI always labels which mode is active.
  Every weather fetch is persisted as a `WeatherSnapshot` for audit.
- **Demand / POS / before-after: simulated by default.** Internally consistent, derived from the
  same risk scores the agent computed — not external ground truth. The architecture is ready to
  swap in real POS via the `CsvOpsAdapter`.
- **The claim is NOT "more accurate than weather apps."** The claim is: **Agent CaMate
  converts local weather and demand signals into actionable store operations plans.**
- **Advanced AI weather models (GraphCast / Aurora / Earth2Studio / RainNet / NowcastNet) are NOT
  integrated.** They are documented as future integration paths via the `WeatherModelProvider`
  interface — see [`ADVANCED_WEATHER_AI_INTEGRATION.md`](./ADVANCED_WEATHER_AI_INTEGRATION.md).
- **IoT / camera telemetry is roadmap, not in this build.**

---

## Roadmap (not in this build)

- **IoT & camera telemetry** — real-time footfall counters, kitchen output sensors, fryer
  temperature feeds. Out of scope for this build; would close the observe loop.
- **Closed-loop execution** — auto-write the staffing delta to the roster system, auto-push the
  campaign to the loyalty app. Currently the agent *recommends*; a human approves.
- **Multi-day forecasting agent** — the engine currently plans for "tomorrow" using a 3-day
  Open-Meteo horizon. A horizon-planning agent could optimize weekly prep & supply.
- **A/B measurement** — track actual waste %, stockout %, and delivery SLA per store, then
  compare "agent-managed" vs "control" stores to validate the before/after simulation. See
  [`EVALUATION.md`](./EVALUATION.md) for the full pilot design.
- **Live ingestion of planned weather sources** — NASA GPM IMERG (rain evidence), Meteostat
  (historical normals), AviationWeather METAR (city-level baseline). Interfaces are ready; live
  calls are pending API key / heavy-data parser provisioning.
- **Advanced AI weather models** — GraphCast / Aurora / Earth2Studio / RainNet / NowcastNet as
  additional `WeatherModelProvider`s. See [`ADVANCED_WEATHER_AI_INTEGRATION.md`](./ADVANCED_WEATHER_AI_INTEGRATION.md).
- **Multi-city** — extend the seed dataset beyond TP.HCM (Hà Nội, Đà Nẵng, …).

---

## See also

- [`AI_DOCUMENTATION.md`](./AI_DOCUMENTATION.md) — deep dive on the 8 agents, the 6-phase flow,
  the `WeatherModelProvider` pluggable interface, the operations data adapter path, the bilingual
  output layer, and provenance threading through the trace.
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — system architecture with data-flow diagrams, the
  weather architecture split, the operations data adapter path, the i18n layer, the
  `WeatherSnapshot` persistence, and the updated sequence diagram.
- [`DATA_SOURCES.md`](./DATA_SOURCES.md) — full data-source registry inventory (8 sources),
  the live-vs-planned honesty table, the operations CSV schema, and `WeatherSnapshot` persistence.
- [`EVALUATION.md`](./EVALUATION.md) — pilot evaluation framework: 7 metrics, 3 baselines,
  A/B pilot design, decision-quality survey, results-reporting template.
- [`ADVANCED_WEATHER_AI_INTEGRATION.md`](./ADVANCED_WEATHER_AI_INTEGRATION.md) — honest
  assessment of GraphCast / Aurora / Earth2Studio / WeatherBench 2 / RainNet / NowcastNet and how
  they'd plug into the `WeatherModelProvider` seam.
- [`DEMO_SCRIPT.md`](./DEMO_SCRIPT.md) — 4-minute judge demo walkthrough.
- [`DEVPOST_SUBMISSION.md`](./DEVPOST_SUBMISSION.md) — Devpost submission copy.
- [`AGENT_DEFINITION.md`](./AGENT_DEFINITION.md) — what makes this an AI Agent (not a chatbot): the agent loop, 10 golden rules, agent checklist, and the pitch line.
- [`CHANGELOG.md`](./CHANGELOG.md) — what's real vs simulated vs not yet implemented.

---

## License

Hackathon demo. All rights reserved by the project authors. Not for commercial use. KFC® is a
trademark of its respective owner and is used here only in the F&B track context of a hackathon.

---

## What is real vs simulated

See [`CHANGELOG.md`](./CHANGELOG.md) for the full table. Quick summary:

**REAL:** Weather (Open-Meteo live), Operations Baseline Agent (sponsor → CSV → synthetic fallback chain), Admin API (Prisma/SQLite), Healthcheck endpoint.

**SIMULATED (clearly labeled):** POS/inventory/staffing data when `SPONSOR_API_*` env vars not set (falls back to `SyntheticOpsAdapter`, mode="simulated"). Demand model (weather-driven formula). Before/After metrics. Store kitchenCapacity/deliveryShare/dineInSeats (ESTIMATED from store type).

**PLACEHOLDER:** Learning Agent (no real actuals/feedback loop yet — labeled "placeholder" in trace).

**NOT YET IMPLEMENTED:** Chat uses existing run (currently re-runs pipeline). Field mapping from admin UI applied in adapter. Prisma ActualResult model.

---

## Remaining gaps (honest)

- **Learning Agent**: Placeholder — no real actuals/feedback loop. Needs Prisma `ActualResult` model.
- **RBAC/Security**: Approval workflow exists but no role-based access control. Anyone can approve.
- **Chat `runId`**: Chat loads latest run for store (not exact runId from DB — Prisma `AgentRun` doesn't store the workflow `runId` field yet).
- **Approval buttons**: UI placeholders only — no backend approval endpoint wired to the new workflow state.
- **`fetchJson`**: Wired into most client components but not all (store-profile, weather panel use direct fetch).
- **`/api/simulate`**: Calls `runAgentPipeline` directly (documented: applies custom weather overrides that bypass the normal observe phase).

## Agent instructions

Before modifying this project, coding agents must read:

- `AGENTS.md`
- `.agents/skills/*/SKILL.md`
- `CLAUDE.md`
- `.cursor/rules/agent-camate.mdc`

These files define the required behavior for grounded Gemini chat, F&B StoreOps logic, human approval guardrails, data quality, and hackathon QA.

# Architecture — Agent CaMate — StoreOps Decision Agent for KFC

System architecture for **Agent CaMate** — a Next.js 16 App Router app with a custom
multi-agent orchestration engine, a pluggable weather architecture (`WeatherModelProvider` seam
+ Weather Signal Layer orchestrator + live Open-Meteo adapter + planned IMERG / Meteostat / METAR
adapters), a pluggable operations data path (`OperationsDataAdapter` with synthetic + CSV
adapters), bilingual (EN/VI) UI, LLM-augmented explanation agents, `WeatherSnapshot` audit
persistence, and best-effort run persistence.

> **Source of truth:**
> `src/app/page.tsx` (UI), `src/app/api/*` (API routes),
> `src/lib/agent/engine.ts` (8-agent pipeline + bilingual `withVietnamese` layer),
> `src/lib/weather/weatherModelProvider.ts` (pluggable interface),
> `src/lib/weather/weatherSignalLayer.ts` (orchestrator + provenance + persistence),
> `src/lib/weather/riskScoring.ts` (pure risk functions),
> `src/lib/weather/adapters/*.ts` (live + planned adapters),
> `src/lib/operations/*.ts` (operations adapter interface + synthetic + CSV),
> `src/lib/i18n/*.ts` (bilingual layer),
> `src/lib/dataSources/dataSourceRegistry.ts` (single source of truth),
> `src/lib/llm.ts` (LLM wrapper),
> `src/lib/db.ts` + `prisma/schema.prisma` (persistence),
> `src/lib/types/index.ts` (domain types incl. `WeatherProvenance`).

---

## 1. High-level architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                BROWSER (client)                              │
│                                                                              │
│   ┌────────────────────┐  ┌────────────────────┐  ┌──────────────────────┐  │
│   │ Store Selector +   │  │  Dashboard         │  │  Agent Trace Panel    │  │
│   │ Store Map          │  │  (page.tsx)        │  │  (agent-trace-panel)  │  │
│   │ (store-map.tsx)    │  │                    │  │                       │  │
│   └─────────┬──────────┘  │  ┌──────────────┐  │  └───────────▲──────────┘  │
│             │             │  │ Weather Panel│  │              │             │
│             │             │  │ Action Plan  │  │              │             │
│             │             │  │ Before/After │  │              │             │
│             │             │  │ Briefing     │  │              │             │
│             │             │  │ Compare View │  │              │             │
│             │             │  │ Data Sources │  │              │             │
│             │             │  └──────┬───────┘  │              │             │
│             │             └─────────┼──────────┘              │             │
│             │                       │                         │             │
│   Language toggle (EN/VI) ──── LanguageProvider (localStorage + browser-lang)│
│                                                                              │
└─────────────┼───────────────────────┼─────────────────────────┼─────────────┘
              │ fetch()               │ fetch()                 │ (rendered from
              │                       │                         │  same payload)
              ▼                       ▼                         │
┌──────────────────────────────────────────────────────────────────────────────┐
│                          NEXT.JS SERVER (Node runtime)                       │
│                                                                              │
│   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌────────┐ │
│   │ GET /api/stores │  │ GET /api/weather│  │POST /api/compare│  │POST    │ │
│   │                 │  │   ?storeId=     │  │   {storeIds[]}  │  │/api/   │ │
│   │ SEED_STORES     │  │  Weather Signal │  │ Promise.all(    │  │briefing│ │
│   │ + HIGHLIGHTS    │  │  Layer          │  │   runPipeline)  │  │/export │ │
│   └─────────────────┘  └─────────────────┘  └─────────────────┘  └────────┘ │
│   ┌─────────────────────────────────────────────────────────────────────┐    │
│   │                  POST /api/agent/run  { storeId }                   │    │
│   │                                                                     │    │
│   │   1. getWeatherSignalWithProvenance(store)                          │    │
│   │      └─ OpenMeteoAdapter.fetch() ──► live or fallback               │    │
│   │      └─ risk scoring + provenance + WeatherSnapshot persist         │    │
│   │   2. runAgentPipeline(store, weather, provenance)  ──► 8 agents    │    │
│   │   3. db.agentRun.create(...)        ──► best-effort persistence     │    │
│   │   4. return AgentRunResult (with weatherProvenance)                 │    │
│   └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└──────────┬───────────────────────────────┬───────────────────────────────────┘
           │                               │
           │ fetch() (6s timeout,          │ chat.completions.create()
           │ 2-attempt retry, 5-min cache)│ (12s / 15s AbortController)
           ▼                               ▼
┌──────────────────────────┐   ┌──────────────────────────────────────────────┐
│  Open-Meteo API          │   │  LLM Router (Gemini/Groq/OpenAI...)          │
│  api.open-meteo.com/     │   │  ──► Risk Explanation Agent (Agent 7, 12s)   │
│  v1/forecast             │   │  ──► Manager Briefing Agent (Agent 8, 15s)   │
│  (no API key)            │   │  (deterministic fallback on failure)         │
└──────────────────────────┘   └──────────────────────────────────────────────┘

       (planned, not yet live)
   ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
   │ NASA GPM IMERG   │  │ Meteostat        │  │ AviationWeather  │
   │ (rain evidence)  │  │ (historical)     │  │ METAR (VVTS)     │
   └──────────────────┘  └──────────────────┘  └──────────────────┘
       (each a WeatherModelProvider — interface ready, live ingestion pending)

           │
           ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                  SQLite (Prisma)  ──  db/custom.db                            │
│   ┌────────────┐  ┌──────────────────┐  ┌──────────────────────────────────┐ │
│   │ GeoCache   │  │ WeatherSnapshot  │  │ AgentRun                         │ │
│   │ (geocoding)│  │ ★ persisted on   │  │ (persisted agent runs)           │ │
│   │            │  │   every weather  │  │                                  │ │
│   │            │  │   fetch for audit│  │                                  │ │
│   └────────────┘  └──────────────────┘  └──────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘

       (operations data path — parallel to weather)
   ┌──────────────────────────────┐
   │  OperationsDataAdapter       │
│   ├─ SyntheticOpsAdapter (default, simulated) │
│   └─ CsvOpsAdapter (reads public/sample-operations-data.csv — seam for real KFC POS)│
   └──────────────────────────────┘
       consumed by: Demand Agent, Inventory & Prep Agent, Staffing Agent (baselines)
```

---

## 2. The new end-to-end data flow

```
Website / API / Sensor (WeatherModelProvider / OperationsDataAdapter)
        │
        ▼
Data Adapter  ──►  Raw normalized data (RawWeatherData / OpsBaseline)
        │              (each adapter never throws — returns fallback on error)
        ▼
Signal Layer  (WeatherSignalLayer for weather — blends providers, applies risk scoring,
        │      sets provenance, persists WeatherSnapshot)
        ▼
WeatherSignal  (4 risk scores + dataConfidence + isLive + provenance + fallbackReason + reliabilityNote)
        │
        ▼
Specialized Agent  (one of the 8 agents in the pipeline)
        │              (each agent logs an AgentStep to the trace)
        ▼
Risk / Insight  (Risk Explanation Agent — LLM-augmented narrative + bilingual)
        │
        ▼
Agent CaMate Orchestrator  (runAgentPipeline — threads structured output agent → agent)
        │
        ▼
Decision Agents  (Demand → Inventory & Prep → Staffing → Campaign)
        │
        ▼
Manager Briefing  (Manager Briefing Agent — LLM-augmented, EN + VI via withVietnamese)
        │
        ▼
Daily StoreOps Action Plan  (ActionPlan + ManagerBriefing + BeforeAfterMetric[] + trace)
        │
        ▼
db.agentRun.create(...)  ──►  best-effort persistence
        │
        ▼
UI renders: Weather panel, Action plan, Before/After, Briefing (EN/VI), Agent Trace,
            Data Sources panel (with active-store weather provenance strip)
```

---

## 3. Frontend

### Stack

- **Next.js 16** (App Router, `output: "standalone"`)
- **React 19**
- **Tailwind CSS 4** (via `@tailwindcss/postcss`)
- **shadcn/ui** (Radix UI primitives, see `components.json`)
- **Google Maps Embed** (keyless iframe) for the store network map
- **Recharts** for risk bars
- **lucide-react** for icons
- **sonner** for toasts
- **Zustand** + **TanStack Query** + React hooks for state
- **i18n** via custom React context (`src/lib/i18n/`) — English + Vietnamese

### Entry point

`src/app/page.tsx` — the single-page dashboard. Layout:

```
┌────────────────────────────────────────────────────────────────────────┐
│ Header: Agent CaMate · 8-agent pipeline · Re-run btn · [EN/VI ▼]  │
├────────────────────────────────────────────────────────────────────────┤
│ Hero strip: positioning sentence + "Run 3-store demo compare" button   │
├────────────────────────────────────────────────────────────────────────┤
│ Store Selector (left, 4/12)  │  Store Network Map (right, 8/12)         │
├────────────────────────────────────────────────────────────────────────┤
│ Results (when a run completes):                                        │
│  ┌──────────────────────────┐  ┌────────────────────────────────────┐  │
│  │ Left column (7/12):      │  │ Right column (5/12):                │  │
│  │  - Weather Signal Panel  │  │  - Manager Briefing Panel (EN + VI)│  │
│  │  - Action Plan Panel     │  │  - Tabs: Action plan | Agent trace  │  │
│  │  - Before/After Panel    │  │    - Risk factors + hourly fcst     │  │
│  │                          │  │    - Agent Execution Trace ★        │  │
│  └──────────────────────────┘  └────────────────────────────────────┘  │
├────────────────────────────────────────────────────────────────────────┤
│ Compare View (when ≥2 stores compared): side-by-side columns            │
├────────────────────────────────────────────────────────────────────────┤
│ Data Sources Panel ★: full registry + active-store weather provenance  │
├────────────────────────────────────────────────────────────────────────┤
│ Why Agentic section: flow strip + 8 agents grid + differentiators       │
├────────────────────────────────────────────────────────────────────────┤
│ Footer: data sources, LLM, map attribution                              │
└────────────────────────────────────────────────────────────────────────┘
```

### Key components (`src/components/dashboard/`)

| Component | Purpose |
|---|---|
| `store-selector.tsx` | Searchable list of 20 seed stores, with `highlight` badge for the 3 demo stores |
| `store-map.tsx` | Google Maps Embed map (dynamically imported with `ssr: false`), searches selected store name, highlights, links to Google Maps |
| `weather-signal-panel.tsx` | Live/fallback weather readings + 4 risk bars + hourly forecast strip |
| `action-plan-panel.tsx` | Slot plan (lunch/dinner), inventory, prep, staffing, delivery readiness, campaign |
| `agent-trace-panel.tsx` | ★ The 8-step execution trace with phase flow indicator, expandable step cards (incl. provenance + fallbackReason + reliabilityNote in step 2) |
| `before-after-panel.tsx` | 5 simulated metrics, red (without) vs green (with) bars, methodology footnote |
| `manager-briefing-panel.tsx` | Headline, TL;DR, top actions, watch items, closing note (EN + VI) + Export .md button |
| `compare-view.tsx` | Side-by-side columns for 2–4 stores with mini-bars and briefing headlines |
| `data-sources-panel.tsx` | ★ Full registry (8 sources) with mode badges + active-store weather provenance strip |
| `language-toggle.tsx` | ★ EN/VI dropdown + pill toggle in header |
| `why-agentic.tsx` | Static explainer: 6-phase flow strip + 8-agent grid + 3 differentiator cards |
| `shared.tsx` | Risk/confidence/live badges, formatters, color tokens |

### Auto-run behavior

When the user selects a store, `useEffect` calls `runAgent(storeId)` → `POST /api/agent/run`.
The toast reads: *"Agent pipeline running — observing → collecting → analyzing → planning →
recommending → explaining…"*. The right-hand tab switches to "Action plan" automatically.

### i18n layer

- `src/lib/i18n/dictionaries.ts` — full English (`en`) and Vietnamese (`vi`) dictionaries covering
  every static UI string (header, hero, store selector, weather panel, action plan, agent trace,
  before/after, briefing, compare, why-agentic, data sources, risk levels, footer, toasts).
- `src/lib/i18n/language-provider.tsx` — `LanguageProvider` React context. Hydrates from
  `localStorage` on mount (key `camate.lang`); falls back to browser-language auto-detect
  (`navigator.language.startsWith("vi")` → `vi`). Exposes `useLang()` and `useT()` hooks.
- `src/components/dashboard/language-toggle.tsx` — dropdown menu (with language label list)
  + compact pill toggle (`EN | VI`) for tight spaces.

Manager-facing outputs (briefing headline, TL;DR, top actions, watch items, closing note) are
generated bilingually by the agent engine via the `withVietnamese()` deterministic layer in
`engine.ts` — **no second LLM call**. The Manager Briefing panel renders whichever language is
active in the React context.

---

## 4. Backend — API routes

All routes are Next.js Route Handlers in `src/app/api/`.

### `GET /api/stores`

Returns the full seed dataset plus the highlighted subset:

```json
{
  "stores": KfcStore[],      // 20 stores
  "highlights": KfcStore[],  // 4 stores with `highlight` tag (urban/residential/2×suburban)
  "count": 20
}
```

No parameters. No DB access (static dataset from `src/lib/stores/seed-stores.ts`).

### `GET /api/weather?storeId=<id>`

Returns the weather signal (with provenance) for a single store.

- Looks up the store in `SEED_STORES`.
- Calls `getWeatherSignalWithProvenance(store)` — live-first with fallback; persists
  `WeatherSnapshot`.
- Returns `{ weather: WeatherSignal, store: KfcStore, provenance: SignalLayerProvenance }`.

### `POST /api/agent/run`  (body: `{ storeId: string }`)

The main entry point. Runs the full 8-agent pipeline:

1. Looks up the store in `SEED_STORES`. 404 if not found.
2. `const { signal: weather, provenance } = await getWeatherSignalWithProvenance(store);`
   — live-first with fallback; persists `WeatherSnapshot`.
3. `const result = await runAgentPipeline(store, weather, provenance);` — 8 agents in sequence.
4. `db.agentRun.create(...)` — best-effort persistence (try/catch).
5. Returns `{ ...result, serverDurationMs }`.

The response shape is `AgentRunResult` (now including `weatherProvenance`) plus `serverDurationMs`
— see `src/lib/types/index.ts`.

### `POST /api/compare`  (body: `{ storeIds: string[] }`)

Runs the agent pipeline for 1–4 stores in parallel:

- Validates: 1 ≤ `storeIds.length` ≤ 4.
- `Promise.all(stores.map(async (store) => runAgentPipeline(store, ...(await getWeatherSignalWithProvenance(store)))))`
- Returns `{ results: AgentRunResult[] }`.

The 3-store demo compare button on the UI calls this with `HIGHLIGHT_STORES.map(s => s.id)`.

### `POST /api/briefing/export`  (body: `{ result: AgentRunResult }`)

Generates a downloadable Markdown briefing. The route handler builds the markdown server-side
(including the full agent execution trace appended at the bottom) and returns it with
`Content-Type: text/markdown` and `Content-Disposition: attachment; filename="briefing-<store>-<date>.md"`.

### `GET /api/`

Health-check: `{ message: "Hello, world!" }`.

---

## 5. Agent engine (`src/lib/agent/engine.ts`)

### Orchestrator: `runAgentPipeline(store, weather, provenance?)`

Runs the 8 agents in sequence, threading structured output from each into the next:

```
1. runStoreContextAgent(store)                            ──► { context, step1 }
2. runWeatherSignalAgent(store, weather, provenance)      ──► { summary, step2 }   [provenance threaded]
3. runDemandAgent(context, weather)                       ──► { slots, step3 }
4. runInventoryPrepAgent(context, weather, slots)         ──► { inventory, prep, wasteWarnings, stockoutWarnings, step4 }
5. runStaffingAgent(context, slots)                       ──► { staffing, serviceDelayWarnings, step5 }
6. runCampaignAgent(context, weather, slots)              ──► { campaign, step6 }
7. buildRiskFactors(context, weather, slots)              ──► factors[]
   runRiskExplanationAgent(context, weather, slots, factors)         ──► { risks, narrative, step7 }   [LLM]
8. runManagerBriefingAgent(context, weather, planDraft, narrative)   ──► { briefing, step8 }          [LLM]
   └─ withVietnamese(briefing, ...)                       ──► bilingual briefing (no second LLM call)

Then: buildBeforeAfter(context, weather, slots)           ──► beforeAfter[]
Return: AgentRunResult { storeId, storeName, trace, plan, briefing, beforeAfter,
                         weather, weatherProvenance, isLive, generatedAt, totalDurationMs }
```

The orchestrator also computes:
- `overallRisk = 0.4·rain + 0.25·deliveryDisruption + 0.20·walkInDrop + 0.15·heat`
- `confidence = min(0.95, 0.5 + weather.dataConfidence × 0.4)`
- `storeRiskSummary` — a 2-sentence string
- `deliveryReadiness` — HIGH/MODERATE/LOW string with rider pre-confirm instructions

If `provenance` is not passed, the orchestrator builds a minimal one from `weather.source` and
`weather.isLive` so the `AgentRunResult.weatherProvenance` field is always populated.

See [`AI_DOCUMENTATION.md`](./AI_DOCUMENTATION.md) for the full per-agent deep dive.

### Why the pipeline is sequential, not parallel

Agents 4 and 5 (Inventory & Prep, Staffing) could in principle run in parallel since both
consume only `slots` from Agent 3. We kept the pipeline sequential for two reasons:

1. **Trace legibility** — judges see a linear 8-step story in the Agent Execution Trace panel.
2. **Total runtime is dominated by Agent 7 & 8 LLM calls** (~12–15s each in the worst case);
   parallelizing Agents 4 & 5 (which take ~1ms each) would save nothing observable.

### Resilience

- The pipeline **never throws**. The weather adapter and LLM wrapper both catch all errors and
  return structured fallbacks.
- Each `AgentStep` has `status: "done" | "running" | "error"`. In the build, all steps complete
  with `"done"` — the fallback paths guarantee this.

---

## 6. Weather architecture (the WeatherModelProvider seam)

This is the **production seam** of the build. The weather layer was split out of the monolithic
MVP adapter into focused, pluggable modules.

### 6.1 Module split

```
src/lib/weather/
├── weatherModelProvider.ts   ← pluggable interface + RawWeatherData type + emptyRawWeather helper
├── weatherSignalLayer.ts     ← orchestrator: blend providers, risk scoring, provenance, persist
├── riskScoring.ts            ← pure risk-score functions (rain/heat/delivery/walk-in) + helpers
├── open-meteo.ts             ← backwards-compatible re-export (legacy imports keep working)
└── adapters/
    ├── openMeteoAdapter.ts      ← LIVE: Open-Meteo (6s timeout, 2-attempt retry, 5-min cache)
    ├── nasaGpmImergAdapter.ts   ← PLANNED: rain evidence (interface ready, ingestion pending NASA GES DISC)
    ├── metostatAdapter.ts       ← PLANNED: historical (interface ready, pending API key)
    └── metarAdapter.ts          ← PLANNED: aviation baseline (interface ready + METAR parser; live call disabled)
```

### 6.2 The `WeatherModelProvider` interface

```ts
export interface WeatherModelProvider {
  readonly id: string;
  readonly name: string;
  readonly mode: "live" | "fallback" | "planned" | "unavailable";
  fetch(store: KfcStore): Promise<RawWeatherData>;   // never throws
}
```

Every weather source — Open-Meteo live, NASA GPM IMERG, Meteostat, METAR, and any future
GraphCast / Aurora / Earth2Studio / RainNet / NowcastNet model — implements this same interface.
The agent engine consumes `WeatherSignal` regardless of source.

### 6.3 Weather Signal Layer (orchestrator) flow

```
getWeatherSignalWithProvenance(store)
        │
        ▼
openMeteoAdapter.fetch(store)
        │  (check 5-min in-process cache first)
        │
        ├──► cache hit ──► return cached RawWeatherData
        │
        └──► cache miss ──► fetchWithRetry(url)  ──► 2 attempts, 6s timeout each, exponential backoff
                                  │
                                  ├──► data + current ──► parseLive(store, data)
                                  │                          │
                                  │                          ├─ parse current + hourly[24] + daily[3]
                                  │                          ├─ derive pressureTrend from hourly precip_prob
                                  │                          └─ return { isLive: true, source: "open-meteo", ... }
                                  │                          └─ cache for 5 min
                                  │
                                  └──► null / error ──► buildFallback(store, reason)
                                                             │
                                                             ├─ synthesize HCM weather (wet-season aware)
                                                             ├─ synthesize hourly[24] + daily[3]
                                                             └─ return { isLive: false,
                                                                         source: "fallback (live unavailable: <reason>)",
                                                                         error: reason, ... }
                                                             └─ cache for 60s (retry live sooner)

        ▼
toWeatherSignal(store, raw)
        │
        ├─ computeRiskScores(...)  [pure functions in riskScoring.ts]
        ├─ dataConfidence = baseConfidence + hourly bonus + daily bonus (capped 0.98)
        ├─ set fallbackReason (only if !isLive)
        └─ set reliabilityNote (live vs fallback note)

        ▼
persistSnapshot(store, signal)  ──►  db.weatherSnapshot.create(...)  [best-effort, try/catch]

        ▼
return { signal, provenance: { primarySource, primaryMode, contributors[] } }
        │
        │   contributors = [
        │     { sourceId: "open-meteo", sourceName: "Open-Meteo",
        │       mode: primary.isLive ? "live" : "fallback", contributed: true,
        │       note: primary.error ? `fallback: ${primary.error}` : undefined },
        │     { sourceId: "nasa-gpm-imerg", sourceName: "NASA GPM IMERG", mode: "planned", contributed: false },
        │     { sourceId: "meteostat", sourceName: "Meteostat", mode: "planned", contributed: false },
        │     { sourceId: "aviationweather-metar", sourceName: "METAR (VVTS)", mode: "planned", contributed: false },
        │   ]
```

### 6.4 Risk scoring (pure functions)

Extracted into `riskScoring.ts` so the formulas are unit-testable and reusable by any
`WeatherModelProvider`:

| Score | Formula (clamped 0–1) |
|---|---|
| `rainRiskScore` | `0.45 × precipIntensity + 0.4 × precipProb + 0.25 (if pressure falling) + 0.05 × cloudCover/100`, where `precipIntensity = precipMm/8` |
| `heatRiskScore` | `0.7 + (tempC−34)×0.08` if tempC≥34, else `0.35 + (tempC−31)×0.12` if tempC≥31, else `0.1` |
| `deliveryDisruptionRisk` | `0.5 × rainRisk + 0.2 × windKmh/40 + 0.2 × store.deliveryShare + 0.15 (if suburban)` |
| `walkInDropRisk` | `rainRisk × walkInExposure + 0.1 × windKmh/30`, where `walkInExposure` = `0.1 (mall) / 0.9 (urban-street) / 0.8 (office) / 0.6 (default)` |

Helpers exported: `clamp01`, `walkInExposure`, `pressureTrendFrom`.

### 6.5 Planned adapters (interface ready)

| Adapter | What it would contribute | Why it's planned (not live) |
|---|---|---|
| `NasaGpmImergAdapter` | Half-hourly satellite precipitation rate (mm/hr) on a 0.1° global grid — would strengthen rain-risk confidence with actual observed rainfall near the store. | Live ingestion requires NASA GES DISC / OPeNDAP access + NetCDF/GeoTIFF parser — too heavy for the current sandbox. Interface is production-ready; live toggle is a config change. |
| `MeteostatAdapter` | Station-level historical normals and observations (nearest station: Tan Son Hoa / Vung Tau). Would contextualise whether current conditions are anomalous. | Live ingestion requires a Meteostat API key (CC BY-NC 4.0, commercial for high volume). Interface ready; pending API key provisioning. |
| `MetarAdapter` | City-level aviation baseline (wind, pressure, cloud, rain/thunderstorm) from Tân Sơn Nhất (VVTS) METAR. **Used ONLY as a city-level supplement, never as the sole store-area signal.** | METAR is airport-level (~6km from District 1). Live call disabled in this build to keep the demo deterministic. Minimal METAR parser implemented; live toggle is a config change. |

Each planned adapter exposes a `planned*()` summary function so the UI can show "what this source
WOULD contribute" even in planned mode:

- `plannedRainEvidence(): RainEvidenceSummary`
- `plannedHistoricalContext(month): HistoricalContext`
- `plannedAviationBaseline(): AviationBaselineSummary`

### 6.6 How advanced AI weather models would plug in

GraphCast / GenCast, Microsoft Aurora, NVIDIA Earth2Studio, WeatherBench 2, RainNet, and
NowcastNet would each be implemented as an additional `WeatherModelProvider`. The integration plan
is documented in [`ADVANCED_WEATHER_AI_INTEGRATION.md`](./ADVANCED_WEATHER_AI_INTEGRATION.md).
**None are integrated in this build.**

---

## 7. Operations data path (the OperationsDataAdapter seam)

Parallel to the weather seam, the operations data path is pluggable so the Demand, Inventory &
Prep, and Staffing agents can consume real or synthetic data without code changes.

### 7.1 Module split

```
src/lib/operations/
├── operationsDataAdapter.ts   ← pluggable interface + OpsBaseline type
├── syntheticOpsAdapter.ts     ← SIMULATED (default): derives baseline from store profile
└── csvOpsAdapter.ts           ← CSV: reads public/sample-operations-data.csv (seam for real KFC POS)
```

### 7.2 The `OperationsDataAdapter` interface

```ts
export interface OperationsDataAdapter {
  readonly id: string;
  readonly name: string;
  readonly mode: "simulated" | "csv" | "live";
  fetch(store: KfcStore): Promise<OpsBaseline>;   // never throws
}

export interface OpsBaseline {
  storeId: string;
  mode: "simulated" | "csv" | "live";
  source: string;
  fetchedAt: string;
  baselineLunchOrders: number;
  baselineDinnerOrders: number;
  baselineDeliveryShare: number;
  inventory: { chickenRawKg: number; buckets: number; cups: number; bags: number };
  staffing: { lunch: number; dinner: number };
  reliabilityNote: string;
}
```

### 7.3 CSV schema (`public/sample-operations-data.csv`)

```
storeId,baselineLunchOrders,baselineDinnerOrders,baselineDeliveryShare,
chickenRawKg,buckets,cups,bags,staffingLunch,staffingDinner
```

One row per store, header required. The shipped sample covers all 20 seed stores. The
`CsvOpsAdapter` parses it tolerant of quoted fields and BOM, then serves per-store baselines by
`storeId`. If a CSV row is missing for a store, the adapter returns a profile-derived baseline
labeled `mode: "csv"` with a reliability note explaining the gap.

**To go live with real KFC data:** replace `public/sample-operations-data.csv` with a real KFC POS
export of the same shape. No code changes. A future live POS connector (`mode: "live"`) would
implement the same interface.

---

## 8. LLM layer (`src/lib/llm.ts`)

### Public API

- `llmComplete(systemPrompt, userMessage, { timeoutMs?, thinking? }): Promise<LlmResult>`
  - Returns `{ content, ok, error?, durationMs }`.
  - Catches all errors (SDK init, network, timeout via AbortController, empty response) and
    returns `{ ok: false, content: "", error, durationMs }`.
- `extractJson<T>(text): T | null` — best-effort JSON extraction from an LLM response that may
  contain prose or code fences. Tries fenced block first, then finds the first balanced JSON
  object/array.

### Client singleton

```ts
let _zai: Awaited<ReturnType<typeof ZAI.create>> | null = null;
async function getClient() {
  if (_zai) return _zai;
  _zai = await ZAI.create();
  return _zai;
}
```

### Usage

Only two agents use the LLM:

| Agent | System prompt | Timeout | Fallback |
|---|---|---|---|
| 7. Risk Explanation | "You are the Risk Explanation Agent… Output STRICT JSON: {narrative: string}" | 12s | Hand-written narrative from top 2 risk factors |
| 8. Manager Briefing | "You are the Manager Briefing Agent… Output STRICT JSON: {headline, tldr, topActions, watchItems, closingNote}" | 15s | Fully-populated briefing from slot deltas + plan fields |

The trace's `dataSource` field is `"llm"` when `llm.ok` is true and the JSON parsed, else
`"computed"`.

### Bilingual output (no second LLM call)

After Agent 8 produces the English briefing (or the deterministic fallback does), the
`withVietnamese(briefing, context, weather, plan, lunch, dinner, overallConfidence)` function
produces the Vietnamese mirror fields (`headlineVi`, `tldrVi`, `topActionsVi`, `watchItemsVi`,
`closingNoteVi`) by translating the same structured inputs deterministically. No second LLM call —
the bilingual UI is free.

### Server-side only

`llm.ts` is imported only by `engine.ts`, which is imported only by API route handlers. The LLM
is **never called from the client** — there's no direct LLM SDK import in any
`"use client"` component.

---

## 9. Database (`src/lib/db.ts` + `prisma/schema.prisma`)

### Prisma client singleton

```ts
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };
export const db = globalForPrisma.prisma ?? new PrismaClient({ log: ["query"] });
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

Prevents multiple Prisma client instances during Next.js hot-reload in dev.

### Schema (`prisma/schema.prisma`)

| Model | Purpose | Used in this build? |
|---|---|---|
| `GeoCache` | Caches Nominatim geocoding results (keyed by normalized address query) | Schema ready; runtime path dormant (geocoding is offline — seed coords pre-geocoded) |
| `WeatherSnapshot` | Snapshots of weather signals per store per time — **the audit trail** | ✅ **Written by the Weather Signal Layer on every fetch** (best-effort) |
| `AgentRun` | Persisted agent runs (trace, plan, briefing, confidence, isLive) | ✅ Written by `POST /api/agent/run` (best-effort) |

`WeatherSnapshot` fields: `id`, `storeId`, `lat`, `lng`, `payload` (JSON string of the full
weather signal bundle), `source`, `isLive`, `createdAt`. Indexed on `(storeId, createdAt)` for
time-series queries.

### SQLite file

`DATABASE_URL=file:/home/z/my-project/db/custom.db` (from `.env`). The `db/` directory is
gitignored. To set up: `bun run db:push` (creates tables from schema).

### Best-effort persistence

`POST /api/agent/run` wraps the `db.agentRun.create(...)` call in a try/catch. The Weather Signal
Layer wraps `db.weatherSnapshot.create(...)` in a try/catch. If the DB is missing, the schema
isn't pushed, or the write fails, the response still returns the full `AgentRunResult`.
Persistence is a bonus, not a dependency.

---

## 10. Data flow — single agent run (sequence diagram with provenance + persistence)

```
Browser                 Next.js Server          Open-Meteo          LLM Router           SQLite
   │                         │                       │                    │                  │
   │  POST /api/agent/run    │                       │                    │                  │
   │  { storeId }            │                       │                    │                  │
   │ ──────────────────────► │                       │                    │                  │
   │                         │                       │                    │                  │
   │                         │  getWeatherSignalWithProvenance(store)    │                  │
   │                         │   └─ openMeteoAdapter.fetch(store)        │                  │
   │                         │       (check 5-min cache)                 │                  │
   │                         │ ────────────────────► │                    │                  │
   │                         │                       │                    │                  │
   │                         │  ◄── 200 + current ── │                    │                  │
   │                         │      (or 6s timeout ×2 retries → fallback)│                  │
   │                         │                       │                    │                  │
   │                         │  toWeatherSignal:     │                    │                  │
   │                         │   computeRiskScores + confidence           │                  │
   │                         │   set fallbackReason + reliabilityNote     │                  │
   │                         │   build provenance (primarySource,         │                  │
   │                         │    primaryMode, contributors[])            │                  │
   │                         │                       │                    │                  │
   │                         │  db.weatherSnapshot.create(...)  [audit]   │                  │
   │                         │ ─────────────────────────────────────────────────────────────► │
   │                         │   ◄── ok (or ignored on error) ──────────────────────────────  │
   │                         │                       │                    │                  │
   │                         │  runAgentPipeline(store, weather, provenance)                  │
   │                         │   ├─ Agent 1: Store Context   (sync, ~1ms) │                  │
   │                         │   ├─ Agent 2: Weather Signal  (sync, ~1ms) │ [provenance logged]│
   │                         │   ├─ Agent 3: Demand           (sync, ~1ms) │                  │
   │                         │   ├─ Agent 4: Inventory & Prep (sync, ~1ms) │                  │
   │                         │   ├─ Agent 5: Staffing         (sync, ~1ms) │                  │
   │                         │   ├─ Agent 6: Campaign         (sync, ~1ms) │                  │
   │                         │   ├─ Agent 7: Risk Explanation (async)      │                  │
   │                         │   │   llmComplete(systemPrompt, userMsg, {timeoutMs: 12000})   │
   │                         │   │ ──────────────────────────────────────► │                  │
   │                         │   │   ◄── JSON {narrative: "..."} ───────── │                  │
   │                         │   │   (or 12s timeout → deterministic fallback)                │
   │                         │   ├─ Agent 8: Manager Briefing (async)      │                  │
   │                         │   │   llmComplete(systemPrompt, userMsg, {timeoutMs: 15000})   │
   │                         │   │ ──────────────────────────────────────► │                  │
   │                         │   │   ◄── JSON {headline, tldr, ...} ────── │                  │
   │                         │   │   (or 15s timeout → deterministic fallback)                │
   │                         │   │   withVietnamese(briefing, ...) → EN + VI (no 2nd LLM call)│
   │                         │   └─ buildBeforeAfter(...) (sync, ~1ms)     │                  │
   │                         │                       │                    │                  │
   │                         │  db.agentRun.create(...)  (best-effort)     │                  │
   │                         │ ─────────────────────────────────────────────────────────────► │
   │                         │   ◄── ok (or ignored on error) ──────────────────────────────  │
   │                         │                       │                    │                  │
   │  ◄── AgentRunResult ─── │                       │                    │                  │
   │      { trace, plan, briefing (EN+VI), beforeAfter,                                  │
   │        weather, weatherProvenance, isLive, ... }                                    │
   │                         │                       │                    │                  │
   │  render: Weather, Action Plan, Before/After, Briefing (EN/VI), Agent Trace,         │
   │          Data Sources panel (with active-store weather provenance strip)             │
   │                         │                       │                    │                  │
```

---

## 11. Data flow — multi-store compare

```
Browser                 Next.js Server          Open-Meteo (×N)        LLM (×N)
   │                         │                       │                    │
   │  POST /api/compare      │                       │                    │
   │  { storeIds: [3 IDs] }  │                       │                    │
   │ ──────────────────────► │                       │                    │
   │                         │                       │                    │
   │                         │  Promise.all(stores.map(async (store) => { │                    │
   │                         │     const { signal, provenance } =         │                    │
   │                         │         await getWeatherSignalWithProvenance(store);            │
   │                         │     return runAgentPipeline(store, signal, provenance);         │
   │                         │  }))                  │                    │
   │                         │                       │                    │
   │                         │   ┌── store 1 ──► weather + provenance + 8 agents ──► LLM ×2   │
   │                         │   ├── store 2 ──► weather + provenance + 8 agents ──► LLM ×2 (parallel)
   │                         │   └── store 3 ──► weather + provenance + 8 agents ──► LLM ×2   │
   │                         │                       │                    │
   │  ◄── { results: AgentRunResult[] (each with weatherProvenance) } ─── │                    │
   │                         │                       │                    │
   │  render: CompareView (side-by-side columns)     │                    │
```

The 3-store demo compare button calls `/api/compare` with `HIGHLIGHT_STORES.map(s => s.id)`.
Three pipelines run in parallel; each makes its own Open-Meteo fetch (with its own retry + cache
+ `WeatherSnapshot` persistence) and its own pair of LLM calls. Total wall-clock time is roughly
max(individual runtimes) ≈ 1–4 seconds depending on network and LLM latency.

---

## 12. Folder structure (annotated)

```
my-project/
├── prisma/
│   └── schema.prisma                          # GeoCache, WeatherSnapshot (audit), AgentRun models
├── db/                                        # SQLite db file (gitignored)
├── public/
│   ├── sample-operations-data.csv             # ★ CSV seam for real KFC POS exports (20 stores)
│   ├── logo.svg
│   └── robots.txt
├── src/
│   ├── app/
│   │   ├── page.tsx                           # ★ Main dashboard UI (single page, bilingual)
│   │   ├── layout.tsx                         # Root layout (LanguageProvider, ThemeProvider)
│   │   ├── globals.css                        # Tailwind 4 entry + theme tokens
│   │   └── api/
│   │       ├── route.ts                       # Health-check
│   │       ├── stores/route.ts                # GET — list 20 seed stores + highlights
│   │       ├── weather/route.ts               # GET ?storeId= — weather signal + provenance
│   │       ├── agent/run/route.ts             # ★ POST {storeId} — full 8-agent pipeline
│   │       ├── compare/route.ts               # POST {storeIds[]} — parallel multi-store run
│   │       └── briefing/export/route.ts       # POST {result} — Markdown briefing download
│   ├── components/
│   │   ├── ui/                                # shadcn/ui primitives
│   │   └── dashboard/
│   │       ├── store-selector.tsx
│   │       ├── store-map.tsx                  # Google Maps Embed map (ssr: false dynamic import)
│   │       ├── weather-signal-panel.tsx
│   │       ├── action-plan-panel.tsx
│   │       ├── agent-trace-panel.tsx          # ★ The execution trace UI (with provenance)
│   │       ├── before-after-panel.tsx
│   │       ├── manager-briefing-panel.tsx     # ★ Export .md button + bilingual render
│   │       ├── compare-view.tsx
│   │       ├── data-sources-panel.tsx         # ★ Full registry + active-store provenance strip
│   │       ├── language-toggle.tsx            # ★ EN/VI dropdown + pill toggle
│   │       ├── why-agentic.tsx
│   │       └── shared.tsx                     # Badges, formatters, color tokens
│   └── lib/
│       ├── agent/
│       │   └── engine.ts                      # ★ 8-agent pipeline + withVietnamese() bilingual layer
│       ├── weather/
│       │   ├── weatherModelProvider.ts        # ★ Pluggable WeatherModelProvider interface + RawWeatherData
│       │   ├── weatherSignalLayer.ts          # ★ Orchestrator: blend, risk score, provenance, persist
│       │   ├── riskScoring.ts                 # ★ Pure risk-score functions (testable)
│       │   ├── open-meteo.ts                  # Backwards-compatible re-export
│       │   └── adapters/
│       │       ├── openMeteoAdapter.ts        # ★ LIVE: 6s timeout, 2-attempt retry, 5-min cache
│       │       ├── nasaGpmImergAdapter.ts     # PLANNED: rain evidence (interface ready)
│       │       ├── metostatAdapter.ts         # PLANNED: historical (interface ready)
│       │       └── metarAdapter.ts            # PLANNED: aviation baseline + METAR parser
│       ├── operations/
│       │   ├── operationsDataAdapter.ts       # ★ Pluggable OperationsDataAdapter interface + OpsBaseline
│       │   ├── syntheticOpsAdapter.ts         # SIMULATED (default): profile-derived baselines
│       │   └── csvOpsAdapter.ts               # ★ CSV reader (seam for real KFC POS exports)
│       ├── i18n/
│       │   ├── dictionaries.ts                # ★ Full EN + VI dictionaries
│       │   └── language-provider.tsx          # ★ React context + localStorage + browser-lang auto-detect
│       ├── dataSources/
│       │   └── dataSourceRegistry.ts          # ★ Single source of truth (8 sources, modes, fallbacks)
│       ├── stores/
│       │   └── seed-stores.ts                 # 20 KFC TP.HCM stores, 4 highlighted
│       ├── types/
│       │   └── index.ts                       # All shared domain types (incl. WeatherProvenance)
│       ├── llm.ts                             # ★ LLM completions wrapper + JSON extractor
│       ├── db.ts                              # Prisma client singleton
│       └── utils.ts                           # cn() helper
├── package.json
├── bun.lock
├── next.config.ts                             # output: "standalone"
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.mjs
├── components.json                            # shadcn/ui config
└── .env                                       # DATABASE_URL (SQLite path)
```

---

## 13. Configuration notes

### `next.config.ts`

```ts
const nextConfig: NextConfig = {
  output: "standalone",        // self-contained production build
  typescript: { ignoreBuildErrors: true },  // hackathon tolerance
  reactStrictMode: false,
};
```

`output: "standalone"` produces a self-contained production server in `.next/standalone/`. The
`bun run build` script copies `.next/static` and `public/` into the standalone dir. This is for
self-hosted production; on Vercel you can use the default build (see README §Deploying to Vercel).

### `.env`

```
DATABASE_URL=file:/home/z/my-project/db/custom.db
```

Only the database URL and API keys (if applicable) are configured. The LLM Router reads LLM_API_KEY
and LLM_API_BASE_URL from environment variables.

### `tailwind.config.ts` / `postcss.config.mjs`

Standard Tailwind 4 setup with `@tailwindcss/postcss`. Theme tokens (brand colors, risk colors)
are defined in `src/app/globals.css` as CSS variables (`--brand`, `--risk-low`, `--risk-medium`,
`--risk-high`, `--risk-critical`).

---

## 14. Resilience & failure modes

| Failure | What happens | How it's surfaced |
|---|---|---|
| Open-Meteo unreachable | `openMeteoAdapter.fetch` returns fallback `RawWeatherData` after 2 attempts | Red `FALLBACK` badge in UI; `dataSource: "fallback"` + `fallbackReason` in trace step 2; `primaryMode: "fallback"` in provenance |
| Open-Meteo 6s timeout (×2) | AbortController fires both attempts; fallback signal returned | Same as above |
| Open-Meteo returns non-200 | Retry once; then fallback | Same as above |
| LLM SDK init fails | `llmComplete` returns `{ ok: false }`; agent uses deterministic fallback | `dataSource: "computed"` in trace step 7/8 |
| LLM call times out (12s/15s) | AbortController fires; same as above | Same as above |
| LLM returns non-JSON prose | `extractJson` returns null; agent uses deterministic fallback | Same as above |
| LLM returns JSON missing required fields | Agent fills missing fields from deterministic fallback | `dataSource: "llm"` (since `llm.ok` was true) but partial fields from fallback |
| SQLite file missing | `db.weatherSnapshot.create` and `db.agentRun.create` throw; caught and ignored | No surface — persistence is silent best-effort |
| CSV file missing / malformed | `CsvOpsAdapter.fetch` returns profile-derived baseline labeled `mode: "csv"` with reliability note | Reliability note in Data Sources panel |
| Invalid `storeId` in API | 404 response | Error toast in UI |
| Invalid JSON body in POST | 400 response | Error toast in UI |
| Store map fails to load (offline) | Map shows error fallback UI with store list and direct Google Maps links | No surface — map is UI nicety |

**The pipeline never throws to the client.** The Agent Execution Trace always shows 8 completed
steps, each labeled with its actual data source.

---

## 15. Performance characteristics

| Operation | Typical time | Worst case |
|---|---|---|
| `openMeteoAdapter.fetch` (cache hit) | < 1 ms | < 1 ms |
| `openMeteoAdapter.fetch` (live, cache miss) | 200–800 ms | 6 s × 2 retries + 60s fallback cache = ~12.6 s |
| Weather Signal Layer (risk scoring + provenance + persist) | 5–25 ms | silent failure (best-effort persist) |
| Agents 1–6 (deterministic) | < 5 ms each | < 5 ms each |
| Agent 7 (LLM, live) | 1–3 s | 12 s (timeout → fallback) |
| Agent 8 (LLM, live) + `withVietnamese` | 1–4 s + <1 ms | 15 s (timeout → fallback) + <1 ms |
| `buildBeforeAfter` | < 1 ms | < 1 ms |
| `db.agentRun.create` | 5–20 ms | silent failure (best-effort) |
| **Total single-store run (live LLM, cache hit)** | **~1.5–4 s** | **~12 s + 12 s + 15 s ≈ 39 s** (very rare) |
| **Total single-store run (LLM fallback)** | **~0.5–1 s** | **~13 s** |

The 5-minute in-process cache means repeated runs for the same store (e.g. judge re-runs) are
near-instant for the weather leg. The 3-store compare runs three pipelines in parallel, so total
wall-clock time ≈ max(individual runtimes) ≈ 1.5–4 s in the typical case.

---

## 16. Production considerations

- **Database:** Move from SQLite to Postgres (or Turso for edge SQLite) for multi-tenant
  production. Prisma supports both with a `DATABASE_URL` change. The `WeatherSnapshot` table will
  grow quickly (one row per store per fetch) — plan for retention policies (e.g. 30-day rolling
  window) and time-series queries (the `(storeId, createdAt)` index supports this).
- **Activate planned weather sources:** NASA GPM IMERG (rain evidence), Meteostat (historical
  normals), METAR (city-level baseline). Each requires provisioning (NASA GES DISC account,
  Meteostat API key, METAR endpoint enable). The interfaces are ready; activation is a config
  change + parser implementation.
- **Activate real POS data:** Replace `public/sample-operations-data.csv` with a real KFC POS
  export, or implement a live `OperationsDataAdapter` (`mode: "live"`) that calls the KFC POS API.
  See `DATA_SOURCES.md` for the CSV schema.
- **LLM cost control:** For production, batch the LLM calls or use a smaller model for the Risk
  Explanation agent (which has a simpler prompt). The Manager Briefing benefits from a larger
  model for prose quality.
- **Streaming:** Currently the API returns the full `AgentRunResult` when done. For better UX,
  stream the trace steps via Server-Sent Events so the UI fills in step-by-step. Not in this build.
- **Auth:** No authentication in this build. Production needs multi-tenant auth (per-store manager
  role, regional manager role, etc.).
- **Advanced AI weather models:** GraphCast / Aurora / Earth2Studio / RainNet / NowcastNet as
  additional `WeatherModelProvider`s — see
  [`ADVANCED_WEATHER_AI_INTEGRATION.md`](./ADVANCED_WEATHER_AI_INTEGRATION.md). None are
  integrated; the interface is ready.

---

## 17. See also

- [`README.md`](./README.md) — project overview, setup, deploy, judge Q&A.
- [`AI_DOCUMENTATION.md`](./AI_DOCUMENTATION.md) — deep dive on the 8 agents, the pluggable
  interfaces, the bilingual layer, and provenance threading.
- [`DATA_SOURCES.md`](./DATA_SOURCES.md) — full data-source registry inventory with honesty table.
- [`EVALUATION.md`](./EVALUATION.md) — pilot evaluation framework (7 metrics, 3 baselines,
  A/B pilot design, decision-quality survey, results template).
- [`ADVANCED_WEATHER_AI_INTEGRATION.md`](./ADVANCED_WEATHER_AI_INTEGRATION.md) — honest
  assessment of GraphCast / Aurora / Earth2Studio / WeatherBench 2 / RainNet / NowcastNet.
- [`DEMO_SCRIPT.md`](./DEMO_SCRIPT.md) — 4-minute demo walkthrough for judges.
- [`DEVPOST_SUBMISSION.md`](./DEVPOST_SUBMISSION.md) — Devpost submission copy.

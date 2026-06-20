# Devpost Submission — Agent CaMate — StoreOps Decision Agent

> **Agent CaMate is not a weather chatbot. It is a StoreOps Decision Agent that turns weather and store operation signals into approved, evidence-backed actions for each KFC store.**

**One-line description:** A pilot-oriented prototype Agentic AI that follows the agent loop — Observe → Reason →
Plan → Act → Verify → Report → Learn — turning live weather signals + operations baseline into a
concrete store-level operations plan with evidence trace, data provenance badges, human approval
gates, and a fallback chain (sponsor API → CSV → synthetic).

**Track:** Agentic AI Build Week 2026 · F&B (KFC)

**Demo link:** _add Vercel preview URL_

**Repo:** _add GitHub URL_

---

## What makes this an AI Agent (not a chatbot)

An AI Agent is not a chatbot. It must Observe → Reason → Plan → Act → Verify → Report → Learn.
Agent CaMate implements this loop with a 10-agent pipeline:

| Phase | Agent(s) | What happens |
|---|---|---|
| **Observe** | Store Context + Weather Signal + Operations Baseline | Fetch store profile, live weather, POS/inventory/staffing baseline (sponsor → CSV → synthetic) |
| **Reason** | Demand + Inventory & Prep | Predict rain-driven demand shifts, stockout/waste risk |
| **Plan** | Staffing + Campaign | Size staffing per slot, assign roles, recommend campaign focus |
| **Act** | Manager Briefing + Task Automation | Create 30-second briefing, draft automation tasks (approval required for sensitive actions) |
| **Verify** | Operations Baseline Agent (trace step 2.5) | Check data source mode (live/csv/synthetic), confidence, fallback status |
| **Report** | Risk Explanation + Agent Execution Trace | Explain why each recommendation was made, with evidence + confidence |
| **Learn** | Learning Agent (placeholder) | TODO: compare forecast vs actual, adjust model |

### 10 Golden Rules compliance

| # | Rule | Status |
|---|---|---|
| 1 | Clear goal | ✅ Reduce stockout, waste, increase readiness |
| 2 | Real data or clearly-labeled demo | ✅ 5-class provenance badges (Live/CSV/Synthetic/Estimated/Missing) |
| 3 | Calls tools/APIs | ✅ Open-Meteo, SponsorOpsAdapter, CsvOpsAdapter, Prisma DB, export API |
| 4 | Evidence trace | ✅ 10-agent execution trace with input/output/confidence per step |
| 5 | Human approval | ✅ Supplier orders, campaigns, staff changes require manager approval |
| 6 | Fallback chain | ✅ Sponsor → CSV → Synthetic → explain degraded confidence |
| 7 | State + context memory | ✅ Prisma AgentRun table, ops baseline mode in run result |
| 8 | No overclaiming | ✅ Agent says "Using CSV baseline" not "Based on real KFC data" |
| 9 | Optimizes actions, not conversation | ✅ Plan is center; chat is auxiliary ("Ask this plan" in Advanced drawer) |
| 10 | Measures outcomes | ~ Placeholder — Learning Agent labeled "placeholder", KPIs in TODO |

---

## The challenge

Ho Chi Minh City is a city of **micro-climates**: a 4pm thunderstorm can flood Bến Thành (Quận 1)
while Củ Chi, 40 km away, stays dry. Today, a KFC store manager checks a generic city-level
weather app at 9am, gets one number for a city of 10 million people, and then mentally translates
it into:

- How many fried chicken batches should I drop at 11am?
- Do I pull a counter staffer into delivery packing at 18:00?
- Should the 16:30 push notification push a rainy-day delivery combo, or a family dine-in bundle?
- Will I have stockouts on delivery buckets, or waste on dine-in sides?

That translation is inconsistent, store by store, manager by manager. The result: over-prep &
waste when forecast rain doesn't hit a store's micro-area, stockouts on delivery SKUs when it
does, mis-staffed shifts, and wasted campaigns.

## What it does

For any chosen KFC store in Ho Chi Minh City, the agent:

1. **Observes** the store's profile — type (urban-street / mall / residential / suburban /
   office-area), district, customer behavior, kitchen capacity, delivery share, peak windows.
2. **Collects** a live micro-local weather signal from Open-Meteo (free, no API key) via a
   pluggable `WeatherModelProvider` — with 6s timeout, 2-attempt retry, 5-min cache, and a
   clearly-labeled deterministic fallback when the live API is unreachable. The Weather Signal
   Layer blends providers, applies risk scoring, sets provenance, and persists a
   `WeatherSnapshot` to Prisma for audit.
3. **Analyzes** how that weather shifts walk-in vs delivery demand for the lunch (11:30–13:30)
   and dinner (18:00–20:30) slots.
4. **Plans** prep batch sizing, inventory, packaging, and staffing per slot.
5. **Recommends** a campaign focus — delivery combo / cold beverage / family dine-in bundle /
   balanced.
6. **Explains** the plan in two LLM-augmented agents: a Risk Explanation narrative and a
   30-second Manager Briefing (headline, TL;DR, top actions, watch items, confidence-aware
   closing note) — generated bilingually in English and Vietnamese via a deterministic
   `withVietnamese()` layer (no second LLM call).

Every step is recorded in an **Agent Execution Trace** panel — the centerpiece of the demo — so
judges can see exactly what each agent received, computed, and emitted, including confidence,
data source (`live` / `fallback` / `computed` / `llm`), **weather provenance** (primarySource,
primaryMode, contributors[]), and duration. A **Data Sources panel** renders the full data-source
registry (8 sources) with mode badges (Live / Verified seed / Simulated / Fallback / Planned),
purpose, used-in, rate limit, license, fallback strategy, and a reliability note per source —
plus an active-store weather provenance strip.

The agent also runs in a **3-store parallel compare mode** — urban (KFC Lê Lai), residential
(KFC Xô Viết Nghệ Tĩnh), and suburban (KFC Centre Mall Củ Chi or KFC Huỳnh Tấn Phát Nhà Bè) — so
judges can see how the *same* weather signal produces *three different* operations plans because
of store-type branching.

## How we built it (the agentic architecture)

We built a custom multi-agent orchestration engine in TypeScript (`src/lib/agent/engine.ts`) —
**eight specialized agents** running in sequence across **six phases**:

```
Observe → Collect → Analyze → Plan → Recommend → Explain
   1        2         3        4-5        6         7-8
```

| # | Agent | Phase | Role |
|---|---|---|---|
| 1 | Store Context Agent | observe | Detects store type, district, customer behavior, peak windows, kitchen capacity |
| 2 | Weather Signal Agent | collect | Pulls live/fallback micro-local weather via `WeatherModelProvider`, derives 4 risk scores, threads provenance |
| 3 | Demand Agent | analyze | Predicts lunch & dinner walk-in / delivery % deltas |
| 4 | Inventory & Prep Agent | plan | Batch sizing, packaging uplift, waste & stockout warnings |
| 5 | Staffing Agent | plan | Per-slot staffing + role assignment |
| 6 | Campaign Agent | recommend | Picks dine-in / takeaway / delivery campaign focus |
| 7 | Risk Explanation Agent | explain | **LLM** narrative connecting risk factors to store context |
| 8 | Manager Briefing Agent | explain | **LLM** 30-second manager-ready briefing (EN + VI) |

**The LLM is used where it adds value — not everywhere.** Six of the eight agents are deterministic
TypeScript functions that compute structured outputs (prep %, staffing delta, etc.). The LLM is
reserved for the two **explanation** agents, where natural-language synthesis is the point.
Both LLM agents have **deterministic fallbacks** so the demo always produces a briefing even if
the LLM is unreachable. The Vietnamese translations of the manager-facing outputs are produced by
a deterministic `withVietnamese()` layer — **no second LLM call** — so the bilingual UI is free.

### Pluggable adapter architecture (pilot-oriented prototype)

The build has two **pluggable seams** that make it pilot-oriented prototype rather than just a demo:

- **`WeatherModelProvider`** (`src/lib/weather/weatherModelProvider.ts`) — every weather source
  implements this interface. The live `OpenMeteoAdapter` is the primary source today. Three
  planned adapters (NASA GPM IMERG rain evidence, Meteostat historical, AviationWeather METAR
  city-level baseline) have production-ready interfaces and are registered in the data source
  registry as `mode: "planned"`. **Advanced AI weather models (GraphCast / Aurora /
  Earth2Studio / RainNet / NowcastNet) are documented as future integration paths via this same
  seam** — see [`ADVANCED_WEATHER_AI_INTEGRATION.md`](./ADVANCED_WEATHER_AI_INTEGRATION.md).
  None are integrated.
- **`OperationsDataAdapter`** (`src/lib/operations/operationsDataAdapter.ts`) — every operations
  data source implements this interface. The default `SyntheticOpsAdapter` (simulated) is
  shipped alongside a `CsvOpsAdapter` that reads `public/sample-operations-data.csv` (20-store
  sample). **Replace that CSV with a real KFC POS export of the same shape and the agent runs on
  real data — no code changes.**

### Data source registry (transparency)

Every external data source is registered in
`src/lib/dataSources/dataSourceRegistry.ts` — the single source of truth. Each entry declares
its id, name, url, type, purpose, **mode** (live / verified-seed / simulated / fallback /
planned / unavailable), used-in, fallback strategy, reliability note, requiresApiKey, cacheTtlSec,
rateLimit, and license. The Data Sources panel renders this registry so operators can see exactly
where every signal comes from.

**Tool use.** Agent 2 calls Open-Meteo via the `OpenMeteoAdapter` as a tool. Agents 7 & 8 call
the LLM as a tool. Every agent's trace step records `dataSource` (`live` / `fallback` /
`computed` / `llm`) so the demo is honest about which agents used real-world data vs computed it.

**Frontend.** Next.js 16 App Router + React 19 + Tailwind 4 + shadcn/ui + Leaflet map. The
dashboard auto-runs the agent on store selection, shows the weather signal, action plan,
before/after simulated impact, manager briefing (EN + VI), the full execution trace, and the Data
Sources panel. A language toggle in the header switches the entire UI between English and
Vietnamese instantly.

**Backend.** Next.js Route Handlers expose `/api/stores`, `/api/weather`, `/api/agent/run`,
`/api/compare`, and `/api/briefing/export`. Every weather fetch persists a `WeatherSnapshot` for
audit; every agent run persists an `AgentRun` (both best-effort — DB failure never breaks the
response).

## Challenges we ran into

- **Live data fragility.** Hackathon demos fail in front of judges when network APIs are blocked.
  We solved this by building a deterministic fallback into the Open-Meteo adapter (6s timeout,
  2-attempt retry, then deterministic fallback signal) that *always* returns a plausible signal —
  but the UI never hides the fact that it's in fallback mode (red `FALLBACK` badge +
  `fallbackReason` + `reliabilityNote` in the trace).
- **LLM latency.** A 15s LLM call is too slow for a 4-minute demo. We added 12s / 15s
  AbortController timeouts with deterministic fallbacks so the pipeline completes in 1–4 seconds
  even when the LLM is slow or unreachable.
- **Bilingual output without doubling LLM cost.** We wanted a Vietnamese operator dashboard for
  real KFC Vietnam managers, but didn't want a second LLM call per run. Solution: the
  `withVietnamese()` deterministic layer translates the structured plan into Vietnamese fields
  (`headlineVi`, `tldrVi`, `topActionsVi`, `watchItemsVi`, `closingNoteVi`) — instant, free,
  deterministic. The LLM only writes English; the Vietnamese mirror is computed.
- **Making "agentic" legible to judges.** "Agentic" is a buzzword. We built the Agent Execution
  Trace panel to make the workflow visible — input, output, confidence, data source, provenance,
  and duration for every step — so judges can *see* the multi-step reasoning, not just trust a
  claim.
- **Honest before/after.** We refused to fabricate "real" POS data. Instead the before/after panel
  is openly labeled as simulated, internally consistent with the agent's own risk scores, with
  relative deltas as the demo value and absolute numbers as illustrative. We also wrote a full
  pilot evaluation framework ([`EVALUATION.md`](./EVALUATION.md)) showing exactly how to replace
  the simulated metrics with real measured ones once POS data is connected.
- **Store-type branching at every layer.** A mall store responds to rain opposite to an
  urban-street store. We had to thread `storeType` through every agent so the same weather signal
  produces store-appropriate plans — and built the 3-store compare to prove it.

## Accomplishments we're proud of

- **The Agent Execution Trace panel.** This is the moment in the demo where judges stop thinking
  "is this just a weather dashboard?" and start thinking "ok, this is reasoning".
- **The pluggable adapter architecture.** `WeatherModelProvider` and `OperationsDataAdapter`
  interfaces mean the agent engine never changes when we swap data sources — whether that's
  activating IMERG/Meteostat/METAR, replacing the synthetic POS with a real CSV, or plugging in
  GraphCast as an advanced AI weather model.
- **Honest degraded modes.** Live → fallback (weather, with retry + cache + audit) → deterministic
  LLM fallback. Every step labeled. Never silently worse. Every weather fetch persisted as a
  `WeatherSnapshot` for audit.
- **Bilingual operator dashboard.** Real KFC Vietnam managers speak Vietnamese. The EN/VI toggle
  in the header switches the entire UI instantly, and the manager-facing outputs (headline,
  TL;DR, top actions, watch items, closing note) are generated bilingually by the agent engine —
  no second LLM call.
- **The 3-store compare.** Same weather, three radically different plans — proving the agent is
  reasoning per-store, not per-city.
- **End-to-end pilot-oriented prototype build** in a hackathon weekend: live API with retry/cache/audit,
  multi-agent pipeline, LLM integration with bilingual output, map UI, data source registry,
  briefing export, persistence.

## What we learned

- **An agent is a workflow, not a model.** The LLM is one tool inside an 8-agent pipeline; the
  orchestration is where the value is.
- **"Honest about data" is a feature.** Surfacing live vs fallback, computed vs LLM, simulated
  vs planned, with a methodology footnote on before/after, makes the demo more credible, not less.
- **Pluggable interfaces age well.** Splitting the monolithic weather adapter into
  `WeatherModelProvider` + `WeatherSignalLayer` + `riskScoring` + adapter modules was extra work
  upfront, but it's what makes activating IMERG/Meteostat/METAR (and eventually GraphCast) a
  config change instead of a rewrite.
- **Store-type branching is the whole game** in hyperlocal F&B ops. A mall is not a street is not
  a suburb — and a city-level weather forecast flattens exactly the differences that matter.
- **Resilience patterns matter for demos.** Timeouts, retries, fallbacks, caching, and
  best-effort persistence are what let you ship a demo that works on hotel wifi, on stage, with a
  4-minute clock.

## What's next

- **Real KFC POS data via the CSV seam** — replace `public/sample-operations-data.csv` with a
  real KFC POS export and the agent runs on real baselines. No code changes. (See
  [`EVALUATION.md`](./EVALUATION.md) for the full A/B pilot design once this is connected.)
- **Activate planned weather sources** — NASA GPM IMERG (rain evidence), Meteostat (historical
  normals), AviationWeather METAR (city-level baseline). Each interface is ready; activation is a
  config + parser/key change.
- **Advanced AI weather models** — GraphCast / Aurora / Earth2Studio / RainNet / NowcastNet as
  additional `WeatherModelProvider`s. See
  [`ADVANCED_WEATHER_AI_INTEGRATION.md`](./ADVANCED_WEATHER_AI_INTEGRATION.md) for the honest
  feasibility assessment. None are integrated.
- **IoT & camera telemetry** — real-time footfall and kitchen output sensors to close the
  observe loop (currently the agent observes only weather + static store profile).
- **Closed-loop execution** — auto-write the staffing delta to the roster system, auto-push the
  campaign to the loyalty app. Today the agent recommends; a human approves.
- **A/B measurement** — track actual waste %, stockout %, and delivery SLA per store; compare
  agent-managed vs control stores to validate the before/after simulation. See
  [`EVALUATION.md`](./EVALUATION.md).
- **Multi-day forecasting agent** — currently the engine plans for "tomorrow" using a 3-day
  Open-Meteo horizon; a horizon-planning agent could optimize weekly prep & supply.
- **Multi-city** — extend the seed dataset beyond TP.HCM (Hà Nội, Đà Nẵng, …).
- **Push briefing to manager channels** — Zalo OA, email, the manager app — instead of
  Markdown download.

## Built with

| | |
|---|---|
| **Language** | TypeScript 5 |
| **Framework** | Next.js 16 (App Router, standalone output) |
| **UI** | React 19, Tailwind CSS 4, shadcn/ui (Radix primitives), lucide-react |
| **Charts** | Recharts |
| **Map** | Leaflet 1.9 + react-leaflet 5, OpenStreetMap tiles |
| **Toasts** | sonner |
| **i18n** | Custom React context (`src/lib/i18n/`) — English + Vietnamese, localStorage persistence, browser-language auto-detect, deterministic bilingual manager-facing output via `withVietnamese()` |
| **Backend** | Next.js Route Handlers (API routes) |
| **Agent engine** | Custom TypeScript pipeline — 8 agents, 6 phases, bilingual output layer (`src/lib/agent/engine.ts`) |
| **Weather architecture** | Pluggable `WeatherModelProvider` interface + `OpenMeteoAdapter` (live, 6s timeout, 2-attempt retry, 5-min cache) + planned IMERG / Meteostat / METAR adapters + `WeatherSignalLayer` orchestrator + pure `riskScoring` functions |
| **Operations data** | Pluggable `OperationsDataAdapter` interface — `SyntheticOpsAdapter` (default, simulated) + `CsvOpsAdapter` (reads `public/sample-operations-data.csv` — seam for real KFC POS exports) |
| **Data sources** | Single source of truth registry (`src/lib/dataSources/dataSourceRegistry.ts`) — 8 sources with mode / purpose / fallback / license / rate limit |
| **Weather data** | Open-Meteo (free, no API key) — live-first with deterministic fallback; every fetch persisted as `WeatherSnapshot` for audit |
| **LLM** | LLM Router (OpenAI-compatible/Gemini/Groq/OpenRouter) (chat completions, JSON output, 12–15s AbortController timeouts + deterministic fallback) |
| **Database** | Prisma 6 + SQLite (caches geocoding, persists WeatherSnapshot audit trail, persists agent runs) |
| **Runtime / package manager** | Bun (also works with npm/pnpm) |
| **Validation** | Zod 4 |
| **Geocoding** | Nominatim / OpenStreetMap (offline at dataset creation; runtime path planned) |
| **Dev tooling** | ESLint 9, bun-types |

---

## Try it

```bash
bun install && bun run dev
```

Open <http://localhost:3000>, pick a store (or hit **Run 3-store demo compare**), watch the
Agent Execution Trace panel, and toggle the language (EN/VI) in the header.

> ⚠️ **Not an official KFC product.** This is a hackathon pilot-oriented prototype build. KFC branding and
> store names are used only in the F&B track context of a hackathon. Operational numbers are
> simulated by default — but the CSV seam is ready for real KFC POS data. The claim is **not**
> "more accurate than weather apps" — it's: **Agent CaMate converts local weather and demand
> signals into actionable store operations plans.** Advanced AI weather models (GraphCast /
> Aurora / Earth2Studio / RainNet / NowcastNet) are documented as future integration paths via
> the `WeatherModelProvider` seam; none are integrated.

# AI Documentation — The Agentic Architecture

This document is the deep dive on the agentic AI architecture of **Agent CaMate — Hyperlocal
StoreOps Agent**. It covers the 8 specialized agents, the 6-phase flow, the pluggable
`WeatherModelProvider` interface (the seam for advanced AI weather models), the operations data
adapter path, the bilingual output layer, how the LLM is used (and where it isn't), the
execution-trace structure (with weather provenance), confidence scoring, and live/fallback data
modes. It is written for judges who want to understand *why this is an agent and not a dashboard*.

> **Source of truth:** `src/lib/agent/engine.ts` (8-agent pipeline + `withVietnamese` layer),
> `src/lib/types/index.ts` (domain types incl. `WeatherProvenance`),
> `src/lib/weather/weatherModelProvider.ts` (pluggable interface),
> `src/lib/weather/weatherSignalLayer.ts` (orchestrator),
> `src/lib/weather/riskScoring.ts` (pure risk-score formulas),
> `src/lib/weather/adapters/*.ts` (live + planned adapters),
> `src/lib/operations/*.ts` (operations adapter interface + synthetic + CSV),
> `src/lib/i18n/dictionaries.ts` (EN + VI dictionaries),
> `src/lib/llm.ts` (LLM wrapper),
> `src/lib/dataSources/dataSourceRegistry.ts` (single source of truth).

---

## 1. Why this is agentic (and not just a dashboard)

A dashboard **displays** data and lets a human decide. An agent **observes, reasons, calls tools,
and outputs a decision**. Agent CaMate is the latter:

| Property | A dashboard | This agent |
|---|---|---|
| Triggered by | User refresh | Auto-runs on store selection; observes signals |
| Workflow | One display step | 8-agent pipeline, 6 phases (Observe → Collect → Analyze → Plan → Recommend → Explain) |
| Tool use | None | Calls Open-Meteo via a pluggable `WeatherModelProvider`; calls LLM for explanation & briefing |
| Output | Chart / number | **A decision** — prep %, staffing delta, campaign focus, briefing |
| Reasoning | None | Each agent logs input → output → confidence + provenance; LLM writes natural-language narrative |
| Failure handling | Crashes or shows blank | Degrades gracefully: live → fallback → deterministic LLM fallback; never throws |
| Transparency | Black box | Full execution trace + Data Sources registry + weather provenance strip visible in the UI |

Crucially, **the agent does not try to be more accurate than weather apps at predicting weather.**
The value proposition is converting any weather signal into a store-level operations decision.
Weather is the input; the agent's job is the translation. The pluggable `WeatherModelProvider`
interface means that translation layer stays the same regardless of which weather model feeds it —
today Open-Meteo, tomorrow GraphCast / Aurora / Earth2Studio (documented as future integration
paths; see [`ADVANCED_WEATHER_AI_INTEGRATION.md`](./ADVANCED_WEATHER_AI_INTEGRATION.md)).

---

## 2. The 6-phase flow

```
┌──────────┐    ┌─────────┐    ┌──────────┐    ┌──────────┐    ┌────────────┐    ┌─────────┐
│ Observe  │ →  │ Collect │ →  │ Analyze  │ →  │   Plan   │ →  │ Recommend  │ →  │ Explain │
└──────────┘    └─────────┘    └──────────┘    └──────────┘    └────────────┘    └─────────┘
   Agent 1         Agent 2        Agent 3      Agents 4 & 5       Agent 6       Agents 7 & 8
```

| Phase | Purpose | Agent(s) |
|---|---|---|
| **Observe** | Understand the store: type, location, customer behavior, operational constraints | 1. Store Context |
| **Collect** | Pull live/fallback micro-local weather signals via the Weather Signal Layer; derive 4 risk scores; record provenance; persist snapshot | 2. Weather Signal |
| **Analyze** | Predict walk-in & delivery demand shift per slot from weather × store profile | 3. Demand |
| **Plan** | Translate demand shift into prep batch sizing, inventory, packaging, staffing | 4. Inventory & Prep · 5. Staffing |
| **Recommend** | Pick a dine-in / takeaway / delivery campaign focus | 6. Campaign |
| **Explain** | Synthesize a natural-language narrative + a 30-second manager briefing (EN + VI) | 7. Risk Explanation · 8. Manager Briefing |

The orchestrator (`runAgentPipeline` in `engine.ts`) runs all 8 agents in sequence, threading
structured output from each into the next, and accumulating an `AgentStep[]` trace. The Weather
Signal Agent additionally receives a `WeatherProvenance` object that records the primary source,
its mode (live/fallback), and the list of contributors (Open-Meteo contributed; IMERG / Meteostat /
METAR planned-but-not-contributed).

---

## 3. The weather architecture (pluggable WeatherModelProvider)

This is the **production seam** of the build. The weather layer was split out of the monolithic
MVP adapter into a set of focused, pluggable modules so that (a) the live source can be replaced
without touching the agent engine, and (b) advanced AI weather models can be added later without
re-architecting the system.

### 3.1 The `WeatherModelProvider` interface

```ts
// src/lib/weather/weatherModelProvider.ts
export interface WeatherModelProvider {
  readonly id: string;
  readonly name: string;
  readonly mode: "live" | "fallback" | "planned" | "unavailable";
  /** Fetch raw normalized weather data for a store.
   *  Never throws — returns fallback data with isLive=false on error. */
  fetch(store: KfcStore): Promise<RawWeatherData>;
}
```

Every weather source — Open-Meteo live, NASA GPM IMERG, Meteostat, METAR, and any future
GraphCast / Aurora / Earth2Studio / RainNet / NowcastNet model — implements this same interface.
The agent engine never imports an adapter directly; it consumes `RawWeatherData` and `WeatherSignal`.

### 3.2 The Weather Signal Layer (orchestrator)

```ts
// src/lib/weather/weatherSignalLayer.ts
export async function getWeatherSignalWithProvenance(
  store: KfcStore,
  opts: { persist?: boolean } = {},
): Promise<WeatherSignalResult>  // { signal: WeatherSignal, provenance: SignalLayerProvenance }
```

The orchestrator:

1. Fetches the primary source (`openMeteoAdapter.fetch(store)` — live-first with built-in
   fallback).
2. Records planned contributors (IMERG / Meteostat / METAR) as `contributed: false` in the
   provenance, so the UI can show "what this source WOULD contribute" even in planned mode.
   When those adapters are activated, their contributions would be blended here to strengthen
   confidence.
3. Converts `RawWeatherData` → `WeatherSignal` via `toWeatherSignal`, which:
   - Calls `computeRiskScores(...)` (pure functions in `riskScoring.ts`) to derive
     `rainRiskScore`, `heatRiskScore`, `deliveryDisruptionRisk`, `walkInDropRisk`.
   - Computes `dataConfidence` (0.45 fallback base, +0.3 hourly, +0.2 daily, capped at 0.98).
   - Sets `fallbackReason` (only when `isLive=false`) and `reliabilityNote`.
4. Persists a `WeatherSnapshot` to Prisma (best-effort — never fails a weather fetch on DB error).
5. Returns `{ signal, provenance }`.

### 3.3 The adapters

| Adapter | File | Mode | Notes |
|---|---|---|---|
| `OpenMeteoAdapter` | `adapters/openMeteoAdapter.ts` | **live** | Live Open-Meteo API. 6s timeout, 2-attempt retry with exponential backoff, 5-min in-process cache. Deterministic fallback signal (`buildFallback`) on failure. |
| `NasaGpmImergAdapter` | `adapters/nasaGpmImergAdapter.ts` | planned | Interface ready. Returns `emptyRawWeather(...)` with a `planned` note. Live ingestion requires NASA GES DISC / OPeNDAP access + NetCDF/GeoTIFF parser. Exposes `plannedRainEvidence()` so the UI can show what IMERG would contribute. |
| `MeteostatAdapter` | `adapters/metostatAdapter.ts` | planned | Interface ready. Nearest-station matching for HCM (Tan Son Hoa / Vung Tau) is feasible. Live ingestion pending Meteostat API key (CC BY-NC 4.0, commercial for high volume). Exposes `plannedHistoricalContext(month)`. |
| `MetarAdapter` | `adapters/metarAdapter.ts` | planned | Interface ready + minimal METAR parser (`parseMetar`) handles wind/pressure/temp/cloud/present-weather tokens. Live call to AviationWeather disabled in this build to keep the demo deterministic. Used ONLY as a city-level baseline (VVTS, ~6km from District 1), never as the sole store-area signal. Exposes `plannedAviationBaseline()`. |

`src/lib/weather/open-meteo.ts` is now a **backwards-compatible re-export** that re-exports
`getWeatherSignal`, `getWeatherSignals`, and the risk-scoring helpers from their new modules.

### 3.4 How advanced AI weather models would plug in

GraphCast / GenCast (Google DeepMind), Microsoft Aurora, NVIDIA Earth2Studio, WeatherBench 2,
RainNet, and NowcastNet would each be implemented as an additional `WeatherModelProvider`. The
integration plan:

1. Implement a new `class GraphCastAdapter implements WeatherModelProvider` (or Aurora, etc.)
   that loads the model, runs inference, and returns `RawWeatherData` in the same shape as the
   Open-Meteo adapter.
2. Register it in the Weather Signal Layer's contributor list.
3. Select via config (env var / config flag) which provider is primary for a given store.
4. **No change** to the agent engine, the risk-scoring functions, the trace structure, or the
   briefing agents — they all consume `WeatherSignal` regardless of source.

See [`ADVANCED_WEATHER_AI_INTEGRATION.md`](./ADVANCED_WEATHER_AI_INTEGRATION.md) for the honest
feasibility assessment of each model. **None are integrated in this build.**

### 3.5 Risk scoring (pure functions)

Extracted from the monolithic adapter into `src/lib/weather/riskScoring.ts` so the formulas are
unit-testable and reusable by any `WeatherModelProvider`:

| Score | Formula (clamped to 0–1) |
|---|---|
| `rainRiskScore` | `0.45 × precipIntensity + 0.4 × precipProb + 0.25 (if pressure falling) + 0.05 × cloudCover/100`, where `precipIntensity = precipMm/8` |
| `heatRiskScore` | `0.7 + (tempC−34)×0.08` if tempC≥34, else `0.35 + (tempC−31)×0.12` if tempC≥31, else `0.1` |
| `deliveryDisruptionRisk` | `0.5 × rainRisk + 0.2 × windKmh/40 + 0.2 × store.deliveryShare + 0.15 (if suburban)` |
| `walkInDropRisk` | `rainRisk × walkInExposure + 0.1 × windKmh/30`, where `walkInExposure` = `0.1 (mall) / 0.9 (urban-street) / 0.8 (office) / 0.6 (default)` |

Note the store-type sensitivity: mall stores have `walkInExposure = 0.1` (rain barely affects
them — shelter effect), while urban-street stores have `0.9` (rain crushes walk-in). This is the
core "hyperlocal" lever.

---

## 4. The operations data path (pluggable OperationsDataAdapter)

The Demand, Inventory & Prep, and Staffing agents all consume an `OpsBaseline` (baseline lunch /
dinner orders, baseline delivery share, on-hand inventory, scheduled staffing). In production this
would come from KFC's POS, inventory, and workforce management systems. In this build it comes
from a pluggable interface:

```ts
// src/lib/operations/operationsDataAdapter.ts
export interface OperationsDataAdapter {
  readonly id: string;
  readonly name: string;
  readonly mode: "simulated" | "csv" | "live";
  /** Fetch the operations baseline for a store. Never throws. */
  fetch(store: KfcStore): Promise<OpsBaseline>;
}
```

Two implementations ship in this build:

| Adapter | File | Mode | Notes |
|---|---|---|---|
| `SyntheticOpsAdapter` | `syntheticOpsAdapter.ts` | simulated | Default. Derives baseline orders from store profile (seats × 1.8 + kitchenCapacity × 12 for lunch). Honest `reliabilityNote` field labels the data as synthetic. |
| `CsvOpsAdapter` | `csvOpsAdapter.ts` | csv | Reads `public/sample-operations-data.csv` (20-store sample shipped). The seam for real KFC POS exports: drop a CSV in the same shape and the adapter picks it up with no code changes. Tolerant of quoted fields and BOM. |

**CSV schema** (one row per store, header required):

```
storeId,baselineLunchOrders,baselineDinnerOrders,baselineDeliveryShare,
chickenRawKg,buckets,cups,bags,staffingLunch,staffingDinner
```

If a CSV row is missing for a store, `CsvOpsAdapter` returns a profile-derived baseline labeled
`mode: "csv"` with a reliability note explaining the gap (so the UI still labels the source
honestly). See [`DATA_SOURCES.md`](./DATA_SOURCES.md) for the full schema and replacement
instructions.

A future live POS connector (`mode: "live"`) would implement the same interface — no agent engine
changes needed.

---

## 5. The 8 specialized agents

### Agent 1 — Store Context Agent (Observe)

**Role:** Understand store type, location, customer behavior & operational constraints.

**Input:** `KfcStore` from the seed dataset (id, name, address, lat/lng, `storeType`,
`riskProfile`, `demandProfile`, `kitchenCapacity`, `deliveryShare`, `dineInSeats`, `notes`).

**Output:** `StoreWithContext` — adds `customerBehavior`, `peakWindows`, `contextNotes`.

**Branching:**
- `customerBehavior` is set per `storeType`:
  - `mall` → "Family & group dine-in dominant; weekend peak; rain increases footfall (shelter)."
  - `office-area` → "Office worker lunch surge 11:30–13:00; thin dinner demand."
  - `urban-street` → "Mixed CBD walk-in + delivery; lunch peak sharp, dinner moderate."
  - `suburban` → "Residential dinner peak; delivery share high; long rider distances."
  - `residential` (default) → "Steady residential all-day; delivery skew rising."
- `peakWindows` is set per `demandProfile` (`lunch-heavy` / `dinner-heavy` / `delivery-skew` /
  `all-day`).

**Confidence:** `0.92` (high — static profile data). **Data source:** `computed`.

---

### Agent 2 — Weather Signal Agent (Collect)

**Role:** Collect & interpret live/fallback weather + area signals into store-level risk, with
full provenance threading.

**Tool use:** The Weather Signal Layer (not the agent itself) calls the primary
`WeatherModelProvider` — currently `OpenMeteoAdapter` — for the store's exact lat/lng with
`current`, `hourly` (24h), and `daily` (3-day) variables in `Asia/Ho_Chi_Minh` timezone,
`past_days=1`, `forecast_days=3`, **6-second timeout, 2-attempt retry with exponential backoff,
5-minute in-process cache**.

**Derived risk scores:** computed by pure functions in `riskScoring.ts` (see §3.5 above).

**Provenance threading:** The trace step's `structuredOutput` records:
- `isLive`, `source`, `fallbackReason`, `reliabilityNote`
- `provenance: { primarySource, primaryMode, contributors[] }` — where each contributor is
  `{ sourceId, sourceName, mode, contributed, note? }`. Currently Open-Meteo contributes;
  IMERG / Meteostat / METAR are listed with `contributed: false` and `mode: "planned"`.
- All four risk scores + `dataConfidence`.

The `AgentRunResult` type also carries a top-level `weatherProvenance: WeatherProvenance` so the
Data Sources panel can render an active-store weather provenance strip.

**Persistence:** The Weather Signal Layer persists a `WeatherSnapshot` to Prisma for every fetch
(best-effort). The snapshot stores `storeId`, `lat`, `lng`, `payload` (full signal JSON),
`source`, `isLive`, `createdAt`. This is the audit trail for "what weather did the agent actually
see at this minute for this store?"

**Live vs fallback:** If the Open-Meteo fetch fails (network, timeout, non-200, missing
`current`), the adapter builds a deterministic fallback signal — plausible HCM weather based on
time of day + wet season (May–Oct) — with `isLive=false`, `dataConfidence=0.45`, and
`source="fallback (live unavailable: <reason>)"`. The fallback is also persisted as a
`WeatherSnapshot` with `isLive=false` for audit.

**Confidence:** equals `weather.dataConfidence` (0.45 fallback → ~0.95–1.0 live).
**Data source:** `live` or `fallback`.

---

### Agent 3 — Demand Agent (Analyze)

**Role:** Predict walk-in & delivery demand shift per slot from weather × store profile.

**Output:** `SlotPlan[]` (two slots — lunch 11:30–13:30, dinner 18:00–20:30), each with:
- `expectedWalkInDelta` (signed % vs baseline)
- `expectedDeliveryDelta` (signed % vs baseline)
- `prepBatchDelta` (signed % vs baseline)
- `staffingDelta` (signed headcount delta, −1/0/+1)
- `packagingDelta` (signed % vs baseline)
- `warnings[]`

**Branching examples:**
- Lunch walk-in delta: `mall` → slight uplift from shelter (`rainRisk×12 − 4`); other types →
  `−walkInDropRisk × 32` (sharp drop).
- Lunch delivery delta: `rainRisk × 35 + deliveryDisruption × 10` (rain drives delivery surge,
  but disruption offsets).
- Dinner delivery delta: `rainRisk × 30 − deliveryDisruption × 12` (net depends on disruption).
- `staffingDelta`: `+1` if delivery delta > 12, `−1` if < −5/-8, else `0`.

**Warnings** fire when:
- Lunch delivery > 15 → "Delivery surge expected — pre-stage rider packaging."
- Lunch walk-in < −20 → "Walk-in collapse risk — reduce early fried batch."
- Dinner delivery < −5 → "Rider dispatch delay may suppress delivery conversion — set delivery ETA buffers."
- Heat risk > 0.6 → "Heat stress — add beverage promo & cold-side prep."

**Confidence:** `0.7 × weather.dataConfidence + 0.2`. **Data source:** `computed`.

---

### Agent 4 — Inventory & Prep Agent (Plan)

**Role:** Translate demand shift into prep batch sizing, inventory & packaging actions.

**Output:** `inventory` (string), `prep` (string), `wasteWarnings[]`, `stockoutWarnings[]`.

**Key computations:**
- `earlyBatchDelta = lunch.prepBatchDelta` (reduce early fried batch if walk-in drop expected).
- `lateBatchHedge`: suburban + rain > 0.5 → "Delay large dinner prep until 17:00 confirmed demand";
  otherwise → "Stage dinner prep in two smaller batches to hedge rain uncertainty."
- `packagingUpliftPct = round(totalDeliveryUplift)` (delivery surge → more buckets/boxes/cups).
- `beverageUpliftPct = round(heatRiskScore × 20)` (heat → more cold drinks).

**Waste warnings** fire when:
- Walk-in drop > 25 → "High walk-in drop — over-prep of dine-in sides will create waste risk."
- Rain > 0.6 and not mall → "Rain + low shelter — risk of leftover fried chicken after lunch."

**Stockout warnings** fire when:
- Delivery uplift > 30 → "Delivery surge — high-delivery SKUs at stockout risk by 19:30."
- Suburban → "Suburban long supply lead time — confirm backup inventory now."

**Confidence:** `0.78`. **Data source:** `computed`.

---

### Agent 5 — Staffing Agent (Plan)

**Role:** Size staffing per slot and assign roles to match shifted demand mix.

**Baseline assumption:** 1 lead + 2 kitchen + 2 counter + 1 runner = 6 staff per slot.

**Output:** `staffing` (string), `serviceDelayWarnings[]`.

**Branching:**
- Lunch staff = baseline + `lunch.staffingDelta` (from Demand Agent).
- Dinner staff = baseline + `dinner.staffingDelta`.
- If lunch delivery delta > 10 → "Assign 1 dedicated online-order packer" else "shared packing".
- If dinner delivery delta > 12 → "Pull 1 prep staff to packing station 18:00–20:30".
- Heat > 0.6 → "Add 5-min rotation break per hour for kitchen staff."

**Service delay warnings:** lunch delivery > 15 → "Pre-confirm 1 extra rider via aggregator";
mall + dinner walk-in < −20 → "Redeploy 1 counter staff to fulfillment."

**Confidence:** `0.74`. **Data source:** `computed`.

---

### Agent 6 — Campaign Agent (Recommend)

**Role:** Recommend dine-in / takeaway / delivery campaign focus from risk + store type.

**Output:** `campaign` (string), with `focus` and `rationale`.

**Decision tree (priority order):**
1. Rain > 0.55 **and not mall** → **DELIVERY + TAKEAWAY** ("Rain suppresses walk-in. Push delivery
   combo bundles & rainy-day free-shipping; suppress dine-in discount. Mall stores invert.")
2. Heat > 0.6 → **COLD BEVERAGE + DELIVERY** ("Heat stress drives cold drink attach & delivery.")
3. Mall store → **DINE-IN FAMILY BUNDLES** ("Mall shelter effect — rain pushes families indoors.")
4. Lunch or dinner delivery delta > 12 → **DELIVERY COMBO + APP PUSH** ("Push app-only delivery
   combo & loyalty points.")
5. Otherwise → **BALANCED — DINE-IN + DELIVERY** ("Standard mix; light delivery app push.")

**Timing:** Push notifications at 10:30 for lunch, 16:30 for dinner.
**Creative:** rainy-day cozy combo / chill combo / everyday value combo based on dominant risk.

**Confidence:** `0.8`. **Data source:** `computed`.

---

### Agent 7 — Risk Explanation Agent (Explain) — **LLM-augmented**

**Role:** Explain **why** the recommended action plan was made, in clear store-manager language.
This agent does **not** make new recommendations — it explains the existing reasoning.

**Input:** Top risk factors (sorted by weight desc), store context, weather signal, slot deltas.

**Risk factors built by `buildRiskFactors`:**
- **Rain risk (micro-local)** — weight `rainRiskScore`.
- **Falling pressure trend** — weight `0.2` (only if pressure is falling).
- **Delivery disruption** — weight `deliveryDisruptionRisk`.
- **Heat stress** — weight `heatRiskScore` (only if > 0.5).
- **Demand mix shift** — weight `min(1, (|lunch del| + |dinner del|) / 80)`.

**LLM call:** `llmComplete(systemPrompt, userMessage, { timeoutMs: 12000 })` via
LLM Router (supporting OpenAI-compatible / Gemini / Groq / OpenRouter). The system prompt is:

> *"You are the Risk Explanation Agent for a KFC F&B store-operations system in Ho Chi Minh City.
> Your job: explain WHY the recommended action plan was made, in clear store-manager language.
> You are NOT making new recommendations. You are explaining the existing reasoning. Be concise
> (max 180 words), practical, no hype. Output STRICT JSON: {"narrative": string}. The narrative
> should reference the top 2-3 risk factors by name and connect them to the store type."*

**Fallback (deterministic):** If the LLM call fails or times out, the agent builds a hand-written
narrative from the top 2 factors:

> *"Recommendations are driven primarily by {factor 0} (weight {w0}) and {factor 1} (weight {w1}).
> For a {storeType} store in {district}, rain suppresses walk-in while shifting demand to delivery
> — but rider dispatch is also disrupted ({deliveryDisruptionRisk}). Net effect: reduce early fried
> prep to avoid waste, pre-stage delivery packaging, and add a fulfillment staffer during peak.
> {Signal is live. | Signal is in fallback mode — treat as directional.}"*

**Confidence:** `0.82` (LLM) or `0.7` (fallback). **Data source:** `llm` or `computed`.

---

### Agent 8 — Manager Briefing Agent (Explain) — **LLM-augmented + bilingual**

**Role:** Synthesize a 30-second, action-oriented briefing a store manager can read before their
shift — in **both English and Vietnamese**.

**Input:** Store context, weather, the full action plan, and the Risk Explanation narrative.

**Output:** `ManagerBriefing` (English primary fields + Vietnamese mirror fields):
- `headline` + `headlineVi` (≤120 chars — the one-line takeaway)
- `tldr[]` + `tldrVi[]` (3–4 bullets, each ≤140 chars)
- `topActions[]` + `topActionsVi[]` (3–5 concrete actions ordered by priority)
- `watchItems[]` + `watchItemsVi[]` (2–3 things to monitor during the shift)
- `confidenceLabel` (`low` / `medium` / `high`)
- `closingNote` + `closingNoteVi` (≤160 chars, confidence-aware)

**LLM call:** `llmComplete(systemPrompt, userMessage, { timeoutMs: 15000 })`. The system prompt
specifies strict JSON output matching the `ManagerBriefing` schema. The user message is a
structured dump of the full plan.

**The bilingual layer (`withVietnamese`):** After the LLM produces the English briefing (or the
deterministic fallback does), a separate deterministic function — `withVietnamese(...)` in
`engine.ts` — produces the Vietnamese mirror fields by translating the same structured inputs
(store name, overall risk %, driver label "do mưa" / "do nắng nóng" / "trung bình", slot deltas,
prep / staffing / campaign recommendations, warnings, confidence). **No second LLM call.** The
Vietnamese output is therefore always available, always fast, and always deterministic — the UI
can switch languages instantly without re-running the pipeline.

**Fallback (deterministic):** If the LLM call fails, the agent builds a complete English briefing
from the plan's slot deltas, prep recommendation, staffing recommendation, campaign recommendation,
warnings, and confidence — every field is populated, just without the LLM's natural-language
polish. The headline always works: `"{storeName}: {overallRisk}% operational risk — {rain-driven|heat-driven|moderate} day."`.

**Confidence:** equals `plan.confidence`. **Data source:** `llm` or `computed`.

---

## 6. Where the LLM is used (and where it isn't)

A common misconception is "more LLM = more agentic". The opposite is true here. The LLM is
reserved for the two agents where **natural-language synthesis is the point** — Risk Explanation
and Manager Briefing. The other six agents are deterministic TypeScript functions.

| Agent | LLM? | Why |
|---|---|---|
| 1. Store Context | No | Static profile lookup. Determinism is correct. |
| 2. Weather Signal | No | Tool call (`WeatherModelProvider`) + deterministic risk derivation. Determinism is correct. |
| 3. Demand | No | Numeric model. Determinism is correct. |
| 4. Inventory & Prep | No | Numeric / rule-based. Determinism is correct. |
| 5. Staffing | No | Numeric / rule-based. Determinism is correct. |
| 6. Campaign | No | Decision tree. Determinism is correct (and auditable). |
| **7. Risk Explanation** | **Yes** | Natural-language narrative — the LLM's strength. |
| **8. Manager Briefing** | **Yes** | Natural-language synthesis of structured plan into a briefing. |

**Resilience:** Both LLM agents have deterministic fallbacks. The pipeline **always** returns a
briefing. The trace records `dataSource: "llm"` when the LLM was used and `dataSource: "computed"`
when the fallback fired — so the demo is honest about which agents actually called the model.

---

## 7. The execution trace structure (with provenance)

Every agent run produces an `AgentRunResult` (`src/lib/types/index.ts`):

```ts
interface AgentRunResult {
  storeId: string;
  storeName: string;
  trace: AgentStep[];                  // ← 8 steps, one per agent
  plan: ActionPlan;                    // ← the final operations plan
  briefing: ManagerBriefing;           // ← the 30-second briefing (EN + VI fields)
  beforeAfter: BeforeAfterMetric[];    // ← simulated impact (5 metrics)
  weather: WeatherSignal;              // ← the weather bundle used
  weatherProvenance: WeatherProvenance; // ← primarySource, primaryMode, contributors[]
  isLive: boolean;                     // ← live or fallback
  generatedAt: string;                 // ISO
  totalDurationMs: number;             // end-to-end
  serverDurationMs?: number;
}
```

Each `AgentStep` records:

```ts
interface AgentStep {
  step: number;                 // 1-8
  agentName: string;            // "Store Context Agent", etc.
  agentRole: string;            // human-readable role
  phase: "observe" | "collect" | "analyze" | "plan" | "recommend" | "explain";
  input: string;                // human-readable summary of input used
  output: string;               // human-readable summary of output generated
  structuredOutput?: Record<string, unknown>;  // JSON object
  confidence: number;           // 0-1
  timestamp: string;            // ISO
  dataSource: "live" | "fallback" | "computed" | "llm";
  durationMs: number;
  status: "running" | "done" | "error";
}
```

For the **Weather Signal Agent (step 2)** specifically, `structuredOutput` includes:
- `isLive`, `source`, `fallbackReason`, `reliabilityNote`
- `provenance: WeatherProvenance` (primarySource, primaryMode, contributors[])
- All four risk scores + `dataConfidence`

The **Agent Execution Trace panel** in the UI (`src/components/dashboard/agent-trace-panel.tsx`)
renders each step as an expandable card with:
- The agent icon (lucide-react) and phase color badge (Observe=amber, Collect=sky, Analyze=violet,
  Plan=emerald, Recommend=rose, Explain=slate).
- Timestamp, duration, `dataSource` badge (color-coded), and confidence %.
- Expandable Input / Output / Structured Output (JSON) sections.

A **phase flow indicator** at the top of the panel shows the 6 phases as a chip-strip with the
completed phases highlighted — making the workflow legible at a glance.

---

## 8. Confidence scoring

Confidence is computed per agent and propagated to the final plan:

| Agent | Confidence formula |
|---|---|
| 1. Store Context | `0.92` (static profile data) |
| 2. Weather Signal | `weather.dataConfidence` (live: `0.5 + 0.3 + 0.2 = 1.0` if all three of current/hourly/daily present; fallback: `0.45`) |
| 3. Demand | `0.7 × weather.dataConfidence + 0.2` |
| 4. Inventory & Prep | `0.78` |
| 5. Staffing | `0.74` |
| 6. Campaign | `0.80` |
| 7. Risk Explanation | `0.82` (LLM) or `0.7` (fallback) |
| 8. Manager Briefing | equals `plan.confidence` |

The **overall plan confidence** is:

```
confidence = min(0.95, 0.5 + weather.dataConfidence × 0.4)
```

This means: in live mode (dataConfidence ≈ 1.0), overall confidence is ≈ 0.9; in fallback mode
(dataConfidence = 0.45), overall confidence is ≈ 0.68. The Manager Briefing translates this into
a `confidenceLabel`: `high` (≥ 0.75), `medium` (≥ 0.5), `low` (< 0.5).

The **overall operational risk** is a weighted blend of weather risk scores:

```
overallRisk = 0.4 × rainRiskScore
            + 0.25 × deliveryDisruptionRisk
            + 0.20 × walkInDropRisk
            + 0.15 × heatRiskScore
```

---

## 9. Live / fallback data modes

The system has **two axes of fallback**, both surfaced honestly in the UI:

### Axis 1: Weather (Agent 2)

| Mode | When | How it's labeled | Confidence |
|---|---|---|---|
| **Live** | Open-Meteo API returns valid `current` payload within 6s (after up to 2 retries with exponential backoff) | `LIVE` green badge, `dataSource: "live"`, `primaryMode: "live"` in provenance | up to 1.0 |
| **Fallback** | API unreachable, non-200, or missing `current` after 2 attempts | `FALLBACK` red badge, `dataSource: "fallback"`, `source="fallback (live unavailable: <reason>)"`, `primaryMode: "fallback"` | 0.45 |

The fallback signal is **deterministic and plausible**: it simulates a late-afternoon convective
shower for HCM wet season (May–Oct, hours 14–18), with falling pressure, higher wind, and
synthesized 24h hourly + 3-day daily forecasts. It's labeled as directional only.

**Caching:** Successful live fetches are cached for 5 minutes (keyed by store id); fallback
fetches are cached for 60 seconds so the adapter retries live sooner on the next call.

**Persistence:** Every fetch — live or fallback — persists a `WeatherSnapshot` to Prisma for
audit (best-effort).

### Axis 2: LLM (Agents 7 & 8)

| Mode | When | How it's labeled | Confidence |
|---|---|---|---|
| **LLM** | LLM Router (OpenAI-compatible / Gemini / Groq / OpenRouter) returns content within timeout (12s / 15s AbortController) | `dataSource: "llm"` (violet badge in trace) | 0.82 (Agent 7) / plan.confidence (Agent 8) |
| **Deterministic fallback** | SDK throws, times out, or returns empty | `dataSource: "computed"` (gray badge) | 0.7 (Agent 7) / plan.confidence (Agent 8) |

The fallback narrative is hand-written from the same risk factors and slot deltas the LLM would
have received — so the demo's *substance* is unchanged, only the *prose polish* is missing.

**Crucially: the pipeline never throws.** Both the weather adapter and the LLM wrapper catch all
errors and return structured results. The orchestrator always produces an `AgentRunResult`.

---

## 10. Before/After simulated impact

The pipeline also produces a `BeforeAfterMetric[]` (5 metrics) shown in a dedicated panel. These
are **simulated, internally consistent** numbers derived from the same risk scores & demand deltas
the agent computed — not external ground truth. The panel says this explicitly:

> *"These are simulated, internally-consistent metrics derived from the same risk scores & demand
> deltas the agent computed — not external ground truth. 'Without agent' models a manager reacting
> to generic city-level weather (tends to over-prep dine-in, understaff delivery). 'With agent'
> models the recommended plan applied. Absolute numbers are illustrative; relative deltas are the
> demo value."*

The 5 metrics:

| Metric | Without-agent model | With-agent model | Better is |
|---|---|---|---|
| Food Waste Risk | `min(45, 12 + walkInDrop × 0.6)` | `max(3, without × 0.35)` | lower |
| Stockout Risk | `min(55, 10 + deliveryUplift × 0.5)` | `max(4, without × 0.3)` | lower |
| Staffing Fit | `max(40, 70 − walkInDrop × 0.4 − deliveryUplift × 0.3)` | `min(95, without + 22)` | higher |
| Delivery Readiness | `max(35, 65 − deliveryUplift × 0.4)` | `min(96, without + 25)` | higher |
| Margin Protected | `max(20, 55 − walkInDrop × 0.3 − deliveryUplift × 0.2)` | `min(94, without + 30)` | higher |

**The honest framing:** we are not claiming these absolute numbers are real. We are claiming the
*direction* of the deltas (waste down, stockout down, staffing fit up, delivery readiness up,
margin protected up) follows logically from the agent's recommendations vs a generic-weather
intuition. Roadmap: validate against real POS data via A/B testing — see
[`EVALUATION.md`](./EVALUATION.md) for the full pilot design including how to replace these
simulated metrics with real measured ones.

---

## 11. Persistence

The build persists three kinds of records to SQLite via Prisma (`prisma/schema.prisma`):

| Model | When persisted | Purpose |
|---|---|---|
| `WeatherSnapshot` | **Every weather fetch** (live or fallback), best-effort | Audit trail — "what weather did the agent actually see at this minute for this store?" Keyed by `(storeId, createdAt)`. Stores full `payload` JSON, `source`, `isLive`. |
| `AgentRun` | Every `POST /api/agent/run` call, best-effort | Recall a past briefing. Stores `traceJson`, `planJson`, `briefingJson`, `confidence`, `isLive`. |
| `GeoCache` | (Schema ready; runtime path dormant) | Would cache Nominatim geocoding results at runtime when adding new stores. Seed coordinates are pre-geocoded. |

All persistence is best-effort: the API routes wrap `db.*.create(...)` calls in try/catch. DB
failure never breaks a response. The agent's reasoning is in memory; persistence is a bonus.

---

## 12. Summary — what makes this an agent (pilot-ready edition)

1. **Multi-step workflow** — 8 agents, 6 phases, sequential with structured hand-offs.
2. **Tool use via pluggable interfaces** — `WeatherModelProvider` (Open-Meteo live; IMERG /
   Meteostat / METAR planned; GraphCast / Aurora / Earth2Studio documented as future paths),
   `OperationsDataAdapter` (synthetic default + CSV seam for real POS), LLM (Agents 7 & 8).
3. **Decision output, not display** — prep %, staffing delta, campaign focus, briefing.
4. **Reasoning is visible** — full execution trace with input, output, confidence, data source,
   provenance, and duration per step.
5. **Resilient** — live → fallback (weather, with retry + cache) → deterministic fallback (LLM);
   never throws.
6. **Honest** — every output labels its source; simulated before/after is openly labeled; planned
   sources are surfaced as `mode: "planned"` not hidden.
7. **Per-store, not per-city** — every agent branches on `storeType`; the 3-store compare proves it.
8. **Bilingual** — manager-facing outputs in EN + VI via a deterministic layer (no second LLM
   call); UI chrome bilingual via React context with localStorage + browser-language auto-detect.
9. **Auditable** — every weather fetch persists a `WeatherSnapshot`; every agent run persists an
   `AgentRun`. The full provenance is threaded through the trace.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the system-level data flow and sequence diagram,
[`DATA_SOURCES.md`](./DATA_SOURCES.md) for the full data-source registry,
[`EVALUATION.md`](./EVALUATION.md) for the pilot measurement framework, and
[`ADVANCED_WEATHER_AI_INTEGRATION.md`](./ADVANCED_WEATHER_AI_INTEGRATION.md) for the honest
assessment of advanced AI weather models.

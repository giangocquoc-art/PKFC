# Advanced Weather AI Integration — Honest Assessment

This document is an **honest assessment** of advanced AI weather models and how they would plug
into Agent CaMate's `WeatherModelProvider` interface.

> **Critical honesty up front:** **None of the models below are integrated in this build.** The
> current live `WeatherModelProvider` is **Open-Meteo** (free, no API key, 6s timeout, 2-attempt
> retry, 5-min cache). The models below are documented as **future integration paths** via the
> same `WeatherModelProvider` seam (`src/lib/weather/weatherModelProvider.ts`). Any external
> communication about this project must state this clearly.

The value proposition of Agent CaMate is **not** weather prediction accuracy. It is:
**Agent CaMate converts local weather and demand signals into actionable store operations
plans.** A more accurate weather model would tighten the input; the agent's translation layer
(8-agent pipeline, risk scoring, per-store branching, bilingual briefing) is where the operational
value lives. A better weather model is a *better ingredient*, not a different meal.

---

## 1. The integration seam: `WeatherModelProvider`

Every weather source — Open-Meteo (live today), NASA GPM IMERG (planned), Meteostat (planned),
METAR (planned), and any future advanced AI weather model — implements this interface:

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

export interface RawWeatherData {
  storeId: string;
  lat: number;
  lng: number;
  temperatureC: number;
  apparentTempC: number;
  humidity: number;
  pressureHpa: number;
  pressureTrend: "rising" | "falling" | "stable";
  windSpeedKmh: number;
  windDir: number;
  precipitationMm: number;
  cloudCover: number;
  precipProb: number;          // 0-1, next-hour probability
  hourly: { time; tempC; precipProb; precipMm; windKmh; humidity }[];
  daily: { date; tempMaxC; tempMinC; precipProb; precipSumMm; windMaxKmh }[];
  fetchedAt: string;
  source: string;
  isLive: boolean;
  error?: string;
}
```

To plug in an advanced AI weather model:

1. Implement `class GraphCastAdapter implements WeatherModelProvider` (or `AuroraAdapter`,
   `Earth2StudioAdapter`, etc.) that loads the model, runs inference for the store's lat/lng,
   and returns a `RawWeatherData` in the same shape as the Open-Meteo adapter's output.
2. Register it in the Weather Signal Layer's contributor list (`weatherSignalLayer.ts`).
3. Select via config (env var / config flag) which provider is primary for a given store.
4. **No change** to the agent engine, the risk-scoring functions (`riskScoring.ts`), the trace
   structure, the `WeatherSnapshot` persistence, or the briefing agents — they all consume
   `WeatherSignal` regardless of source.

This is the same seam the planned IMERG / Meteostat / METAR adapters use (see
`src/lib/weather/adapters/*.ts`). The advanced AI weather models would simply be additional
adapters — heavier to implement and run, but architecturally identical.

---

## 2. Per-model assessment

For each model: what it is, compute/data requirements, feasibility for a real KFC pilot,
how it would plug into the `WeatherModelProvider` interface, and whether it would meaningfully
improve store-level operations decisions vs the current Open-Meteo baseline.

Feasibility key:
- **Light**: runnable on CPU or small cloud VM; days to integrate.
- **Medium**: requires GPU (consumer or cloud); weeks to integrate; data download < 50 GB.
- **Heavy**: requires multi-GPU or HPC; months to integrate; data download > 100 GB.

---

### 2.1 GraphCast / GenCast (Google DeepMind)

**Repo:** https://github.com/google-deepmind/graphcast

**What it is:** GraphCast is a graph-neural-network global weather forecasting model trained on
ERA5 reanalysis. It produces 10-day global forecasts at ~0.25° resolution (~25 km) in under a
minute on a single TPUv4. GenCast is the newer probabilistic ensemble version (50-member ensemble,
15-day forecast). Both are published in *Science* (GraphCast, 2023) and *Nature* (GenCast, 2024).

**Compute / data requirements:**
- Inference: 1 TPUv4 or 1 modern GPU (A100/H100). GraphCast inference is ~60s for a 10-day
  forecast; GenCast ensemble is longer.
- Model weights: ~150 MB (GraphCast), larger for GenCast.
- Input data: ERA5 initial conditions from ECMWF (or a real-time analysis) — NetCDF, ~500 MB
  per init time. Requires ECMWF MARS or CDS access (free for research; commercial license for
  production).
- No training required (use pre-trained weights).

**Feasibility:** **Medium-Heavy.** The model itself is well-documented and the JAX/Flax code
runs. The friction is (a) getting real-time ERA5 initial conditions reliably (CDS API rate limits
+ latency), (b) provisioning a TPU/GPU instance, and (c) downsampling the 0.25° global output
to store-level (interpolation — easy but adds uncertainty).

**Licensing:** Apache 2.0 (code). Model weights under DeepMind's terms — research use is clear;
commercial production use should be verified with DeepMind. ERA5 input data has its own CDS
license.

**How it would plug into `WeatherModelProvider`:**
```ts
class GraphCastAdapter implements WeatherModelProvider {
  readonly id = "graphcast";
  readonly name = "GraphCast (DeepMind)";
  readonly mode = "live";  // once wired
  async fetch(store: KfcStore): Promise<RawWeatherData> {
    // 1. Fetch latest ERA5 init from CDS (cached, 6-hourly).
    // 2. Run GraphCast inference for next 24h / 3 days.
    // 3. Interpolate the 0.25° grid to store.lat, store.lng.
    // 4. Map to RawWeatherData (temp, humidity, pressure, wind, precip, cloud).
    //    GraphCast outputs these on pressure levels — surface variables are available.
    // 5. Return with source: "graphcast", isLive: true.
  }
}
```

**Would it meaningfully improve store-level operations decisions?** **Marginally.** GraphCast's
0.25° resolution is ~25 km — for HCM (a ~40 km wide metro area), all 20 stores fall in 1–2 grid
cells. So GraphCast would give a better *city-level* forecast than Open-Meteo's interpolation,
but it wouldn't differentiate between Bến Thành and Củ Chi any better than Open-Meteo does. The
agent's value is the per-store *translation* of a city-level signal — GraphCast would marginally
improve the input, not change the translation. **Verdict: not worth the integration cost for a
pilot.** A cheaper win is Open-Meteo's higher-resolution ECMWF-based forecasts, which the
adapter already consumes.

---

### 2.2 Microsoft Aurora

**Repo:** https://github.com/microsoft/aurora

**What it is:** A unified foundation model for the Earth system — weather, ocean, air quality,
waves. Produces global forecasts at ~0.25° (weather) and higher resolution for air quality.
Published in *Nature* (2025). Aurora is notable for producing *multi-variable* output (including
air quality / PM2.5) from a single model, which Open-Meteo doesn't provide directly.

**Compute / data requirements:**
- Inference: 1 GPU (A100 recommended). Aurora comes in 1.1B and 330M parameter versions.
- Model weights: ~5 GB (1.1B) / ~1.5 GB (330M).
- Input data: same ERA5 initial conditions as GraphCast, plus IFS for ocean/waves if used.
- No training required (use pre-trained weights).

**Feasibility:** **Medium.** Cleaner JAX/PyTorch codebase than GraphCast; the 330M version runs
on consumer GPUs. ERA5 input friction is the same as GraphCast.

**Licensing:** MIT (code). Model weights under Microsoft's research license — commercial use
should be verified.

**How it would plug into `WeatherModelProvider`:** Same shape as GraphCastAdapter above.
Additionally, Aurora could supply PM2.5 / air quality — useful for a *health-advisory* agent
extension (e.g. "high PM2.5 today → expect more delivery, fewer walk-ins"). Not currently a
Agent CaMate use case, but a future capability.

**Would it meaningfully improve store-level operations decisions?** **Marginally, for weather;
potentially useful for air quality.** Same resolution limitation as GraphCast (~25 km). The air
quality angle is the differentiator — HCM has severe PM2.5 episodes that affect walk-in demand
and delivery rider availability. If KFC wants to model air-quality-driven demand shifts, Aurora
is the only model here that supplies it natively. **Verdict: not worth integrating for weather
alone; worth considering if air-quality-driven demand becomes a use case.**

---

### 2.3 NVIDIA Earth2Studio

**Repo:** https://github.com/NVIDIA/earth2studio

**What it is:** A Python SDK for AI-driven weather forecasting that wraps *multiple* AI weather
models (GraphCast, GenCast, Aurora, NVIDIA's own DLWP, FuXi, Pangu-Weather, etc.) under a
unified API. It's a *meta-framework* — you pick the model, Earth2Studio handles the data loading,
inference, and post-processing. Published as an open-source NVIDIA project (2024).

**Compute / data requirements:**
- Inference: 1 GPU (A100/H100 recommended; some models run on consumer GPUs).
- Model weights: depends on which underlying model — bundled via Earth2Studio's model registry.
- Input data: Earth2Studio handles ERA5 / GFS / IFS initial-condition fetching automatically
  (it has built-in data handlers). This is its main value — it abstracts the data-access friction
  that GraphCast and Aurora require you to solve yourself.
- No training required.

**Feasibility:** **Medium.** Earth2Studio reduces the integration friction *vs.* wiring GraphCast
or Aurora directly. Still requires a GPU and a Python sidecar process (the Agent CaMate
backend is TypeScript/Node — Earth2Studio would run as a separate Python service called via HTTP
from a `Earth2StudioAdapter`).

**Licensing:** Apache 2.0 (code). Underlying model weights have their respective licenses.

**How it would plug into `WeatherModelProvider`:** Not directly — Earth2Studio is Python, the
`WeatherModelProvider` is TypeScript. The integration pattern:
```ts
class Earth2StudioAdapter implements WeatherModelProvider {
  readonly id = "earth2studio";
  readonly name = "NVIDIA Earth2Studio";
  readonly mode = "live";
  async fetch(store: KfcStore): Promise<RawWeatherData> {
    // 1. POST { lat, lng, horizonHours: 72 } to the Python Earth2Studio sidecar.
    //    Sidecar runs the configured model (e.g. GraphCast or FuXi), interpolates to lat/lng,
    //    returns JSON.
    // 2. Map JSON → RawWeatherData.
    // 3. Return with source: "earth2studio:<model>", isLive: true.
  }
}
```

**Would it meaningfully improve store-level operations decisions?** **No more than the underlying
model it wraps.** Earth2Studio's value is *engineering productivity* (one integration gives you
access to many models), not *forecast accuracy*. If Agent CaMate wanted to experiment with
multiple AI weather models in parallel and A/B test them, Earth2Studio is the right tool. **Verdict:
not worth it for a pilot. Worth it for a research phase if you want to compare models.**

---

### 2.4 WeatherBench 2

**Repo:** https://github.com/google-research/weatherbench2

**What it is:** WeatherBench 2 is **not a forecasting model** — it's a **benchmark framework**
for evaluating weather forecasts against reanalysis ground truth. It provides standardized
metrics (RMSE, ACC, CRPS for ensembles), standardized ERA5 evaluation data, and reproducible
evaluation pipelines. Published in *Advances in Statistical Sciences* (2024).

**Compute / data requirements:**
- Evaluation: a modest CPU or small GPU is sufficient. The bottleneck is downloading ERA5
  reanalysis data (~10s of GB per evaluation).
- No model weights — it's a benchmark, not a model.

**Feasibility:** **Light** to run; **not directly integrable** as a `WeatherModelProvider`
because it's not a forecast source.

**Licensing:** Apache 2.0 (code). ERA5 evaluation data under CDS license.

**How it would plug into `WeatherModelProvider`:** **It wouldn't.** WeatherBench 2 is an
*evaluation* tool, not a forecast source. It plugs in at a different layer — it would let KFC
Agent CaMate's team *evaluate* whether switching from Open-Meteo to GraphCast (or Aurora, etc.)
actually improves forecast accuracy at the store-level coordinates, before committing to the
integration.

**Would it meaningfully improve store-level operations decisions?** **Indirectly, yes.** If
Agent CaMate's team is considering switching weather providers, WeatherBench 2 lets them
quantify the forecast-accuracy delta at the store-level coordinates. This is the *right* way to
decide whether to invest in GraphCast/Aurora integration — measure first, integrate second.
**Verdict: don't integrate as a WeatherModelProvider. Do use it as an evaluation tool when
deciding which model to integrate next.**

---

### 2.5 RainNet

**Repo:** https://github.com/hydrogo/rainnet

**What it is:** A convolutional neural network for **nowcasting** — short-term (0–60 minute)
precipitation forecasting from radar sequences. Trained on the MRMS radar dataset. Predicts
future radar frames using a U-Net architecture. Published at NeurIPS (2020).

**Compute / data requirements:**
- Inference: 1 GPU (consumer-grade is fine — RainNet is a U-Net, not huge).
- Model weights: ~50 MB.
- Input data: **This is the blocker.** RainNet requires sequences of recent radar reflectivity
  grids as input. HCM does not have a public real-time radar reflectivity feed comparable to
  MRMS. Vietnam's National Center for Hydro-Meteorological Forecasting (NCHMF) has radar data
  but it's not openly available in the format/frequency RainNet needs.

**Feasibility:** **Heavy — blocked on data access.** The model itself is light; the input data
isn't available for HCM at the required frequency and resolution. Without a radar input stream,
RainNet cannot run.

**Licensing:** MIT (code). MRMS training data is NOAA public domain. HCM radar data licensing is
NCHMF's to grant.

**How it would plug into `WeatherModelProvider`:**
```ts
class RainNetAdapter implements WeatherModelProvider {
  readonly id = "rainnet";
  readonly name = "RainNet (radar nowcast)";
  readonly mode = "live";  // if radar input stream available
  async fetch(store: KfcStore): Promise<RawWeatherData> {
    // 1. Fetch last 60 min of radar reflectivity grids covering store.lat, store.lng.
    //    (BLOCKED: no public real-time HCM radar feed in the required format.)
    // 2. Run RainNet inference → next 60 min reflectivity.
    // 3. Convert reflectivity (dBZ) → rain rate (mm/hr) via Z-R relationship.
    // 4. Sample the grid cell at store.lat, store.lng.
    // 5. Return RawWeatherData with precipitationMm + precipProb derived from the nowcast.
    //    Other fields (temp, humidity, pressure) would come from Open-Meteo (blend).
  }
}
```

**Would it meaningfully improve store-level operations decisions?** **Yes — *if* the radar input
were available.** Nowcasting (0–60 min) is exactly the timescale that matters for "do I cut the
next fried batch?" decisions. Open-Meteo's shortest horizon is hourly; a 15-minute nowcast of
"rain will hit this store's coordinates in 20 minutes" would directly drive the Inventory & Prep
Agent's batch timing. This is the highest-leverage model *operationally* — but it's also the most
blocked *practically*. **Verdict: highest operational value, but blocked on HCM radar data
access. Pursue NCHMF data partnership before integration.**

---

### 2.6 NowcastNet

**Repo:** https://codeocean.com/capsule/3935105/tree/v1

**What it is:** A dual-network model (generation + evolution) for **probabilistic precipitation
nowcasting** at 0–3 hour horizons, also from radar sequences. Published in *Nature* (2023). Like
RainNet, it's a nowcaster — but probabilistic (ensemble), which gives uncertainty estimates that
RainNet doesn't.

**Compute / data requirements:**
- Inference: 1 GPU (the evolution network is heavier than RainNet's U-Net).
- Model weights: ~200 MB.
- Input data: **Same blocker as RainNet** — requires radar reflectivity sequences. Same HCM data
  access problem.

**Feasibility:** **Heavy — blocked on data access** (same as RainNet). Slightly more compute than
RainNet but the blocker is the same.

**Licensing:** Code is on Code Ocean (capsule). Research use; commercial licensing unclear.
Training data is multi-source radar; HCM operational data is NCHMF's.

**How it would plug into `WeatherModelProvider`:** Same shape as RainNetAdapter, but the ensemble
output would let the agent express *uncertainty* in the rain nowcast — e.g. "70% of ensemble
members show rain hitting this store in 30 min; 30% show it missing". This is useful for the
Inventory & Prep Agent: high-probability rain → cut batch; low-probability rain → hold batch with
hedging. The agent's existing `precipProb` field maps naturally.

**Would it meaningfully improve store-level operations decisions?** **Yes, even more than RainNet
— *if* the radar input were available.** The probabilistic ensemble is the right way to express
rain nowcast uncertainty to an operations agent. **Verdict: same as RainNet — highest operational
value, blocked on HCM radar data access. The probabilistic ensemble makes NowcastNet the better
choice over RainNet if you can only integrate one.**

---

## 3. Summary assessment table

| Model | Type | Feasibility | GPU? | Data blocker | License | Operational value for KFC | Integrate in pilot? |
|---|---|---|---|---|---|---|---|
| **Open-Meteo** (current) | Live API | — | No | None | CC BY 4.0 | Baseline (current) | ✅ Already integrated |
| **GraphCast / GenCast** | Global AI forecast (10-day) | Medium-Heavy | Yes (TPU/GPU) | ERA5 init (CDS) | Apache 2.0 + DeepMind weights | Marginal (25 km res = city-level, not store-level) | ❌ Not worth it for pilot |
| **Microsoft Aurora** | Unified Earth system (incl. air quality) | Medium | Yes (GPU) | ERA5 init (CDS) | MIT + MS research license | Marginal for weather; useful for air-quality use case | ❌ Not worth it for weather alone |
| **NVIDIA Earth2Studio** | Meta-framework (wraps many models) | Medium | Yes (GPU) | Same as wrapped model | Apache 2.0 | Same as wrapped model; engineering productivity tool | ❌ Not for pilot; yes for research phase comparing models |
| **WeatherBench 2** | Evaluation benchmark (NOT a model) | Light | No | ERA5 reanalysis | Apache 2.0 | Indirect — evaluate before integrating | ❌ Not a WeatherModelProvider; use as evaluation tool |
| **RainNet** | Radar nowcast (0–60 min) | Heavy (blocked on data) | Yes (consumer GPU) | HCM radar feed (NCHMF) | MIT | **High** — nowcast timescale is operational | ❌ Blocked on HCM radar data access |
| **NowcastNet** | Probabilistic radar nowcast (0–3 hr) | Heavy (blocked on data) | Yes (GPU) | HCM radar feed (NCHMF) | Code Ocean research | **Highest** — probabilistic ensemble fits agent's uncertainty model | ❌ Blocked on HCM radar data access |

---

## 4. Which (if any) are realistic for a real KFC pilot?

**Honest answer: none of them are realistic to integrate for a first KFC pilot.**

Here's why, per model:

- **GraphCast / Aurora / Earth2Studio** — all produce ~25 km resolution global forecasts. For HCM
  (a ~40 km metro area), they would give a marginally better *city-level* forecast than Open-Meteo
  (which already interpolates ECMWF model output). The agent's operational value comes from the
  *per-store translation*, not from tightening the city-level input by a few percentage points of
  RMSE. **Integration cost (GPU + ERA5 pipeline + sidecar service) >> operational benefit.**

- **WeatherBench 2** — not a forecast source, so it can't be integrated as a
  `WeatherModelProvider`. But it **should** be used as an evaluation tool *before* any model
  integration: measure whether GraphCast actually beats Open-Meteo at HCM store-level coordinates
  first. If the accuracy delta is < 5% RMSE on precipitation probability, don't integrate.

- **RainNet / NowcastNet** — these would be the **highest-leverage** models operationally,
  because nowcasting (0–60 min) is the timescale that drives "do I cut the next fried batch?"
  decisions. Open-Meteo's shortest horizon is hourly. **But both are blocked on HCM radar data
  access** — there's no public real-time radar reflectivity feed for Ho Chi Minh City in the
  format/frequency these models need. Vietnam's NCHMF has the radar data but it isn't openly
  distributed. **Pursuing an NCHMF data partnership is the prerequisite; integration is the
  follow-up.**

### What's realistic for a first KFC pilot (no advanced AI weather models)

For a first pilot, the realistic weather stack is:

1. **Open-Meteo** as the live `WeatherModelProvider` (current — already integrated).
2. **Activate the planned adapters**: NASA GPM IMERG (rain evidence cross-check — satellite
   precipitation, no radar needed), Meteostat (historical normals — for anomaly detection),
   AviationWeather METAR (city-level baseline — for pressure/wind cross-validation). All three
   have production-ready interfaces; activation is a config + parser/key change.
3. **Run WeatherBench 2 evaluations** of Open-Meteo vs GraphCast vs Aurora at HCM store-level
   coordinates to *quantify* whether any AI model is worth integrating for pilot phase 2.
4. **Pursue NCHMF radar data partnership** in parallel — if secured, RainNet or NowcastNet
   becomes the highest-value phase-2 integration.

### What's realistic for a phase-2 integration (post-pilot, if at all)

If the pilot shows operational value and KFC wants to invest further:

- **Conditional yes to NowcastNet (or RainNet)** — *only if* NCHMF radar data access is secured.
  This is the model most likely to meaningfully improve store-level operations decisions, because
  nowcasting is the operationally-relevant timescale.
- **Conditional yes to Aurora** — *only if* air-quality-driven demand becomes a use case (HCM
  PM2.5 episodes). Aurora is the only model here that supplies air quality natively.
- **Probably no to GraphCast / Earth2Studio standalone** — the resolution limitation means they
  don't differentiate stores within HCM. Use them via Earth2Studio only if running a research
  comparison.
- **Always yes to WeatherBench 2 as an evaluation tool** — measure before integrating.

---

## 5. The integration plan (if/when a model is chosen)

When a specific model is greenlit for integration, follow this plan:

### Phase A — Sidecar service (Python)

Most advanced AI weather models are Python (PyTorch / JAX). The Agent CaMate backend is
TypeScript/Node. So the integration is a **Python sidecar service** that exposes an HTTP endpoint:

```
POST /forecast
  body: { lat, lng, horizonHours }
  response: { tempC, humidity, pressureHpa, windKmh, precipMm, precipProb, cloudCover,
              hourly: [...], daily: [...], source: "graphcast", fetchedAt: "..." }
```

The sidecar handles:
- Model loading (cached in memory).
- Initial-condition fetching (ERA5 from CDS, or radar from NCHMF, cached).
- Inference.
- Interpolation to the requested lat/lng.
- Mapping to the `RawWeatherData`-compatible JSON shape.

### Phase B — TypeScript adapter

Implement the `WeatherModelProvider` adapter in the Agent CaMate codebase:

```ts
// src/lib/weather/adapters/graphCastAdapter.ts (example)
import type { WeatherModelProvider, RawWeatherData } from "../weatherModelProvider";
import type { KfcStore } from "@/lib/stores/seed-stores";

const SIDECAR_URL = process.env.GRAPHCAST_SIDECAR_URL ?? "http://localhost:8001";

export class GraphCastAdapter implements WeatherModelProvider {
  readonly id = "graphcast";
  readonly name = "GraphCast (DeepMind)";
  readonly mode = "live" as const;

  async fetch(store: KfcStore): Promise<RawWeatherData> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);  // 30s for AI inference
      const res = await fetch(`${SIDECAR_URL}/forecast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: store.lat, lng: store.lng, horizonHours: 72 }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`GraphCast sidecar HTTP ${res.status}`);
      const data = await res.json();
      return {
        storeId: store.id, lat: store.lat, lng: store.lng,
        temperatureC: data.tempC, apparentTempC: data.tempC,  // or compute heat index
        humidity: data.humidity, pressureHpa: data.pressureHpa,
        pressureTrend: "stable",  // or derive from hourly pressure sequence
        windSpeedKmh: data.windKmh, windDir: data.windDir ?? 180,
        precipitationMm: data.precipMm, cloudCover: data.cloudCover,
        precipProb: data.precipProb,
        hourly: data.hourly, daily: data.daily,
        fetchedAt: new Date().toISOString(),
        source: "graphcast", isLive: true,
      };
    } catch (e) {
      // Never throw — return empty fallback; the Weather Signal Layer will
      // fall back to Open-Meteo as primary if GraphCast is configured as primary
      // and fails.
      return emptyRawWeather(store, this.id, e instanceof Error ? e.message : "graphcast error");
    }
  }
}
```

### Phase C — Register in the Weather Signal Layer

Add the new adapter to the contributors list in `weatherSignalLayer.ts` and wire it as primary
(or as a supplementary contributor that strengthens confidence). The Weather Signal Layer's
blending logic decides how to combine multiple providers' outputs.

### Phase D — Register in the data source registry

Add an entry to `src/lib/dataSources/dataSourceRegistry.ts` with `mode: "live"`, the model's
license, compute requirements (in the reliability note), and fallback strategy. The Data Sources
panel will then render it for operators.

### Phase E — No changes downstream

The agent engine, risk scoring, trace structure, `WeatherSnapshot` persistence, bilingual
briefing layer, and dashboard UI **require no changes**. They consume `WeatherSignal` regardless
of source. This is the value of the `WeatherModelProvider` seam.

---

## 6. What this document is NOT claiming

- ❌ **Not claiming** that any advanced AI weather model is integrated. None are. Open-Meteo is
  the only live `WeatherModelProvider`.
- ❌ **Not claiming** that integrating any of these models would meaningfully improve store-level
  operations decisions *for HCM stores specifically*. GraphCast / Aurora / Earth2Studio produce
  ~25 km resolution forecasts — useful for city-level, not store-level. Only RainNet / NowcastNet
  (radar nowcasters) would meaningfully improve store-level decisions, and they're blocked on HCM
  radar data access.
- ❌ **Not claiming** that Agent CaMate's value depends on integrating any of these. The
  value is the translation layer (8-agent pipeline, per-store branching, bilingual briefing), not
  the weather model. A better weather model is a better ingredient, not a different meal.
- ❌ **Not claiming** "more accurate than weather apps." The claim is: **Agent CaMate
  converts local weather and demand signals into actionable store operations plans.**
- ✅ **Claiming** that the `WeatherModelProvider` interface is the right architectural seam, and
  that any of these models *could* be integrated without re-architecting the agent engine.
- ✅ **Claiming** that WeatherBench 2 should be used as an evaluation tool before any model
  integration, to quantify the accuracy delta at HCM store-level coordinates.
- ✅ **Claiming** that the highest-leverage model *operationally* would be a radar nowcaster
  (RainNet or NowcastNet), if HCM radar data access can be secured via NCHMF partnership.

---

## 7. See also

- [`README.md`](./README.md) — project overview, production readiness (lists the
  `WeatherModelProvider` seam as a production capability).
- [`AI_DOCUMENTATION.md`](./AI_DOCUMENTATION.md) §3 — the weather architecture, the
  `WeatherModelProvider` interface, the Weather Signal Layer orchestrator, the planned adapters.
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) §6 — the weather architecture module split + sequence
  diagram with provenance and persistence.
- [`DATA_SOURCES.md`](./DATA_SOURCES.md) §5, §6, §7 — the planned NASA GPM IMERG, Meteostat,
  and METAR adapters (the non-AI planned sources).
- [`EVALUATION.md`](./EVALUATION.md) — the pilot evaluation framework (use WeatherBench 2 as
  part of the pre-pilot evaluation before deciding to integrate any AI weather model).

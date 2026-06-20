# Data Sources — Agent CaMate — StoreOps Decision Agent for KFC

This document is an **honest inventory of every data source** used by Agent CaMate, driven by
the **data source registry** (`src/lib/dataSources/dataSourceRegistry.ts`) — the single source of
truth that also powers the in-app Data Sources panel. For each source we list: what it provides,
its mode (`live` / `verified-seed` / `simulated` / `fallback` / `planned` / `unavailable`),
license / rate limits, timestamp handling, confidence contribution, fallback strategy, and
reliability note. We are explicit about what is **real** vs **simulated** vs **planned** — judges
should never have to guess.

> **Source of truth:** `src/lib/dataSources/dataSourceRegistry.ts` (registry),
> `src/lib/weather/weatherSignalLayer.ts` + `src/lib/weather/adapters/*.ts` (weather),
> `src/lib/operations/*.ts` (operations data), `src/lib/agent/engine.ts` (consumers),
> `src/lib/stores/seed-stores.ts` (store dataset), `src/lib/llm.ts` (LLM),
> `prisma/schema.prisma` (persistence).

---

## TL;DR — the 8 registered sources at a glance

| # | Source | Mode | Type | Used in |
|---|---|---|---|---|
| 1 | KFC Vietnam Store Locator | **verified-seed** | store-directory | Store Context Agent · store selector |
| 2 | OpenStreetMap / Nominatim | **verified-seed** (offline) | geocoding | Store coordinates pre-geocoded in `seed-stores.ts` for weather context |
| 3 | Open-Meteo | **live** | weather-current | Weather Signal Agent · Weather Signal Layer · risk scoring |
| 4 | NASA GPM IMERG | **planned** | rain-evidence | Weather Signal Layer (rain evidence cross-check) |
| 5 | Meteostat | **planned** | weather-historical | Weather Signal Layer (historical context) · Demand Agent (baseline) |
| 6 | AviationWeather / METAR (VVTS) | **planned** | aviation | Weather Signal Layer (city-level cross-check) |
| 7 | Synthetic Operations Data (POS / Inventory / Staffing) | **simulated** | operations-pos | Demand Agent · Inventory & Prep Agent · Staffing Agent (baselines) |
| 8 | LLM Router (OpenAI-compatible/Gemini/Groq/OpenRouter) | **live** | llm | Risk Explanation Agent · Manager Briefing Agent |

Plus: a **CSV operations adapter** (`CsvOpsAdapter`, reads `public/sample-operations-data.csv`)
is the **seam for real KFC POS exports** — currently shadowed by the synthetic default, but ready
to go live by dropping a CSV in the same shape. See §10.

**The honest one-liner:** Weather is real when reachable (Open-Meteo, with retry + cache + audit
persistence); fallback is clearly labeled. Store list is manually verified against the public KFC
Vietnam locator. Everything operational (demand shifts, POS baselines, before/after impact) is
**simulated and internally consistent** by default — but the architecture is ready to swap in real
KFC POS via the CSV adapter seam. Three weather sources (IMERG, Meteostat, METAR) are **planned**:
interface-ready, live ingestion pending API key / heavy-data parser provisioning.

---

## 1. The data source registry (single source of truth)

`src/lib/dataSources/dataSourceRegistry.ts` exports `DATA_SOURCE_REGISTRY: DataSourceEntry[]` —
8 entries, each with:

```ts
interface DataSourceEntry {
  id: string;
  name: string;
  url: string;
  type: DataSourceType;   // store-directory | geocoding | weather-current | weather-forecast |
                          // weather-historical | rain-evidence | aviation | operations-pos |
                          // operations-inventory | operations-staffing | llm
  purpose: string;
  mode: DataSourceMode;   // live | verified-seed | simulated | fallback | planned | unavailable
  usedIn: string;
  fallbackStrategy: string;
  reliabilityNote: string;
  requiresApiKey: boolean;
  cacheTtlSec?: number;
  rateLimit?: string;
  license?: string;
  freshnessLabel?: string;
}
```

Helper functions:
- `getDataSource(id)` — look up by id.
- `sourcesUsedBy(layer)` — filter by usedIn substring (e.g. `"Weather"`).
- `sourceModeSummary()` — `{ total, live, planned, simulated, verifiedSeed }` for the Data Sources
  panel header.

The Data Sources panel (`src/components/dashboard/data-sources-panel.tsx`) renders the full
registry with mode badges (Live / Verified seed / Simulated / Fallback / Planned / Unavailable),
purpose, used-in, rate limit, license, fallback strategy, and reliability note — plus an
**active-store weather provenance strip** that shows which contributors contributed (✓) vs were
planned-but-not-contributed (○) for the currently selected store, with a `fetchedAt` timestamp.

---

## 2. Live vs planned honesty table

| Source | Mode | API key? | Live in this build? | What's needed to go live |
|---|---|---|---|---|
| **Open-Meteo** | live | No | ✅ Yes — 6s timeout, 2-attempt retry, 5-min cache, WeatherSnapshot persistence | — (already live) |
| **LLM Router (OpenAI-compatible/Gemini/Groq/OpenRouter)** | live | Yes (if required) | ✅ Yes — 12s/15s timeouts + deterministic fallback | — (already live) |
| **KFC Vietnam Store Locator** | verified-seed | No | N/A — used to verify the seed dataset at creation time | — (seed is verified; runtime scraping intentionally avoided) |
| **OSM / Nominatim** | planned | No | ❌ Not at runtime (seed coords are pre-geocoded) | Runtime geocoding for custom new/edited stores is planned |
| **NASA GPM IMERG** | planned | No | ❌ Interface ready, ingestion not enabled | NASA GES DISC / OPeNDAP access + NetCDF/GeoTIFF parser |
| **Meteostat** | planned | Yes | ❌ Interface ready, ingestion not enabled | Meteostat API key (CC BY-NC 4.0; commercial for high volume) |
| **AviationWeather / METAR** | planned | No | ❌ Interface + parser ready, live call disabled | Toggle `mode` from `"planned"` to `"live"` in `MetarAdapter` |
| **Synthetic Operations Data** | simulated | N/A | ❌ Synthetic (default adapter) | Replace with `CsvOpsAdapter` (drop CSV) or live POS connector |
| **CSV Operations Data** (`public/sample-operations-data.csv`) | csv (seam) | N/A | ⚠️ Adapter ready; sample CSV ships with 20 stores | Replace CSV with real KFC POS export of same shape |
| **Google Maps Embed** (iframe) | live | No | ✅ Yes — keyless iframe embed by store name | — (already live, no API key required) |
| **Prisma + SQLite** | live (local) | N/A | ✅ Yes — best-effort persistence of WeatherSnapshot + AgentRun | Move to Postgres / Turso for multi-tenant production |

---

## 3. Open-Meteo — live weather (no API key)

### What it provides

Live current conditions + hourly (24h) + daily (3-day) forecasts for any lat/lng on Earth. The
`OpenMeteoAdapter` requests:

- **current:** `temperature_2m`, `apparent_temperature`, `relative_humidity_2m`, `pressure_msl`,
  `wind_speed_10m`, `wind_direction_10m`, `precipitation`, `cloud_cover`
- **hourly:** `temperature_2m`, `precipitation_probability`, `precipitation`, `wind_speed_10m`,
  `relative_humidity_2m`
- **daily:** `temperature_2m_max`, `temperature_2m_min`, `precipitation_probability_max`,
  `precipitation_sum`, `wind_speed_10m_max`
- **timezone:** `Asia/Ho_Chi_Minh`
- **past_days:** 1
- **forecast_days:** 3

Endpoint: `GET https://api.open-meteo.com/v1/forecast?latitude=...&longitude=...&current=...&hourly=...&daily=...&timezone=Asia/Ho_Chi_Minh&past_days=1&forecast_days=3`

### Mode

✅ **Live** (`mode: "live"`). Registered as `id: "open-meteo"`.

### Timestamp handling

- The adapter sets `fetchedAt` to `new Date().toISOString()` at parse time.
- Hourly forecast timestamps come from Open-Meteo in the `Asia/Ho_Chi_Minh` timezone (ISO strings).
- Daily forecast dates come as `YYYY-MM-DD` strings in ICT.
- The `WeatherSnapshot` row stores `createdAt = now()` at persist time.

### Confidence contribution

- Base confidence (live): `0.5` (current present).
- +`0.3` if hourly present.
- +`0.2` if daily present.
- Capped at `0.98`.
- → Up to **0.98** in live mode when all three payloads are present.

### License & rate limits

- **License:** Open-Meteo's free tier is **CC-BY 4.0** — attribution required (we attribute in the
  UI footer: "Data: Open-Meteo (live) · fallback (synthetic)").
- **API key:** Not required for the free tier.
- **Rate limits:** Free tier: ~10,000 requests/day for non-commercial use. The build makes 1 call
  per store per agent run, batched with concurrency 5 in `getWeatherSignals`. Well within limits.
- **Timeout:** 6 seconds per attempt (AbortController). 2 attempts with exponential backoff
  (400ms × attempt delay). If both fail, fall back.
- **Cache:** 5-minute in-process cache keyed by store id (bounded). Fallback signals cached for
  60 seconds so live is retried sooner.

### Fallback strategy

If the fetch fails for **any** reason (network error, non-200 response, missing `current`
payload, 6s timeout, AbortController abort) after 2 attempts, `openMeteoAdapter.fetch` returns a
`RawWeatherData` with `isLive=false`, `source="fallback (live unavailable: <reason>)"`, and a
plausible HCM weather signal (see §4). The Weather Signal Layer then converts that to a
`WeatherSignal` with `dataConfidence=0.45`, sets `fallbackReason`, sets `reliabilityNote`, and
**persists a `WeatherSnapshot` with `isLive=false`** for audit.

**The adapter never throws.** It always returns a `RawWeatherData`. The UI shows a red `FALLBACK`
badge in both the compare strip and the Weather Signal panel; the Agent Execution Trace's step 2
shows `dataSource: "fallback"` and `primaryMode: "fallback"` in the provenance.

### How we derive risk scores from raw observations

The `computeRiskScores` function (in `src/lib/weather/riskScoring.ts`) turns raw observations
into four 0–1 risk scores:

| Score | Formula (clamped 0–1) |
|---|---|
| `rainRiskScore` | `0.45 × precipIntensity + 0.4 × precipProb + 0.25 (if pressure falling) + 0.05 × cloudCover/100`, where `precipIntensity = precipMm/8` |
| `heatRiskScore` | `0.7 + (tempC−34)×0.08` if tempC≥34, else `0.35 + (tempC−31)×0.12` if tempC≥31, else `0.1` |
| `deliveryDisruptionRisk` | `0.5 × rainRisk + 0.2 × windKmh/40 + 0.2 × store.deliveryShare + 0.15 (if suburban)` |
| `walkInDropRisk` | `rainRisk × walkInExposure + 0.1 × windKmh/30`, where `walkInExposure` = `0.1 (mall) / 0.9 (urban-street) / 0.8 (office) / 0.6 (default)` |

These are **our own heuristics**, calibrated to HCM weather patterns and F&B operations intuition.
They are not derived from KFC's internal models — they are a transparent, auditable starting
point. Roadmap: validate against actual store-level demand data (see
[`EVALUATION.md`](./EVALUATION.md)).

### Pressure trend derivation

Open-Meteo's `current` payload doesn't give us a previous pressure reading directly, so we
approximate the trend from the first hourly `precipitation_probability`:
- `> 0.6` → `"falling"` (rain likely approaching → pressure likely falling)
- `< 0.2` → `"rising"`
- otherwise → `"stable"`

This is a known approximation; we'd prefer a true pressure-trend API field in a production
version (and METAR would give it to us when that adapter goes live).

---

## 4. Deterministic fallback weather signal

### What it provides

A plausible HCM weather signal when Open-Meteo is unreachable.

### Mode

`fallback` — clearly labeled `isLive=false`. Triggered only when the live `OpenMeteoAdapter`
fails after 2 attempts.

### How it's built (`buildFallback` in `openMeteoAdapter.ts`)

Based on current time of day (ICT = UTC+7) and wet season (May–Oct):

| Variable | Wet season (May–Oct), 14:00–18:00 | Otherwise |
|---|---|---|
| `precipMm` | `4 + random×4` (i.e. 4–8 mm) | `random × 0.6` (light) |
| `tempC` | `32 + random×3` (32–35°C) | `27 + random×3` (27–30°C) |
| `humidity` | `72 + random×18` (72–90%) | `60 + random×15` (60–75%) |
| `pressureTrend` | `"falling"` | `"stable"` |
| `windKmh` | `18 + random×12` (18–30) | `6 + random×8` (6–14) |
| `cloudCover` | `80 + random×15` (80–95%) | `40 + random×30` (40–70%) |
| `precipProb` | `0.7 + random×0.25` (0.7–0.95) | `random × 0.3` (0–0.3) |

The fallback also synthesizes a 24-hour hourly forecast and a 3-day daily forecast, with
late-afternoon rain peaks in wet season. It then runs the same `computeRiskScores` function
as the live path — so the downstream agents see the same shape of data either way.

### License

N/A — synthetic data generated locally. No external attribution needed.

### Fallback strategy

This **is** the fallback. There is no further layer below it. The pipeline always returns a
`WeatherSignal`; the only question is whether it's live or fallback, and that question is always
answered honestly in the UI (red badge + `fallbackReason` + `reliabilityNote`).

### Persistence

Fallback signals are **also persisted** as `WeatherSnapshot` rows with `isLive=false` — so the
audit trail records every fallback event, not just live ones.

---

## 5. NASA GPM IMERG — planned rain-evidence source

### What it provides

Satellite-based precipitation evidence (half-hourly global rain rate on a 0.1° grid). For a store
we would sample the nearest grid cell and the surrounding 3×3 cells to get a local rain-evidence
signal that strengthens rain-risk confidence with actual observed rainfall.

### Mode

⚠️ **Planned** (`mode: "planned"`). Registered as `id: "nasa-gpm-imerg"`.

The `NasaGpmImergAdapter` (`src/lib/weather/adapters/nasaGpmImergAdapter.ts`) implements the
`WeatherModelProvider` interface and currently returns `emptyRawWeather(store, this.id,
"planned — live ingestion not enabled in this build")`. The Weather Signal Layer records it in
the provenance as `contributed: false, mode: "planned"`.

The adapter also exports `plannedRainEvidence(): RainEvidenceSummary` so the UI can show "what
this source WOULD contribute" — `{ source, mode: "planned", precipRateMmPerHr: null,
neighbourhoodMeanMmPerHr: null, confidenceBoost: 0, fetchedAt: null, note }`.

### Timestamp handling

Not applicable until live ingestion is enabled. When activated, IMERG half-hourly tiles would be
timestamped by NASA's production pipeline; we'd record `fetchedAt` at ingestion time.

### Confidence contribution

Currently zero (planned). When activated, IMERG would contribute a `confidenceBoost` (0–0.3) to
the rain-risk score by cross-validating Open-Meteo's forecasted precipitation against actual
observed rainfall.

### License & rate limits

- **License:** NASA open data (public domain).
- **API key:** Not required, but NASA GES DISC account + Earthdata login needed for OPeNDAP access.
- **Rate limits:** Fair use; data volumes are large (half-hourly global NetCDF / GeoTIFF tiles).

### Fallback strategy

Until live integration is enabled, rain evidence comes from Open-Meteo precipitation. The
interface is production-ready; live toggle is a config + parser change.

### Reliability note

IMERG provides near-global half-hourly precipitation. Live ingestion requires NASA GES DISC /
OPeNDAP access and a NetCDF/GeoTIFF parser — too heavy for the current sandbox. Interface is
production-ready; live toggle is a config change.

---

## 6. Meteostat — planned historical source

### What it provides

Historical weather normals and station observations for the nearest station to each store. Used
to contextualise whether current conditions are anomalous (e.g. "this is the heaviest rain for
this week in 5 years" vs "this is normal wet-season rain").

### Mode

⚠️ **Planned** (`mode: "planned"`). Registered as `id: "meteostat"`.

The `MeteostatAdapter` (`src/lib/weather/adapters/metostatAdapter.ts`) implements the
`WeatherModelProvider` interface and currently returns `emptyRawWeather(store, this.id,
"planned — Meteostat API key not provisioned")`. Nearest HCM stations are pre-declared:
`48900` (Ho Chi Minh / Tan Son Hoa, 0 km) and `48910` (Vung Tau, 65 km).

The adapter exports `plannedHistoricalContext(month): HistoricalContext` returning seasonal
normals from a deterministic HCM model: wet season (May–Oct) → temp 25–33°C, precip prob 0.6;
dry season → temp 21–31°C, precip prob 0.2.

### Timestamp handling

Not applicable until live ingestion is enabled. When activated, Meteostat station observations
are timestamped per-record; we'd use rolling 30-year normals for anomaly detection.

### Confidence contribution

Currently zero (planned). When activated, Meteostat would contribute a `normalTempRangeC`,
`normalPrecipProb`, and `anomalyFlag` to strengthen the Demand Agent's baseline.

### License & rate limits

- **License:** **CC BY-NC 4.0** (non-commercial). Commercial use requires a paid plan.
- **API key:** Required (pending provisioning).
- **Rate limits:** Free tier limited; commercial tier for production volume.

### Fallback strategy

Until live integration is enabled, historical baselines use a deterministic HCM seasonal model
inside the signal layer. The `MeteostatAdapter` interface is defined for future activation.

### Reliability note

Meteostat provides station-level historical data via a Python SDK and REST API. Nearest-station
matching for HCM (Tan Son Hoa / Vung Tau) is feasible. Interface ready; live toggle pending API
key provisioning.

---

## 7. AviationWeather / METAR (VVTS) — planned aviation baseline

### What it provides

City-level aviation baseline (wind, pressure, cloud, rain/thunderstorm) from Tân Sơn Nhất (VVTS)
METAR. Used **only as a SUPPLEMENT** for cross-validation, **never as the sole store-area signal**.

### Mode

⚠️ **Planned** (`mode: "planned"`). Registered as `id: "aviationweather-metar"`.

The `MetarAdapter` (`src/lib/weather/adapters/metarAdapter.ts`) implements the
`WeatherModelProvider` interface, has a production-ready **minimal METAR parser** (`parseMetar`)
that handles the common fields (wind `18012KT`, pressure `Q1010`, temp/dew `28/24`, cloud layers
`FEW018 SCT100 BKN100 OVC100`, present weather `RA TSRA TS DZ`), and has the live fetch URL
(`https://aviationweather.gov/cgi-bin/data/metar.php?ids=VVTS&format=raw&hours=1`) ready — but
the live call is **deliberately disabled** (`if (this.mode === "planned") return emptyRawWeather(...)`)
to keep the demo deterministic. The adapter exports `plannedAviationBaseline()` for UI display.

### Timestamp handling

Not applicable until live ingestion is enabled. When activated, METAR observations are
timestamped per-record (the `observedAt` token in the raw METAR string).

### Confidence contribution

Currently zero (planned). When activated, METAR would contribute city-level wind, pressure, and
present-weather cross-validation — useful for confirming rain when Open-Meteo and IMERG disagree.

### License & rate limits

- **License:** Public domain (US government data).
- **API key:** Not required.
- **Rate limits:** Fair use.

### Fallback strategy

Not used as a primary source. If unavailable, the signal layer relies on Open-Meteo + fallback.
The `MetarAdapter` interface is defined.

### Reliability note

METAR is airport-level (VVTS), ~6km from District 1. Useful as a city-level baseline and for
pressure/wind cross-validation. **Deliberately NOT used to replace hyperlocal store-area signals.**

---

## 8. KFC Vietnam Store Locator — verified-seed store directory

### What it provides

Source of truth for the KFC Vietnam store list, addresses and districts. Used to seed and verify
the 20-store TP.HCM dataset.

### Mode

✅ **Verified seed** (`mode: "verified-seed"`). Registered as `id: "kfc-vn-locator"`.

### How it's used

The 20 seed stores in `src/lib/stores/seed-stores.ts` are manually cross-checked against the
public KFC Vietnam locator at `https://kfcvietnam.com.vn/he-system-nha-hang-kfc`. Coordinates are
pre-geocoded via OSM/Nominatim and committed. The locator is **not scraped at runtime** to avoid
breakage.

### Timestamp handling

N/A — verification happens at dataset creation time. The dataset is version-controlled in git.

### Confidence contribution

Static — `0.92` confidence in the Store Context Agent (Agent 1) reflects this verified seed.

### License

Public website — used for verification only. Store names and addresses are public information.
**Not affiliated with or endorsed by KFC.** Operational attributes (`kitchenCapacity`,
`deliveryShare`, `dineInSeats`) are plausible estimates, not real KFC data.

### Fallback strategy

If the locator is unreachable, fall back to the verified seed dataset committed in
`src/lib/stores/seed-stores.ts` (manually cross-checked against the locator).

### Reliability note

Store list, addresses and districts are verified against the public KFC Vietnam locator.
Coordinates are pre-geocoded via OSM/Nominatim and committed. The locator is not scraped at
runtime to avoid breakage.

---

## 9. OpenStreetMap / Nominatim — planned runtime geocoding

### What it provides

Geocodes store addresses to lat/lng. Results would be cached in the `GeoCache` Prisma table to
avoid repeat lookups.

### Mode

⚠️ **Planned** (`mode: "planned"`). Registered as `id: "osm-nominatim"`.

The 20 seed stores already carry verified coordinates (pre-geocoded offline at dataset creation
time), so live runtime geocoding is only triggered for new/edited stores. The `GeoCache` table is
ready to persist successful lookups.

### Timestamp handling

When activated, geocoding results would be cached with `createdAt` + `updatedAt` and a permanent
TTL (cache `cacheTtlSec: 0` in the registry means permanent per address).

### Confidence contribution

Indirect — accurate coordinates are what make the Open-Meteo fetch hyperlocal rather than
city-level. Bad coordinates → wrong weather → wrong risk scores.

### License & rate limits

- **License:** **ODbL** (Open Database License). OpenStreetMap data is © OpenStreetMap contributors.
- **API key:** Not required, but a valid HTTP `User-Agent` identifying the application is expected.
- **Rate limits:** 1 request/second (absolute max per usage policy).

### Fallback strategy

If Nominatim fails or is rate-limited, the verified seed coordinates in `seed-stores.ts` are
used. The `GeoCache` table persists successful lookups.

### Reliability note

Nominatim is free but rate-limited (1 req/sec per usage policy). The 20 seed stores already carry
verified coordinates, so live geocoding is only triggered for new/edited stores. Cache TTL:
permanent per address.

---

## 10. Operations data — synthetic (default) + CSV seam for real KFC POS

### What it provides

The operations baseline per store: average lunch/dinner covers (orders), baseline delivery share,
on-hand inventory (chicken raw kg, buckets, cups, bags), scheduled staffing (lunch/dinner). Used
by the Demand Agent, Inventory & Prep Agent, and Staffing Agent.

### Mode

❌ **Simulated** by default (`SyntheticOpsAdapter`, `mode: "simulated"`). Registered as
`id: "synthetic-ops"`. **Plus a CSV seam** (`CsvOpsAdapter`, `mode: "csv"`) that reads
`public/sample-operations-data.csv`.

### The pluggable interface

```ts
// src/lib/operations/operationsDataAdapter.ts
export interface OperationsDataAdapter {
  readonly id: string;
  readonly name: string;
  readonly mode: "simulated" | "csv" | "live";
  fetch(store: KfcStore): Promise<OpsBaseline>;   // never throws
}
```

### Synthetic adapter (`SyntheticOpsAdapter`)

Derives baseline orders from store profile (seats × 1.8 + kitchenCapacity × 12 for lunch;
seats × 2.1 + kitchenCapacity × 14 for dinner). Inventory derived from kitchen capacity +
seats. Staffing defaults to 6/6 (lunch/dinner). The `reliabilityNote` field is honest:
*"Synthetic baseline derived from store profile (seats, kitchen capacity, delivery share). NOT
real KFC POS data. Replaceable by CsvOpsAdapter or a live POS connector."*

### CSV adapter (`CsvOpsAdapter`) — the seam for real KFC POS exports

Reads `public/sample-operations-data.csv`. Tolerant of quoted fields and BOM. The shipped sample
covers all 20 seed stores:

```csv
storeId,baselineLunchOrders,baselineDinnerOrders,baselineDeliveryShare,chickenRawKg,buckets,cups,bags,staffingLunch,staffingDinner
kfc-le-lai,260,300,0.35,72,216,320,168,7,7
kfc-nguyen-thai-hoc,210,240,0.38,60,180,256,140,6,6
... (20 rows total)
```

**Schema:**

| Column | Type | Notes |
|---|---|---|
| `storeId` | string | Must match the seed-stores `id` (e.g. `kfc-le-lai`) |
| `baselineLunchOrders` | integer | Average lunch covers (orders) |
| `baselineDinnerOrders` | integer | Average dinner covers (orders) |
| `baselineDeliveryShare` | float 0–1 | Share of revenue from delivery |
| `chickenRawKg` | integer | On-hand chicken raw (kg) |
| `buckets` | integer | On-hand buckets |
| `cups` | integer | On-hand cups |
| `bags` | integer | On-hand delivery bags |
| `staffingLunch` | integer | Scheduled staff for lunch slot |
| `staffingDinner` | integer | Scheduled staff for dinner slot |

Header row required. One row per store. All numeric.

### How to replace the sample CSV with real KFC data

1. Export from KFC's POS / inventory / workforce management system into the schema above.
2. Save as `public/sample-operations-data.csv` (overwriting the sample) — or change the
   `CsvOpsAdapter` constructor's `csvUrl` argument to point at a different path.
3. Wire the `CsvOpsAdapter` as the active adapter (replace the `syntheticOpsAdapter` singleton
   with `new CsvOpsAdapter()` wherever the agents consume operations data).
4. No agent engine code changes. The agents consume `OpsBaseline` regardless of adapter.

If a CSV row is missing for a store, the `CsvOpsAdapter` returns a profile-derived baseline
labeled `mode: "csv"` with a reliability note: *"No CSV row found for this store. Values are
profile-derived. Add a row to public/sample-operations-data.csv to supply real data."* — so the
UI still labels the source honestly.

### Timestamp handling

CSV data is static (file-based). `fetchedAt = new Date().toISOString()` at adapter call time.
For a live POS connector, `fetchedAt` would reflect the actual POS query time.

### Confidence contribution

Indirect — operations baselines are what the Demand Agent's deltas are computed *against*. Bad
baselines → wrong absolute plan numbers (but the *direction* of the deltas still follows the
weather signal).

### License

- **Synthetic:** Simulated (hackathon demo). Our own.
- **CSV sample:** Simulated (hackathon demo). Our own.
- **Real KFC POS export (when connected):** KFC internal data — usage subject to KFC's data
  sharing agreement. **Not affiliated with or endorsed by KFC.**

### Fallback strategy

The `OperationsDataAdapter` interface accepts either the `SyntheticOpsAdapter` (default) or the
`CsvOpsAdapter`. If the CSV fetch fails (network, 404, parse error), the `CsvOpsAdapter` returns
a profile-derived baseline labeled `mode: "csv"` with a reliability note. Real KFC POS can be
plugged in by implementing the same interface (`mode: "live"`).

### Reliability note

Numbers are internally consistent but NOT real KFC data. All before/after comparison metrics are
simulated and clearly labeled. The architecture is ready to swap in real POS/inventory/staffing
feeds.

---

## 11. LLM Router (OpenAI-compatible/Gemini/Groq/OpenRouter) — LLM (with deterministic fallback)

### What it provides

Chat-completion LLM calls for two agents:

- **Risk Explanation Agent (Agent 7):** writes a ≤180-word narrative connecting the top 2–3
  risk factors to the store's context, in store-manager language. Strict JSON output:
  `{"narrative": string}`.
- **Manager Briefing Agent (Agent 8):** writes a structured 30-second briefing (headline,
  TL;DR, top actions, watch items, closing note) in English. Strict JSON output matching the
  `ManagerBriefing` schema. A deterministic `withVietnamese()` layer then produces the Vietnamese
  mirror fields — **no second LLM call**.

### Mode

✅ **Live** (`mode: "live"`). Registered as `id: "camate-llm"`.

### Timestamp handling

Each LLM call records `durationMs` in the trace step. The briefing's `generatedAt` reflects the
agent run time.

### Confidence contribution

- Agent 7: `0.82` (LLM) or `0.7` (fallback).
- Agent 8: equals `plan.confidence`.

### License & rate limits

- **License:** Open-source LLM client supporting standard completions APIs.
- **API key:** Configured in env variables (`LLM_API_KEY`, etc.) or custom keys in Admin Integrations UI.
- **Timeouts:** 12 seconds (Agent 7), 15 seconds (Agent 8) — AbortController.

### Fallback strategy

The `llmComplete` helper (`src/lib/llm.ts`) catches all errors — SDK init failure, network
error, timeout (AbortController), empty response — and returns `{ ok: false, error, content: "" }`.

In each LLM agent, if `llm.ok` is false (or the parsed JSON is missing required fields), the
agent builds a **deterministic fallback**:

- **Agent 7 fallback narrative:** hand-written from the top 2 risk factors, the store type, the
  district, and whether the signal is live or fallback.
- **Agent 8 fallback briefing:** fully populated from the plan's slot deltas, prep / staffing /
  campaign recommendations, warnings, and confidence — every field is filled, just without the
  LLM's natural-language polish.

The trace's `dataSource` field records `"llm"` when the LLM was used and `"computed"` when the
fallback fired — so the demo is honest about which agents actually called the model.

---

## 12. Google Maps Embed (iframe) — map UI

### What it provides

The interactive store network map on the dashboard UI. It recenters on the selected store and links directly to the Google Maps application.

### Mode

✅ **Live** — rendered as a keyless iframe embed. It does not require a Google Maps API key, as it uses the keyless Google Maps query parameter embed (`https://maps.google.com/maps?q=...&output=embed`).

### License & rate limits

- **API key:** Not required.
- **Rate limits:** Standard Google Maps iframe embedding policies apply.

### Fallback strategy

If the embed fails or is offline, the component handles loading errors gracefully, showing a styled placeholder with retry buttons and direct links to the web/app version of Google Maps.

---

## 13. Prisma + SQLite — local persistence (best-effort, with audit)

### What it provides

Three models (defined in `prisma/schema.prisma`):

| Model | Purpose | Written in this build? |
|---|---|---|
| `GeoCache` | Caches Nominatim geocoding results (keyed by normalized address query) | Schema ready; runtime path dormant (geocoding is offline) |
| `WeatherSnapshot` | Snapshots of weather signals fetched for a store at a given time — **the audit trail** | ✅ **Written by the Weather Signal Layer on every fetch** (best-effort) |
| `AgentRun` | Persisted agent runs (storeId, storeName, traceJson, planJson, briefingJson, confidence, isLive) | ✅ Written by `POST /api/agent/run` (best-effort) |

### WeatherSnapshot persistence

Every weather fetch — live **or** fallback — triggers a best-effort `db.weatherSnapshot.create(...)`
inside the Weather Signal Layer:

```ts
async function persistSnapshot(store: KfcStore, signal: WeatherSignal): Promise<void> {
  try {
    await db.weatherSnapshot.create({
      data: {
        storeId: store.id,
        lat: store.lat,
        lng: store.lng,
        payload: JSON.stringify(signal),
        source: signal.source,
        isLive: signal.isLive,
      },
    });
  } catch {
    // Persistence is best-effort — never fail a weather fetch on DB error.
  }
}
```

The snapshot stores the **full signal bundle** as JSON (`payload`), the `source` string (e.g.
`"open-meteo"` or `"fallback (live unavailable: ...)"`), and the `isLive` flag. Indexed on
`(storeId, createdAt)` for time-series queries like "show me every weather observation we
recorded for store X in the last 24 hours".

This is the **audit trail** for the weather leg of the agent: any time someone asks "what
weather did the agent actually see at this minute for this store?", the answer is in
`WeatherSnapshot`.

### Mode

✅ **Live** (local DB). Used best-effort — DB failure never breaks the API response.

### License & rate limits

- **License:** SQLite is public domain. Prisma is Apache 2.0.
- **Rate limits:** Local file DB — no rate limits, but SQLite has single-writer concurrency.
  Fine for a demo / pilot. Production would move to Postgres or Turso.

### Fallback strategy

Both `db.weatherSnapshot.create` and `db.agentRun.create` are wrapped in try/catch. If the DB
file is missing, the schema isn't pushed, or the write fails, the response still returns the full
`AgentRunResult`. The agent's reasoning is in memory; persistence is a bonus.

---

## 14. Data-source decision tree (how a single agent run flows through sources)

```
User selects a store
        │
        ▼
POST /api/agent/run { storeId }
        │
        ▼
getWeatherSignalWithProvenance(store)
        │
        ├─ openMeteoAdapter.fetch(store)  ────► Open-Meteo API (live)
        │     (check 5-min cache)                 │
        │                                         ├──► OK 200 + current ──► parseLive  ──► isLive=true,  conf ≤ 0.98
        │                                         │                                          └─ cache 5 min
        │                                         │
        │                                         └──► fail / timeout (×2) ──► buildFallback ──► isLive=false, conf=0.45
        │                                                                                    └─ cache 60s
        │
        ├─ toWeatherSignal: computeRiskScores + confidence + fallbackReason + reliabilityNote
        ├─ build provenance { primarySource, primaryMode, contributors[] }
        │     contributors: open-meteo✓ | nasa-gpm-imerg○ planned | meteostat○ planned | metar○ planned
        │
        └─ db.weatherSnapshot.create(...)  ──► try/catch (best-effort audit)
        │
        ▼
runAgentPipeline(store, weather, provenance)
        │
        ├─ Agent 1: Store Context        (computed,    conf 0.92)  [verified-seed store data]
        ├─ Agent 2: Weather Signal       (live|fallback, conf = dataConfidence)  [provenance logged]
        ├─ Agent 3: Demand               (computed,    conf = 0.7×dataConf + 0.2)  [synthetic ops baseline]
        ├─ Agent 4: Inventory & Prep     (computed,    conf 0.78)  [synthetic ops baseline]
        ├─ Agent 5: Staffing             (computed,    conf 0.74)  [synthetic ops baseline]
        ├─ Agent 6: Campaign             (computed,    conf 0.80)
        ├─ Agent 7: Risk Explanation     ──► llmComplete() ──► LLM ok ──► llm,     conf 0.82
        │                                                      └─► fail  ──► computed, conf 0.70
        ├─ Agent 8: Manager Briefing     ──► llmComplete() ──► LLM ok ──► llm,     conf = plan.confidence
        │                                                      └─► fail  ──► computed, conf = plan.confidence
        │   └─ withVietnamese(...)  ──► bilingual briefing (EN + VI, no 2nd LLM call)
        │
        └─ buildBeforeAfter(...)         (computed/simulated)
        │
        ▼
db.agentRun.create(...)  ────► try/catch (best-effort)
        │
        ▼
Return AgentRunResult (with weatherProvenance)
        │
        ▼
UI renders: Weather panel, Action plan, Before/After, Briefing (EN/VI), Agent Trace,
            Data Sources panel (with active-store weather provenance strip)
            (every step labeled with dataSource + confidence + provenance)
```

---

## 15. Honesty summary

| Claim | True? |
|---|---|
| "Live weather from Open-Meteo" | ✅ Yes, when reachable. 6s timeout, 2-attempt retry, 5-min cache. Fallback is labeled. Every fetch persisted as `WeatherSnapshot` for audit. |
| "Micro-local (per-store) weather" | ✅ Yes — each store has its own lat/lng. |
| "Real KFC store addresses" | ✅ Yes — public KFC Vietnam store locator, verified at dataset creation. |
| "Real KFC operational data (POS, demand, capacity)" | ❌ No by default — synthetic adapter. **But the CSV seam is ready** — replace `public/sample-operations-data.csv` with a real KFC export and it goes live. |
| "Before/After numbers are real" | ❌ No — simulated, internally consistent, labeled. See [`EVALUATION.md`](./EVALUATION.md) for how to replace with real measured metrics. |
| "NASA GPM IMERG / Meteostat / METAR are integrated" | ❌ No — interface-ready, live ingestion pending. Registered as `mode: "planned"`. Surfaced honestly in the Data Sources panel. |
| "Advanced AI weather models (GraphCast / Aurora / Earth2Studio / RainNet / NowcastNet) are integrated" | ❌ No — documented as future integration paths via the `WeatherModelProvider` seam. See [`ADVANCED_WEATHER_AI_INTEGRATION.md`](./ADVANCED_WEATHER_AI_INTEGRATION.md). |
| "More accurate than weather apps" | ❌ We do NOT claim this. We claim: **Agent CaMate converts local weather and demand signals into actionable store operations plans.** |
| "The LLM wrote the briefing" | ✅ Yes, when reachable. Deterministic fallback otherwise — labeled per step. Vietnamese translation is deterministic (no second LLM call). |
| "Every weather fetch is auditable" | ✅ Yes — `WeatherSnapshot` table records every fetch (live or fallback) with `payload`, `source`, `isLive`, `createdAt`. |
| "8-agent pipeline with execution trace + provenance" | ✅ Yes — every step recorded with input, output, confidence, source, duration; step 2 records full `WeatherProvenance`. |
| "Official KFC product" | ❌ No — hackathon pilot-ready build. KFC branding used only in the F&B track context. |

If a judge asks "is X real?", the answer is in the table above. We err on the side of over-honest.

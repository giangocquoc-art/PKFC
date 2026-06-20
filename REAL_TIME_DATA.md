# REAL_TIME_DATA.md — Real-time Operations Intelligence Layer

> Part of **Agent CaMate — StoreOps Autopilot** (Agentic AI Build Week 2026, F&B track).
> **Hackathon pilot-ready build. NOT an official KFC product.**

This document covers the **Real-time Operations Intelligence Layer**: the canonical `OperationEvent` schema, the six synthetic data adapters with their live interfaces, the Risk Intelligence Agent that computes 10 real-time metrics, the anomaly detection rules, and the strategic insight generator.

For how the resulting draft tasks are approved/executed, see [`AUTOMATION.md`](./AUTOMATION.md).
For how the metrics ground Smart Interaction Agent answers, see [`SMART_INTERACTION.md`](./SMART_INTERACTION.md).

---

## 1. Design principle: schema is real, data is synthetic, adapters are swappable

In production, store operations events would flow from KFC POS / inventory / workforce / delivery aggregator / complaint systems — optionally via an event bus like Apache Kafka. In this build:

- The **`OperationEvent` schema is real** and stable — any live connector implementing it can drop in without changing the downstream agents.
- The **adapters are synthetic** with `mode: "synthetic"`. They produce deterministic, weather-shaped event streams that exercise every code path the live adapters would.
- Every event carries **provenance** (`source`, `mode`, `confidence`, `timestamp`) so the UI can honestly badge data freshness.

The Risk Intelligence Agent and the Live Operations Monitor consume this stream and surface live/synthetic/fallback status honestly. The `mode` badge is never hidden.

---

## 2. The OperationEvent schema

Defined in `src/lib/operations/realTimeEventSchema.ts`.

```ts
export type OperationEventType =
  | "pos-order"          // a POS order (walk-in / takeaway)
  | "delivery-order"     // a delivery order
  | "inventory-level"    // inventory snapshot
  | "batch-prep"         // a kitchen batch prep event
  | "waste-event"        // waste logged
  | "stockout-event"     // stockout logged
  | "staff-checkin"      // staff check-in
  | "staff-checkout"     // staff check-out
  | "service-time"       // service time sample
  | "complaint"          // customer complaint
  | "refund"             // refund / cancel
  | "campaign-event";    // campaign performance sample

export type EventMode = "live" | "synthetic" | "fallback";

export interface OperationEvent {
  eventId: string;        // "evt-<base36 ts>-<seq>"
  storeId: string;
  type: OperationEventType;
  timestamp: string;      // ISO 8601
  source: string;         // adapter id (e.g. "pos-data")
  mode: EventMode;        // live | synthetic | fallback
  confidence: number;     // 0-1
  payload: Record<string, unknown>;
}
```

### 2.1 Why every event carries provenance

| Field | Why it matters |
|---|---|
| `source` | Lets the UI group events by adapter and lets the Risk Intelligence Agent weight them by reliability. |
| `mode` | The honesty badge. `"live"` = real POS/inventory/etc. data. `"synthetic"` = simulated by this build. `"fallback"` = a live adapter failed and a deterministic fallback was used. |
| `confidence` | Adapter-reported confidence in the payload (e.g. a synthetic POS event is `0.7`; a live inventory snapshot would be `0.95`). |
| `timestamp` | Lets the Risk Intelligence Agent window events (last N minutes) and lets the UI render a live event ticker. |

### 2.2 Helper: `makeEvent(store, type, payload, opts)`

Constructs a properly-typed `OperationEvent` with a deterministic `eventId` (FNV-1a hash-based sequence). Used by every adapter.

### 2.3 Computed types

The schema also defines three derived types the Risk Intelligence Agent produces:

- **`RealTimeMetrics`** — 10 computed metrics (see §4) + window metadata + `mode` + `eventCount`.
- **`AnomalyAlert`** — `{id, storeId, severity: info|warning|critical, category, title, message, recommendation, detectedAt, confidence, mode}`.
- **`StrategicInsight`** — `{id, storeId, horizon: today|week, title, message, evidence, confidence, generatedAt}`.

---

## 3. The 6 adapters

All adapters implement the `OperationsDataAdapter` interface in `src/lib/operations/operationsAdapters.ts`:

```ts
export interface OperationsDataAdapter {
  readonly id: string;
  readonly name: string;
  readonly eventType: OperationEventType;
  readonly mode: EventMode;
  /** Emit a batch of recent events for the store (last N minutes). */
  emit(store: KfcStore, profile: StoreOperatingProfile, weather: WeatherSignal, count: number): OperationEvent[];
}
```

The 6th adapter (`RealTimeEventAdapter`) is an aggregator that fans out to the other 5.

| # | Adapter | `id` | Event type | Mode | What it emits (synthetic shape) |
|---|---|---|---|---|---|
| 1 | `PosDataAdapter` | `pos-data` | `pos-order` | synthetic | Walk-in + takeaway orders per minute. Lunch = 8 orders/min baseline, dinner = 6, off-peak = 2. Scaled down by `walkInDropRisk`. Channel split 60% walk-in / 40% takeaway. |
| 2 | `DeliveryDataAdapter` | `delivery-data` | `delivery-order` | synthetic | Delivery orders per minute, scaled up by `rainRiskScore` (rain → surge). Suburban stores get 18-min dispatch delay vs 8-min for urban. Platform mix: ShopeeFood / GrabFood / BeFood. ETA breach rate scaled by rain risk. |
| 3 | `InventoryDataAdapter` | `inventory-data` | `inventory-level` | synthetic | Chicken raw (kg), buckets, cups, delivery bags. Stockout risk score derived from rain risk + bucket level. `lowStockSkus` array populated when risk > 0.4. |
| 4 | `StaffingDataAdapter` | `staffing-data` | `staff-checkin` | synthetic | `staffPresent`, `scheduled=6`, `roles` (kitchen/counter/runner/lead), `fitScore` (penalises mismatch between present and scheduled). |
| 5 | `ComplaintDataAdapter` | `complaint-data` | `complaint` | synthetic | Per-minute complaint sample. Probability driven by `rainRiskScore * 0.6 + deliveryDisruptionRisk * 0.3`. Reasons drawn from `["slow-delivery", "missing-item", "cold-food"]`. |
| 6 | `RealTimeEventAdapter` | `realtime-event` | (aggregator) | synthetic | Calls all 5 adapters above, merges results, sorts by timestamp descending. Exposes `.sources` for the UI to render adapter-by-adapter breakdown. |

### 3.1 Seeded pseudo-randomness

Every adapter uses a seeded PRNG (`seededRandom(seed)`, FNV-1a) keyed by `storeId + index + minute-bucket`. This means:

- The same store at the same minute produces the same events — **deterministic demo**.
- Re-running the Risk Intelligence Agent within the same minute produces the same metrics.
- Moving to the next minute produces a fresh, plausible variation.

This is a deliberate choice for a hackathon: judges see realistic-looking data, and the same store always behaves the same way for a given weather signal. Live adapters would replace the PRNG with real system reads.

### 3.2 Hour-of-day awareness

`hourOfDay()` returns `UTC hours + 7 (Vietnam timezone) mod 24`. The POS adapter uses this to switch between lunch (11–13), dinner (18–21), and off-peak baselines — so the simulated event stream varies realistically through the day.

---

## 4. The 10 computed real-time metrics

Defined in `computeRealTimeMetrics()` in `src/lib/operations/riskIntelligenceAgent.ts`. All metrics are clamped to a sensible range (`clamp01` for 0–1 scores, signed percentages for trends).

| # | Metric | Type | Definition / formula |
|---|---|---|---|
| 1 | `walkInTrend` | signed % | `((walkInOrders − baselineWalkIn) / baselineWalkIn) × 100`. Baseline = 40 for urban-center, 24 otherwise. Positive = above baseline. |
| 2 | `deliverySurge` | signed % | `((deliveryOrders − baselineDelivery) / max(1, baselineDelivery)) × 100`. Baseline = `store.deliveryShare × 40`. Positive = surge. |
| 3 | `prepUtilization` | 0–1 | `clamp01(0.3 + (totalOrders / 80) × 0.5)`. Scales with total order volume; saturates near 0.8 when orders hit 80/event-window. |
| 4 | `wasteTrend` | signed % | `+20 + walkInDropRisk × 30` when `walkInDropRisk > 0.4`, else `-5`. Negative trend = waste controlled. |
| 5 | `stockoutProbability` | 0–1 | `clamp01(0.4 × stockoutRiskFromInv + 0.4 × clamp01(deliverySurge / 50) + 0.2 × rainRiskScore)`. Blends inventory-side risk, delivery pressure, and weather. |
| 6 | `staffingFit` | 0–1 | `clamp01(avg(staffEvents.fitScore))`. Falls back to 0.7 if no staff events. |
| 7 | `serviceDelayRisk` | 0–1 | `clamp01(0.5 × deliveryDisruptionRisk + 0.3 × (1 − staffingFit) + 0.2 × clamp01(deliverySurge / 40))`. Weather + staffing + surge combined. |
| 8 | `marginRisk` | 0–1 | `clamp01(0.3 × clamp01(|wasteTrend| / 40) + 0.3 × stockoutProbability + 0.2 × serviceDelayRisk + 0.2 × (1 − staffingFit))`. Composite — waste + stockout + service + staffing. |
| 9 | `complaintRisk` | 0–1 | `clamp01(0.4 × rainRiskScore + 0.3 × serviceDelayRisk + 0.15 × stockoutProbability + clamp01(complaintCount / 5) × 0.15)`. |
| 10 | `campaignEffectiveness` | 0–1 | `clamp01(rainRiskScore > 0.5 ? 0.7 + rainRiskScore × 0.2 : 0.4)`. Delivery campaign performs better in rain. |

The result object also carries:

```ts
{
  storeId, computedAt,
  mode: "synthetic",     // matches the underlying event mode
  eventCount,            // total events used
  windowStart, windowEnd // ISO timestamps of newest/oldest event
}
```

---

## 5. Anomaly detection rules

Defined in `detectAnomalies()` in `src/lib/operations/riskIntelligenceAgent.ts`. Five rules, each emitting an `AnomalyAlert` with `severity`, `category`, `title`, `message`, `recommendation`, `confidence`, `mode`.

| # | Trigger | Severity | Category | Title (example) | Recommendation |
|---|---|---|---|---|---|
| 1 | `metrics.deliverySurge > 20` | warning (or critical if > 35) | `delivery` | "Delivery surge exceeds forecast" | Add 1 packing staff member now; pre-confirm extra rider via aggregator. |
| 2 | `metrics.wasteTrend > 20 AND weather.walkInDropRisk > 0.4` | warning | `waste` | "Waste risk rising — early batch too high" | Cut the next fried batch by 15%; delay large prep until confirmed demand. |
| 3 | `metrics.stockoutProbability > 0.5` | warning (or critical if > 0.7) | `stockout` | "Stockout risk for family bucket" (or "spicy chicken" for suburban) | Suburban: confirm replenishment delivery NOW. Other: pull backstock for high-delivery SKUs before 17:00. |
| 4 | `metrics.staffingFit < 0.6` | warning | `staffing` | "Staffing mismatch at peak" | Redeploy 1 counter staff to packing; consider calling 1 backup for dinner. |
| 5 | `metrics.complaintRisk > 0.5` | warning | `complaint` | "Complaint risk elevated" | Set delivery ETA buffer +10min; prepare apology voucher draft for affected orders. |

Every alert is tagged with `mode: "synthetic"` in this build. In production the mode would match the underlying event stream (`"live"` if any contributing adapter was live, `"fallback"` if any adapter fell back).

### 5.1 Why no `info`-level alerts in this build

The 5 rules above only emit `warning` and `critical` alerts. The `info` severity is reserved in the schema for future low-priority observations (e.g. "Campaign effectiveness trending up — consider scaling budget"), to be added when live campaign-event ingestion is wired up.

---

## 6. Strategic insights

Defined in `generateStrategicInsights()` in `src/lib/operations/riskIntelligenceAgent.ts`. Three rules, each emitting a `StrategicInsight` with `horizon: "today" | "week"`, `title`, `message`, `evidence`, `confidence`.

| # | Trigger | Horizon | Title (example) |
|---|---|---|---|
| 1 | `rainRiskScore > 0.5 AND campaignEffectiveness > 0.6` | today | "Delivery campaign outperforming dine-in in rain window" |
| 2 | `wasteTrend > 15 AND operatingType == "urban-center"` | week | "Recurring over-prep pattern at lunch — review batch schedule" |
| 3 | `storeType == "suburban" AND stockoutProbability > 0.4` | week | "Suburban replenishment lead time is the binding constraint" |

Insights are longer-horizon than alerts: an alert says "act now", an insight says "this is a pattern worth fixing structurally". Both are surfaced in the Live Operations Monitor UI and feed the Smart Interaction Agent's context.

---

## 7. The full Risk Intelligence pipeline

`runRiskIntelligence(store, profile, weather)` in `src/lib/operations/riskIntelligenceAgent.ts` runs the full pipeline:

```
   store + profile + weather
            │
            ▼
   realTimeEventAdapter.emitAll(store, profile, weather, 3)
            │  ← 3 events per source × 5 sources = 15 events
            ▼
   computeRealTimeMetrics(store, profile, weather, events)
            │  ← 10 metrics + window metadata
            ▼
   detectAnomalies(store, metrics, weather)
            │  ← 0–5 alerts
            ▼
   generateStrategicInsights(store, metrics, weather, profile)
            │  ← 0–3 insights
            ▼
   RiskIntelligenceResult {
     metrics, alerts, insights, events,
     sources: [{ id, name, mode, eventCount }]
   }
```

The `sources` array tells the UI how many events each adapter contributed and what mode they were in — this is what powers the "Live / Synthetic / Fallback" badges in the Live Operations Monitor.

---

## 8. How to swap synthetic adapters for live POS / inventory / workforce connectors

The synthetic adapters are designed to be replaced one at a time. For each:

1. **Implement the `OperationsDataAdapter` interface** with `mode: "live"`:
   ```ts
   export class LivePosDataAdapter implements OperationsDataAdapter {
     readonly id = "pos-data";
     readonly name = "POS Data (live)";
     readonly eventType = "pos-order" as const;
     readonly mode = "live" as const;

     async emit(store, profile, weather, count) {
       const recent = await fetch(`https://pos.kfcvn.internal/api/orders?storeId=${store.id}&last=${count}min`);
       const json = await recent.json();
       return json.orders.map(o => makeEvent(store, "pos-order", {
         channel: o.channel,
         orders: o.items.length,
         avgItems: o.items.length,
         avgTicketVnd: o.total_vnd,
       }, { source: this.id, mode: this.mode, confidence: 0.95, timestamp: o.timestamp }));
     }
   }
   ```

2. **Register it in `RealTimeEventAdapter.sources`** (replace the synthetic instance, or add alongside for an A/B comparison).

3. **That's it.** The Risk Intelligence Agent, the Live Operations Monitor, and the Smart Interaction Agent all consume events through the interface — no further code changes needed. The `mode` badge in the UI automatically reflects `"live"`.

4. **(Optional) Add a fallback adapter** with `mode: "fallback"` that produces a deterministic shape when the live adapter times out. The `mode` field will surface this honestly.

### 8.1 Per-adapter production targets

| Adapter | Production target | Connector notes |
|---|---|---|
| `PosDataAdapter` → live | KFC VN POS (NCR Aloha or equivalent) | REST API or Kafka topic `pos.orders.v1` |
| `DeliveryDataAdapter` → live | GrabFood / ShopeeFood / BeFood partner APIs (or aggregator webhook) | Polling or webhook → Kafka topic `delivery.orders.v1` |
| `InventoryDataAdapter` → live | KFC inventory management system (SAP MM or equivalent) | Periodic snapshot every 5 min |
| `StaffingDataAdapter` → live | KFC WFM / Deputy / Kronos | Check-in events streamed; `fitScore` computed live |
| `ComplaintDataAdapter` → live | Zendesk / Freshdesk + social listening (Facebook / Zalo) | Webhook → Kafka topic `complaints.v1` |

### 8.2 What is explicitly NOT claimed as integrated

- No live POS, delivery aggregator, inventory, workforce, or complaint system is connected in this build.
- All 6 adapters ship with `mode: "synthetic"`.
- The `mode: "live"` and `mode: "fallback"` enums are real and used by the UI, but no adapter in this build sets them.

---

## 9. Apache Kafka (design only, NOT implemented)

For a real multi-store pilot, the intended event streaming layer is **Apache Kafka**. This is documented as a design path only — no Kafka cluster, broker, producer, or consumer is bundled or deployed.

### 9.1 Proposed topic layout

| Topic | Producers | Consumers | Partitions |
|---|---|---|---|
| `pos.orders.v1` | Live POS adapter (one per store) | Risk Intelligence Agent, BI dashboards | partitioned by `storeId` |
| `delivery.orders.v1` | Delivery aggregator webhooks | Risk Intelligence Agent | partitioned by `storeId` |
| `inventory.snapshots.v1` | Inventory system | Risk Intelligence Agent, Task Automation (supplier-order trigger) | partitioned by `storeId` |
| `staffing.events.v1` | WFM system | Risk Intelligence Agent | partitioned by `storeId` |
| `complaints.v1` | Zendesk / social listening | Risk Intelligence Agent, Smart Interaction (customer-reply trigger) | partitioned by `storeId` |
| `automation.task.executed.v1` | Approval Workflow (see [`AUTOMATION.md`](./AUTOMATION.md) §8) | n8n / outbound connectors | partitioned by `storeId` |
| `risk.alerts.v1` | Risk Intelligence Agent | Live Operations Monitor, paging system | partitioned by `storeId` |

### 9.2 Why Kafka (and why not in this build)

- **Why Kafka in production:** multi-store fan-out (20+ stores in the seed dataset, would scale to 100+ in a real VN pilot), decoupled producers/consumers, replayable event log for audit, and natural fit for windowed metric computation (Kafka Streams / ksqlDB).
- **Why NOT in this build:** a hackathon cannot stand up a Kafka cluster and real producers. The `OperationsDataAdapter` interface gives us the same decoupling for free — synthetic adapters are producers, the Risk Intelligence Agent is the consumer, and switching to Kafka later means replacing each adapter's `emit()` body with a Kafka consumer poll. No downstream code changes.

### 9.3 Apache Superset / Metabase for BI dashboards (design only, NOT implemented)

The 10 computed metrics in §4 and the strategic insights in §6 are designed to be BI-friendly. The intended production path is:

- **Apache Superset** or **Metabase** as the BI layer, reading from a metrics warehouse (Postgres or ClickHouse) populated by a Kafka Streams / Flink job that computes the same 10 metrics at a fixed cadence (e.g. every 1 minute).
- The Live Operations Monitor panel in this build is the **operational** view (real-time, last 15 min). Superset/Metabase would be the **analytical** view (trends over days/weeks, cross-store comparison, campaign effectiveness over time).
- Neither Superset nor Metabase is bundled or deployed in this build. They are referenced as the production BI path.

---

## 10. Data freshness + live/synthetic/fallback badge honesty

The build enforces three honesty rules:

### 10.1 Every event is badged

Every `OperationEvent` carries `mode`. The Live Operations Monitor UI renders this as a badge next to each event:

- 🟢 `live` — real data from a real system
- 🟡 `synthetic` — simulated by this build (default for all 6 adapters in this build)
- 🟠 `fallback` — a live adapter failed and a deterministic fallback was used (not triggered in this build, but the schema and UI support it)

### 10.2 Every metric is badged

`RealTimeMetrics.mode` is set to `"synthetic"` in this build (it matches the underlying event mode). In production, if any contributing adapter was `"live"`, the metric mode would be `"live"`; if all adapters fell back, it would be `"fallback"`.

### 10.3 Every alert and insight is badged

`AnomalyAlert.mode` and (transitively) the alerts surfaced in the UI carry the same badge. A judge can see at a glance: "this stockout alert was derived from synthetic inventory events" — never "the system says stockout is imminent" without context.

### 10.4 The freshness contract

| Adapter | Synthetic freshness (this build) | Target live freshness (production) |
|---|---|---|
| `pos-data` | 1-minute bucket (re-emits every minute) | 1 min (real POS poll) |
| `delivery-data` | 1-minute bucket | 1 min (aggregator poll) or real-time webhook |
| `inventory-data` | 5-minute bucket | 5 min (inventory system snapshot) |
| `staffing-data` | 1-hour bucket | 15 min (WFM check-in stream) |
| `complaint-data` | 10-minute bucket | 5 min (Zendesk webhook + social listening poll) |

The Store Operating Profile's `monitoredMetrics` array (`src/lib/storeProfile/storeOperatingProfile.ts`) documents the **required** freshness for each metric type — this is the contract the live adapters must meet.

---

## 11. API surface

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/realtime/events?storeId=xxx` | GET | Run the full Risk Intelligence pipeline. Returns `{metrics, alerts, insights, events, sources}`. |
| `/api/store-profile?storeId=xxx` | GET | Build the Store Operating Profile (defines monitored metrics + required freshness). |

The `/api/realtime/events` endpoint is called by the Live Operations Monitor panel on load and on refresh. It runs the entire pipeline server-side and returns the complete `RiskIntelligenceResult`.

---

## 12. Honesty summary

- ✅ The `OperationEvent` schema, `OperationsDataAdapter` interface, and Risk Intelligence pipeline are **real and stable** — live connectors can drop in without downstream changes.
- ✅ The 10 computed metrics, 5 anomaly rules, and 3 strategic insight rules are **real and deterministic** — they run on every call and produce the same output for the same inputs.
- ✅ Every event, metric, alert, and insight carries a `mode` badge that is **honestly rendered in the UI**.
- ⚠️ All 6 adapters ship with `mode: "synthetic"`. No live POS, delivery, inventory, workforce, or complaint system is connected.
- ⚠️ Apache Kafka, Apache Superset, and Metabase are **documented as the production design path**, NOT integrated or deployed.
- ⚠️ This is a **hackathon pilot-ready build**, not an official KFC product. The correct framing: "Agent CaMate converts local weather and demand signals into actionable store operations plans." — it does not claim to be more accurate than weather apps.

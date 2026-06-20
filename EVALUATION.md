# Evaluation — Measuring Real Pilot Impact

This document is the **pilot evaluation framework** for Agent CaMate — Hyperlocal StoreOps
Agent. It defines the 7 metrics that matter for a real KFC pilot, the 3 baselines for comparison,
the A/B store-pair pilot design, the decision-quality survey, and a results-reporting template.

It also explains, honestly, how to replace the **simulated** before/after metrics shown in the
demo UI with **real measured metrics** once POS data is connected via the CSV operations adapter
seam (`public/sample-operations-data.csv`).

> **Status of the demo's before/after panel:** the 5 metrics shown in the UI (Food Waste Risk,
> Stockout Risk, Staffing Fit, Delivery Readiness, Margin Protected) are **simulated,
> internally-consistent numbers** derived from the agent's own risk scores — labeled explicitly
> in the methodology footnote. They illustrate the *direction* of expected impact. **This
> document defines how to measure the real impact.**

---

## 1. Why this document exists

The demo claims: **Agent CaMate converts local weather and demand signals into actionable
store operations plans.** The simulated before/after panel illustrates *what kind* of impact we
expect (waste down, stockout down, staffing fit up, delivery readiness up, margin protected up).

But "illustrative" is not "measured". Before any real KFC pilot, we need:

1. A precise definition of each metric.
2. A formula and a data source for each.
3. A target per metric.
4. A baseline to compare against (3 options below).
5. A pilot design that produces statistically defensible results.
6. A decision-quality dimension (manager confidence + usefulness) — because operational metrics
   alone don't capture whether managers actually trust and use the plan.
7. A reporting template so pilot results are comparable across stores and time periods.

This document delivers all seven.

---

## 2. The 7 metrics

For each metric below: definition, how to measure, data source needed, formula, target, and which
of the demo's 5 simulated metrics it maps to (where applicable).

### Metric 1 — Food waste reduction

**Definition:** The percentage of food prepared (by weight or by cost) that is discarded unsold
at end of shift, vs a baseline period.

**How to measure:** Weigh (or cost) end-of-shift discarded food per slot (lunch, dinner) per
store per day. Aggregate to weekly. Compare pilot period (agent-managed) vs baseline period
(pre-agent).

**Data source needed:**
- Waste log per store (manual or IoT scale). Most KFC stores already track this for inventory
  reconciliation.
- Date + slot (lunch/dinner) + store id + discarded weight (kg) or cost (VND).

**Formula:**
```
wasteRate = (discardedFoodCost / totalFoodCostPrepared) × 100
wasteReduction = baselineWasteRate − pilotWasteRate
```

**Target:** ≥ 20% relative reduction in waste rate vs baseline (e.g. 12% → ≤ 9.6%).

**Maps to demo metric:** "Food Waste Risk" (simulated).

---

### Metric 2 — Stockout risk reduction

**Definition:** The frequency and duration of stockout events on high-demand SKUs (family buckets,
combo boxes, popular sides) during peak slots, vs baseline.

**How to measure:** Record each stockout event (SKU, store, start time, end time, slot). Either
from POS (item shows as unavailable) or from manual shift log.

**Data source needed:**
- POS stockout events (item unavailable flags) OR manual shift log.
- Date + time + store id + SKU + duration (minutes).

**Formula:**
```
stockoutRate = (stockoutEventMinutes / totalPeakSlotMinutes) × 100
stockoutRiskReduction = baselineStockoutRate − pilotStockoutRate
```

**Target:** ≥ 30% relative reduction in stockout rate on top-5 delivery SKUs during rain-event
days.

**Maps to demo metric:** "Stockout Risk" (simulated).

---

### Metric 3 — Staffing fit improvement

**Definition:** The percentage of peak slots where actual staffing matched demand-mix (i.e.
enough fulfillment staff when delivery surges, enough counter staff when walk-in surges), vs
baseline.

**How to measure:** Per slot, classify as "fit" or "misfit" based on:
- If delivery delta > +10% and ≥1 dedicated packer on shift → fit.
- If walk-in delta > +10% and ≥2 counter staff on shift → fit.
- Otherwise → misfit.

**Data source needed:**
- Roster (scheduled staff per slot per role) — from workforce management system.
- Actual demand mix per slot (walk-in vs delivery orders) — from POS.
- Date + slot + store id + scheduled staff by role + actual orders by channel.

**Formula:**
```
staffingFitRate = (fitSlots / totalPeakSlots) × 100
staffingFitImprovement = pilotFitRate − baselineFitRate
```

**Target:** ≥ 20 percentage point improvement (e.g. 60% → ≥ 80%).

**Maps to demo metric:** "Staffing Fit" (simulated).

---

### Metric 4 — Delivery readiness

**Definition:** The percentage of delivery orders that meet the pack-to-dispatch SLA (e.g. ready
within 8 minutes of order acceptance) during rain-event days, vs baseline.

**How to measure:** Per delivery order, record order-accept time and ready-for-dispatch time.
Compute SLA adherence.

**Data source needed:**
- POS / aggregator integration with order timestamps (accept time, ready time, dispatch time).
- Date + time + store id + orderId + acceptTime + readyTime.

**Formula:**
```
deliveryReadinessRate = (ordersWithinSLA / totalDeliveryOrders) × 100
deliveryReadinessImprovement = pilotRate − baselineRate
```

**Target:** ≥ 15 percentage point improvement on rain-event days (e.g. 70% → ≥ 85%).

**Maps to demo metric:** "Delivery Readiness" (simulated).

---

### Metric 5 — Over-prep reduction

**Definition:** The frequency with which a store prepares more than 110% of actual peak-slot
demand on a non-rain day (i.e. wasted prep capacity from over-cautious forecasting), vs baseline.

**How to measure:** Per slot, compare prepared units (from kitchen log) to actual sold units
(from POS). Flag over-prep when prepared > 110% of sold.

**Data source needed:**
- Kitchen prep log (batches prepared per slot per SKU).
- POS sold units per slot per SKU.
- Date + slot + store id + SKU + preparedQty + soldQty + rainFlag.

**Formula:**
```
overPrepRate = (overPrepSlots / totalNonRainPeakSlots) × 100
overPrepReduction = baselineOverPrepRate − pilotOverPrepRate
```

**Target:** ≥ 25% relative reduction in over-prep rate on non-rain days.

**Maps to demo metric:** Partially captured by "Food Waste Risk" (simulated) — over-prep is the
*cause*, waste is the *outcome*. This metric measures the cause directly.

---

### Metric 6 — Under-prep reduction

**Definition:** The frequency with which a store prepares less than 90% of actual peak-slot
demand on a rain-event day (i.e. lost sales from under-cautious forecasting), vs baseline.

**How to measure:** Same data source as Metric 5. Flag under-prep when prepared < 90% of sold.

**Data source needed:**
- Kitchen prep log + POS sold units (same as Metric 5) + rain-event flag from weather log.

**Formula:**
```
underPrepRate = (underPrepSlots / totalRainPeakSlots) × 100
underPrepReduction = baselineUnderPrepRate − pilotUnderPrepRate
```

**Target:** ≥ 30% relative reduction in under-prep rate on rain-event days.

**Maps to demo metric:** Partially captured by "Stockout Risk" (simulated) — under-prep is the
*cause*, stockout is the *outcome*.

---

### Metric 7 — Margin protection

**Definition:** The percentage of at-risk margin (revenue that would have been lost to waste +
stockout + mis-staffing) that was protected by the agent's plan, vs baseline.

**How to measure:** Compute at-risk margin per day per store as:
`atRisk = (wasteCost) + (stockoutLostRevenue) + (misStaffingCost)`
where misStaffingCost = (idle staff cost on over-staffed slots) + (lost-sales cost on
under-staffed slots). Protected margin = baseline at-risk − pilot at-risk.

**Data source needed:**
- All of the above (waste log, stockout events, roster, POS, prep log) + cost rates (per-kg food
  cost, per-SKU revenue, per-hour staff cost).

**Formula:**
```
atRiskMargin = wasteCost + stockoutLostRevenue + misStaffingCost
marginProtectionRate = ((baselineAtRisk − pilotAtRisk) / baselineAtRisk) × 100
```

**Target:** ≥ 25% relative reduction in at-risk margin (i.e. ≥ 25% of at-risk margin protected).

**Maps to demo metric:** "Margin Protected" (simulated).

---

## 3. The 3 baselines for comparison

To attribute impact to the agent (and not to seasonality, weather variation, or other
interventions), we compare three conditions:

### Baseline A — Manager uses generic city weather app only (control)

- Store manager checks a generic city-level weather app (e.g. the default iOS weather app,
  AccuWeather for Ho Chi Minh City) at 9am.
- Manager makes prep, staffing, and campaign decisions based on intuition + the city forecast.
- No agent output is shown to the manager.
- This is the "status quo" baseline — the typical KFC store today.

### Baseline B — Manager uses fixed rules

- Store manager follows a fixed printed ruleset: "if forecast says >50% rain chance, cut dine-in
  prep 10%, add 1 delivery packer, push delivery combo".
- Same rule for every store, regardless of store type.
- This isolates the value of *hyperlocal per-store reasoning* from the value of *having any
  system at all*.
- Optional baseline — use if pilot duration allows a 3-way comparison.

### Treatment — Manager uses Agent CaMate

- Store manager reads the agent's Daily StoreOps Action Plan + Manager Briefing at the start of
  the shift (exported as Markdown or viewed in the dashboard).
- Manager approves / adjusts the plan before execution.
- Agent output is logged (so we can compare recommended vs actual decisions).

### Why three baselines?

- A vs Treatment answers: "does the agent beat the status quo?" (the main question).
- B vs Treatment answers: "does the agent's per-store reasoning beat a one-size-fits-all rule?"
  (the hyperlocal value question).
- A vs B answers: "is any structured system better than none?" (sanity check — if B doesn't beat
  A, the pilot design has a problem).

---

## 4. A/B pilot design

### Store pairs (treatment vs control)

Pair stores by similarity — same district band, same store type, similar baseline delivery share
and kitchen capacity. Within each pair, randomly assign one store to Treatment and one to
Control (Baseline A).

Recommended pilot: **6–10 store pairs** (12–20 stores total) for statistical power. Minimum
**4 store pairs** (8 stores) for a directional read.

Suggested pairing for the 20-store TP.HCM seed dataset:

| Pair | Treatment (agent) | Control (status quo) | Rationale |
|---|---|---|---|
| 1 | KFC Lê Lai (urban-street, Quận 1) | KFC Nguyễn Thái Học (urban-street, Quận 1) | Same district, same type — clean comparison |
| 2 | KFC Xô Viết Nghệ Tĩnh (residential, Bình Thạnh) | KFC Thống Nhất (residential, Tân Phú) | Same type, similar demand profile |
| 3 | KFC Centre Mall Củ Chi (suburban mall) | KFC Huỳnh Tấn Phát 2 (suburban, Nhà Bè) | Both outer suburban — different shelter profiles |
| 4 | KFC Cách Mạng Tháng 8 (urban-street, Quận 3) | KFC Lâm Văn Bền (residential, Quận 7) | Cross-district urban pair |
| 5 | KFC Emart Gò Vấp (mall, Gò Vấp) | KFC Pandora (mall, Quận 1) | Mall pair — shelter-effect test |
| 6 | KFC Lê Văn Việt (residential, Quận 9) | KFC Đỗ Xuân Hợp (residential, Quận 9) | Same district, same type |

(Pairing can be re-randomized at pilot start. The above is illustrative.)

### Minimum pilot duration

- **2 weeks minimum** — to capture at least one full weekly cycle and a few rain-event days.
- **4 weeks recommended** — to capture wet-season variability and enough rain events for
  statistically meaningful rain-day metrics (Metrics 4, 6).
- **Avoid**: pilot during Tet or other major demand anomalies; pilot during unusually dry weeks
  (no rain events → no rain-day metrics).

### Statistical considerations

- **Sample size:** with 6–10 store pairs over 4 weeks (28 days × 2 slots = 56 slot-days per
  store), each metric has ~336–560 slot-day observations per condition. Sufficient for detecting
  ≥15% relative effects with 80% power at α=0.05.
- **Paired analysis:** because stores are paired by similarity, use a **paired t-test** (or
  Wilcoxon signed-rank for non-normal distributions) on the per-store-pair metric deltas.
- **Rain-event stratification:** pre-register the rain-event definition (e.g. METAR VVTS
  reports `RA` or `TSRA`, OR Open-Meteo precipitation > 1mm/hr at the store's coordinates
  during the slot). Stratify the analysis by rain-event vs non-rain days — Metrics 4 and 6 are
  only meaningful on rain-event days.
- **Day-of-week fixed effects:** include day-of-week dummies in the regression to absorb weekly
  demand patterns.
- **Pre-registration:** register the analysis plan (metrics, formulas, targets, sample size,
  rain-event definition) before the pilot starts. This prevents post-hoc metric shopping.

### Operational considerations

- **Manager training:** Treatment-group managers get a 30-minute walkthrough of the agent's
  briefing format and how to approve/adjust the plan. Control-group managers get no training.
- **Compliance logging:** track whether Treatment managers actually read and followed the plan
  (a quick end-of-shift checkbox: "I read the briefing", "I followed the plan / deviated
  because ___"). Non-compliance dilutes treatment effect — record it.
- **Hawthorne effect:** managers may behave differently because they know they're being
  measured. Mitigate by running Baseline A for 1 week before randomizing (pre-baseline
  observation period) so the measurement itself isn't novel.
- **No cross-contamination:** Treatment and Control managers should not be in the same regional
  manager's direct report chain if possible, to avoid the Control manager asking the Treatment
  manager "what does the agent say today?".

---

## 5. Replacing the simulated before/after panel with real metrics

The demo's before/after panel (`src/components/dashboard/before-after-panel.tsx`) currently
renders 5 simulated metrics computed by `buildBeforeAfter()` in `engine.ts` from the agent's own
risk scores. **These are illustrative, not measured.**

To replace with real measured metrics once POS data is connected:

### Step 1 — Connect real POS data via the CSV seam

Replace `public/sample-operations-data.csv` with a real KFC POS export (see `DATA_SOURCES.md`
§10 for the schema). This gives the agent real baselines.

### Step 2 — Add a `PilotMetrics` table to Prisma

```prisma
model PilotMetric {
  id          String   @id @default(cuid())
  storeId     String
  date        DateTime
  slot        String   // "lunch" | "dinner"
  metric      String   // "waste" | "stockout" | "staffingFit" | "deliveryReadiness" | "overPrep" | "underPrep" | "margin"
  value       Float
  unit        String
  isTreatment Boolean  // true if store was in Treatment group
  rainFlag    Boolean
  createdAt   DateTime @default(now())

  @@index([storeId, date, metric])
  @@index([isTreatment, date])
}
```

### Step 3 — Build a real-metrics ingestion path

A nightly job (or manual CSV upload per store per week) ingests waste logs, stockout events,
roster, POS sold units, and prep logs into the `PilotMetric` table.

### Step 4 — Replace the simulated `buildBeforeAfter()` with a real-metrics query

Replace the call to `buildBeforeAfter(context, weather, slots)` in `engine.ts` with a query to
`PilotMetric` for this store, comparing the last 4 weeks of Treatment vs Control days (matched by
rain-flag and day-of-week). Render the real deltas in the before/after panel.

### Step 5 — Keep the simulated panel as a "projected impact" view

Don't delete the simulated `buildBeforeAfter()` — relabel it as **"Projected impact (simulated)"**
and add a second tab **"Measured impact (pilot)"** that shows the real `PilotMetric` deltas. This
way the demo still works pre-pilot, and the real pilot results are visible as they accumulate.

---

## 6. Decision-quality metric (manager survey)

Operational metrics alone don't capture whether managers actually trust and use the agent's plan.
A pilot can show stockout reduction but manager adoption can be low — in which case the
operational gains won't persist post-pilot. So we add a **decision-quality survey**.

### Survey design

Administer a short (5-question) survey to **Treatment-group managers** at the end of each pilot
week. 5-point Likert scale (1=strongly disagree, 5=strongly agree) for Q1–Q4; open text for Q5.

| # | Question | What it measures |
|---|---|---|
| 1 | "The agent's plan was relevant to my store's actual conditions today." | Relevance |
| 2 | "I felt more confident making shift decisions with the agent's plan than without it." | Confidence |
| 3 | "The agent's plan saved me time vs my usual planning process." | Usefulness / time |
| 4 | "I would continue using the agent's plan after the pilot ends." | Adoption intent |
| 5 | "What was the single most useful thing about the agent's plan? What was the single least useful?" | Qualitative |

### Survey analysis

- Compute mean + standard deviation per question per week.
- Track the trend over the 4 pilot weeks — Q4 (adoption intent) should be stable or rising; a
  falling Q4 in weeks 3–4 is a red flag.
- Code Q5 open-text responses into themes (e.g. "briefing format", "campaign focus", "prep
  sizing accuracy"). Report the top 3 most-useful and top 3 least-useful themes.
- Cross-tabulate Q1–Q4 against operational metric performance: stores where the manager rated Q2
  (confidence) ≥ 4 should show larger operational gains — if they don't, either the manager is
  overconfident or the operational metrics are miscalibrated.

### Control-group manager survey

Optionally, ask Control-group managers Q1–Q4 rephrased for their usual process (e.g. "I felt
confident making shift decisions with my usual planning process"). This gives a baseline
confidence score to compare against.

---

## 7. Results-reporting template

After the pilot, present results in this structure. This template is designed to be
judge-readable and operator-readable.

### 7.1 Executive summary (1 page)

- Pilot duration: [start date] → [end date] (N weeks).
- Store pairs: [N pairs, M stores total]. [Districts covered].
- Rain-event days: [N days with METAR RA/TSRA or Open-Meteo precip > 1mm/hr].
- Headline result: "Agent CaMate reduced food waste by X%, stockout risk by Y%, and
  protected Z% of at-risk margin vs the status-quo baseline, across N store pairs over N weeks."

### 7.2 Operational metrics table

| Metric | Baseline A (status quo) | Treatment (agent) | Delta | Target met? |
|---|---|---|---|---|
| 1. Food waste rate (%) | [value] | [value] | [−X pp] | ✅/❌ |
| 2. Stockout rate — rain days (%) | [value] | [value] | [−X pp] | ✅/❌ |
| 3. Staffing fit rate (%) | [value] | [value] | [+X pp] | ✅/❌ |
| 4. Delivery readiness — rain days (%) | [value] | [value] | [+X pp] | ✅/❌ |
| 5. Over-prep rate — non-rain days (%) | [value] | [value] | [−X pp] | ✅/❌ |
| 6. Under-prep rate — rain days (%) | [value] | [value] | [−X pp] | ✅/❌ |
| 7. Margin protection rate (%) | [value] | [value] | [+X pp] | ✅/❌ |

(If Baseline B was run, add a second table for B vs Treatment.)

### 7.3 Statistical significance

For each metric, report:
- Paired t-test (or Wilcoxon) p-value.
- 95% confidence interval on the delta.
- Effect size (Cohen's d for paired test).
- Per-store-pair deltas (small multiples chart).

### 7.4 Rain-event stratification

Report Metrics 2, 4, 6 stratified by:
- Rain-event day vs non-rain day.
- Rain intensity (light < 2mm/hr, moderate 2–8mm/hr, heavy > 8mm/hr).
- Store type (urban-street vs mall vs residential vs suburban).

The hyperlocal value claim is strongest if Treatment beats Control *specifically on rain-event
days for non-mall stores* (where rain crushes walk-in). If Treatment also beats Control on
non-rain days, that's a bonus — it means the agent's demand-mix reasoning helps even without
rain.

### 7.5 Decision-quality survey results

| Question | Week 1 mean (SD) | Week 2 | Week 3 | Week 4 | Trend |
|---|---|---|---|---|---|
| Q1 Relevance | [value] | [value] | [value] | [value] | ↑/→/↓ |
| Q2 Confidence | [value] | [value] | [value] | [value] | ↑/→/↓ |
| Q3 Time saved | [value] | [value] | [value] | [value] | ↑/→/↓ |
| Q4 Adoption intent | [value] | [value] | [value] | [value] | ↑/→/↓ |

Plus: top 3 most-useful themes from Q5, top 3 least-useful themes, representative quotes.

### 7.6 Compliance & caveats

- Treatment-group manager compliance: "On X% of pilot days, the Treatment manager confirmed
  reading the briefing and following the plan. On Y% of days they deviated; reasons coded into
  themes: [list]."
- Data quality: "Waste log coverage was Z% of expected slot-days; missing days imputed as
  [method]."
- External events: "During the pilot, [event X] occurred on [date] and may have affected
  demand at stores [list]."
- Generalizability: "Pilot covered [districts] in TP.HCM over [season]. Results may not
  generalize to [other cities / other seasons / other store types not in pilot]."

### 7.7 Recommendation

One of:
- **Scale**: metrics met targets, manager adoption ≥ 4/5, recommend scaling to N more stores.
- **Iterate**: metrics partially met; recommend specific improvements (e.g. "improve mall-store
  campaign logic", "add Meteostat historical baseline") before scaling.
- **Halt**: metrics missed targets significantly; recommend revisiting the agent architecture
  before further pilot.

---

## 8. What the demo's simulated before/after panel maps to

| Demo metric (simulated) | Real pilot metric (measured) |
|---|---|
| Food Waste Risk → lower | Metric 1: Food waste reduction |
| Stockout Risk → lower | Metric 2: Stockout risk reduction |
| Staffing Fit → higher | Metric 3: Staffing fit improvement |
| Delivery Readiness → higher | Metric 4: Delivery readiness |
| Margin Protected → higher | Metric 7: Margin protection |

The demo's simulated panel shows **5** metrics; this framework defines **7** — adding
**Metric 5 (over-prep reduction)** and **Metric 6 (under-prep reduction)** as separate cause-side
metrics (the demo's "Food Waste Risk" and "Stockout Risk" are the outcome-side metrics). Measuring
both cause and outcome lets you diagnose *why* a pilot did or didn't work.

---

## 9. Honesty constraints

- **The before/after panel in the demo is simulated.** It says so explicitly in the methodology
  footnote. Do not present those numbers as measured.
- **This evaluation framework is a plan, not a result.** No pilot has been run yet. Any pilot
  results presented externally must come from a real pilot run following this framework.
- **Statistical significance is not the same as operational significance.** A metric can be
  statistically significant (p < 0.05) but operationally trivial (0.5 pp improvement). Always
  report effect size alongside p-value, and judge against the pre-registered targets (§2).
- **Manager adoption is a real outcome, not a soft metric.** If managers don't trust the plan,
  the operational metrics won't persist post-pilot. The decision-quality survey (§6) is
  first-class, not a footnote.
- **No claim of "more accurate than weather apps."** This framework measures *operational impact*,
  not weather prediction accuracy. The agent's value is the translation, not the forecast.

---

## 10. See also

- [`README.md`](./README.md) — project overview, production readiness.
- [`AI_DOCUMENTATION.md`](./AI_DOCUMENTATION.md) — the 8 agents, the pluggable interfaces, the
  bilingual layer.
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — system architecture, sequence diagram with provenance
  and persistence.
- [`DATA_SOURCES.md`](./DATA_SOURCES.md) — data source registry, CSV schema for real POS,
  WeatherSnapshot persistence.
- [`ADVANCED_WEATHER_AI_INTEGRATION.md`](./ADVANCED_WEATHER_AI_INTEGRATION.md) — honest assessment
  of advanced AI weather models.

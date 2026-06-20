# Demo Script — Agent CaMate — StoreOps Decision Agent for KFC

**Target duration:** 4 minutes.
**Audience:** Agentic AI Build Week 2026 judges (F&B / KFC track).
**Setup:** Have the app open at <http://localhost:3000> (or the Vercel preview URL) on the
projector. Make sure the dev server is running and Open-Meteo is reachable from the demo network.
If you're unsure about network, the fallback mode will kick in automatically — practice the
fallback framing in section 7 below.

---

## Pre-demo checklist (30 seconds before you start)

- [ ] App loaded at `/`. Default store (KFC Lê Lai) auto-ran. You can see a plan + briefing.
- [ ] The `LIVE` badge is green (or `FALLBACK` red — see section 7 for how to frame this).
- [ ] The Agent Execution Trace panel is visible — switch the right-hand tab to "Agent trace"
      if needed. This is the centerpiece; don't bury it.
- [ ] The language toggle (EN/VI) is visible in the header — you'll click it during the demo.
- [ ] The Data Sources panel is visible further down the page — you'll scroll to it.
- [ ] Browser zoom is comfortable for a projector (Cmd/Ctrl + or 110%).
- [ ] Have the **"Run 3-store demo compare"** button in mind — that's your closing punch.

---

## 0:00–0:30 — The hook

> **Say:**
>
> "Agent CaMate converts local weather and demand signals into actionable store operations
> plans."
>
> "Weather apps tell managers what the weather *may be*. This agent tells each F&B store what to
> *do* because of local weather risk."
>
> "Ho Chi Minh City is a city of micro-climates — a 4pm storm can flood Bến Thành in Quận 1 while
> Củ Chi, 40 kilometers away, stays dry. A KFC manager checking a city-level weather app at 9am
> gets one number for ten million people, then has to mentally translate that into: how many
> fried chicken batches do I drop at 11? Do I pull a counter staffer into delivery packing at 6pm?
> Should the 4:30 push notification push a rainy-day delivery combo or a family dine-in bundle?"
>
> "That translation today is inconsistent, store by store. Our agent does it — per store, per
> weather signal, per slot — and shows its work."

**On screen:** the hero strip at the top of the dashboard with the positioning sentence, the
store network map of 20 KFC TP.HCM stores, and the store selector on the left. KFC Lê Lai is
auto-selected.

---

## 0:30–1:10 — Single-store run: KFC Lê Lai (urban)

> **Say:**
>
> "Let me pick an urban CBD store — **KFC Lê Lai**, on Lê Lai street in Bến Thành, Quận 1. It's a
> prime walk-in store near the office district. Narrow storefront, heavy lunch surge 11:30 to 1.
> When it rains, walk-in collapses."

**Click:** confirm KFC Lê Lai is selected in the left-hand store selector (it should already be
the default). The agent has already auto-run.

> **Say:**
>
> "The agent auto-ran the moment I selected the store. Notice the green **LIVE** badge — that
> means it pulled real Open-Meteo weather for this store's exact coordinates via our pluggable
> weather adapter — 6-second timeout, 2-attempt retry, 5-minute cache. Not a city-level forecast.
> The whole pipeline took about [read the `Xms` from the compare strip] milliseconds."
>
> "On the left, the **Weather Signal panel** shows the live readings — temperature, humidity,
> pressure trend, wind, last-hour rain — and the four derived risk scores: rain risk, heat risk,
> delivery disruption, walk-in drop. These scores are store-aware: a mall store gets a different
> walk-in drop score from the same rain signal than an urban-street store."

**Point to:** the Weather Signal panel (top-left). Point at the four risk bars.

> **Say:**
>
> "Below that, the **Action Plan** — this is the decision, not a chart. Lunch slot: walk-in down
> X percent, delivery up Y percent, so prep early batch is cut, packaging is staged, staffing is
> re-weighted toward fulfillment. Dinner slot: same idea, different numbers. Plus inventory, prep,
> staffing, delivery readiness, and campaign recommendations — all concrete."

**Point to:** the Action Plan panel. Read one or two of the recommendation lines aloud.

> **Say:**
>
> "And on the right, the **Manager Briefing** — a 30-second, action-oriented briefing the manager
> can read before their shift. Headline, TL;DR, top actions, watch items. This is the LLM agent
> synthesizing the structured plan into natural language — in English right now, but watch this."

---

## 1:10–1:35 — The bilingual moment: language toggle EN → VI

> **Say:**
>
> "Real KFC Vietnam managers speak Vietnamese. So the entire dashboard is bilingual — and the
> manager-facing outputs are generated bilingually by the agent engine, not by a second LLM call.
> Watch."

**Click:** the **EN/VI** language toggle in the header (top-right). Switch from **EN** to **VI**.

> **Say:**
>
> "The whole UI just switched to Vietnamese — store selector, weather panel, action plan, agent
> trace, even the briefing headline, TL;DR, top actions, watch items, and closing note. The
> Vietnamese translation is generated deterministically by a `withVietnamese` layer in the agent
> engine — same structured inputs, no second LLM call. The choice is stored in localStorage and
> auto-detected from the browser language on first visit."

**Point to:** the Manager Briefing panel — now showing the Vietnamese headline, TL;DR, top
actions, watch items, closing note. Read the Vietnamese headline aloud.

> **Say:**
>
> "Switch back to English for the rest of the demo."

**Click:** switch the toggle back to **EN**.

---

## 1:35–2:10 — The "this is agentic" moment: the Agent Execution Trace

> **Say:**
>
> "Now here's the moment that makes this an agent and not a dashboard."

**Click:** the **"Agent trace"** tab on the right-hand side (next to "Action plan").

> **Say:**
>
> "This is the **Agent Execution Trace**. Eight specialized agents ran in sequence across six
> phases — Observe, Collect, Analyze, Plan, Recommend, Explain."
>
> "Step 1, **Store Context Agent** — observed the store type, district, customer behavior, kitchen
> capacity. Step 2, **Weather Signal Agent** — pulled the live Open-Meteo signal via our
> pluggable weather adapter, derived the four risk scores, and recorded the full weather
> provenance — let me show you."

**Click:** expand step 2 (Weather Signal Agent). Point at the `structuredOutput` JSON.

> **Say:**
>
> "Look at the structured output for step 2 — you can see `isLive: true`, `source: "open-meteo"`,
> the `fallbackReason` is undefined because we're live, the `reliabilityNote` explains the audit
> persistence, and the `provenance` object shows the primary source (Open-Meteo, live) and the
> contributors list: Open-Meteo contributed, while NASA GPM IMERG, Meteostat, and METAR are
> listed as `planned` — interfaces ready, live ingestion pending. That's the honesty: we don't
> hide the planned sources, we surface them so a judge can see exactly what's real and what's
> coming."

> **Say:**
>
> "Continuing — Step 3, **Demand Agent** — predicted the lunch and dinner walk-in and delivery
> deltas. Steps 4 and 5, **Inventory & Prep** and **Staffing** — turned those deltas into batch
> sizing, packaging, and rota. Step 6, **Campaign Agent** — picked the campaign focus. Steps 7
> and 8, **Risk Explanation** and **Manager Briefing** — the LLM agents that wrote the narrative
> and the bilingual briefing."

**Click:** expand step 1 (Store Context Agent) to show the Input / Output / Structured Output
sections.

> **Say:**
>
> "Every step logs its **input**, its **output**, a **confidence score**, a **data source** badge
> — `live`, `fallback`, `computed`, or `llm` — and a **duration**. So you can audit exactly what
> each agent received and emitted. That's the difference between an agent and a black-box LLM
> call."

**Click:** scroll down to step 7 (Risk Explanation Agent). Point at the `llm` data-source badge.

> **Say:**
>
> "Step 7 here used the LLM — see the violet `llm` badge — to write the risk narrative. If the
> LLM had been unreachable, this would have been `computed` instead, with a deterministic
> fallback narrative. The demo works either way."

---

## 2:10–2:40 — Before/After: the value claim

> **Say:**
>
> "Now, what's the value of doing this agentic-ly versus a manager just looking at a weather app?"

**Scroll:** down to the **Without Agent vs With Agent** panel.

> **Say:**
>
> "Five metrics — Food Waste Risk, Stockout Risk, Staffing Fit, Delivery Readiness, Margin
> Protected. The red bars model a manager reacting to generic city-level weather — tends to
> over-prep dine-in, understaff delivery. The green bars model the agent's plan applied."

**Point to:** the red → green bars, especially Food Waste Risk and Delivery Readiness.

> **Say:**
>
> "I want to be honest with you: **these are simulated, internally-consistent numbers**, not real
> POS data. They're derived from the same risk scores the agent computed — see the methodology
> footnote right here. The absolute numbers are illustrative; the relative deltas are the demo
> value. We wrote a full pilot evaluation framework — `EVALUATION.md` in the repo — showing
> exactly how to replace these simulated metrics with real measured ones once POS data is
> connected. Three baselines, A/B store-pair design, seven real metrics."

**Point to:** the methodology footnote at the bottom of the panel.

> **Say:**
>
> "And to be clear — we are **not** claiming to be more accurate than weather apps at predicting
> weather. The claim is: **Agent CaMate converts local weather and demand signals into
> actionable store operations plans.** Weather is the input; the agent's job is the translation."

---

## 2:40–3:10 — The Data Sources panel: full transparency

> **Say:**
>
> "Speaking of honesty — every signal this agent uses is traced to a registered source. Let me
> show you the **Data Sources panel**."

**Scroll:** down to the **Data Sources & Confidence** panel.

> **Say:**
>
> "This panel renders our data source registry — the single source of truth. Eight sources, each
> with a mode badge: green **Live** for Open-Meteo and the LLM, blue **Verified seed** for the
> KFC Vietnam store list, orange **Simulated** for the synthetic POS data, gray **Planned** for
> NASA GPM IMERG, Meteostat, and METAR."
>
> "Each source shows its purpose, where it's used, its rate limit, its license, its fallback
> strategy, and a reliability note. The header summary: 2 live, 1 verified, 1 simulated, 4
> planned. No hidden sources, no hidden modes."

**Point to:** the header summary badges (2 live, 1 verified, 1 sim, 4 planned), then the
**active-store weather provenance strip** at the top of the panel.

> **Say:**
>
> "And right here at the top — the **active-store weather provenance strip**. For the store I
> just selected, it shows which weather sources actually contributed to this run: Open-Meteo
> (✓, live), and the three planned sources (○, planned). With a `fetched` timestamp. This is the
> same provenance you saw in the trace step 2, rendered for operators."

> **Say:**
>
> "One more thing on data — the simulated POS data has a real seam. There's a CSV file at
> `public/sample-operations-data.csv` with 20 stores. Replace it with a real KFC POS export of
> the same shape and the agent runs on real data. No code changes. That's what makes this
> pilot-ready, not just a demo."

---

## 3:10–3:50 — The 3-store compare: same weather, different plans

> **Say:**
>
> "Now the punchline. The same weather signal should produce different plans for different store
> types. Let me prove it."

**Click:** the **"Run 3-store demo compare"** button at the top-right of the hero strip.

> **Say:**
>
> "This runs the agent pipeline in parallel across three highlighted stores — urban, residential,
> and suburban — so you can see the plans side by side."

**Wait:** ~2–4 seconds for the parallel run to complete (toast will confirm).

> **Say:**
>
> "Three stores, same city, same weather API call, three radically different plans."
>
> "**KFC Lê Lai** — urban CBD, Quận 1. Rain crushes walk-in, surges delivery. Plan: cut early
> prep, stage packaging, push the rainy-day delivery combo."
>
> "**KFC Xô Viết Nghệ Tĩnh** — residential, Bình Thạnh. Dinner peak from returning residents,
> high delivery share to surrounding apartments. Plan: dinner-focused, delivery-heavy, with rider
> dispatch buffers."
>
> "**KFC Centre Mall Củ Chi** — suburban mall, outermost store in the network. Rain drives
> footfall UP because of the shelter effect. Plan: increase prep, push family dine-in bundles,
> flag the long supply lead time."

**Point to:** each column in turn. Read the campaign line and the briefing headline aloud for
each.

> **Say:**
>
> "Notice the mall store inverts the rain response — that's the Store Context Agent tagging it
> `mall` and every downstream agent branching on that. A city-level weather app can't do that
> because it doesn't know which store is which."

---

## 3:50–4:10 — Export + honesty + close

> **Say:**
>
> "One last thing — the briefing is exportable as Markdown."

**Click:** the **"Export .md"** button on the Manager Briefing panel (switch back to a single
store if needed). Mention that the downloaded file is a complete shift-ready briefing with the
full trace appended.

> **Say:**
>
> "And to be upfront: this is a hackathon pilot-ready build, **not an official KFC product**.
> KFC branding and store names are used only in the F&B track context. The operational numbers
> are simulated by default — but the CSV seam is ready for real KFC POS data. The live weather
> is real when the network allows; the fallback is clearly labeled. NASA GPM IMERG, Meteostat,
> and METAR are planned — interfaces ready, ingestion pending. Advanced AI weather models like
> GraphCast, Aurora, and Earth2Studio are documented as future integration paths via our
> pluggable `WeatherModelProvider` interface — none are integrated. IoT and camera telemetry are
> roadmap, not in this build."

> **Say:**
>
> "To summarize: an 8-agent pipeline — Observe, Collect, Analyze, Plan, Recommend, Explain — that
> turns any weather signal into a per-store operations decision, with a full execution trace,
> weather provenance, a bilingual (EN/VI) 30-second manager briefing, a transparent data source
> registry, an honest fallback story, and pluggable adapter seams for real POS data and advanced
> weather models. The Agent Execution Trace panel is the moment this stops being a dashboard and
> starts being an agent. Thank you — questions?"

---

## Fallback framing (if LIVE badge is red)

If Open-Meteo is unreachable on the demo network, the Weather Signal panel will show a red
`FALLBACK` badge. **Do not panic — this is a designed feature, not a bug.** Frame it as a
strength:

> **Say:**
>
> "You'll notice the **FALLBACK** badge — the live Open-Meteo API isn't reachable from this
> network, so the adapter retried twice with exponential backoff, then fell back to a
> deterministic synthetic signal. This is a designed feature: the demo always works, and we
> never hide the degraded mode — look at the red badge, the trace's step 2 will show
> `dataSource: fallback`, the structured output will show the `fallbackReason` and a
> `reliabilityNote`, and the provenance strip will show `primaryMode: fallback`. The plan is
> still internally consistent; the confidence is just lower (around 68% instead of 90%). The
> fallback signal is also persisted as a `WeatherSnapshot` for audit. When the live API is
> reachable, the badge turns green automatically."

This actually demonstrates the **resilience** of the agent — a strong selling point with judges.

---

## Talking-point cheat sheet

| If a judge asks… | Say… |
|---|---|
| "Is the weather real?" | "Yes, when the network allows — Open-Meteo, free, no API key, per-store lat/lng, 6s timeout, 2-attempt retry, 5-min cache. See the green LIVE badge. Red FALLBACK badge = live unreachable, deterministic fallback kicks in. Every fetch persisted as WeatherSnapshot for audit." |
| "Is the demand / POS data real?" | "No by default — synthetic adapter. But there's a CSV seam at `public/sample-operations-data.csv` — replace it with a real KFC POS export of the same shape and the agent runs on real data. No code changes." |
| "What's the `planned` badge in the Data Sources panel?" | "NASA GPM IMERG (rain evidence), Meteostat (historical), METAR (city-level baseline). Interfaces are production-ready; live ingestion pending API key / heavy-data parser provisioning. We surface them honestly rather than hiding them." |
| "Are GraphCast / Aurora / Earth2Studio integrated?" | "No — none are integrated. They are documented as future integration paths via the same `WeatherModelProvider` interface that Open-Meteo uses today. See `ADVANCED_WEATHER_AI_INTEGRATION.md` for the honest feasibility assessment." |
| "Where does the LLM come in?" | "Two of eight agents — Risk Explanation and Manager Briefing. The other six are deterministic TypeScript. Both LLM agents have fallbacks; the trace shows `llm` vs `computed` per step. The Vietnamese translation of the briefing is deterministic — no second LLM call." |
| "Why is this agentic, not a dashboard?" | "It outputs a decision (prep %, staffing delta, campaign focus), runs an 8-step workflow with tool use via pluggable interfaces, threads provenance through the trace, and shows the full execution trace. A dashboard displays; this agent decides." |
| "How is this different for a mall vs a street store?" | "Store Context Agent tags store type; every downstream agent branches on it. The 3-store compare proves it — same weather, three different plans." |
| "Are you more accurate than weather apps?" | "No — and we don't claim to be. We claim: **Agent CaMate converts local weather and demand signals into actionable store operations plans.** Weather is the input; translation is the value." |
| "Is this an official KFC product?" | "No — hackathon pilot-ready build. KFC branding used only in the F&B track context. Operational numbers are simulated by default; the CSV seam is ready for real KFC data." |
| "How would you measure real pilot impact?" | "We wrote a full evaluation framework — `EVALUATION.md`. Seven metrics (food waste, stockout risk, staffing fit, delivery readiness, over-prep, under-prep, margin protection), three baselines (city weather app, fixed rules, Agent CaMate), A/B store-pair design, 2–4 week pilot, decision-quality survey. The before/after panel in the demo is labeled simulated; we show exactly how to replace it with real measured metrics." |
| "What's the roadmap?" | "Real KFC POS via the CSV seam; activate planned weather sources (IMERG / Meteostat / METAR); advanced AI weather models via the WeatherModelProvider seam; IoT / camera telemetry; closed-loop execution; A/B measurement; multi-day forecasting; multi-city." |

---

## Time budget summary

| Segment | Time |
|---|---|
| 0. The hook | 0:00–0:30 |
| 1. Single-store run (KFC Lê Lai) | 0:30–1:10 |
| 2. Bilingual moment — language toggle EN → VI | 1:10–1:35 |
| 3. Agent Execution Trace — the "agentic" moment (with provenance) | 1:35–2:10 |
| 4. Before/After — value claim | 2:10–2:40 |
| 5. Data Sources panel — full transparency | 2:40–3:10 |
| 6. 3-store compare — same weather, different plans | 3:10–3:50 |
| 7. Export + honesty + close | 3:50–4:10 |

**Total: ~4 minutes 10 seconds.** If you have only 3 minutes, trim segment 5 (Data Sources panel)
and segment 4 (Before/After) — the agent trace, the language toggle, and the 3-store compare are
the three un-cuttable moments. If you have 5 minutes, spend the extra 50 seconds expanding the
provenance object in trace step 2 and walking through the Data Sources panel in more detail.

# AGENT DEFINITION — Agent CaMate

> **Agent CaMate is not a weather chatbot. It is a StoreOps Decision Agent that turns weather and store operation signals into approved, evidence-backed actions for each KFC store.**

---

## What is an AI Agent?

An AI Agent is not a chatbot. In this project, an AI Agent is a decision-making system that:

1. **Observes** live and operational signals
2. **Reasons** toward a business objective
3. **Plans** an actionable course of action
4. **Acts** by creating briefings, checklists, and draft tasks
5. **Verifies** data quality, confidence, and fallback mode
6. **Reports** evidence and decision trace
7. **Learns** from manager feedback and post-shift outcomes

> **Agent = a system that knows how to work, not just how to talk.**

---

## The Agent Loop

```
Observe → Reason → Plan → Act → Verify → Report → Learn
```

In Vietnamese:

```
Quan sát → Suy luận → Lập kế hoạch → Hành động → Kiểm tra → Báo cáo → Cải thiện
```

### How Agent CaMate implements each phase

| Phase | What the agent does | Implementation |
|---|---|---|
| **Observe** | Fetch weather, store profile, POS/inventory/staffing baseline | `getWeatherSignalWithProvenance()` + `getOpsBaseline()` (sponsor → CSV → synthetic) |
| **Reason** | Predict rain-driven demand shifts, stockout/waste risk | `runDemandAgent()` + `runInventoryPrepAgent()` |
| **Plan** | Size prep batches, staffing, delivery readiness, campaign | `runStaffingAgent()` + `runCampaignAgent()` |
| **Act** | Create manager briefing, checklist, draft automation tasks | `runManagerBriefingAgent()` + `generateAutomationTasks()` |
| **Verify** | Check data source mode, confidence, fallback status | `Operations Baseline Agent` trace step + `DataSourceStatusBanner` |
| **Report** | Evidence trace, risk factors, approval requirements | `Agent Execution Trace` panel + `Risk Explanation Agent` |
| **Learn** | Compare forecast vs actual, log feedback (placeholder) | `Learning Agent (placeholder)` — TODO: wire actuals |

---

## 10 Golden Rules of an AI Agent

### 1. Agent must have a clear goal

**Goal:** Help KFC store managers make operations decisions based on weather and store data to reduce stockout, reduce waste, increase readiness, and protect customer experience.

### 2. Agent must use real data or clearly label demo data

Every number in the UI carries a provenance badge:

| Source | Badge | When |
|---|---|---|
| Weather | `Live` / `Fallback` | Open-Meteo API (6s timeout, deterministic fallback) |
| POS / Inventory / Staffing | `Live` / `CSV` / `Synthetic` / `Chưa có` | Sponsor API → CSV → SyntheticOpsAdapter fallback chain |
| Store location | `Verified` | Seed coordinates (geocoded) |
| Store capacity | `ESTIMATED` | Rule-based from store type (not real KFC data) |

### 3. Agent must call tools/APIs

- Open-Meteo Weather API
- Sponsor/Organizer API (POS/inventory/staffing) — via `SponsorOpsAdapter`
- CSV file fallback — via `CsvOpsAdapter` (fs/promises readFile)
- Prisma/SQLite database (agent runs, data source configs)
- Export briefing API (POST /api/briefing/export)
- Admin API (GET/POST /api/admin/sources, POST /api/admin/sources/test)

### 4. Agent must have trace/evidence

Every recommendation includes:
- **Why** the agent made this recommendation
- **What data** was used (source mode: live/csv/synthetic)
- **Confidence** score (0-1)
- **Data gaps** (what's missing to improve confidence)

Example from the Inventory & Prep Agent trace:
```
Input: Kitchen capacity 12 batches/hr | Delivery uplift 41% | Walk-in drop 29% |
       Heat risk 0.3 | Store type urban-street | Ops mode: csv | Chicken: 72kg | Bags: 168
Output: Chicken raw on hand: 72kg [csv]. Reduce early fried batch by 35% for lunch.
        Delivery bags on hand: 168 [csv] — increase usage by 41% for delivery surge.
```

### 5. Agent must have human approval

| Auto-allowed (low risk) | Requires approval (high risk) |
|---|---|
| Analyze data | Change staffing |
| Create checklist | Place supplier order |
| Draft briefing | Launch campaign |
| Flag risks | Send customer reply |
| Draft task | Change roster |

**Formula:** Agent recommends → Human approves → System executes.

### 6. Agent must have fallback

```
Sponsor API → CSV → Synthetic demo → Explain degraded confidence
```

When the sponsor API is not configured, the agent:
1. Tries `SponsorOpsAdapter` → throws (env vars not set)
2. Tries `CsvOpsAdapter` → throws (no CSV row) or returns CSV data
3. Falls back to `SyntheticOpsAdapter` → returns `mode="simulated"` baseline
4. Trace step 2.5 shows the attempts and which adapter succeeded
5. UI shows `Synthetic` badge in DataSourceStatusBanner

### 7. Agent must have state and context memory

- **Store selected** — persists in React state
- **Current run** — `AgentRunResult` in state, persisted to Prisma `AgentRun` table
- **Ops baseline mode** — `opsBaselineMode` field in run result (live/csv/simulated)
- **Agent run history** — `/api/agent/history` returns past runs from DB
- **Data source configs** — Prisma `DataSourceConfig` table

### 8. Agent must not overclaim authority

The agent says:
> "I don't have live POS data. I'm using CSV baseline. Confidence reduced."

NOT:
> "Based on real KFC data..." (when no API is connected)

### 9. Agent must optimize actions, not conversation

Primary outputs:
- Prep plan (batch sizing, inventory levels)
- Staffing plan (role assignment, shift deltas)
- Delivery readiness (packaging buffer, ETA)
- Inventory warnings (stockout, waste risk)
- Campaign recommendation (channel, creative, timing)
- Risk checklist
- Manager briefing (30-second TL;DR)

Chat ("Ask this plan") is a **secondary** view in the Advanced drawer — not the center.

### 10. Agent must measure outcomes

| KPI | Status | How |
|---|---|---|
| Forecast accuracy | TODO | Compare forecast vs actual orders (needs ActualResult model) |
| Stockout reduction | TODO | Track stockout events before/after agent |
| Waste reduction | TODO | Track waste units before/after agent |
| Delivery delay reduction | TODO | Track late orders before/after agent |
| Manager approval rate | TODO | Log approve/reject decisions per task |
| Revenue protected | TODO | Estimate revenue at risk vs revenue saved |

---

## Agent Checklist

```
[✓] Has a clear goal (reduce stockout, waste, increase readiness)
[✓] Has real input or clearly-labeled demo data
[✓] Has tool/API integration (weather, sponsor, CSV, DB, export)
[✓] Has multi-step planning (8-agent pipeline)
[✓] Has actionable output (prep, staffing, delivery, campaign, checklist)
[✓] Has evidence trace (Agent Execution Trace panel)
[✓] Has confidence score (per-agent + overall)
[✓] Has fallback when API fails (sponsor → CSV → synthetic)
[✓] Has human approval for risky actions (supplier order, campaign, staff change)
[✓] Has state/runId/history (Prisma AgentRun table)
[~] Has guardrails (partial — approval workflow exists, RBAC not yet)
[~] Has KPI evaluation (placeholder — Learning Agent labeled "placeholder")
[✓] Has simple UI for decision-making (3 main views + Advanced drawer)
```

**Score: 11/13 fully implemented, 2/13 partial.** This qualifies as a strong agent.

---

## Agent Roles in Agent CaMate

| # | Agent | Role | Output |
|---|---|---|---|
| 1 | Store Context Agent | Understand store type, location, customer behavior | Store profile, peak windows, constraints |
| 2 | Weather Signal Agent | Collect live weather + risk scores | Rain risk, heat risk, delivery disruption, walk-in drop |
| 3 | Operations Baseline Agent | Fetch POS/inventory/staffing baseline | Lunch/dinner orders, inventory levels, staffing count, **mode** |
| 4 | Demand Agent | Predict demand shift per slot | Walk-in delta, delivery delta, prep batch delta |
| 5 | Inventory & Prep Agent | Size prep batches, inventory, packaging | Prep quantity, stockout risk, waste risk, **real inventory numbers** |
| 6 | Staffing Agent | Size staffing per slot, assign roles | Staff count, role priority, **uses real baseline** |
| 7 | Campaign Agent | Recommend campaign focus + channel | Campaign type, creative, timing, budget |
| 8 | Risk Explanation Agent | Explain risk factors + confidence | Ranked risk factors, narrative reasoning |
| 9 | Manager Briefing Agent | Package everything into a 30-second briefing | Headline, TL;DR, top actions, watch items |
| 10 | Learning Agent (placeholder) | Record proposed actions for future comparison | TODO: compare forecast vs actual, adjust model |

---

## UI Layout for an Agent

```
Header: Store | Data mode | Run StoreOps Plan

Main:
  Today's Signals (weather, ops baseline, demand shift)
  Action Plan (prep, staffing, delivery, campaign)
  Evidence Trace (8-step agent reasoning)
  Approve / Export (manager briefing, task drafts)

Advanced drawer:
  Ask this plan (chat grounded in current run)
  Simulator (what-if exploration)
  Automation (task approval workflow)
  Live Monitor (realtime ops events)
  Knowledge Base (SOP documents)
```

Chat is NOT the center. The **plan** is the center. Chat is auxiliary.

---

## Pitch Line

**English:**
> Agent CaMate is not a weather chatbot. It is a StoreOps Decision Agent that turns weather and store operation signals into approved, evidence-backed actions for each KFC store.

**Vietnamese:**
> Agent CaMate không phải chatbot thời tiết. Đây là StoreOps Decision Agent, biến tín hiệu thời tiết và dữ liệu vận hành cửa hàng thành kế hoạch hành động có bằng chứng, có kiểm soát và có thể được manager duyệt.

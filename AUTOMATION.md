# AUTOMATION.md — Task Automation Agent & Approval Workflow

> Part of **Agent CaMate — StoreOps Autopilot** (Agentic AI Build Week 2026, F&B track).
> **Hackathon pilot-ready build. NOT an official KFC product.**

This document covers the **Task Automation Agent** (`src/lib/automation/taskAutomationAgent.ts`) and the **Approval Workflow** state machine (`src/lib/automation/approvalWorkflow.ts`) that gates every sensitive action behind a human decision.

For the safety policy itself, see [`HUMAN_APPROVAL_POLICY.md`](./HUMAN_APPROVAL_POLICY.md).
For the real-time risk signals that feed task generation, see [`REAL_TIME_DATA.md`](./REAL_TIME_DATA.md).

---

## 1. What the Task Automation Agent does

After the 8-agent decision pipeline (Observe → Classify → Diagnose → Simulate → Decide) and the Risk Intelligence Agent produce an `ActionPlan`, `ManagerBriefing`, and `RiskIntelligenceResult`, the Task Automation Agent converts those recommendations into **concrete draft artifacts** that a store team can act on:

- Markdown briefings ready to read out at the shift huddle
- Copy-paste checklists for opening, pre-lunch peak, and next-shift handover
- A draft Zalo group message to lunch-shift staff
- A draft supplier purchase order
- A draft campaign brief (channel, creative, timing, budget cap)
- An auto-generated incident report when critical alerts fire
- An end-of-day (EOD) summary template to capture actuals vs forecast
- A next-shift prep task list

Every artifact carries:

| Field | Purpose |
|---|---|
| `reason` | Why this task was generated (the trigger) |
| `dataUsed` | List of data sources/signals that informed it (e.g. `open-meteo`, `store-operating-profile`, `agent-action-plan`, `realtime-ops-events`, `inventory-data`, `risk-intelligence-agent`) |
| `confidence` | 0–1 confidence score inherited from the action plan or the source signal |
| `riskNote` | Human-readable risk classification ("Low risk — internal document" / "HIGH risk — commits a purchase order") |
| `approval.requiresApproval` | Boolean — does this need a human to approve before it can be executed? |
| `approval.approverRole` | `store-manager` (most) or `area-manager` (campaigns) |
| `approval.riskLevel` | `low` / `medium` / `high` |
| `auditLog` | Every state transition with `{at, action, by, note}` |

---

## 2. The 9 task categories and which are auto-approved vs need approval

The approval policy is defined in `approvalFor(category)` in `src/lib/automation/approvalWorkflow.ts`. Categories are split into **internal/draft** (auto-approved) and **external/impactful** (require human approval).

| # | Category | Auto-approved? | Approver | Risk level | Why |
|---|---|---|---|---|---|
| 1 | `briefing` | ✅ Yes | store-manager | low | Internal markdown — no external impact |
| 2 | `checklist` | ✅ Yes | store-manager | low | Operational checklist for internal use |
| 3 | `incident-report` | ✅ Yes (as draft) | store-manager | low | Internal report; *sharing externally* still needs approval |
| 4 | `end-of-day-summary` | ✅ Yes | store-manager | low | Internal template for capturing actuals |
| 5 | `staff-message` | ❌ No | store-manager | medium | Sends a real message to staff — manager must confirm wording |
| 6 | `manager-email` | ❌ No | store-manager | medium | Sends a real email to area manager |
| 7 | `supplier-order` | ❌ No | store-manager | high | Commits a purchase order — financial impact |
| 8 | `campaign` | ❌ No | area-manager | high | Launches a real campaign with spend + customer impact |
| 9 | `customer-reply` | ❌ No | store-manager | high | Sends a real reply to a customer — brand impact |
| 10 | `staff-roster-change` | ❌ No | store-manager | high | Changes staff roster — labour impact |

> Note: the `TaskAutomationAgent` currently generates tasks for categories 1–8 above (9 tasks in total per run, with `incident-report` only emitted when at least one critical alert is active). Categories `manager-email`, `customer-reply`, and `staff-roster-change` are defined in the policy and produced elsewhere (Smart Interaction Agent drafts customer replies; staff-roster-change and manager-email are reserved for future task generators). All categories share the same state machine and approval policy.

The engine's `automate` phase trace records exactly: **9 tasks generated, 3 require approval (staff-message, supplier-order, campaign), 6 auto-approved** — or fewer if no critical alert fires (incident-report is conditional).

---

## 3. The state machine

Every task lives in exactly one status at any time. The full lifecycle is:

```
                createTask()                submitForApproval()
   ┌─────────┐ ─────────────► ┌─────────┐ ───────────────────► ┌──────────────────┐
   │  (none) │                │  draft  │                      │ pending-approval │
   └─────────┘                └────┬────┘                      └────┬─────────┬───┘
                                  │ auto-approve                    │         │
                                  │ (non-sensitive)                 │ approve │ reject
                                  ▼                                 ▼         ▼
                              ┌─────────┐                      ┌─────────┐  ┌──────────┐
                              │approved │ ◄────────────────────┤approved │  │ rejected │
                              └────┬────┘                      └────┬────┘  └──────────┘
                                   │ execute                         │ execute
                                   ▼                                 ▼
                              ┌──────────┐                    ┌──────────┐
                              │ executed │                    │ executed │
                              └──────────┘                    └──────────┘
```

Status values:

| Status | Meaning |
|---|---|
| `draft` | Generated by the agent, awaiting review. Default state from `createTask()`. |
| `pending-approval` | Submitted for human approval via `submitForApproval()`. **Sensitive tasks only** — non-sensitive tasks skip this state and auto-approve in the same call. |
| `approved` | Approved (either by a human via `approve()`, or auto-approved at submit time for non-sensitive tasks). Ready to execute/export. |
| `rejected` | Rejected by a human via `reject(task, by, note)`. Terminal. |
| `executed` | Approved task was executed/exported/sent via `execute(task, by)`. Terminal. |
| `expired` | Reserved state for stale tasks that should be auto-expired (not yet auto-triggered in this build). |

Transitions are pure functions in `src/lib/automation/approvalWorkflow.ts`:

- `createTask(...)` → returns a `draft` task with `auditLog = [{at, action: "created", note: "Generated by Task Automation Agent"}]`
- `submitForApproval(task, by)` → either auto-approves (non-sensitive) or moves to `pending-approval` (sensitive). Audit entry: `"submitted-for-approval"` (or `"auto-approved"`).
- `approve(task, by)` → moves `pending-approval` → `approved`. Audit entry: `"approved"`.
- `reject(task, by, note?)` → moves `pending-approval` → `rejected`. Audit entry: `"rejected"` with optional note.
- `execute(task, by)` → moves `approved` → `executed` (no-op if not currently `approved`). Audit entry: `"executed"`.

---

## 4. The approval policy

### 4.1 Who approves what

| Action class | Approver role | Reason |
|---|---|---|
| Internal drafts (briefings, checklists, incident reports, EOD summaries) | n/a — auto-approved | No external impact |
| Staff messages, manager emails | `store-manager` | Manager confirms wording before it reaches staff |
| Supplier orders, roster changes, customer replies | `store-manager` | Manager owns financial, labour, and brand decisions at store level |
| Campaign launches | `area-manager` | Campaigns cross store boundaries and have area-level budget + brand implications |

### 4.2 Risk levels

| Risk level | Examples | Meaning |
|---|---|---|
| `low` | Briefing, checklist, incident report, EOD summary | Internal artifact — no approval needed to generate/export |
| `medium` | Staff message, manager email | Real communication but bounded audience; manager confirms wording |
| `high` | Supplier order, campaign, customer reply, roster change | Commits money, labour, customer-facing brand impact, or external commitment — must be approved |

### 4.3 Approver roles in code

```ts
export interface ApprovalRequirement {
  requiresApproval: boolean;
  reason: string;
  approverRole: "store-manager" | "area-manager";
  riskLevel: "low" | "medium" | "high";
}
```

`approverRole` is advisory in this build (the API accepts any `by` string), but it is recorded in the audit log so a real pilot can enforce it via SSO/role mapping.

---

## 5. The audit log structure

Every task carries an `auditLog` array. Each entry is:

```ts
{ at: string; action: string; by?: string; note?: string }
```

| Field | Type | Description |
|---|---|---|
| `at` | ISO timestamp | When the transition happened |
| `action` | string | One of: `created`, `submitted-for-approval`, `auto-approved`, `approved`, `rejected`, `executed` |
| `by` | string? | Who performed the action (`"auto"` for non-sensitive auto-approval; otherwise a role/username) |
| `note` | string? | Optional context (e.g. rejection reason, or `"Non-sensitive task"` for auto-approval) |

Example audit log for a sensitive supplier order that was approved and executed:

```json
[
  { "at": "2026-01-15T03:14:02.001Z", "action": "created", "note": "Generated by Task Automation Agent" },
  { "at": "2026-01-15T03:14:02.142Z", "action": "submitted-for-approval", "by": "store-manager" },
  { "at": "2026-01-15T03:18:11.902Z", "action": "approved", "by": "nguyen.van.a@kfcvn" },
  { "at": "2026-01-15T03:18:34.500Z", "action": "executed", "by": "nguyen.van.a@kfcvn", "note": "Task executed (exported/sent/applied)" }
]
```

For a non-sensitive checklist that auto-approved, the audit log is shorter:

```json
[
  { "at": "2026-01-15T03:14:02.001Z", "action": "created", "note": "Generated by Task Automation Agent" },
  { "at": "2026-01-15T03:14:02.142Z", "action": "auto-approved", "note": "Non-sensitive task" }
]
```

In a real pilot, the audit log is the **compliance trail** that proves no sensitive action was ever executed without explicit human approval (see [`HUMAN_APPROVAL_POLICY.md`](./HUMAN_APPROVAL_POLICY.md) §6).

---

## 6. Example task outputs

The Task Automation Agent generates these drafts each run. Bodies are truncated for readability — see `src/lib/automation/taskAutomationAgent.ts` for the full templates.

### 6.1 Daily Manager Briefing (auto-approved, low risk)

```markdown
# High rain risk at Nguyễn Huệ — protect dinner delivery, cut early batch

## TL;DR
- Rain risk 68% — walk-in drop expected at lunch
- Delivery surge +22% in dinner window
- Reduce early fried batch by 15%, pre-stage delivery packaging

## Top Actions
1. Cut 10:30 fried batch by 15%
2. Pre-stage +18% delivery packaging
3. Confirm 1 extra rider 17:30–20:30

## Watch Items
- Stockout risk for family bucket
- Waste if batch not adjusted

_Stay calm, prioritise packing speed over batch size._
```

### 6.2 Opening Checklist (auto-approved, low risk)

```
Opening Checklist — 15/01/2026 — KFC Nguyễn Huệ

- [ ] Confirm weather signal: rain risk 68%, walk-in drop 45%
- [ ] Prep philosophy today: Smaller early batches, refresh toward confirmed lunch demand...
- [ ] Early batch size: -15% vs baseline
- [ ] Packaging buffer: +18% delivery packaging
- [ ] Staff present vs scheduled (check staffing fit 78%)
- [ ] Inventory floor confirmed (chicken, buckets, cups, bags)
- [ ] Campaign focus: Delivery combo for rain window
- [ ] ETA buffer set +10min
- [ ] Waste log opened
```

### 6.3 Pre-Lunch Peak Checklist (auto-approved, low risk)

```
Pre-Lunch Peak Checklist — 15/01/2026

- [ ] Fried chicken batch ready (reduced 15% if rain)
- [ ] Delivery packaging pre-staged (+18%)
- [ ] Online-order packer assigned (1 dedicated)
- [ ] Rider confirmation via aggregator (1 extra rider 11:00-13:30)
- [ ] Sides (rice, coleslaw) at 80% of peak
- [ ] App push notification scheduled 10:30
- [ ] ETA buffer +10min
```

### 6.4 Staff Shift Note (needs approval, medium risk)

```
📣 LUNCH SHIFT NOTE — 15/01/2026

Team, today's lunch (Lunch peak):
- Walk-in -22%, delivery +18%
- 👉 1 dedicated online-order packer
- 👉 Walk-in drop expected — DON'T fry large batches early
- 👉 Delivery ETA buffer +10min — tell customers
- Campaign: Delivery combo for rain window

Let's have a smooth shift! 🍗
```

> ⚠️ This is a DRAFT. The Zalo message is **not** sent until the store manager approves the wording.

### 6.5 Supplier Order Draft (needs approval, high risk)

```
SUPPLIER ORDER DRAFT — 15/01/2026 — KFC Nguyễn Huệ

Chicken raw: URGENT — order 64kg
Buckets: URGENT — order 160 units
Cups: sufficient
Delivery bags: order 112 units (rain-adjusted)

Requested delivery: tomorrow before 09:00
Reason: stockout probability 58% — replenishment needed

⚠️ This is a DRAFT. No order is placed until the store manager approves.
```

### 6.6 Campaign Draft (needs approval from area-manager, high risk)

```
CAMPAIGN DRAFT — 15/01/2026 — KFC Nguyễn Huệ

Focus: Delivery combo for rain window
Creative: rainy-day cozy combo
Channel: delivery app push + SMS
Timing: push 10:30 (lunch), 16:30 (dinner)
Budget cap: 1.5x baseline

⚠️ This is a DRAFT. No campaign launches until the area manager approves.
```

### 6.7 Incident Report (auto-approved as draft, low risk; sharing externally needs approval)

```
INCIDENT REPORT — 15/01/2026 — KFC Nguyễn Huệ

Generated: 2026-01-15T03:14:02.001Z
Overall risk: 68%

## Critical Alerts
- [DELIVERY] Delivery surge exceeds forecast: Delivery is trending 38% above baseline... → Add 1 packing staff member now; pre-confirm extra rider via aggregator.

## Action Taken
- Plan adjusted (prep, staffing, campaign) per agent recommendation.
- Draft tasks generated for staff message, supplier order, and campaign.
- Manager notified.

## Follow-up
- Monitor metrics at next 15-min tick.
- File this report in the shift log.
```

### 6.8 End-of-Day Summary (auto-approved, low risk)

```
END-OF-DAY SUMMARY — 15/01/2026 — KFC Nguyễn Huệ

## Plan vs Actual
- Lunch walk-in forecast: -22% | Actual: ___
- Lunch delivery forecast: +18% | Actual: ___
- Dinner walk-in forecast: -8% | Actual: ___
- Dinner delivery forecast: +28% | Actual: ___

## Waste
- Estimated waste risk: 28% | Actual waste: ___

## Stockout
- Stockout probability: 58% | Actual stockouts: ___

## Staffing
- Staffing fit: 78% | Notes: ___

## Complaints
- Complaint risk: 52% | Actual complaints: ___

## Learnings for next run
- ___
```

The EOD template intentionally includes blank `___` fields — this is the **Learn phase** of the 9-step agent loop: actuals are filled in by the manager and fed back into the next run's calibration.

### 6.9 Next-Shift Prep Task (auto-approved, low risk)

```
NEXT-SHIFT TASKS — 15/01/2026

- Do NOT fry large batch before 10:45 (walk-in drop risk 45%)
- Prepare 28% extra delivery packaging for dinner
- URGENT: check family bucket stock before 17:00
- Confirm dinner staffing: +1 vs baseline
```

---

## 7. How to extend with new task categories

To add a new task category (e.g. `maintenance-request`):

1. **Add the category to the `TaskCategory` union** in `src/lib/automation/approvalWorkflow.ts`:
   ```ts
   export type TaskCategory =
     | ...
     | "maintenance-request";
   ```

2. **Add an `approvalFor` rule** for the new category. Decide whether it's auto-approved or needs approval, who approves it, and the risk level:
   ```ts
   case "maintenance-request":
     return { requiresApproval: true, reason: "Commits a maintenance vendor dispatch.", approverRole: "store-manager", riskLevel: "medium" };
   ```

3. **Add a task generator** in `src/lib/automation/taskAutomationAgent.ts`'s `generateAutomationTasks()`. Use `createTask({...})` and pass:
   - `category`, `title`, `description`, `content` (the draft body)
   - `reason` — why the task was triggered
   - `dataUsed` — list of data sources that informed it
   - `confidence` — 0–1
   - `riskNote` — human-readable risk description

4. **Verify the audit log** captures the `created` event automatically (it does — `createTask()` seeds the first entry).

5. **(Optional) Add UI rendering** in `src/components/dashboard/automation-center.tsx` if the new category needs a distinct icon or color.

The state machine, approval workflow, and audit logging apply uniformly to all categories — you only need to declare the policy and write the generator.

---

## 8. Integration plan for real Gmail / Slack / Google Sheets / POS

This pilot-ready build generates **drafts only**. Execution is currently a no-op state transition (`execute()` just marks the task `executed` and audit-logs it — it does not actually send an email, post to Zalo, or place an order). The audit trail is real; the delivery is not.

The intended production path is an **n8n-style workflow automation layer** that subscribes to the `executed` state transition and dispatches the artifact to the right channel:

| Task category | Production target | Mechanism (design only) |
|---|---|---|
| `briefing`, `checklist`, `incident-report`, `end-of-day-summary` | Google Sheets / Google Docs (store log) | n8n Google Sheets node appends a row; manager gets a permalink |
| `staff-message` | Zalo OA group / Slack #store-{id} | n8n HTTP request to Zalo OA API or Slack incoming webhook |
| `manager-email` | Gmail (manager ↔ area manager) | n8n Gmail node, BCC to area-manager alias |
| `supplier-order` | Supplier portal / EDI / email PO | n8n HTTP POST to supplier API (or Gmail PDF attachment fallback) |
| `campaign` | KFC VN CRM / app push console | n8n HTTP POST to internal campaign service — gated behind area-manager SSO |
| `customer-reply` | Zendesk / Freshdesk / in-app messaging | n8n HTTP POST to ticketing API; reply drafted by Smart Interaction Agent, approved by store-manager, sent by n8n |
| `staff-roster-change` | Workforce management system (e.g. Deputy / KFC WFM) | n8n HTTP POST to WFM API; changes audit-logged in both systems |

### 8.1 The integration seam

The `execute(task, by)` function is the **single integration seam**. In this build it returns the task with `status: "executed"` and an audit entry. In production it would also:

1. Emit an event to a queue (Kafka topic `automation.task.executed` — see [`REAL_TIME_DATA.md`](./REAL_TIME_DATA.md) §8 for the Kafka design).
2. An n8n workflow (or a small TypeScript worker) consumes the event, looks up the right connector by `category`, and performs the real action.
3. The connector writes back the external ID (email Message-ID, Zalo message ID, supplier PO number, CRM campaign ID, Zendesk ticket ID) into the task's `auditLog` as `{action: "executed", by, note: "externalId=..."}`.

### 8.2 What is explicitly NOT claimed as integrated

- Gmail, Slack, Zalo OA, Google Sheets, supplier portals, KFC CRM, Zendesk, and Deputy/WFM are **NOT** integrated in this build.
- n8n is referenced as the intended orchestration pattern; no n8n instance is bundled or deployed.
- The `execute()` function in this build only changes the task status and audit-logs the transition — it does not perform any external HTTP call.

### 8.3 Honesty contract for the pilot

For a real KFC pilot, the integration plan is:

1. **Phase 1 (this build):** Drafts + audit log + UI approval buttons. No external actions. Safe to demo.
2. **Phase 2 (next sprint):** Add one read-only integration (e.g. publish approved briefings to a Google Sheet) so managers can see the artifact land somewhere external. Still no email/message/order automation.
3. **Phase 3 (gated pilot):** Add the first *outbound* integration (staff-message → Zalo OA group) behind an explicit store-manager approval flow. Monitor for 2 weeks before adding more.
4. **Phase 4 (full pilot):** Add supplier-order, campaign, and customer-reply integrations. Each gated behind its own approver role per `HUMAN_APPROVAL_POLICY.md`.

---

## 9. API surface

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/automation/tasks` | POST | Generate the full task set for a store. Body: `{storeId}`. Returns `{tasks, profile, risk, generatedAt}`. |
| `/api/automation/approve` | POST | Approve/reject/execute a task. Body: `{task, action: "approve"\|"reject"\|"execute", by, note?}`. Returns `{task}` with updated status + audit log. |
| `/api/store-profile` | GET | Build the Store Operating Profile for a store (consumed by the automation agent). |

The approve endpoint is **stateless in this build** — the caller posts the full task object back and receives the transitioned task. In production this would be persisted to a `Task` table (the `auditLog` array is already designed to round-trip through JSON).

---

## 10. Honesty summary

- ✅ The Task Automation Agent **generates** real, useful draft artifacts grounded in the action plan + risk intelligence + store operating profile.
- ✅ The approval workflow state machine and audit logging are **real and enforced** — sensitive tasks cannot be auto-executed.
- ✅ Every task carries `reason`, `dataUsed`, `confidence`, `riskNote`, `approval`, and `auditLog` for full traceability.
- ⚠️ The `execute()` transition is currently a **state change + audit log only** — no real external action (Gmail, Slack, Zalo, supplier portal, CRM) is performed.
- ⚠️ n8n, Kafka, Gmail, Slack, Zalo OA, Google Sheets, and supplier/CRM connectors are **documented as the production integration path**, NOT integrated.
- ⚠️ This is a **hackathon pilot-ready build**, not an official KFC product.

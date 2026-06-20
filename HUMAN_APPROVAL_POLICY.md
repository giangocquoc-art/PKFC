# HUMAN_APPROVAL_POLICY.md — Safety Policy for the StoreOps Autopilot

> Part of **Agent CaMate — StoreOps Autopilot** (Agentic AI Build Week 2026, F&B track).
> **Hackathon pilot-ready build. NOT an official KFC product.**

This document is the **safety policy** that governs every action the StoreOps Autopilot takes. It defines what the system may do autonomously, what requires human approval, who approves what, how risk is classified, and how every decision is audit-logged.

For the implementation of the state machine, see [`AUTOMATION.md`](./AUTOMATION.md).
For the customer-reply draft rules, see also [`SMART_INTERACTION.md`](./SMART_INTERACTION.md) §5.

---

## 1. The core principle

> **No sensitive action executes without human approval.**

The StoreOps Autopilot is an **agent that drafts, recommends, and prepares** — not an agent that acts on the world without supervision. Concretely:

- The agent may **generate** any artifact (briefings, checklists, draft emails, draft orders, draft campaign briefs, draft customer replies).
- The agent may **auto-approve and export** internal artifacts that have no external impact (briefings, checklists, incident reports, EOD summaries).
- The agent **may not** send a real email, place a real supplier order, launch a real campaign, change a real staff roster, or send a real customer reply without an explicit human approval. Every such action sits in `draft` or `pending-approval` state until a human approves it.

This principle is enforced in code by the `approvalFor(category)` function in `src/lib/automation/approvalWorkflow.ts`, which is the single source of truth for what requires approval and who approves it. There is no bypass path.

---

## 2. Sensitive actions (require human approval)

The following categories **always require human approval** before execution. They cannot be auto-approved.

| Category | Approver | Risk level | Why sensitive |
|---|---|---|---|
| `supplier-order` | store-manager | high | Commits a purchase order — financial impact. A wrong order wastes money and inventory space. |
| `staff-message` | store-manager | medium | Sends a real message to staff (Zalo group). Wrong wording demoralises the team or miscommunicates the plan. |
| `manager-email` | store-manager | medium | Sends a real email to the area manager. Wrong content escalates incorrectly or wastes area-manager time. |
| `campaign` | area-manager | high | Launches a real campaign with spend + customer impact. Wrong channel/timing/budget wastes money and damages the brand. |
| `customer-reply` | store-manager | high | Sends a real reply to a customer. Wrong wording (e.g. promising a refund the system can't honour) creates legal/PR exposure. |
| `staff-roster-change` | store-manager | high | Changes the staff roster — labour impact. Wrong changes cause understaffing, overtime, or compliance issues. |

### 2.1 What "approval" means

Approval is a **state transition** in the audit-logged state machine (see §6). It is recorded with:

- `by` — the approver's identity (in production: SSO username; in this build: any string, defaulting to `"store-manager"`)
- `at` — ISO timestamp
- `note` — optional context (especially for rejections)

Approval is **per-task**, not blanket. Approving a supplier-order draft does not approve the next one. Each new draft starts in `draft` state and must traverse `submitForApproval()` → `approve()` → `execute()` independently.

### 2.2 What "execute" means (and doesn't mean)

In this pilot-ready build, `execute(task, by)` is a **state transition + audit log entry only**. It does NOT:

- Send a real email
- Post to a real Zalo group
- Place a real supplier order
- Launch a real campaign in the KFC VN CRM
- Send a real customer reply
- Push a roster change to the WFM system

The production integration path (n8n-style workflow automation, optionally backed by Kafka — see [`AUTOMATION.md`](./AUTOMATION.md) §8 and [`REAL_TIME_DATA.md`](./REAL_TIME_DATA.md) §9) is documented but **not implemented**. The audit trail is real; the delivery is not. This is intentional for a hackathon: the safety property (no sensitive action without approval) is fully enforced, while the operational risk of actually sending things is zero.

---

## 3. Auto-approved (non-sensitive) actions

The following categories **do not require human approval**. They are auto-approved at `submitForApproval()` time and can be exported/executed immediately.

| Category | Approver | Risk level | Why auto-approved |
|---|---|---|---|
| `briefing` | store-manager (advisory) | low | Internal markdown document. No external impact. The manager reads it; nothing is sent. |
| `checklist` | store-manager (advisory) | low | Operational checklist for internal use. No external impact. |
| `incident-report` | store-manager (advisory) | low | Internal report generated when critical alerts fire. Sharing externally still needs approval. |
| `end-of-day-summary` | store-manager (advisory) | low | Internal template for capturing actuals vs forecast. No external impact. |

### 3.1 Why these are safe to auto-approve

- **No external audience.** These artifacts stay inside the store team. They don't reach customers, suppliers, or area managers unless explicitly exported.
- **Reversible.** A wrong briefing can be ignored. A wrong supplier order cannot.
- **No financial/labour/brand commitment.** A checklist doesn't spend money, change rosters, or make brand promises.
- **The manager is the audience.** The manager who reads the briefing is the same person who would have approved it — so the approval step would be ceremonial.

### 3.2 The exception: sharing an incident report externally

The `incident-report` category is auto-approved as a **draft**, but the policy is explicit (in the `riskNote` field on the generated task): `"Low risk — internal report. Sharing externally needs approval."` If a manager wants to forward the incident report to the area manager or to KFC VN operations, that forwarding is a separate `manager-email` task that **does** require approval.

---

## 4. Approver roles

Two approver roles are defined:

### 4.1 `store-manager`

The store manager is the **primary approver** for most sensitive actions. They own:

- Staff messages (wording)
- Manager emails (escalation content)
- Supplier orders (financial commitment at store level)
- Customer replies (brand voice at store level)
- Staff roster changes (labour at store level)

The store manager is **on-site** (or reachable by phone) and has the operational context to make these calls.

### 4.2 `area-manager`

The area manager is the **approver for campaigns**. They own:

- Campaign launches (budget, creative, channel, timing)

The area manager approves campaigns because:

- Campaigns have **area-level budget implications** (multiple stores may share a budget pool).
- Campaigns have **brand consistency implications** that cross store boundaries.
- The area manager has the **cross-store visibility** to decide whether a campaign at store A cannibalises store B.

### 4.3 Role mapping in production

In this build, `approverRole` is advisory — the API accepts any `by` string. In production:

- The `by` field would be populated from SSO (e.g. `nguyen.van.a@kfcvn`).
- The Approval Workflow would check the user's role claim (e.g. via a JWT scope `role:store-manager` or `role:area-manager`) and reject approvals from users without the required role for the task's `approverRole`.
- A `store-manager` trying to approve a `campaign` task would be rejected with a 403.
- A `area-manager` trying to approve a `staff-message` task would also be rejected (campaigns are their only approval domain).

This role enforcement is **not implemented in this build** — it is the production hardening path. The policy is documented in code so the enforcement point is unambiguous.

---

## 5. Risk levels

Three risk levels, used to classify every task and to drive UI badges:

| Risk level | Color (UI) | Examples | Meaning |
|---|---|---|---|
| `low` | 🟢 Green | Briefing, checklist, incident report, EOD summary | Internal artifact — no approval needed to generate/export |
| `medium` | 🟡 Yellow | Staff message, manager email | Real communication but bounded audience — manager confirms wording |
| `high` | 🔴 Red | Supplier order, campaign, customer reply, roster change | Commits money, labour, customer-facing brand impact, or external commitment — must be approved |

### 5.1 How risk levels drive UI behaviour

In the Automation Center panel:

- `low`-risk tasks are rendered with a green badge and an "Export" button (no approval step).
- `medium`-risk tasks are rendered with a yellow badge and "Submit for approval" / "Approve" / "Reject" buttons.
- `high`-risk tasks are rendered with a red badge, the same approval buttons, plus a prominent warning text matching the `riskNote` field (e.g. `"HIGH risk — commits a purchase order. Manager must approve."`).

### 5.2 Risk levels are advisory, not gating

The risk level itself does not gate execution — the `requiresApproval` boolean does. A `low`-risk task has `requiresApproval: false`; a `medium` or `high` task has `requiresApproval: true`. The risk level is the **explanation** for why approval is (or isn't) required, surfaced to the human reviewer.

---

## 6. The audit log requirement

Every state transition on every task is audit-logged. This is **non-negotiable** and is enforced by the state machine — there is no path that changes a task's status without appending to the audit log.

### 6.1 Audit log structure

Each entry is:

```ts
{
  at: string;        // ISO timestamp
  action: string;    // "created" | "submitted-for-approval" | "auto-approved" | "approved" | "rejected" | "executed"
  by?: string;       // who performed the action ("auto" for auto-approval; otherwise SSO username)
  note?: string;     // optional context (rejection reason, "Non-sensitive task", external ID for execution)
}
```

### 6.2 What each action means

| Action | When it fires | `by` |
|---|---|---|
| `created` | `createTask()` generates a new draft | n/a (note: `"Generated by Task Automation Agent"`) |
| `submitted-for-approval` | `submitForApproval()` on a sensitive task | the submitting user |
| `auto-approved` | `submitForApproval()` on a non-sensitive task | `"auto"` (note: `"Non-sensitive task"`) |
| `approved` | `approve()` on a pending task | the approving user |
| `rejected` | `reject()` on a pending task | the rejecting user (note: optional rejection reason) |
| `executed` | `execute()` on an approved task | the executing user (note: `"Task executed (exported/sent/applied)"`) |

### 6.3 Why this matters for a real pilot

For a real KFC pilot, the audit log is the **compliance trail** that proves:

1. **No sensitive action was ever executed without explicit human approval.** A regulator or internal auditor can trace every `executed` entry back to its preceding `approved` entry, with a named approver and timestamp.
2. **Every rejection was logged with a reason.** This surfaces patterns (e.g. "the agent's supplier-order drafts are rejected 40% of the time — recalibrate the stockout-probability threshold").
3. **Every state transition is timestamped.** This enables SLA monitoring (e.g. "average time from `submitted-for-approval` to `approved` is 4 minutes — within the 15-minute target").
4. **The auto-approval decisions are explainable.** Every auto-approved task carries the note `"Non-sensitive task"`, so an auditor can verify the policy was applied correctly.

### 6.4 Persistence (production path)

In this build, the audit log lives on the `AutomationTask` object, which is stateless — the API receives the task, transitions it, and returns it. The audit log round-trips through JSON.

In production, the audit log would be **append-only persisted** to a `TaskAuditLog` table (or an append-only Kafka topic `automation.task.audit.v1`) so it cannot be retroactively modified. The Prisma schema already supports an `AgentRun` audit model; a `Task` model with a related `TaskAuditLog` model would mirror it.

---

## 7. The draft → submit → approve/reject → execute flow

The full lifecycle of a sensitive task:

```
   ┌─────────┐  createTask()  ┌─────────┐  submitForApproval()  ┌──────────────────┐
   │ (none)  │ ─────────────► │  draft  │ ─────────────────────► │ pending-approval │
   └─────────┘                └─────────┘                        └────┬─────────┬───┘
                                                                   approve    reject
                                  ┌──────────┐                       │         │
                                  │ rejected │ ◄─────────────────────┘         │
                                  └──────────┘                                 │
                                  ┌──────────┐                                 │
                                  │ approved │ ◄───────────────────────────────┘
                                  └────┬─────┘  approve()
                                       │ execute()
                                       ▼
                                  ┌──────────┐
                                  │ executed │
                                  └──────────┘
```

### 7.1 Step-by-step

1. **`createTask(...)`** — The Task Automation Agent generates a draft. Status: `draft`. Audit log: `[{action: "created", note: "Generated by Task Automation Agent"}]`.
2. **`submitForApproval(task, by)`** — A user (or the system on the user's behalf) submits the draft for approval.
   - If the task is non-sensitive (`requiresApproval: false`): auto-approved. Status: `approved`. Audit log appends `{action: "auto-approved", by: "auto", note: "Non-sensitive task"}`.
   - If the task is sensitive: moves to `pending-approval`. Audit log appends `{action: "submitted-for-approval", by}`.
3. **`approve(task, by)`** or **`reject(task, by, note?)`** — The approver reviews and decides.
   - Approve: Status: `approved`. Audit log appends `{action: "approved", by}`.
   - Reject: Status: `rejected` (terminal). Audit log appends `{action: "rejected", by, note}`.
4. **`execute(task, by)`** — An approved task is executed/exported. Status: `executed` (terminal). Audit log appends `{action: "executed", by, note: "Task executed (exported/sent/applied)"}`.

### 7.2 Non-sensitive shortcut

Non-sensitive tasks skip step 2's `pending-approval` state entirely. The `submitForApproval()` call auto-approves them in a single step, so the flow is:

```
draft → (submitForApproval auto-approves) → approved → (execute) → executed
```

The audit log still records both the `submitted-for-approval` and `auto-approved` entries — there is no silent path.

### 7.3 Rejection is terminal

A rejected task cannot be re-submitted. The agent will generate a fresh draft on the next run (with potentially different content if the inputs changed). This prevents "approval ping-pong" where a rejected task is repeatedly re-submitted with cosmetic changes.

In a future iteration, a `re-submit-with-edits` flow could be added (where the manager edits the draft and re-submits). For this build, the manager's options are: approve, reject, or wait for the next agent run.

---

## 8. Escalation rules

The system escalates to a human in three situations:

### 8.1 Smart Interaction Agent escalation (`escalateToHuman`)

When the Smart Interaction Agent's LLM response matches the escalation regex (`/escalate|don't have|not in (the )?context|no data/i`), the answer is returned with `escalateToHuman: true`. The Smart Interaction Panel UI shows a "🚨 Escalate to human" badge and offers a button to convert the answer into a `customer-reply` or `manager-email` task in the Automation Center (see [`SMART_INTERACTION.md`](./SMART_INTERACTION.md) §6).

### 8.2 Customer-reply special case (always escalate on fallback)

If the Smart Interaction Agent falls back to the deterministic path for a customer-role question, the answer **always** has `escalateToHuman: true` and `needsApproval: true`. The customer never receives an auto-generated reply — the worst case is a generic acknowledgement draft that the manager reviews.

### 8.3 Critical alert escalation

When the Risk Intelligence Agent detects a `critical`-severity anomaly (e.g. `stockoutProbability > 0.7` or `deliverySurge > 35`), the Task Automation Agent generates an `incident-report` task. The report's content explicitly includes `"Manager notified"` as an action taken, and the manager SOP (built-in knowledge document #7) instructs: `"Escalate any critical incident to area manager by phone."`

This escalation is **advisory** in this build — the system does not auto-dial the area manager. It surfaces the critical alert prominently in the Live Operations Monitor and the incident report, and the manager is expected to act on it per the SOP.

### 8.4 Approval timeout escalation (production path, NOT implemented)

In production, a `pending-approval` task that has not been decided within a configurable SLA (e.g. 15 minutes for `staff-message`, 30 minutes for `supplier-order`, 60 minutes for `campaign`) would auto-escalate:

- A reminder is sent to the approver (via Slack/Zalo).
- If still not decided after a second SLA window, the task is escalated to the next role (e.g. `store-manager` → `area-manager`).
- If still not decided, the task is moved to `expired` status and the agent re-generates a fresh draft on the next run.

This is **not implemented** in this build. It is the production hardening path.

---

## 9. Customer-reply special rules

Customer replies have the strictest rules in the system. They are a sub-case of §2 but deserve their own section because the brand-safety stakes are highest.

### 9.1 Never promise refunds

The Smart Interaction Agent's customer-role system prompt explicitly states:

> You CANNOT promise refunds, free items, or policy exceptions — if the customer asks for that, draft a reply that acknowledges and says a manager will follow up, and flag needsApproval=true.

This is reinforced by the Refund & Complaint Policy in the knowledge base (built-in document #4):

> Staff may NOT promise refunds, free items, or policy exceptions. For any complaint: (1) apologise, (2) log the complaint with order ID and reason, (3) escalate to store manager.

The two layers (system prompt + knowledge base) reinforce each other. Even if the LLM "tries" to promise a refund, the system prompt constrains it; and even if the LLM were jailbroken, the customer-reply task still requires `store-manager` approval before being sent — the manager would catch and reject any refund promise.

### 9.2 Never confirm unknown order status

The system prompt also states:

> Never confirm an order status you don't have data for.

The Smart Interaction Agent has **no access to the order management system** in this build. It does not know whether order #12345 is in the kitchen, with a rider, or delivered. Any answer that confirms a status would be a hallucination. The agent is instructed to defer: "A store manager will follow up with you shortly with an update."

In production, this rule would be relaxed only when a live order-management adapter is integrated — and even then, the agent would be constrained to quote the status verbatim from the system, not infer or predict.

### 9.3 Always draft, never send

Every customer-role `SmartInteractionAnswer` has `needsApproval: true`. The `draftReply` field contains the proposed reply; the `answer` field is `"(Draft reply — requires manager approval before sending)"`. The reply is **never** sent without an explicit `approve()` + `execute()` from a store manager.

### 9.4 The manager's review responsibilities

When reviewing a customer-reply draft, the manager checks:

1. **Tone** — is it polite and empathetic?
2. **Factual accuracy** — does it promise anything the system can't deliver?
3. **Status claims** — does it confirm an order status the manager can verify?
4. **Brand voice** — does it sound like KFC VN?
5. **Escalation need** — does this need to go to the area manager (e.g. a serious complaint)?

The manager can approve, reject (with a note), or — in a future iteration — edit the draft and re-submit.

---

## 10. Compliance + audit trail notes for a real pilot

For a real KFC VN pilot, this policy would be extended with:

### 10.1 Role-based access control (RBAC)

- SSO integration (Google Workspace or Azure AD) to populate `by` with real usernames.
- JWT scope claims (`role:store-manager`, `role:area-manager`) checked at the `/api/automation/approve` endpoint.
- Reject approvals from users without the required role for the task's `approverRole` (see §4.3).

### 10.2 Append-only audit persistence

- Persist `AutomationTask` and a related `TaskAuditLog` table to the database (Prisma schema extension).
- The `TaskAuditLog` table is **append-only** — no UPDATE or DELETE permissions for any role. INSERT only.
- Mirror to a Kafka topic `automation.task.audit.v1` for cross-system audit (e.g. Splunk, Elastic).

### 10.3 Approval SLAs and escalation

- Configurable SLAs per category (see §8.4).
- Auto-escalation to the next role on SLA breach.
- Auto-expiry to `expired` status on double-SLA breach.

### 10.4 Separation of duties

- The user who **submits** a task for approval should not be the same user who **approves** it (four-eyes principle).
- The user who **approves** a task should not be the same user who **executes** it (where execution has external impact).
- In this build, these separations are advisory. In production, they would be enforced by the RBAC layer.

### 10.5 Data retention

- Audit log entries retained for the duration of the pilot + 90 days (or per KFC VN data retention policy).
- Rejected tasks retained for analytics (rejection patterns inform agent recalibration).
- Executed tasks retained indefinitely as the compliance trail.

### 10.6 What is explicitly NOT claimed as implemented

- RBAC, SSO, JWT scope enforcement: **not implemented**.
- Append-only audit persistence: **not implemented** (audit log is in-memory on the task object).
- Approval SLAs and auto-escalation: **not implemented**.
- Separation of duties enforcement: **not implemented** (advisory only).
- Data retention policy: **not implemented** (no persistence).

The policy itself — what requires approval, who approves what, what the audit log records — **is implemented and enforced** in `src/lib/automation/approvalWorkflow.ts`. The production hardening on top of it is documented as the path forward.

---

## 11. Honesty summary

- ✅ The core safety property — **no sensitive action executes without human approval** — is **fully enforced in code** by the `approvalFor()` function and the state machine. There is no bypass path.
- ✅ The audit log **records every state transition** with timestamp, action, actor, and optional note.
- ✅ Customer replies **always require manager approval**, **never promise refunds**, and **never confirm unknown order status**.
- ✅ Approver roles (`store-manager`, `area-manager`) are **documented in code** and surfaced in the UI; the production RBAC enforcement point is unambiguous.
- ⚠️ The `execute()` step is a **state transition + audit log only** — no real external action (email, Zalo, supplier order, campaign, customer reply) is performed in this build.
- ⚠️ RBAC, SSO, append-only persistence, SLA auto-escalation, and separation-of-duties enforcement are **documented as the production hardening path**, NOT implemented.
- ⚠️ This is a **hackathon pilot-ready build**, not an official KFC product. The correct framing: "Agent CaMate converts local weather and demand signals into actionable store operations plans." — it does not claim to be more accurate than weather apps.

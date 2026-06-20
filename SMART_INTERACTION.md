# SMART_INTERACTION.md — Smart Interaction Agent

> Part of **Agent CaMate — StoreOps Autopilot** (Agentic AI Build Week 2026, F&B track).
> **Hackathon pilot-ready build. NOT an official KFC product.**

This document covers the **Smart Interaction Agent** (`src/lib/interactions/smartInteractionAgent.ts`): the three roles it plays (Manager Chat, Staff Assistant, Customer Support draft mode), how answers are grounded, the LLM call with deterministic fallback, the customer-reply draft policy, the `escalateToHuman` flag, source attribution, and the channel extension plan.

For the approval policy that gates customer replies, see [`HUMAN_APPROVAL_POLICY.md`](./HUMAN_APPROVAL_POLICY.md).
For the knowledge base that grounds answers, see [`KNOWLEDGE_BASE.md`](./KNOWLEDGE_BASE.md).

---

## 1. What the Smart Interaction Agent does

The Smart Interaction Agent is the conversational layer of the StoreOps Autopilot. It answers questions from three audiences:

1. **Store managers** — "Why is the plan cutting the lunch batch?" / "What's the delivery readiness for tonight?"
2. **Staff on shift** — "How much packaging should I prep?" / "What's my priority right now?"
3. **Customers** (in draft mode only) — "My order is late, what's happening?" — answered with a **draft reply that requires manager approval before it is ever sent**.

Every answer is **grounded** in:

- The **Store Operating Profile** (store type, time windows, channel mix, key risks, operating rules, prep philosophy, campaign bias)
- The **Weather Signal** (live or fallback, with risk scores)
- The **Action Plan** (overall risk, slot-level walk-in/delivery/prep/staffing deltas)
- The **Manager Briefing** (headline, TL;DR, top actions, watch items)
- The **Real-time Metrics + Alerts** from the Risk Intelligence Agent
- The **Knowledge Base** (retrieved snippets — see [`KNOWLEDGE_BASE.md`](./KNOWLEDGE_BASE.md))

The agent never hallucinates. If the context does not contain the answer, it says so and sets `escalateToHuman: true`.

---

## 2. The three roles and their system prompts

Defined in `systemPromptFor(role)` in `src/lib/interactions/smartInteractionAgent.ts`. The base system prompt is shared; each role gets an additional section that tunes tone, length, and boundaries.

### 2.1 Base prompt (all roles)

> You are the Smart Interaction Agent for Agent CaMate — a store operations autopilot for KFC stores in Ho Chi Minh City.
> You answer questions GROUNDED in the provided operational context (weather, action plan, real-time metrics, store profile). You do NOT hallucinate.
> If the context does not contain the answer, say so and suggest escalating to a human.
> Keep answers concise (max 120 words), practical, and store-manager friendly. No hype, no emojis.

### 2.2 Manager Chat

> You are answering a STORE MANAGER. Be direct, reference the data, and give a clear recommendation. If asked "why", explain the reasoning chain (weather → risk → decision).

- **Tone:** Direct, data-grounded, action-oriented.
- **Max length:** 120 words.
- **Boundaries:** Can discuss any operational topic in the context. Cannot promise refunds or external commitments (those go through the customer-reply role).

### 2.3 Staff Assistant

> You are answering a STAFF MEMBER on shift. Be very short (max 60 words), use simple bullet points, and focus on what they need to DO right now. No jargon.

- **Tone:** Short, action-first, simple language.
- **Max length:** 60 words.
- **Boundaries:** Only what the staff member needs to do right now. No strategy, no "why" — just "do this".

### 2.4 Customer Support (draft mode)

> You are drafting a reply to a CUSTOMER. Be polite, empathetic, and concise (max 80 words). You CANNOT promise refunds, free items, or policy exceptions — if the customer asks for that, draft a reply that acknowledges and says a manager will follow up, and flag needsApproval=true. Never confirm an order status you don't have data for.

- **Tone:** Polite, empathetic, concise.
- **Max length:** 80 words.
- **Boundaries (hard):**
  - **Never** promises a refund, free item, or policy exception.
  - **Never** confirms an order status the system doesn't have data for.
  - **Always** returns `needsApproval: true` and a `draftReply` field — the manager reviews and approves before the reply is sent.
  - If the customer asks for a refund or escalation, the agent sets `escalateToHuman: true` and drafts a "manager will follow up" reply.

---

## 3. How answers are grounded

The agent's `buildContext()` function packs the full operational state into a single string block that is sent to the LLM as the user message. The block contains:

| Block | Source |
|---|---|
| `STORE:` | `store.name` + `profile.operatingType` + `store.district` |
| `WEATHER:` | `weather.isLive` (LIVE/FALLBACK badge) + temperature + rain risk % + delivery disruption % + walk-in drop % |
| `PLAN:` | overall risk % + plan confidence % |
| `LUNCH:` | window label, walk-in delta, delivery delta, prep batch delta, staffing delta |
| `DINNER:` | same as lunch |
| `PREP:` | `plan.prepRecommendation` |
| `STAFFING:` | `plan.staffingRecommendation` |
| `DELIVERY READINESS:` | `plan.deliveryReadiness` |
| `CAMPAIGN:` | `plan.campaignRecommendation` |
| `REAL-TIME:` | walk-in trend %, delivery surge %, stockout prob %, staffing fit %, waste trend % |
| `ALERTS:` | all active alerts (title + severity) or "none" |
| `STORE RULES:` | `profile.operatingRules` joined with `\|` |
| `PREP PHILOSOPHY:` | `profile.prepPhilosophy` |
| `CAMPAIGN BIAS:` | `profile.campaignBias` |
| `BRIEFING HEADLINE:` | `briefing.headline` |

### 3.1 Knowledge base grounding

If the caller passes a `knowledge: KnowledgeSnippet[]` array (retrieved via the Document Intelligence Agent's `retrieve()` function — see [`KNOWLEDGE_BASE.md`](./KNOWLEDGE_BASE.md)), the snippets are appended to the system prompt:

```
RELEVANT KNOWLEDGE BASE SNIPPETS:
1. [built-in] Fried chicken must reach internal temperature 74°C...
2. [built-in] During rain, set ETA buffer +10 minutes...
```

The `/api/chat` route does this automatically — it calls `retrieve(question, 4)` before calling `answerQuestion()` so the LLM has both the live operational context AND the policy/SOP context.

### 3.2 The "answer grounded in context" instruction

The user message ends with:

> Answer grounded in the context above. If the answer is not in the context, say "I don't have that data — escalate to human" and set escalateToHuman=true.

This is the **anti-hallucination** guardrail. The LLM is told explicitly that "I don't know" is a valid answer, and that admitting ignorance triggers the escalation flag.

---

## 4. The LLM call with deterministic fallback

The agent uses `llmComplete()` from `src/lib/llm.ts` (the LLM Router wrapper) with a 12-second timeout.

### 4.1 Happy path (`mode: "live"`)

1. The LLM is called with the system prompt (role-specific + knowledge block) and the user message (context + question).
2. If the response is OK and non-empty, the answer is trimmed to 600 chars and returned.
3. A regex check (`/escalate|don't have|not in (the )?context|no data/i`) sets `escalateToHuman: true` if the LLM admitted it didn't have the answer.
4. The returned `SmartInteractionAnswer` has `mode: "live"`, `confidence: 0.82`, and sources populated.

### 4.2 Fallback path (`mode: "fallback"`)

If the LLM call fails (timeout, 429 rate limit, network error, or empty response), the agent falls back to a **deterministic retrieval-style answer** in `fallbackAnswer()`:

- The agent inspects the question for keywords (`prep`/`batch`/`chiên`, `why`/`tại sao`, `staff`/`nhân sự`, `waste`/`hao hụt`, `delivery`/`giao hàng`, `packaging`/`bao bì`, `priority`/`ưu tiên`).
- For each keyword match, it returns a templated answer built from the live context (action plan deltas, real-time metrics, prep philosophy).
- If no keyword matches, it returns a default answer referencing the briefing headline + top actions.

The fallback answer has `mode: "fallback"`, `confidence: 0.72`, and is **always honest** — the UI badges it as a fallback so the user knows the LLM was not used.

### 4.3 Customer role fallback special case

For the customer role, the fallback always returns:

- `answer: "(Draft reply — requires manager approval before sending)"`
- `draftReply:` — a short, safe acknowledgement ("Thank you for reaching out. I'm the Agent CaMate assistant. I've noted your message and a store manager will follow up shortly.")
- `needsApproval: true`
- `escalateToHuman: true`
- `mode: "fallback"`

This means: **even if the LLM is down, a customer never gets an auto-sent reply.** The worst case is a generic acknowledgement draft that still requires manager approval.

---

## 5. Customer reply draft mode

This is the most important safety property of the Smart Interaction Agent.

### 5.1 The hard rules

1. **Customer replies are NEVER auto-sent.** The `answerQuestion()` function returns `needsApproval: true` for every customer-role call. The actual reply lives in `draftReply` and must be approved by a store manager via the Approval Workflow (see [`HUMAN_APPROVAL_POLICY.md`](./HUMAN_APPROVAL_POLICY.md) §8).
2. **Customer replies NEVER promise refunds.** The system prompt explicitly forbids this: "You CANNOT promise refunds, free items, or policy exceptions". If the customer asks for one, the agent drafts a "manager will follow up" reply and sets `escalateToHuman: true`.
3. **Customer replies NEVER confirm unknown order status.** The prompt: "Never confirm an order status you don't have data for." The agent has no access to the actual order management system in this build — so it always defers.

### 5.2 Why this design

- **Brand safety:** an automated reply promising a refund or confirming an order status the agent cannot verify could create legal/PR exposure.
- **Manager accountability:** the manager is the human in the loop. They can edit the draft, add a coupon code, or escalate to the area manager before sending.
- **Auditability:** every draft + the approval decision is logged via the Approval Workflow's audit log (see [`AUTOMATION.md`](./AUTOMATION.md) §5).

### 5.3 What the manager sees

A customer-reply task in the Automation Center looks like:

```
Title:         Customer Reply Draft — Order #12345
Category:      customer-reply
Status:        draft
Risk level:    high
Approver:      store-manager
Content:       (the draft reply)
Reason:        Customer complained about late delivery during rain window.
Data used:     ["open-meteo", "store-operating-profile", "agent-action-plan",
                "realtime-ops-events", "knowledge-base"]
Confidence:    0.82
Risk note:     HIGH risk — sends a real reply to a customer — brand impact.
```

The manager can: (a) approve and execute (which would send the reply via the production connector — see [`AUTOMATION.md`](./AUTOMATION.md) §8), (b) reject with a note, or (c) edit the draft and re-submit. In this build, the execute step is a state transition only — no real email/SMS is sent.

---

## 6. The `escalateToHuman` flag

Every `SmartInteractionAnswer` carries `escalateToHuman: boolean`. It is set to `true` when:

1. The LLM response matches the escalation regex (`/escalate|don't have|not in (the )?context|no data/i`).
2. The role is `customer` and the fallback path was taken (always escalate customer fallbacks).
3. The question asks for something explicitly out of scope (refund, order status, policy exception) — the LLM is instructed to escalate rather than fabricate.

When `escalateToHuman: true`, the Smart Interaction Panel UI shows a clear "🚨 Escalate to human" badge and offers a button to convert the answer into a `customer-reply` (or `manager-email`) task in the Automation Center, pre-populated with the question and the draft reply.

---

## 7. Source attribution + confidence

Every `SmartInteractionAnswer` carries:

```ts
{
  sources: { label: string; value: string }[],
  confidence: number,         // 0.82 (live) or 0.72 (fallback) or 0.6 (customer fallback)
  mode: "live" | "fallback",
}
```

### 7.1 Sources populated

| Source label | Value example | When populated |
|---|---|---|
| Weather signal | `"live"` or `"fallback"` | Always |
| Action plan | `"risk 68%"` | Always |
| Real-time metrics | `"15 events"` | Always (live path) |
| Knowledge base | `"4 snippets"` | When `knowledge` array was passed |
| Prep recommendation | (truncated text) | Fallback path, manager role, prep question |
| Staffing recommendation | (truncated text) | Fallback path, manager role, staff question |
| Delivery readiness | (truncated text) | Fallback path, manager role, delivery question |
| Waste trend | `"28%"` | Fallback path, manager role, waste question |
| Risk factors | (top 3 risk factor labels) | Fallback path, manager role, "why" question |

### 7.2 Confidence levels

| Mode | Confidence | Meaning |
|---|---|---|
| `live` (LLM answered) | 0.82 | LLM produced a grounded answer — high but not 1.0 because LLMs can still drift |
| `fallback` (deterministic) | 0.72 | Templated answer from the live context — reliable but less nuanced |
| `fallback` (customer) | 0.60 | Generic acknowledgement — safe but uninformative; manager must follow up |

The confidence is intentionally **never 1.0**. The Smart Interaction Agent is a decision-support tool, not an authority.

---

## 8. Example Q&A for each role

### 8.1 Manager Chat

**Q:** "Why is the plan cutting the lunch batch?"

**A (live path):**
> The plan cuts the lunch batch by 15% because rain risk is 68% and walk-in drop risk is 45% — for an urban-center store, rain collapses walk-in sharply. Frying a full batch before 10:45 would create waste. Real-time prep utilization is 62% and waste trend is +28%, confirming the risk. The plan pre-stages delivery packaging (+18%) instead, because delivery surge is +22%.

**Sources:** Weather signal (live), Action plan (risk 68%), Real-time metrics (15 events), Knowledge base (2 snippets).

### 8.2 Staff Assistant

**Q:** "How much delivery packaging should I prep?"

**A (live path):**
> ✅ Prepare +18% delivery packaging.
> 👉 Pre-stage combo boxes at the packing station.
> 👉 1 dedicated packer for online orders 11:00–13:30.
> 👉 Don't fry a large batch before 10:45.

**Sources:** Weather signal (live), Action plan (risk 68%), Real-time metrics (15 events).

### 8.3 Customer Support (draft mode)

**Q (from customer):** "My order is 25 minutes late, where is it?"

**A (returned to the Smart Interaction Panel — NOT sent to the customer):**
> `answer:` "(Draft reply — requires manager approval before sending)"
> `draftReply:` "Hi, thank you for reaching out. I'm sorry your order is taking longer than expected. We're currently experiencing higher-than-usual order volumes due to weather in your area. A store manager will follow up with you shortly with an update. Thank you for your patience."
> `needsApproval:` true
> `escalateToHuman:` true
> `confidence:` 0.82
> `mode:` live

The manager reviews the draft, edits if needed, and approves it via the Approval Workflow. The reply is **never** sent automatically.

---

## 9. How to extend to more channels (Slack, Zalo, in-app)

The Smart Interaction Agent is channel-agnostic — it produces a `SmartInteractionAnswer` object. Channel-specific delivery is a separate concern, handled by the same n8n-style integration layer described in [`AUTOMATION.md`](./AUTOMATION.md) §8.

### 9.1 Slack

1. **Inbound:** A Slack Bolt app listens for `@Agent CaMateAI` mentions in `#store-{id}` channels. It calls `/api/chat` with `role: "manager"` (or `"staff"` for shift channels) and posts the answer back to the thread.
2. **Outbound (customer-reply):** When a manager approves a `customer-reply` task, the n8n workflow posts it to the channel the customer used (Slack Connect channel, Slack DM, etc.).

### 9.2 Zalo OA

1. **Inbound:** A Zalo Official Account webhook receives customer messages. The handler calls `/api/chat` with `role: "customer"` and stores the resulting draft reply as a `customer-reply` task in the Automation Center.
2. **Outbound:** When the manager approves the task, n8n calls the Zalo OA API to send the reply.

### 9.3 In-app (KFC VN app)

1. **Inbound:** The KFC VN app's in-app chat sends customer messages to `/api/chat` with `role: "customer"`.
2. **Outbound:** Approved replies are pushed back to the app's chat thread via the app's backend.

### 9.4 What is explicitly NOT claimed as integrated

- Slack, Zalo OA, and the KFC VN in-app chat are **NOT** integrated in this build.
- The Smart Interaction Panel in this build is the only UI surface — it calls `/api/chat` directly and renders the answer with source attribution + escalation flag.
- The channel-extension plan above is the **production design path**, not a current capability.

---

## 10. API surface

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/chat` | POST | Answer a question. Body: `{storeId, role: "manager"\|"staff"\|"customer", question}`. Returns a `SmartInteractionAnswer`. |

The `/api/chat` route:

1. Builds the Store Operating Profile.
2. Fetches the weather signal (with provenance).
3. Runs the full 8-agent pipeline to produce an `ActionPlan` + `ManagerBriefing`.
4. Runs the Risk Intelligence Agent to produce `RiskIntelligenceResult`.
5. Retrieves 4 knowledge snippets via `retrieve(question, 4)`.
6. Calls `answerQuestion()` with all of the above.
7. Returns the `SmartInteractionAnswer`.

This means every chat answer is **fully grounded in the current operational state** — there is no cached or stale context.

---

## 11. Honesty summary

- ✅ The Smart Interaction Agent **grounds every answer** in the Store Operating Profile, weather signal, action plan, briefing, real-time metrics, and knowledge base.
- ✅ The LLM call has a **deterministic fallback** that produces templated answers from the live context when the LLM is unavailable. The fallback is honestly badged.
- ✅ Customer replies are **always drafts requiring manager approval** — never auto-sent, never promising refunds, never confirming unknown order status.
- ✅ Every answer carries **source attribution + confidence + mode + escalateToHuman flag**.
- ⚠️ Slack, Zalo OA, and the KFC VN in-app chat are **documented as the production channel-extension path**, NOT integrated.
- ⚠️ The `execute()` step on an approved customer reply is a **state transition + audit log only** in this build — no real message is sent to any channel.
- ⚠️ This is a **hackathon pilot-ready build**, not an official KFC product. The correct framing: "Agent CaMate converts local weather and demand signals into actionable store operations plans." — it does not claim to be more accurate than weather apps.

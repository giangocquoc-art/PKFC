---
name: agent-camate-scenario-qa
description: Use this skill when testing Agent CaMate / P-KFC against the original hackathon scenario. It audits the full user flow, StoreOps agent behavior, UI, localization, API routes, approval flow, map, chat, Router API, and P-KFC API without changing code unless explicitly asked.
---

# Agent CaMate Scenario QA Skill

## Purpose

Test Agent CaMate against the original product scenario.

Agent CaMate is a StoreOps Decision Agent for KFC shift managers.

The original scenario is:

A shift manager selects a KFC store, runs a StoreOps plan, sees today's signals, receives evidence-backed recommended actions, reviews manager approval items, asks the agent questions about the current plan, exports a shift briefing, and can configure data/API/model sources from admin.

P-KFC API is the external API layer that allows other apps to ask Agent CaMate through authenticated endpoints.

## Golden rule

Do not edit code during the first pass.

First, audit and report:
- what works
- what is broken
- what is missing
- what is confusing
- what does not match the original scenario

Only edit files if the user explicitly asks to fix issues.

## Original user flow to test

### 1. App starts correctly

Run:

npm run build
npm run dev

Verify:
- App opens at /
- No fatal console errors
- No blank white screen
- No hydration crash
- No API route returning HTML when JSON is expected

### 2. Main dashboard scenario

The main dashboard must clearly show:

- Agent CaMate name
- Store selector
- Store map
- Primary CTA:
  - Vietnamese: Tạo kế hoạch vận hành
  - English: Run StoreOps Plan
- Data source strip
- Today’s signals
- Today’s action plan
- Manager approval required
- Evidence / Why Agent CaMate recommends this
- Ask Agent CaMate chat panel
- Export briefing
- Advanced section hidden or secondary

Fail if:
- Store map is missing or replaced by a blank area
- Chat panel is missing
- Approval panel is missing
- Evidence is hidden too deeply
- Main screen looks like only a chatbot
- Main screen looks like only a technical dashboard

### 3. Store selector and map

Test:
- Search store
- Change selected store
- Favorites if available
- Category filters if available
- Map updates when selected store changes

Expected:
- Store map is visible
- Google Maps keyless iframe embed is allowed
- No Google Maps API key should be required for current map
- If map fails, show fallback:
  - Vietnamese: Không tải được bản đồ nhúng. Bạn vẫn có thể mở vị trí trên Google Maps.
  - English: Embedded map could not be loaded. You can still open the location in Google Maps.

Fail if:
- Large blank area appears instead of map
- Admin/test requires GOOGLE_MAPS_API_KEY for current embed map
- Docs claim Leaflet/OpenStreetMap if code uses Google Maps embed

### 4. Run StoreOps Plan

Click:
- Vietnamese: Tạo kế hoạch vận hành
- English: Run StoreOps Plan

Expected:
- /api/agent/run is called
- A runId is created
- Today’s signals appear
- Today’s action plan appears
- Evidence appears
- Data source mode is visible:
  live / csv / demo / fallback
- Sensitive actions show manager approval required

Fail if:
- Plan is generated without runId
- Data source is hidden
- Demo/fallback data is shown as real KFC data
- Actions look executed instead of draft
- Approval-required actions are not visible

### 5. Approval flow

Expected approval wording:

Vietnamese:
- Cần quản lý duyệt
- Hành động nháp — cần quản lý duyệt
- Chờ duyệt
- Đã duyệt
- Đã từ chối

English:
- Manager Approval Required
- Draft action — manager approval needed
- Pending
- Approved
- Rejected

Approval item should show:
- action
- reason
- risk level
- confidence
- data source mode

Fail if:
- Approval is inferred only from random string includes without structured request
- UI says action was executed automatically
- Sensitive staffing/supplier/campaign changes do not require approval

### 6. Evidence trace

Expected:
- Human-readable evidence is visible
- Raw JSON/technical trace is hidden in Advanced
- Evidence explains why the action was recommended
- It references weather, demand, inventory, staffing, or data source where relevant

Fail if:
- User only sees raw JSON
- Evidence is too technical
- Evidence is missing
- Agent gives actions without reasons

### 7. Ask Agent CaMate

Chat panel must exist.

Before run:
Vietnamese:
Hãy tạo kế hoạch vận hành trước, sau đó bạn có thể hỏi Agent CaMate về kế hoạch này.

English:
Run a StoreOps plan first, then you can ask Agent CaMate about this plan.

After run:
Vietnamese:
Đang bám theo phiên chạy: <runId>

English:
Grounded in run: <runId>

Test:
- Ask: Vì sao cần chuẩn bị thêm túi giao hàng?
- Verify /api/chat receives explicit runId
- Verify answer is grounded in that run
- Verify it does not rerun the entire plan unless explicitly intended

Fail if:
- Chat has no runId
- Chat creates unrelated answer
- Chat hardcodes data source incorrectly
- Chat becomes the main product instead of helper

### 8. Export briefing

Test export briefing.

Expected:
- Briefing uses Agent CaMate / P-KFC branding
- No old brand:
  - KFC RainShift AI
  - Hyperlocal StoreOps Agent
- Briefing includes:
  - store
  - runId
  - signals
  - actions
  - approval items
  - evidence
  - data source mode
  - disclaimer

Disclaimer:
Independent hackathon demo. Not an official KFC product.

Fail if:
- Old brand appears
- Export claims official KFC product
- Export says real KFC POS data when using demo/csv/fallback

### 9. Admin integrations

Open:
/admin/integrations

Test sections:

1. Organizer / KFC API
2. Router API / AI Model Provider
3. P-KFC API
4. External data sources
5. CSV upload if available

Must separate clearly:

Sponsor/KFC API:
- operations data
- orders
- inventory
- staffing
- store signals

Router/LLM API:
- optional model provider
- Ask this plan
- explanation wording
- manager briefing language

Fail if:
- Router API is presented as sponsor/KFC API
- Old SDK API key is required
- Google Maps API key is required for current embed map
- API keys are shown in plain text
- Save configuration does not show success state

### 10. Router API / Model Provider

Test:
- Input endpoint base URL
- Input API key
- Load models
- Select model
- Test model
- Save configuration

Expected:
- Model list loads from OpenAI-compatible /v1/models or /models
- UI shows selected model
- Save configuration displays success state
- Full API key is never displayed
- VI mode shows Vietnamese only
- EN mode shows English only

Fail if:
- Save button does nothing
- API key is logged or displayed
- Mixed bilingual messages appear, such as English / Vietnamese in one string
- Missing key crashes the app

### 11. P-KFC API

Test endpoints:

GET /api/p-kfc/v1/profile

POST /api/p-kfc/v1/runs

POST /api/p-kfc/v1/chat

GET /api/p-kfc/v1/runs/[runId]

POST /api/p-kfc/v1/briefings/export

POST /api/p-kfc/v1/chat/completions

GET /api/p-kfc/v1/openapi.json

Expected:
- Auth works using:
  Authorization: Bearer <P_KFC_API_KEY>
  or x-p-kfc-api-key
- Unauthorized response is JSON
- Profile explains this is an independent hackathon demo
- Runs endpoint creates runId
- Chat endpoint grounds answer in runId
- Chat completions endpoint returns OpenAI-compatible shape
- OpenAPI endpoint returns valid JSON

Fail if:
- API exposes secrets
- API returns HTML error
- API claims official KFC product
- API bypasses approval/data-source honesty

### 12. Localization

Vietnamese mode:
Visible UI should be Vietnamese almost 100%.

Allowed terms:
API, CSV, JSON, runId, StoreOps, workflow, fallback, trace, demo, live, agent, model.

English mode:
Visible UI should be English almost 100%.

Fail if:
- Mixed bilingual messages appear
- Vietnamese mode still shows many English labels
- English mode shows Vietnamese labels
- Buttons are inconsistent

### 13. Data honesty

Always check wording.

Do not allow claims:
- production-ready
- official KFC product
- real KFC POS data
- fully autonomous KFC manager
- actions executed
- learning complete

Allowed wording:
- pilot-oriented prototype
- independent hackathon demo
- sponsor API-ready
- demo fallback
- CSV fallback
- manager approval required
- draft action
- evidence-backed recommendation

### 14. Repo cleanliness

Check final zip/source should not contain:
- node_modules
- .next
- .git
- .env
- build logs
- server logs
- duplicate archives
- tool-result folders
- pasted text files
- Chat app prompt leftovers in user-facing docs

Must contain:
- .env.example
- README.md
- DEVPOST_SUBMISSION.md
- AGENT_DEFINITION.md
- AI_DOCUMENTATION.md
- DATA_SOURCES.md
- HUMAN_APPROVAL_POLICY.md
- package.json
- prisma if used
- src
- public

### 15. Required final report

After audit, respond with:

1. Overall score out of 10
2. Pass/Fail by feature:
   - Build
   - Main dashboard
   - Store selector
   - Store map
   - Run StoreOps Plan
   - Approval flow
   - Evidence
   - Ask Agent
   - Export briefing
   - Admin integrations
   - Router API model discovery
   - P-KFC API
   - Localization
   - Repo cleanliness
3. Top 10 issues
4. Must-fix before Devpost submission
5. Nice-to-have after submission
6. Exact files likely involved
7. Do not edit anything unless the user asks

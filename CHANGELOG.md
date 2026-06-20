# CHANGELOG — Agent CaMate

## What became REAL vs still SIMULATED

### REAL (wired end-to-end)

| Feature | Status | Details |
|---|---|---|
| **Weather data** | ✅ LIVE | Open-Meteo API with 6s timeout + deterministic fallback. `src/lib/weather/open-meteo.ts` |
| **Operations Baseline Agent** | ✅ REAL | New trace step 2.5 fetches ops baseline (sponsor → CSV → synthetic). `src/lib/operations/getOpsBaseline.ts` |
| **SponsorOpsAdapter** | ✅ REAL | Implements `OperationsDataAdapter`. Reads `SPONSOR_API_BASE_URL` + `SPONSOR_API_KEY` env vars. `src/lib/operations/sponsorOpsAdapter.ts` |
| **getOpsBaseline() fallback chain** | ✅ REAL | Tries sponsor API → CSV → synthetic. Returns attempts trace. `src/lib/operations/getOpsBaseline.ts` |
| **Ops baseline in agent pipeline** | ✅ REAL | `runAgentPipeline()` accepts `opsBaseline` param. Demand + Staffing agents use real baselines instead of hardcoded 6. |
| **Admin API: /api/admin/sources** | ✅ REAL | GET (list) + POST (upsert). Stored in Prisma/SQLite `DataSourceConfig` table. Non-secret config only. |
| **Admin API: /api/admin/sources/test** | ✅ REAL | POST tests connection. Weather tests Open-Meteo, POS tests sponsor API, Maps tests Google key. Updates DB status. |
| **Healthcheck: GET /api** | ✅ REAL | Returns `{ status, service, timestamp, stores, dataSources, version }`. No more "Hello World". |
| **Prisma DataSourceConfig model** | ✅ REAL | Non-secret config persisted in SQLite. API keys in env vars only. |
| **.env.example** | ✅ REAL | Documents `SPONSOR_API_BASE_URL`, `SPONSOR_API_KEY`, `SPONSOR_API_MODE`, `SPONSOR_API_TIMEOUT_MS`, `GOOGLE_MAPS_API_KEY`, etc. |

### SIMULATED / DEMO (clearly labeled)

| Feature | Status | Details |
|---|---|---|
| **POS / Inventory / Staffing data** | ⚠️ SYNTHETIC | When `SPONSOR_API_*` env vars are not set, pipeline falls back to `SyntheticOpsAdapter` (mode="simulated"). Clearly labeled in trace. |
| **Demand model (walk-in/delivery deltas)** | ⚠️ COMPUTED | Weather-driven formula, not ML-trained on real KFC data. |
| **Before/After metrics** | ⚠️ SIMULATED | Comparison vs "no agent" baseline. Formula-based, not measured. |
| **Store kitchenCapacity / deliveryShare / dineInSeats** | ⚠️ ESTIMATED | Rule-based from store type. NOT real KFC operational data. |
| **LLM reasoning (Manager Briefing + Risk Explanation)** | ⚠️ FALLBACK | Uses LLM Router when configured; deterministic fallback when unavailable or rate-limited. |

### NOT YET IMPLEMENTED (roadmap)

| Feature | Status | Details |
|---|---|---|
| **Sponsor API actual connection** | 🔲 PENDING | `SponsorOpsAdapter.fetch()` is implemented but env vars must be set by the team. |
| **CSV upload to operations baseline** | 🔲 PENDING | `CsvOpsAdapter` reads from `public/sample-operations-data.csv`. Upload UI not wired to this adapter yet. |
| **Admin API key storage (encrypted)** | 🔲 PENDING | API keys are env-var-only. No DB storage of secrets. |
| **Field mapping UI → adapter** | 🔲 PENDING | Admin page shows field mapping form, but mapping is not yet applied in `SponsorOpsAdapter.fetch()`. |
| **Chat uses existing run (no re-run)** | 🔲 PENDING | Chat currently re-runs the pipeline. Should use `runId` to reference existing plan. |

---

## Changes in this sprint

### Fixed
- **`next.config.ts`**: Removed `typescript.ignoreBuildErrors: true`. Build errors must be fixed, not hidden.
- **`src/app/api/route.ts`**: Replaced "Hello World" with proper healthcheck JSON.
- **`src/app/admin/integrations/page.tsx`**: Fixed Back link to `/` (was `/admin` which doesn't exist).
- **`src/app/page.tsx`**: Fixed `const lang = useLang()` → `const { lang } = useLang()` (was always false for `lang === "vi"`).
- **`src/lib/operations/operationsAdapters.ts`**: Fixed duplicate `sources` identifier (private field + getter). Renamed to `sourceAdapters`.
- **`tsconfig.json`**: Added `examples`, `mini-services`, `skills` to exclude (was including socket.io examples).
- **`src/app/globals.css`**: Removed unused `leaflet/dist/leaflet.css` import (store-map uses Google Maps iframe, not Leaflet).
- **`src/components/dashboard/action-plan-panel.tsx`**: Fixed `factorIcon` → `FactorIcon` (React component casing).

### Added
- **`src/lib/operations/getOpsBaseline.ts`**: Fallback chain (sponsor → CSV → synthetic) with attempts trace.
- **`src/lib/operations/sponsorOpsAdapter.ts`**: Real implementation using `SPONSOR_API_BASE_URL` + `SPONSOR_API_KEY`.
- **`src/app/api/admin/sources/route.ts`**: GET (list) + POST (upsert) data source configs.
- **`src/app/api/admin/sources/test/route.ts`**: POST tests connection per source type.
- **`prisma/schema.prisma`**: Added `DataSourceConfig` model.
- **`.env.example`**: Documents all env vars.
- **`CHANGELOG.md`**: This file.

### Wired
- **`runAgentPipeline()`**: Now accepts `opsBaseline?: OpsBaseline` param. Added trace step 2.5 (Operations Baseline Agent).
- **`runDemandAgent()`**: Now accepts `opsBaseline`. Trace input/output includes ops mode.
- **`runStaffingAgent()`**: Now accepts `opsBaseline`. Uses `opsBaseline.staffing.lunch/dinner` instead of hardcoded 6. Trace includes `opsMode`.
- **`/api/agent/run`**: Fetches ops baseline via `getOpsBaseline()` before running pipeline. Returns `opsBaselineSource`, `opsBaselineMode`, `opsBaselineAttempts`.
- **`/admin/integrations`**: Now fetches from real `/api/admin/sources` API. Test/Save buttons call real endpoints.

## Sprint 2 — Agent framework honesty + UI simplification

### Fixed
- **DataSourceStatusBanner**: Now uses `result.opsBaselineMode` instead of hardcoded `"none"`. Supports "live", "csv", "simulated", "demo", "none" modes.
- **CSV adapter**: Replaced `fetch("/sample-operations-data.csv")` (client-side fetch on server) with `fs/promises.readFile` from `process.cwd()/public/`. Throws explicit error when no CSV row found — no longer silently returns profile-derived data labeled as "csv".
- **Export briefing**: Changed from `GET /api/briefing/export?storeId=...` to `POST /api/briefing/export` with body `{ result }`.
- **Smart Interaction → "Ask this plan"**: Renamed in ADVANCED_VIEWS label.
- **Learning Agent**: Labeled as "Learning Agent (placeholder)" with `placeholder: true` in structuredOutput. Added TODO array for ActualResult data model (actualOrders, actualWaste, actualStockout, managerFeedback, forecastError).
- **Inventory & Prep Agent**: Now accepts `opsBaseline` param. Uses `inventory.chickenRawKg`, `bags`, `baselineLunchOrders`, `baselineDinnerOrders` when available. Trace includes ops mode + actual inventory numbers.

### Added
- **`src/lib/client/fetchJson.ts`**: Safe fetch helper that reads `response.text()`, tries `JSON.parse`, throws clear error on HTML/non-JSON responses.
- **`src/lib/agent/runStoreOpsAgent.ts`**: Centralized agent runner — always does store → weather → getOpsBaseline → runAgentPipeline. Used by `/api/agent/run` and `/api/automation/tasks`.
- **Advanced drawer**: 3 main views (Today Plan, Area View, Advanced) + drawer for Simulator, Automation, Live Monitor, Ask this plan, Knowledge Base.

### Changed
- **UI simplified to 3 main views**: "Today Plan" (main flow), "Area View", "Advanced" (opens drawer with secondary views).
- **`/api/agent/run`**: Now uses `runStoreOpsAgent()` — single source of truth for the agent pipeline.
- **`/api/automation/tasks`**: Now uses `runStoreOpsAgent()` — same pipeline as agent run.

### Remaining issues
- Chat still re-runs pipeline (Task 7 — runId-based chat not yet implemented)
- `fetchJson` helper created but not yet wired into all client components
- `/api/compare` and `/api/simulate` not yet using `runStoreOpsAgent()`
- No Prisma `ActualResult` model yet (Task 9 TODO)

## Sprint 3 — LangGraph-style agent architecture

### Added
- **`src/lib/agent/storeOpsState.ts`**: Typed `StoreOpsState` with 20 fields (runId, store, weatherSignal, opsBaseline, demandShift, prepPlan, staffingPlan, campaignPlan, riskReview, approvalRequired, approvalStatus, briefing, trace, confidence, dataSources, errors, learningStatus). `createStoreOpsState()` + `appendTrace()` helpers.
- **`src/lib/agent/storeOpsWorkflow.ts`**: 12-node workflow (observeStoreContext → observeWeather → loadOperationsBaseline → reasonDemandShift → planPrepAndInventory → planStaffing → planCampaign → verifyRisksAndGuardrails → prepareManagerBriefing → requireHumanApproval → exportActions → recordLearningPlaceholder). Each node receives state, returns updated state, appends trace.
- **`src/lib/agent/tools/`**: 5 explicit tools (weatherTool, operationsTool, exportTool, approvalTool, learningTool). Each returns `{ ok, sourceMode, data, error, confidenceImpact, durationMs }`.

### Changed
- **`src/lib/agent/runStoreOpsAgent.ts`**: Now calls `runStoreOpsWorkflow()` (12 nodes) instead of directly calling `runAgentPipeline()`. Converts workflow state back to `AgentRunResult` for backward compat.
- **`src/app/api/chat/route.ts`**: Now "Ask this plan" — accepts `runId`, loads existing `AgentRun` from DB, answers grounded in current plan/trace/briefing. Does NOT re-run pipeline unless no existing run. Returns `groundedInRun`, `opsBaselineMode`, `dataSources` metadata.
- **README/DEVPOST/AGENT_DEFINITION**: Changed "pilot-ready" → "pilot-oriented prototype".

### Architecture patterns applied
1. **Stateful agent workflow** — `StoreOpsState` flows through 12 nodes
2. **Graph/node-based execution** — each node is a pure function (state → state)
3. **Tool/API calls** — 5 explicit tools with structured `ToolResult` returns
4. **Human-in-the-loop approval** — `node_requireHumanApproval` marks high-impact actions as `approvalRequired: true, approvalStatus: "pending"`
5. **Durable run state** — persisted to Prisma `AgentRun` table, recalled by `runId`
6. **Evidence trace** — each node appends `StoreOpsTraceItem` with agentName, phase, input, output, confidence, dataSource
7. **Fallback handling** — `operationsTool` tries sponsor → CSV → synthetic, returns honest `sourceMode`
8. **Final actionable output** — manager briefing, action plan, approval requests, export

## Sprint 4 — Finish remaining agent gaps

### Fixed
- **`/api/compare`**: Now uses `runStoreOpsAgent()` instead of calling `runAgentPipeline` directly.
- **`/api/simulate`**: Now uses `getOpsBaseline()` + `runAgentPipeline` with ops baseline. Documented reason for direct call (applies custom weather overrides that bypass normal observe phase).
- **`runId` wired**: `runStoreOpsAgent` returns `runId` in result. Page stores `currentRunId` in state. `SmartInteractionPanel` accepts + passes `runId`. `/api/chat` accepts explicit `runId` and loads that exact run. UI shows "Grounded in run: <short runId>".
- **Approval UI**: "Manager Approval Required" card surfaces when `state.approvalRequired` is true. Shows pending items (supplier order, campaign launch, staff change) with action, reason, risk level, confidence, data source mode. Approve/Reject buttons as UI placeholders.
- **`fetchJson` wired**: Replaced all `res.json()` calls in client components with `fetchJson<T>()` — typed, safe, throws clear error on HTML/non-JSON responses. Files: page.tsx, agent-runs-history-panel, area-manager-overview, automation-center, decision-simulator, knowledge-base-panel, smart-interaction-panel.
- **Dev script**: Changed from `next dev -p 3000 2>&1 | tee dev.log` to `next dev -p 3000` (Windows-compatible, no `tee`).
- **Build passes**: Fixed all TypeScript errors (unused @ts-expect-error, type mismatches in fetchJson generics, StoreOpsDataSource mode union, approvalRequired boolean coercion).

### Verified
- `bun run build`: ✅ passes (TypeScript strict mode, no ignoreBuildErrors)
- `bun run lint`: ✅ 0 errors
- GET /api: 200 (healthcheck)
- GET /: 200
- GET /admin/integrations: 200
- POST /api/agent/run: 200, runId returned, 22 trace items, opsMode=csv
- POST /api/chat: 200, groundedInRun=true, runId echoed
- POST /api/compare: 200, results array
- POST /api/simulate: 200, opsMode=csv, plan returned
- POST /api/admin/sources/test: 200 (weather: ok=false, honest failure)
- POST /api/briefing/export: 200

## Sprint 5 — Brand rename to Agent CaMate + UI bilingual polish

### Changed
- **Brand renamed**: "Agent CaMate" → "Agent CaMate" in i18n dictionaries (EN + VI), layout metadata, README, DEVPOST_SUBMISSION, AGENT_DEFINITION, CHANGELOG.
- **Vietnamese UI improved**: hero copy, product tagline, footer disclaimer, approval card title/buttons, "Grounded in run" label, "Export Briefing" button all bilingual.
- **English UI improved**: "Re-run agent" → "Run StoreOps Plan", hero copy updated to "Agent CaMate is not a weather chatbot."
- **Tab labels**: "Ask this plan" → VI: "Hỏi về kế hoạch này", "Area View" → VI: "Khu vực", "Live Monitor" → VI: "Theo dõi trực tiếp", "Knowledge Base" → VI: "Kho kiến thức".
- **.env.example**: Simplified to required vars only (DATABASE_URL, SPONSOR_API_*, GOOGLE_MAPS_API_KEY, LLM_API_KEY, LLM_API_BASE_URL).

### Verified
- `bun run lint`: ✅ 0 errors
- `bun run build`: ✅ passes
- All 9 endpoints pass: GET /api, GET /, GET /admin/integrations, POST /api/agent/run (returns Prisma runId), POST /api/chat (groundedInRun=true, exact runId match), POST /api/admin/sources/test, POST /api/briefing/export, POST /api/compare, POST /api/simulate.

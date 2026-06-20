# Hackathon Demo QA Skill

Use this skill before final demo, Devpost submission, Vercel deploy, or presentation recording.

## Demo goal

A judge should understand in 30 seconds:
Agent CaMate reads store data, detects F&B operations risk, recommends actions, and keeps human approval in the loop.

## 3-minute demo flow

1. Open dashboard.
Say: “This is an AI StoreOps Agent for KFC-style F&B operations.”

2. Run analysis.
Show:
- store context,
- weather signal,
- demand shift,
- inventory/prep recommendation,
- staffing recommendation.

3. Show evidence.
Open:
- Bằng chứng & phân tích,
- Agent trace,
- data source mode.

4. Ask chat.
Question:
“Rủi ro vận hành lớn nhất hôm nay là gì?”

Expected answer:
- rain risk,
- walk-in drop,
- delivery surge,
- prep/staffing action,
- confidence.

5. Show approval.
Show:
- campaign needs approval,
- staff change needs approval,
- sensitive actions are drafts.

6. Close:
“This is not just a chatbot. It is a grounded, approval-aware store operations agent.”

## Pre-demo checklist

Must pass:
- npm run lint
- npm run build
- Vercel deploy works
- /api/agent/run works
- /api/chat uses Gemini
- providerMode = router
- modelUsed = gemini-2.5-flash-lite
- no API key in repo
- no .env committed
- UI does not show raw JSON
- user-facing copy is Vietnamese
- demo data is labeled

## If something fails

If Gemini fails:
- fallback must still answer honestly;
- UI must show “Chế độ dự phòng”;
- do not pretend Gemini is working.

If Supabase fails:
- show clear error;
- do not fake a saved run.

If weather fails:
- use fallback mode and label it.

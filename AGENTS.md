# Agent CaMate Project Rules

You are working on Agent CaMate, an AI StoreOps Agent for F&B/KFC-style store operations.

## Product goal

This is not a generic chatbot. It is an AI operations assistant that:
- reads store context, weather, operations baseline, inventory, staffing and approval state;
- detects operational risks;
- explains why the risk exists;
- recommends actions;
- requires human approval before sensitive actions;
- answers manager questions based on the current run data.

## Non-negotiable rules

1. Do not fake data.
If data is missing, say it is missing.

2. Do not show mock/demo data as real data.
If demo or CSV data is used, label it clearly.

3. Do not expose secrets.
Never put API keys, database passwords, ADMIN_TOKEN, Gemini key, Supabase key, or env values in code, logs, UI, screenshots, docs, or commits.

4. Do not break deploy.
Before finishing, run:
- npm run lint
- npm run build

5. Do not change core business logic unless the task asks for it.
Prefer small, focused fixes.

6. UI visible to users should be Vietnamese by default.
Technical internal names may remain in code, but visible copy should be Vietnamese.

7. Keep the answer flow grounded.
User question + current run data + Gemini = professional operational answer.

8. Human approval is required before:
- campaign launch,
- staff roster change,
- supplier order,
- customer-facing message,
- financial or labor-impacting action.

## Correct chat answer format

Kết luận nhanh:
...

Bằng chứng:
...

Đề xuất hành động:
...

Mức độ tin cậy:
...

## Bad behavior to avoid

- Generic chatbot answer not tied to run data.
- Raw JSON dumped into UI.
- English UI labels in production view.
- “Fallback Mode” showing when Gemini is actually configured.
- Long trace shown to users unless they explicitly open technical trace.
- Making claims not supported by the run context.

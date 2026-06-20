# Grounded Gemini Chat Skill

Use this skill when editing /api/chat, Gemini routing, smart interaction UI, or manager Q&A.

## Goal

The chat must work like this:

User question + current AgentRun data + clean context + Gemini = grounded operational answer.

## Required backend flow

1. Receive:
- runId
- message
- role
- language

2. Validate:
- If runId is missing, return a friendly message asking the user to run analysis first.
- If runId is not found, say the current run cannot be found.
- If message is greeting only, answer briefly and offer help.

3. Load context from the run:
- store name
- store type
- weather signal
- rain risk
- delivery disruption risk
- walk-in drop risk
- operations baseline
- inventory recommendation
- prep recommendation
- staffing recommendation
- campaign recommendation
- approval required
- approval status
- top risks
- 3 to 5 short trace evidence lines

4. Do not send raw full JSON to Gemini.
Summarize the context first.

5. Gemini system instruction:
You are Agent CaMate, a store operations assistant for F&B/KFC-style shifts.
Only answer from CONTEXT.
Do not invent data.
If data is missing, say what is missing.
Respond in Vietnamese.
Be professional, friendly, concise and useful.

6. Gemini answer format:
Kết luận nhanh:
Bằng chứng:
Đề xuất hành động:
Mức độ tin cậy:

## Required API response shape

/api/chat should return only:

{
  "answer": string,
  "providerMode": "router" | "fallback",
  "modelUsed": string,
  "confidence": number,
  "sources": array,
  "warning": string | null
}

Do not return the full run object to the chat UI.

## UI rules

- If providerMode is router, show “Đang dùng Gemini”.
- If providerMode is fallback, show “Chế độ dự phòng”.
- Never show fallback badge by default before asking.
- Never render raw JSON.
- User-visible labels must be Vietnamese.
- Keep message bubbles readable.

## Fallback rule

Fallback is allowed only when:
- Gemini key is missing,
- Gemini request fails,
- run context is unavailable,
- rate limit or provider error occurs.

Fallback answer must still be useful and must clearly say it is based on rules, not Gemini.

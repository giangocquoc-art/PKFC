# Project Agent Instructions

Before making any change, always read:

- AGENTS.md
- .agents/skills/*/SKILL.md

Follow those rules strictly.

Core requirements:
- Do not edit randomly.
- Do not fake data.
- Do not expose secrets.
- Do not commit `.env`, API keys, database passwords, ADMIN_TOKEN, Gemini keys, or Supabase secrets.
- Keep user-facing UI in Vietnamese.
- For chat flow: user question + current AgentRun data + clean context + Gemini = grounded operational answer.
- Do not show raw JSON in user chat.
- Sensitive business actions require human approval.
- Before finishing, run:
  - npm run lint
  - npm run build

If data is missing, say it is missing. Do not pretend.

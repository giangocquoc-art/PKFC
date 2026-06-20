---
name: agent-camate-visual-media-director
description: Use this skill when improving Agent CaMate visual design, UI polish, Devpost screenshots, demo media, presentation pages, and hackathon submission visuals. It focuses on red/white KFC-inspired design, clean storytelling, screenshot-ready layouts, and a distinctive product identity without breaking agent logic.
---

# Agent CaMate Visual Media Director Skill

## Purpose

Make Agent CaMate look polished, memorable, and submission-ready.

This skill should be used when improving:

- UI visual design
- Devpost screenshots
- project media gallery
- demo presentation pages
- red/white visual identity
- screenshot-friendly layouts
- hackathon judge experience
- first 10-second product impression

Agent CaMate should feel like a real vertical StoreOps agent product, not a generic chatbot, not a messy technical dashboard, and not an AI-generated scaffold.

## Product identity

Product name:

Agent CaMate

Tagline:

Vietnamese:
Agent CaMate — Trợ lý đồng quản lý ca cho cửa hàng KFC

English:
Agent CaMate — StoreOps Decision Agent for KFC shift managers

Core idea:

Weather, order, inventory, staffing, and store signals go into Agent CaMate.
Agent CaMate produces an evidence-backed shift action plan with manager approval.

## Visual direction

Use a polished red-and-white system inspired by fast-food operations.

Color direction:

- Primary red: #E4002B
- Deep red: #B00020
- Soft red background: #FFF5F6
- White card: #FFFFFF
- Text: #171717
- Muted text: #666666
- Border: #F1D5D9 or #E5E7EB
- Approval/warning: amber
- Success/ready: green
- Info/data source: blue or cyan, used sparingly

Avoid:

- dark developer dashboard
- too many badges
- too many shadows
- huge empty whitespace
- raw JSON in main UI
- mixed English/Vietnamese labels
- generic SaaS template feel
- official KFC logo misuse unless already legally included
- fake real KFC claims

## Distinctive art direction

Agent CaMate should have its own recognizable visual language:

1. Red command center
2. White operational cards
3. Bento-style summary panels
4. Evidence chips
5. Approval stamps
6. Store shift timeline
7. Agent workflow ribbon
8. Small operation icons:
   - rain
   - delivery bag
   - chicken bucket / meal prep
   - staff
   - inventory box
   - approval stamp
   - map pin
   - API plug
   - runId / trace

Use icons lightly. Do not clutter.

## Main dashboard design goals

The main dashboard must answer within 10 seconds:

Vietnamese:
Hôm nay cửa hàng cần làm gì, và vì sao?

English:
What should this store do today, and why?

The page should clearly show:

1. Agent CaMate header
2. Store selector
3. Store map
4. Primary CTA:
   Vietnamese: Tạo kế hoạch vận hành
   English: Run StoreOps Plan
5. Shift readiness summary
6. Today’s top actions
7. Manager approval required
8. Why Agent CaMate recommends this
9. Ask Agent CaMate
10. Export briefing
11. Advanced hidden by default

Do not remove map, chat, evidence, or approval for the sake of minimalism.

## Screenshot-ready mode

When asked to prepare Devpost media, create or improve screenshot-ready sections.

Preferred route if useful:

/media-kit
or
/demo-media

This route should not replace the main app.
It can be a static/presentation view using real app structure and safe demo data.

It should create 3:2 screenshot-friendly panels:

1. Hero screenshot
Title:
Agent CaMate

Subtitle:
StoreOps Decision Agent for KFC shift managers

Visual:
Store selector + map + Run StoreOps Plan button

2. Action plan screenshot
Title:
Today’s Shift Plan

Visual:
Signals → top actions → data source mode

3. Approval screenshot
Title:
Manager Approval Required

Visual:
Draft action, reason, confidence, risk, approve/reject buttons

4. Ask Agent screenshot
Title:
Ask Agent CaMate

Visual:
Question, grounded answer, runId, Router API/model badge

5. Admin/API screenshot
Title:
Data & Model Provider Hub

Visual:
Organizer/KFC API, Router API, P-KFC API, OpenAPI schema

6. Agent workflow screenshot
Title:
Observe → Reason → Plan → Verify → Approve → Report

Visual:
Simple horizontal workflow with tool/data icons

All screenshot panels should be clean, big, readable, and export-friendly.

## Devpost media rules

Devpost image gallery should use 3:2 ratio.

Each screenshot should be understandable without explanation.

Recommended image order:

1. Hero dashboard
2. Today’s action plan
3. Approval + evidence
4. Ask Agent CaMate
5. Admin integrations / Provider Hub
6. P-KFC API / OpenAPI

Avoid uploading screenshots that show:

- blank map
- fallback-only empty chat
- broken layout
- raw JSON
- localhost errors
- console errors
- mixed language strings
- exposed API keys
- old brand names

## UI polish checklist

Before finishing a visual pass, check:

- Header looks like a real product
- Primary CTA is obvious
- Cards have consistent spacing
- There is no giant blank area
- Store map is visible
- Ask Agent panel shows answer text, not only badge
- Approval card is clear
- Evidence is human-readable
- Technical trace is collapsed
- Data source mode is visible
- Red/white theme is consistent
- Vietnamese mode is Vietnamese
- English mode is English
- Buttons use consistent style
- Mobile/tablet does not break

## Copywriting style

Vietnamese should sound natural:

Good:
- Chuẩn bị thêm túi giao hàng trước giờ trưa vì rủi ro mưa đang cao.
- Đề xuất này cần quản lý duyệt vì có thay đổi nhân sự.
- Đang dùng dữ liệu demo dự phòng vì API ban tổ chức chưa kết nối.
- Câu trả lời đang bám theo phiên chạy hiện tại.

Bad:
- Agent đã operationalize heuristic dịch chuyển nhu cầu khí tượng.
- Successfully verified connection / Kết nối thành công.
- 8 agent luồng.

English should be polished:

Good:
- Prepare more delivery bags before lunch because rain risk is high.
- This recommendation needs manager approval because it changes staffing.
- Using demo fallback because the organizer API is not connected.

Bad:
- Operationalized meteorological demand-shift heuristics.

## Brand honesty

Never claim:

- official KFC product
- production-ready
- real KFC POS data
- fully autonomous KFC manager
- actions executed automatically
- learning complete

Use:

- independent hackathon demo
- pilot-oriented prototype
- sponsor API-ready
- demo fallback
- manager approval required
- draft action
- evidence-backed recommendation

## API and model visuals

When showing APIs visually, separate:

1. Organizer / KFC API
Operations data:
orders, inventory, staffing, store signals

2. Router API / AI Model Provider
Natural-language explanation:
Ask Agent, briefing, model provider

3. P-KFC API
External access:
other apps can ask Agent CaMate

Do not show full API keys.
Use masked key display only.

## What to improve when asked to make it “đẹp hơn”

Prioritize:

1. Clear layout
2. Better hierarchy
3. Stronger red/white identity
4. Screenshot-ready panels
5. Bigger readable cards
6. Less technical clutter
7. Better iconography
8. Better empty/loading/error states
9. Clean 3:2 media output
10. Stronger storytelling for judges

Do not add heavy animation unless it improves clarity.

## What not to do

Do not:

- rewrite backend logic
- break runId grounding
- break StoreOps workflow
- remove approval flow
- remove evidence
- remove map
- remove Ask Agent
- hide data source mode
- add fake store data
- expose keys
- use official KFC marks beyond what the project already has rights to use

## Testing

Run:

npm run build

Manual visual checks:

- /
- /admin/integrations
- /media-kit or /demo-media if created
- Vietnamese mode
- English mode
- mobile width
- screenshot 3:2 layout

## Final response format

When done, reply only:

1. Files changed
2. Visual improvements
3. Media/screenshot improvements
4. Localization improvements
5. Build result
6. Remaining visual gaps

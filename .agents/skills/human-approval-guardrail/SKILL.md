# Human Approval Guardrail Skill

Use this skill when editing automation, approval, action cards, tasks, campaign, supplier, staffing, or export logic.

## Principle

Agent CaMate can recommend, draft and explain. It must not silently execute sensitive business actions.

## Actions requiring approval

Require manager approval before:
- launching a campaign,
- changing staff roster,
- sending staff instructions,
- sending customer-facing messages,
- placing supplier orders,
- changing operating budget,
- sending external exports,
- making labor or financial decisions.

## Approval object should include

- action type
- title
- reason
- risk level
- expected impact
- data source
- created time
- status: draft / pending-approval / approved / rejected
- approvedBy if approved
- approvedAt if approved
- rejectionReason if rejected

## UX rules

Action cards must clearly show:
- what the AI recommends,
- why,
- evidence,
- risk level,
- button: Duyệt,
- button: Từ chối,
- button: Sửa trước khi duyệt.

## Forbidden

- Auto-approving sensitive actions.
- Hiding that approval is needed.
- Showing “executed” when the action is only a draft.
- Creating fake approval logs.

## Correct wording

Use:
- “Đề xuất”
- “Bản nháp”
- “Cần quản lý duyệt”
- “Chưa thực thi”

Avoid:
- “Đã triển khai”
- “AI đã quyết định”
- “Tự động chạy chiến dịch”

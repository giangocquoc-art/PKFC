# F&B Data Quality Skill

Use this skill when editing data adapters, CSV import, Supabase/Prisma, weather adapters, run context, or trace.

## Rule

Data quality is part of the product. The user must understand where the answer comes from.

## Source modes

Use clear source mode labels:
- live: real external API/data source
- csv: uploaded or bundled CSV data
- demo: intentionally simulated data for demo
- computed: calculated from available data
- missing: unavailable
- fallback: rule-based fallback

## Data source display

Every major result should be able to answer:
- Where did this data come from?
- How fresh is it?
- How confident is it?
- Is it live or simulated?
- What should the manager verify?

## Missing data behavior

If sponsor API is not configured:
- do not pretend it is configured;
- use CSV/demo fallback only with label;
- mention that real POS/sponsor API would improve accuracy.

If actual end-of-day data is missing:
- do not say the AI has learned;
- say “Chưa có dữ liệu cuối ngày để AI học.”

## Encoding

All user-visible Vietnamese must be valid UTF-8:
- KFC Lê Lai
- Quận 1
- Rủi ro mưa
- Dịch chuyển nhu cầu
- Chưa có dữ liệu cuối ngày để AI học
- 11:30–13:30

Do not allow mojibake:
- LÃª Lai
- Quáº­n
- Rá»§i ro
- ChÆ°a cÃ³
- â13:30

## Trace

Trace should be concise by default.
Full technical trace should be hidden behind “Xem nhật ký kỹ thuật”.

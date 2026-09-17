# Release evidence — Studio › Templates

| | |
|---|---|
| Parent section / route | Studio · `/{type}/studio` |
| Sub-tab / route | Templates · `/{type}/studio/templates` (`?selected=`, `?range=7\|30\|90`, filters) |
| Required plan / flag | Studio `templates` module |
| Roles tested | Owner (browser) |
| Reference | `designs/Universal Sections/Studio/templates.png` @ 1491 × 1055 |
| Score | **85 / 100** |
| Decision | **Ready for admin-only beta** |

## Tested (browser)
KPIs, filters (Channel, Category, Owner, Status, Filters), grid/list, popular template cards (Preview, Duplicate, Use template, favourite, status menu), all-templates table + pagination, quick actions (Create, Import JSON/CSV, Request review, Guidelines), template preview + **Full preview** dialog, template performance (cumulative uses chart; uses / drafts created / published vs previous window), template details, Edit / Use template split.

## Business rules (server)
Status workflow draft → in review → approved / changes requested → published → archived, with `approveTemplates` / `publishTemplates` capabilities; publish requires approval; cover image must be a workspace media asset; duplicate-name check on create; archived templates cannot be used.

## Bugs fixed
Stretched first card cover; clipped card buttons; truncated KPI values; spiky sparse chart (now cumulative, labelled); range select clipped; missing Full preview link.

## Outstanding
Import tested by code review only (1 MB cap, 50 rows, per-row validation); placeholder values in the preview are shown raw (`{{product}}`) by design.

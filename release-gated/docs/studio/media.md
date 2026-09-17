# Release evidence — Studio › Media

| | |
|---|---|
| Parent section / route | Studio · `/{type}/studio` |
| Sub-tab / route | Media · `/{type}/studio/media` (`?selected=<id>\|none`, `?collection=`, `?type=`, `?status=`, `?tag=`, `?owner=`, `?view=grid\|list`, `?size=`) |
| Required plan / flag | Studio `media` module; storage quota `limits.storageBytes` |
| Roles tested | Owner (browser) |
| Reference | `designs/Universal Sections/Studio/media.png` @ 1491 × 1055 |
| Score | **87 / 100** |
| Decision | **Ready for admin-only beta** |

## Tested (browser)
KPI strip (month-over-month), collection chips + More + New collection, filters, grid/list, sort, asset cards, detail panel (favourite, large preview, Details / Metadata / History / Versions), **Crop** (end-to-end: `UI Kit.png` cropped to 16:9 → 1000 × 563, version 2, original kept in versions, activity "replaced"), Replace, Download (signed URL), Approve split menu, all-assets table with bulk Approve / Move / Archive, pagination + page size, upload rail (drop zone, folder), activity, asset picker.
Design layout: detail panel overlaps the table title bar exactly as in the design (explicit grid placement).

## Storage / files
R2 private bucket; uploads via signed PUT under `studio/{workspace}/`; `finaliseMediaUpload` re-reads real size/type from R2; crop reads and writes server-side with `sharp` (JPEG/PNG/WebP/AVIF, ≤ 40 MB, workspace prefix check, archived assets blocked); storage paths stripped before rows reach the client.

## Bugs fixed
Server page calling a client helper; grid auto-placement collapse; mobile footer overflow; MIME-based type filter (shared table uses a different `file_type` taxonomy); duration badge overflow.

## Outstanding
Malicious-file scanning is `scan_state: pending` (no scanner wired); per-role negative tests.

# Advertising — manual actions for the owner

These are the steps Claude Code could not complete from inside the repo.

## 1. Fix the Cloudflare R2 access key (blocks R2 uploads)

**Symptom:** R2 rejects requests with `InvalidArgument: Credential access key has length 29, should be 32`.
The `CLOUDFLARE_ACCESS_KEY_ID` in `.env.local` is truncated or is the wrong kind of token.
Until it is fixed, creative uploads automatically use the private Supabase `ad-creatives` bucket, so nothing is broken for users.

1. Cloudflare dashboard → **R2** → **Manage R2 API Tokens** → **Create API token**.
2. Permission: **Object Read & Write**, scoped to the `caption-fox` bucket only.
3. Copy the **Access Key ID** (32 characters) and **Secret Access Key** (64 characters). Cloudflare shows the secret only once.
4. In `.env.local` (and in Vercel → Project → Settings → Environment Variables), set:
   - `CLOUDFLARE_ACCESS_KEY_ID=<32-char key id>`
   - `CLOUDFLARE_SECRET_ACCESS=<64-char secret>`
   - Leave `CLOUDFLARE_R2_S3_API` and `CLOUDFLARE_S3_BUCKET` as they are (they are correct).
5. Restart `npm run dev` / redeploy.

## 2. Allow browser uploads to the R2 bucket (CORS)

Browsers upload directly to R2 with signed URLs, which needs a CORS rule on the bucket.
Cloudflare → R2 → `caption-fox` → **Settings** → **CORS Policy** → add:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3004", "https://<your-production-domain>"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

Keep the bucket **private** (no public r2.dev URL). The app only ever serves signed, 10-minute URLs.

## 3. Connect real ad platforms

The pages currently show **development seed data** (`scripts/seed-advertising-demo.mjs`, every row flagged `is_demo`).
To show live data, each workspace connects its own platform apps: Advertising → Accounts → **Connect Source**, then follow the per-platform developer-app steps shown in the dialog.
To remove the demo data from a workspace, re-run nothing: delete rows where `is_demo = true` for that workspace (the seed script's `clearWorkspace` shows the exact order).

## 4. Decision needed: Advertising on Creator / Business workspaces

CLAUDE.md now says build rules apply "across all workspace types". The entitlement resolver currently gives Advertising to **Brand and Agency** workspaces only (`src/lib/advertising/entitlements.ts`, `ADVERTISING_SURFACES`).
If Creator and/or Business should have it, add them to `ADVERTISING_SURFACES` — one line; every page, action and the sidebar follow automatically.

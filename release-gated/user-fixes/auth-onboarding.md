# Manual steps — Authentication, Registration & Onboarding

## Blockers (do before release)

### 1. Custom SMTP (sign-up verification is capped at 2 emails/hour)
The Supabase built-in mailer allows only 2 emails an hour across the **whole project**, so real sign-ups will fail.

1. Open Supabase → Project `crazahobtmpipzxbkckf` → Authentication → Emails → SMTP Settings.
2. Enable custom SMTP (for example Resend: host `smtp.resend.com`, port 465, user `resend`, and your API key as the password).
3. Set the sender to a verified Caption Fox domain address.
4. Raise the email rate limit under Authentication → Rate Limits.

### 2. Run the admin MFA end to end with a real platform admin
Admin access now needs a password **and** an authenticator code (AAL2) on every session.

1. Go to `/admin-login` and enter your admin email and password. Leave the code field blank.
2. Scan the QR code shown with an authenticator app, then enter the 6-digit code. You should land on `/admin`.
3. Sign out, then sign in again using the code. Confirm that an `admin.login.success` row appears in `audit_logs`.

Existing admin sessions now redirect to `/admin-login?reason=mfa` until they complete this. **Store backup access**: if your authenticator is lost, remove the factor in Supabase → Authentication → Users → your user → MFA factors.

### 3. Production build, lint and Lighthouse
On 15 Sep the build ran out of memory twice while the shared dev server was running. Only about 2.9 GB of 16 GB RAM was free, and ESLint crashed the same way.

1. Stop every `next dev` process, including the one on port 3004.
2. Run `npm run build`, or push and let Vercel build it.
3. Run `npx eslint src/components/onboarding src/components/auth`.
4. Restart the dev server and run a Lighthouse accessibility audit on `/login`, `/signup` and one `/onboarding/{type}`. The target score is 98 or higher.
5. Fix anything these report.

## Recommended

4. **Google sign-in (optional).** Enable Google under Authentication → Providers with your OAuth client, and add `https://caption-fox.vercel.app/callback` as a redirect URI. Then set `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true` in Vercel. Until you do, the Google buttons stay hidden.
5. **Affiliate approval.** Go to `/admin/affiliates` and approve the pending QA application from `qa.creator.0915@example.com`. Then sign in as that user at `/affiliates/login` and confirm the portal shows the referral link.
6. **Legal review.** Have `/legal/affiliate-terms` reviewed. It reflects the implemented rules: 30% of first payment, 10% override, manual approval and GBP payouts.
7. **Accessibility and responsive checks.** Run Lighthouse or axe on the 10 pages. Capture screenshots at 1280, 1024, 768, 430 and 360, and in installed-PWA mode.

## QA data created during testing (delete when finished)
All users share the password stored in the session scratchpad and use `@example.com`, so no mail was sent.

- **Users:** `qa.creator.0915@example.com`, `qa.business.0915@example.com`, `qa.brand.0915@example.com`, `qa.agency.0915@example.com`, `qa.supplier.0915@example.com` and `teammate.qa@example.com`. Delete them in Supabase → Authentication → Users, which cascades their profiles.
- **Workspaces owned by those users:** "Alex Smith", "Acme Co.", "Acme Co", "BrightSide Media". Delete these first: `delete from workspaces where owner_id in (select id from profiles where email like 'qa.%.0915@example.com');`
- **Records:** the supplier profile "Luna Creative Co." and one pending affiliate application.
- **Storage:** objects under `onboarding-uploads/<qa uid>/`, `media/suppliers/<qa uid>/`.

## Rollback notes
- To undo the auth config changes, reset site URL, redirect allow-list and password minimum in Authentication → URL Configuration and Policies.
- The migrations add columns, triggers, RPCs and policies. To roll back in an emergency, drop the triggers `trg_guard_profile_privileges`, `trg_guard_workspace_billing`, `trg_guard_supplier_trust_fields`, `trg_guard_affiliate_fields` and `trg_guard_affiliate_application_fields`. **Warning: dropping them reopens the privilege-escalation holes.**
- Backup: this area writes profiles, workspaces and billing-adjacent fields. Keep PITR enabled on the project.

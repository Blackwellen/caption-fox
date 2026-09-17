# Remaining release checks — 17 September 2026

The requested GitHub push does not certify the whole application as release-ready.

- Resolve the remaining repository-wide ESLint findings (`npm run lint`).
- Run authenticated route, action, RLS and responsive/PWA audits described in the section release documents.
- Check deployment migration history and apply any pending migrations through the project's migration workflow before relying on new database fields. This task did not apply migrations.

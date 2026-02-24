# Findings - Ultimate Report Dashboard

## Discovery & Research
*This file will document all discoveries, research findings, and constraints encountered during the project.*

### Initial State
- Project appears to be a Next.js application.
- Integrations detected: Supabase, Google Ads, GA4, SEO metrics.
- Many script files (`check-*.js`, `verify-*.js`) suggest ongoing work on data verification.

### Backfill Script Analysis
- `scripts/backfill-metrics.ts`: Uses internal `/api/admin/run-rollup` API. Dependent on server running.
- `scripts/nightly-metrics-rollup.ts`: Likely the cron core, but needs validation.
- `scripts/gbp-backfill.ts`: Specifically for Google Business Profile.
- **Improved Tool:** `gemini/tools/backfill_engine.ts` now provides a deterministic, server-less way to backfill data directly to Supabase.

### Pilot Run Discovery (2026-02-23)
- **Target Date:** 2026-02-21
- **Success:** 18 clients processed and upserted to Supabase.
- **Permission Error:** `User does not have sufficient permissions for this property` detected for some GA4 properties. Service account `analysis-api@uplifted-triode-432610-r7.iam.gserviceaccount.com` needs access added to those GA4 properties.
- **Accuracy:** `gemini/tools/data_validator.ts` confirmed real data points (e.g., $83.34 total spend, 4 total leads for the day).

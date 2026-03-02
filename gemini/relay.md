# 🏁 Gemini Relay - Change History

This file tracks significant architectural decisions, major bug fixes, and system maintenance tasks to ensure continuity between AI sessions.

---

## 📅 [[2026-03-01]] - Complete Data Backfill + Timezone Fix + sync-ga4 Improvements

### 🛠 Changes

#### Phase 1: Cron Endpoint Updates
- **All 4 sync endpoints** now accept `?date=YYYY-MM-DD` for backfill support
- **sync-ga4 improvements**:
  - Added `?clientId=UUID` parameter to sync a single client (60s timeout vs 20s default)
  - Replaced silent `.catch(() => [])` with `fetchWithRetry` (logs errors, retries once)
  - Added `fetchGA4SessionsAggregate` fallback — when 3-dimension query returns 0 rows (possible GA4 thresholding), retries with no dimensions to get aggregate data
- **Timezone fix**: All endpoints now use `America/Los_Angeles` (California) timezone for "yesterday" calculation instead of UTC

#### Phase 2: Full Data Backfill
- **Scripts created**:
  - `scripts/data_audit.mjs` — comprehensive audit across all raw tables
  - `scripts/backfill-all-gaps.mjs` — identifies gaps and calls sync endpoints via Vercel
  - `scripts/fix-all-gaps.mjs` — targeted fix for specific client+date gaps
- **Backfill results**: 423 GA4 dates, 54 Ads dates, all GBP gaps filled via real API data

#### Phase 3: ChiroSolutions GA4 Full Backfill
- User added service account `analysis-api@uplifted-triode-432610-r7.iam.gserviceaccount.com` to GA4 property 310677662
- Synced 414 dates (2025-01-01 to 2026-02-28) — all 414 successful, 414 rollups successful
- ChiroSolutions now has complete data

#### Phase 4: Zero-Traffic Day Resolution
- 9 single-day GA4 gaps across 6 clients confirmed as genuine zero-data days
- Verified 3 ways: batch sync, single-client sync (60s timeout), aggregate fallback
- Inserted zero-value rows (accurate — 0 sessions is the real data)
- Root cause: boundary dates (first day of tracking) or isolated zero-traffic days

#### Phase 5: Timezone Bug Fix
- **Bug found**: `new Date('YYYY-MM-DD' + 'T00:00:00').toISOString()` shifts date back 1 day on non-UTC machines (PST → UTC conversion)
- **Fix**: Use `T12:00:00Z` (noon UTC) for date arithmetic across all scripts/endpoints
- **Global fix**: All sync endpoints, rollup, audit, backfill, and cron-monitor now use `America/Los_Angeles` timezone

### 📊 Final Audit Results
| Category | Result |
|----------|--------|
| **GA4 sessions** | ✅ All 18 clients CLEAN |
| **GBP metrics** | ✅ All 16 GBP clients CLEAN |
| **client_metrics_summary** | ✅ All 18 clients CLEAN |
| **Ads campaign metrics** | ⚠️ 7 clients have historical gaps (Jan-Oct 2025 — pre-pipeline) |

### 💡 Key Findings
- **Cron jobs ARE running**: All 4 crons execute daily at 10:00-10:15 UTC on Vercel
- **ChiroSolutions GA4**: Service account needed manual addition to GA4 property
- **GA4 zero-data days**: GA4 API returns nothing when sessions=0 (not an error)
- **Timezone critical**: Always use `T12:00:00Z` for date math, `America/Los_Angeles` for "today/yesterday"

### 🔧 Tools
- `scripts/data_audit.mjs` — Run anytime to check data completeness
- `scripts/backfill-all-gaps.mjs` — Fill any new gaps (uses Vercel production URL)
- `scripts/fix-all-gaps.mjs` — Targeted fix for specific client+date gaps

---

## 📅 [[2026-02-24]] - System Cleanup & Data Audit

### 🛠 Changes
- **Project Sanitization**: Moved 80+ redundant files to `retired_artifacts/`. Deleted sensitive keys.
- **Continuity Audit**: Identified 29-day GBP gap and 19-day GA4 gap.
- **Cron Verification**: Confirmed full sync schedule in root `vercel.json`:
    - 10:00 UTC: GA4
    - 10:05 UTC: Ads
    - 10:10 UTC: GSC
    - 10:12 UTC: GBP
    - 10:15 UTC: Rollup
- **Health Dashboard**: Initialized premium HTML dashboard for real-time monitoring.

---

## 📅 [[2026-02-23]] - GBP Auth Recovery & Initial Pilot

### 🛠 Changes
- **GBP Auth FIX**: Integrated OAuth token retrieval logic into `backfill_engine.ts` using tokens from Supabase `system_settings`.
- **Pilot Run**: Successfully backfilled GBP and Ads data for `2026-02-21`.
- **Environment Update**: Fixed `.env.local` with real Google OAuth IDs.

### 💡 Context
- GBP backfill was failing due to stale tokens and incorrect ID normalization.
- Transitioned from "Building a new Engine" to "Solution A" (Backfilling Raw Tables to utilize existing Rollup logic).

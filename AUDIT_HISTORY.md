# Data Audit History

## Audit Date: 2026-02-24

### Summary
- 19 active clients
- Data pipeline: Google APIs → Cron sync → Supabase raw tables → Rollup → client_metrics_summary

### Critical Issues Found

#### Issue 1: GSC Queries only 4/19 clients
- Only coreposture, decarlo-chiro, dr-digrado, zencare have GSC query data
- 15 clients have ZERO gsc_queries → SEO metrics (impressions, clicks, rank, keywords) = 0
- Need to check service_configs for missing gsc_site_url
- **Status:** PENDING

#### Issue 2: Session rollup only covers ~90 days
- Rollup backfill ran for 90 days (Nov 26 - Feb 23)
- GA4 data exists for ~400 days for most clients
- Older dates not rolled up → summary shows 0 sessions for dates before Nov 26
- **Status:** PENDING

#### Issue 3: Per-client data gaps
| Client | Missing Data |
|--------|-------------|
| chirosolutions-center | No GA4 data at all |
| cinque-chiropractic | Only 42 days GA4 (new client), no GBP |
| symmetry-health-center | No Ads, no GBP |
| chiropractic-first | No Ads |
| chiropractic-health-club | No Ads |
| haven-chiropractic | No Ads |
| zencare | No GBP |
| symmetry-health-center | No GBP |
| cinque-chiropractic | No GBP |
| hood-chiropractic | Only 45 days Ads, 17 days GSC pages |
| **15/19 clients** | No GSC queries |
- **Status:** FIXING NOW

### Data Coverage (per table)
| Table | Records | Date Range | Clients |
|-------|---------|------------|---------|
| ga4_sessions | 83,334 | 2024-12-31 → 2026-02-22 | 18/19 |
| ga4_events | 47,052 | 2024-12-31 → 2026-02-22 | 18/19 |
| ga4_landing_pages | 129,688 | 2024-12-31 → 2026-02-22 | 18/19 |
| gsc_queries | ~227,065 | 2025-11-23 → 2026-02-20 | 4/19 |
| gsc_pages | ~31,455 | varies | 19/19 (sparse) |
| ads_campaign_metrics | 7,820 | 2025-01-01 → 2026-02-23 | 14/19 |
| gbp_location_daily_metrics | 6,504 | 2025-01-01 → 2026-02-23 | 16/19 |
| client_metrics_summary | 9,982 | 2025-01-01 → 2026-02-23 | 19/19 |

#### Issue 4: google_ads_conversions inflated (FIXED)
- Rollup used `ads_campaign_metrics.conversions` which includes view-through/broad conversions
- Dr DiGrado showed 476 conversions in January (real: 28 from Google Ads UI)
- Root cause: `ads_campaign_metrics` inflates with campaign-level conversion counting
- Fix: switched to `campaign_conversion_actions` which matches Google Ads UI exactly
- Verified: WBW=105(real)/106(db), Restoration=63/63, DiGrado=28/28
- **Status:** FIXED [2026-02-24]

#### Issue 5: form_fills double counting with ads conversions (FIXED)
- Old formula: `total_leads = google_ads_conversions + form_fills + gbp_calls`
- Old form_fills counted ALL `appointment` events (including paid traffic)
- Paid form fills were counted in BOTH form_fills AND google_ads_conversions
- Fix: form_fills now only counts events with "success" in name AND excludes paid traffic (source_medium containing cpc/paid)
- **Status:** FIXED [2026-02-24]

#### Issue 6: GBP phone_calls metric (RESOLVED — data is correct)
- GBP sync cron stores `CALL_CLICKS` metric as `phone_calls`
- User initially reported ~90% inaccuracy compared to real call data
- **Investigation [2026-02-25]:**
  - `ACTIONS_PHONE` was a v4 Google My Business API metric — **retired March 30, 2023**
  - `CALL_CLICKS` is the official v1 Performance API **replacement** for `ACTIONS_PHONE` (1:1 rename)
  - POST-based code in `performance/route.ts` and `nightly-metrics-rollup.ts` used dead v4 metrics — never worked
  - The only valid phone metric in GBP Performance API v1 is `CALL_CLICKS`
  - API only supports GET method (POST returns 404 for all metrics)
- **Conclusion:** `CALL_CLICKS` IS the correct and only phone call metric from GBP. Data is accurate.
- CallRail: NOT integrating right now
- **Backfill [2026-02-25]:** Re-backfilled all 16 GBP locations, 420 days (6720 records)
- **Status:** RESOLVED [2026-02-25]

#### Issue 7: Removed unnecessary metrics from dashboard (FIXED)
- Removed branded/non-branded traffic (unreliable brand detection)
- Replaced with engagement_rate and conversion_rate
- Removed health_score from Overview page (replaced with organic traffic)
- Keywords improved/declined now uses period-over-period comparison (not daily sum)
- **Status:** FIXED [2026-02-24]

### GA4 Events Available (for form_fills reference)
| Event Name | Total Count | Used in form_fills? |
|------------|------------|-------------------|
| appointment | 11,789 | No (removed) |
| call_from_web | 8,274 | No |
| submit_form_successful | 4,708 | Yes (if non-paid) |
| submit_form | 4,695 | No |
| form_start | 3,729 | No |
| Appointment (uppercase) | 2,509 | No |
| phone_call | 543 | No |
| Appointment_Successful | 471 | Yes (if non-paid) |

### GBP Performance API Metrics Available
| API Metric | Currently Used | Stored As |
|------------|---------------|-----------|
| CALL_CLICKS | Yes | phone_calls (official v1 replacement for v4 ACTIONS_PHONE) |
| WEBSITE_CLICKS | Yes | website_clicks |
| BUSINESS_DIRECTION_REQUESTS | Yes | direction_requests |
| BUSINESS_IMPRESSIONS_* (4 types) | Yes | views (combined) |
| ACTIONS_PHONE | Retired (v4) | Was sunset March 30, 2023 — replaced by CALL_CLICKS |
| QUERIES_DIRECT | No | Could populate gbp_searches_direct |
| QUERIES_INDIRECT | No | Could populate gbp_searches_discovery |

### Actions Taken
1. [2026-02-24] Rewrote rollup to read from Supabase only (no Google API calls)
2. [2026-02-24] Backfilled GSC 90 days for 18 clients (only 4 had gsc_site_url configured)
3. [2026-02-24] Backfilled rollup 90 days (1,710 records)
4. [2026-02-24] Fixed dashboard bugs (hardcoded trends, lead distribution, keywords ranking)
5. [2026-02-24] Cleaned up ga4_events (218K → 47K), campaign_search_terms (275K → 4.7K)
6. [2026-02-24] Disabled RLS on gsc_queries and gsc_pages
7. [2026-02-24] VACUUM FULL + TRUNCATE on gsc_queries (was corrupted)
8. [2026-02-24] Fixed google_ads_conversions: switched from ads_campaign_metrics to campaign_conversion_actions
9. [2026-02-24] Fixed form_fills: only count "success" events, exclude paid traffic (no double counting)
10. [2026-02-24] Removed branded traffic, health score, ads quality score from dashboard
11. [2026-02-24] Added engagement_rate, conversion_rate to SEO page
12. [2026-02-24] Keywords improved/declined now uses period-over-period comparison
13. [2026-02-24] Re-ran rollup backfill 90 days with all fixes (1,890 records)
14. [2026-02-25] Investigated ACTIONS_PHONE: NOT available via GBP API (400/404 on all methods)
15. [2026-02-25] Re-backfilled GBP data for all 16 locations, 420 days (6720 records) with CALL_CLICKS
16. [2026-02-25] CallRail: decided NOT to integrate for now (exists in codebase but not priority)

### TODO for next session
- [x] Issue 6: RESOLVED — CALL_CLICKS is the correct official metric (v4 ACTIONS_PHONE was retired 2023)
- [ ] Issue 1: Add service account to GSC for remaining clients (manual user action)
- [ ] Issue 2: Extend rollup backfill before Feb 2025 (cover Dec 2024 - Jan 2025 GA4 history)
- [ ] Clean up dead v4 API code (performance/route.ts, nightly-metrics-rollup.ts use retired ACTIONS_PHONE)

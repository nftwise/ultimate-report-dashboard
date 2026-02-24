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

### Actions Taken
1. [2026-02-24] Rewrote rollup to read from Supabase only (no Google API calls)
2. [2026-02-24] Backfilled GSC 90 days for 18 clients (only 4 had gsc_site_url configured)
3. [2026-02-24] Backfilled rollup 90 days (1,710 records)
4. [2026-02-24] Fixed dashboard bugs (hardcoded trends, lead distribution, keywords ranking)
5. [2026-02-24] Cleaned up ga4_events (218K → 47K), campaign_search_terms (275K → 4.7K)
6. [2026-02-24] Disabled RLS on gsc_queries and gsc_pages
7. [2026-02-24] VACUUM FULL + TRUNCATE on gsc_queries (was corrupted)

# System Overview

## Project

Next.js analytics dashboard cho **22 marketing clients** (chiropractic clinics, US + Europe).
Hiển thị 4 loại data: SEO (GA4 + GSC), Google Ads, Google Business Profile (GBP).

**Repo:** https://github.com/nftwise/ultimate-report-dashboard
**Production:** https://ultimate-report-dashboard.vercel.app

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 14+ (App Router), TypeScript, Tailwind CSS, Recharts |
| Backend | Supabase (PostgreSQL) |
| Auth | NextAuth.js |
| APIs | Google GA4, Google Ads, Google Business Profile, Google Search Console |
| Hosting | Vercel (Hobby plan) |
| Scheduler | GitHub Actions (3 workflows/ngày) |
| Alerts | Telegram Bot (@Orca_Monitor_Bot) |

---

## Dashboard Pages

```
/admin-dashboard                        → Overview tất cả clients
/admin-dashboard/[clientSlug]           → Overview 1 client (all metrics)
/admin-dashboard/[clientSlug]/seo       → GA4 + GSC
/admin-dashboard/[clientSlug]/google-ads → Google Ads chi tiết
/admin-dashboard/[clientSlug]/gbp       → Google Business Profile
```

---

## Database Tables (Supabase PostgreSQL)

### Bảng chính (đọc từ đây trước)
- **`client_metrics_summary`** — 66 columns, aggregated daily metrics per client. SOURCE OF TRUTH cho dashboard.
- **`clients`** — 22 clients, có cột `sync_group` (A/B/C), `has_seo`, `has_ads`, `is_active`

### Raw tables (sync trực tiếp từ Google APIs)
- `ga4_sessions` — GA4 sessions by source/medium/device (PARTIAL, không dùng để tổng)
- `ga4_events`, `ga4_landing_pages` — GA4 events + landing pages
- `ads_campaign_metrics` — Google Ads campaigns (source of truth cho Ads)
- `ads_ad_group_metrics`, `campaign_conversion_actions`, `campaign_search_terms`
- `gbp_location_daily_metrics` — GBP raw data per location/day
- `gsc_daily_summary`, `gsc_queries`, `gsc_pages` — Search Console data

### Config tables
- **`gbp_locations`** — GBP location IDs (join qua `client_id` vào `clients`)
- `service_configs` — API customer IDs per client

---

## Data Flow

```
GitHub Actions (09/10/11 UTC daily)
    ↓ trigger curl
Vercel API endpoints (/api/cron/sync-*)
    ↓ call
Google APIs (GA4, Ads, GBP, GSC)
    ↓ write
Supabase raw tables
    ↓ rollup
client_metrics_summary (66 cols)
    ↓ read
Dashboard pages
```

---

## GBP Column Mapping — CRITICAL

Hai bảng GBP dùng tên cột khác nhau:

| `gbp_location_daily_metrics` | `client_metrics_summary` |
|-----------------------------|------------------------|
| `phone_calls` | `gbp_calls` |
| `website_clicks` | `gbp_website_clicks` |
| `direction_requests` | `gbp_directions` |
| `views` | `gbp_profile_views` |

---

## Design System

- Colors: `#2c2419` (dark), `#c4704f` (accent/orange), `#d9a854` (gold), `#9db5a0` (green)
- Cards: glassmorphism `rgba(255,255,255,0.9)` + `backdrop-filter: blur(10px)`
- Layout: 4-tier (KPIs → Charts → Analysis → Granular data)

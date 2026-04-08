# Database Schema Reference

> Read this alongside CLAUDE.md. Last verified: 2026-04-08.
> Always use `supabaseAdmin` (service_role) for server-side writes. Anon key for client-side reads.

---

## Quick Reference — Which Table To Use

| Data | Read From | Write From |
|------|-----------|-----------|
| Dashboard overview (fast) | `client_metrics_summary` | `run-rollup` cron |
| GBP detailed daily | `gbp_location_daily_metrics` | `sync-gbp` cron |
| GA4 sessions | `ga4_sessions` | `sync-ga4` cron |
| GSC keywords | `gsc_queries` | `sync-gsc` cron |
| GSC daily totals | `gsc_daily_summary` | `sync-gsc` cron |
| Ads campaigns | `ads_campaign_metrics` | `sync-ads` cron (7-day window) |
| Ads conversions | `campaign_conversion_actions` | `sync-ads` cron |
| Client config (API keys) | `service_configs` | Admin UI |
| GBP OAuth token | `system_settings` | `gbp-token-manager` |
| Facebook Ads | `fb_campaign_metrics`, `fb_leads` | `sync-fb-ads` cron |
| Users & auth | `users`, `login_logs` | Auth system |

---

## GBP Column Name Mapping (CRITICAL)

| `gbp_location_daily_metrics` | `client_metrics_summary` | Description |
|------------------------------|--------------------------|-------------|
| `phone_calls` | `gbp_calls` | Phone calls |
| `website_clicks` | `gbp_website_clicks` | Website clicks |
| `direction_requests` | `gbp_directions` | Direction requests |
| `views` | `gbp_profile_views` | Profile views (sum of 4 impression types) |
| `total_reviews` | `gbp_reviews_count` | Total review count |
| `new_reviews_today` | `gbp_reviews_new` | New reviews |
| `average_rating` | `gbp_rating_avg` | Average star rating |
| `posts_count` | `gbp_posts_count` | Active posts |
| `posts_views` | `gbp_posts_views` | Post views |
| `posts_actions` | `gbp_posts_clicks` | Post clicks |

---

## Table Schemas

### clients

19 active rows (is_active=true). `sync_group` (A/B/C) determines which GitHub Actions workflow syncs this client.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `name` | string | Display name |
| `slug` | string | URL slug (unique) |
| `industry` | string | e.g. "chiropractic" |
| `is_active` | boolean | Filter: `.eq('is_active', true)` |
| `sync_group` | string | 'A' \| 'B' \| 'C' — for cron batching |
| `city` | string | |
| `website_url` | string | |
| `contact_email` | string | |
| `plan_type` | string | 'standard' \| 'premium' |
| `has_seo` | boolean | |
| `has_ads` | boolean | |
| `has_gbp` | boolean | ⚠️ NOT reliable — derive from gbp_locations table |
| `has_callrail` | boolean | |
| `status` | string | e.g. "Working", "Onboarding" |
| `notes` | string | |
| `created_at` / `updated_at` | timestamp | |

> ⚠️ `has_gbp` on the clients row is unreliable. Use `gbp_locations WHERE client_id = X AND is_active = true` to check.
> ⚠️ `google_ads_customer_id` and `ga4_property_id` columns exist but are NOT used — use `service_configs` instead.

---

### service_configs

Per-client API credentials. One row per client (or null if not configured).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `client_id` | uuid FK → clients | |
| `ga_property_id` | string\|null | Numeric string, 6-12 digits (e.g. "310666159") |
| `gads_customer_id` | string\|null | 10 digits, format "123-456-7890" stripped to "1234567890" |
| `gsc_site_url` | string\|null | Full URL e.g. "https://example.com/" |
| `callrail_account_id` | string\|null | Optional — not required for core features |

```typescript
// Correct way to get client API credentials
const { data: config } = await supabaseAdmin
  .from('service_configs')
  .select('ga_property_id, gads_customer_id, gsc_site_url')
  .eq('client_id', clientId)
  .single();
```

---

### client_metrics_summary

66-column pre-aggregated daily rollup. **Primary read table for dashboard.** Written by `run-rollup` cron.

| Column | Computed? | Notes |
|--------|-----------|-------|
| `id`, `client_id`, `date`, `period_type` | — | `period_type` = 'daily' always |
| `sessions` | ✅ | From ga4_sessions aggregate row |
| `users` | ✅ | |
| `new_users` | ✅ | |
| `traffic_organic/paid/direct/referral/ai` | ✅ | Traffic source breakdown |
| `sessions_mobile/desktop` | ✅ | |
| `engagement_rate` | ✅ | |
| `returning_users` | ✅ | |
| `conversion_rate` | ✅ | |
| `seo_impressions`, `seo_clicks`, `seo_ctr` | ✅ | From gsc_daily_summary |
| `branded_traffic`, `non_branded_traffic` | ✅ | |
| `keywords_improved`, `keywords_declined` | ✅ | |
| `ad_spend` | ✅ | From ads_campaign_metrics SUM(cost) |
| `ads_impressions`, `ads_clicks`, `ads_ctr` | ✅ | |
| `ads_avg_cpc`, `ads_impression_share` | ✅ | |
| `ads_search_lost_budget` | ✅ | |
| `ads_quality_score`, `ads_conversion_rate` | ✅ | |
| `ads_top_impression_rate` | ✅ | |
| `google_ads_conversions` | ✅ | SUM(conversions) from ads_campaign_metrics |
| `total_leads` | ✅ | = google_ads_conversions |
| `cpl` | ✅ | cost / conversions |
| `form_fills` | ✅ | From ga4_conversions |
| `gbp_calls` | ✅ | From gbp_location_daily_metrics.phone_calls |
| `gbp_website_clicks` | ✅ | |
| `gbp_directions` | ✅ | |
| `gbp_profile_views` | ✅ | |
| `gbp_reviews_count`, `gbp_reviews_new` | ✅ | From gbp_location_daily_metrics |
| `gbp_rating_avg` | ✅ | |
| `gbp_posts_count`, `gbp_posts_views`, `gbp_posts_clicks` | ✅ | |
| `health_score` | ✅ | Computed score |
| `budget_utilization` | ✅ | |
| `blog_sessions` | ✅ | |
| `top_landing_pages` | ✅ | JSON array |
| `fb_spend`, `fb_leads`, `fb_impressions`, `fb_clicks` | ✅ | From fb_campaign_metrics |
| `ads_phone_calls` | ❌ ALWAYS 0 | Not available at campaign level |
| `days_since_review` | ❌ ALWAYS 0 | Needs historical lookup, not implemented |
| `days_since_post` | ❌ ALWAYS 0 | Needs historical lookup, not implemented |
| `gbp_searches_direct`, `gbp_searches_discovery` | ❌ NEVER SET | Not computed in rollup |
| `gbp_q_and_a_count`, `gbp_photos_count` | ❌ NEVER SET | Not computed in rollup |
| `alerts_count`, `content_conversions` | ❌ NEVER SET | Not computed in rollup |
| `mom_leads_change` | ❌ NEVER SET | Not computed in rollup |

---

### gbp_location_daily_metrics

Daily GBP metrics per location. Written by `sync-gbp` cron (90-day rolling window).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `location_id` | uuid FK → gbp_locations | |
| `client_id` | uuid FK → clients | |
| `date` | date | 'YYYY-MM-DD' |
| `views` | int | Sum of all 4 impression types (desktop+mobile × maps+search) |
| `phone_calls` | int | |
| `website_clicks` | int | |
| `direction_requests` | int | |
| `total_reviews` | int | Snapshot at sync time |
| `average_rating` | float | |
| `new_reviews_today` | int | |
| `actions` | int | Total actions |
| `business_photo_views` | int | |
| `posts_count`, `posts_views`, `posts_actions` | int | |
| `fetch_status` | string | 'success' \| 'error' |
| `created_at` / `updated_at` | timestamp | |

Upsert conflict key: `(location_id, date)`.

---

### gbp_locations

One row per GBP location per client.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | Used as `location_id` in daily metrics |
| `client_id` | uuid FK | |
| `gbp_location_id` | string | Google's location ID, e.g. "locations/1234567890" |
| `location_name` | string | |
| `is_active` | boolean | Filter by this |
| `address`, `phone`, `website` | string\|null | |
| `synced_at` | timestamp\|null | |

> 16 active locations as of 2026-04-08. 3 clients (Cinque, Healing Hands, Zen Care) pending GBP access grant.

---

### system_settings

Global key-value config store.

| Key | Value structure | Purpose |
|-----|----------------|---------|
| `gbp_agency_master` | `{ access_token, refresh_token, expiry_date, token_type }` | GBP OAuth token (auto-refreshed by GBPTokenManager) |

---

### ads_campaign_metrics

Daily campaign-level Google Ads data. 7-day rolling window sync to catch retroactive conversion updates.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `client_id` | uuid FK | |
| `campaign_id` | string | Google campaign ID |
| `campaign_name` | string | |
| `campaign_status` | string | ENABLED \| PAUSED \| REMOVED |
| `date` | date | |
| `impressions`, `clicks` | int | |
| `cost` | float | In dollars (cost_micros / 1,000,000) |
| `conversions` | float | Can be fractional (model-based) |
| `conversion_value` | float | |
| `ctr` | float | Percentage |
| `cpc` | float | |
| `cpa` | float | |
| `roas` | float | |
| `quality_score` | int | |
| `impression_share`, `search_impression_share` | float | |
| `search_lost_is_budget`, `search_lost_is_rank` | float | |

Upsert conflict key: `(client_id, campaign_id, date)`.
> ⚠️ Conversions are retroactively updated by Google for 30-90 days. The 7-day sync window catches most updates.

---

### ads_ad_group_metrics

| Column | Type | Notes |
|--------|------|-------|
| `client_id`, `campaign_id`, `ad_group_id` | ids | |
| `ad_group_name` | string | |
| `date` | date | |
| `impressions`, `clicks`, `cost`, `conversions` | numeric | |
| `ctr`, `cpc`, `cpa` | float | |

Upsert conflict key: `(client_id, campaign_id, ad_group_id, date)`.

---

### campaign_conversion_actions

| Column | Type |
|--------|------|
| `client_id`, `campaign_id`, `date` | ids/date |
| `conversion_action_name` | string |
| `conversion_action_type` | string |
| `conversions`, `conversion_value` | float |
| `avg_conversion_lag_days` | int (always 0) |

Upsert conflict key: `(client_id, campaign_id, date, conversion_action_name)`.

---

### campaign_search_terms

| Column | Type | Notes |
|--------|------|-------|
| `client_id`, `campaign_id`, `date`, `search_term` | ids | |
| `impressions`, `clicks`, `cost`, `conversions` | numeric | |
| `is_irrelevant`, `wasted_spend` | bool/float | For search term analysis |

Upsert conflict key: `(client_id, campaign_id, date, search_term)`.

---

### ga4_sessions

Dimensional session data. **Use aggregate rows only** (`source_medium = '(all) / (all)'`) to avoid double-counting.

| Column | Type | Notes |
|--------|------|-------|
| `client_id`, `date` | ids | |
| `source_medium` | string | Filter: `eq('source_medium', '(all) / (all)')` for totals |
| `device`, `country`, `city`, `region` | string | Dimensional breakdowns |
| `sessions`, `total_users`, `new_users` | int | |
| `page_views`, `screen_page_views` | int | |
| `engagement_rate`, `bounce_rate` | float | |
| `avg_session_duration` | float | Seconds |
| `conversions`, `conversion_rate` | float | |
| `event_count`, `events_per_session` | int | |

> ⚠️ CRITICAL: Always filter `source_medium = '(all) / (all)'` for monthly totals. Summing all rows = double-count.

---

### ga4_events

| Column | Type |
|--------|------|
| `client_id`, `date`, `event_name` | ids |
| `source_medium`, `device` | string |
| `event_count`, `total_users`, `event_value` | numeric |

---

### ga4_conversions

| Column | Type | Notes |
|--------|------|-------|
| `client_id`, `date` | ids | |
| `conversion_event` | string | e.g. "Appointment", "Phone Call" |
| `source_medium`, `device` | string | |
| `conversions`, `total_users`, `conversion_rate`, `conversion_value` | numeric | |

---

### ga4_landing_pages

| Column | Type |
|--------|------|
| `client_id`, `date`, `landing_page` | ids |
| `source_medium` | string |
| `sessions`, `total_users`, `new_users` | int |
| `avg_session_duration`, `bounce_rate` | float |
| `conversions`, `conversion_rate` | float |

---

### gsc_queries

Per-keyword Search Console data. Large table (~300k rows).

| Column | Type | Notes |
|--------|------|-------|
| `client_id`, `date`, `query` | ids | |
| `site_url` | string | |
| `clicks`, `impressions` | int | |
| `ctr` | float | Percentage |
| `position` | float | Average position |

> Use `gsc_daily_summary` for totals — querying gsc_queries for SUM can timeout.

---

### gsc_daily_summary ⭐

Pre-aggregated daily GSC totals. Use this instead of summing gsc_queries.

| Column | Type |
|--------|------|
| `client_id`, `date` | ids |
| `total_clicks`, `total_impressions` | int |
| `avg_ctr`, `avg_position` | float |
| `top_keywords_count` | int |

---

### gsc_pages

Per-page Search Console data (usually empty — most data is in gsc_queries).

---

### users

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `email` | string | Unique |
| `password_hash` | string | bcrypt(10) |
| `role` | string | 'admin' \| 'team' \| 'client' |
| `client_id` | uuid\|null | Only set for 'client' role |
| `is_active` | boolean | |
| `created_at`, `last_login` | timestamp | |

Password change: `POST /api/user/change-password` (any role, requires old password).
Admin reset: `PATCH /api/admin/add-user` with `{ id, password }`.

---

### login_logs

| Column | Type |
|--------|------|
| `user_id` | uuid FK → users |
| `email`, `role` | string |
| `logged_at` | timestamp |

Used for 26-week login heatmap in users management page.

---

### Facebook Ads Tables

**fb_campaign_metrics** — Daily Facebook campaign data

| Column | Type |
|--------|------|
| `client_id`, `date`, `campaign_id` | ids |
| `campaign_name`, `campaign_status` | string |
| `spend`, `impressions`, `clicks`, `reach` | numeric |
| `leads`, `cpl`, `ctr`, `cpc` | numeric |

**fb_leads** — Individual Facebook lead records

| Column | Type |
|--------|------|
| `client_id`, `ad_id`, `lead_id` | ids |
| `name`, `email`, `phone` | string |
| `created_time` | timestamp |
| `notified`, `imported_to_sheets` | boolean |

**fb_age_gender_metrics** — FB demographic breakdown by age/gender/date

**fb_placement_metrics** — FB placement breakdown (feed, story, etc.)

---

### Other Tables

**gsc_daily_summary** — Pre-aggregated GSC totals (use for dashboard reads)

**api_cache** — Supabase-backed API response cache with TTL
| Column | Type |
|--------|------|
| `cache_key` | string PK |
| `data` | jsonb |
| `expires_at` | timestamp |

**bot_credentials** — API credentials for bots (Telegram, etc.)

**follow_up_sequences** — Lead follow-up workflow definitions

**lead_follow_up_state** — Per-lead follow-up state tracking

**sms_messages** — SMS send history (Twilio)

**manual_form_fills** — Manually recorded form fill events

**password_reveal_tokens** — One-time tokens for password reset via Telegram bot

**bing_ai_citations**, **bing_ai_queries**, **bing_ai_page_citations** — Bing AI visibility data (import-only)

---

## Common Query Patterns

### Dashboard overview (fast)
```typescript
const { data } = await supabaseAdmin
  .from('client_metrics_summary')
  .select('date, sessions, gbp_calls, gbp_profile_views, ad_spend, google_ads_conversions, seo_clicks')
  .eq('client_id', clientId)
  .eq('period_type', 'daily')
  .gte('date', startDate)
  .lte('date', endDate)
  .order('date');
```

### GA4 totals (avoid double-count)
```typescript
const { data } = await supabaseAdmin
  .from('ga4_sessions')
  .select('date, sessions, total_users, new_users, conversions')
  .eq('client_id', clientId)
  .eq('source_medium', '(all) / (all)')  // ← CRITICAL
  .gte('date', startDate)
  .lte('date', endDate);
```

### GSC totals (use summary table, not queries)
```typescript
const { data } = await supabaseAdmin
  .from('gsc_daily_summary')
  .select('date, total_clicks, total_impressions')
  .eq('client_id', clientId)
  .gte('date', startDate)
  .lte('date', endDate);
```

### GBP daily (check both tables)
```typescript
// Detailed: gbp_location_daily_metrics (joined through gbp_locations)
// Summary: client_metrics_summary.gbp_calls / gbp_profile_views etc.
// Prefer gbp_location_daily_metrics for GBP page, client_metrics_summary for overview
```

### Client with service config
```typescript
const { data: client } = await supabaseAdmin
  .from('clients')
  .select('id, name, slug, service_configs(ga_property_id, gads_customer_id, gsc_site_url)')
  .eq('slug', slug)
  .eq('is_active', true)
  .single();
const config = Array.isArray(client.service_configs)
  ? client.service_configs[0]
  : client.service_configs;
```

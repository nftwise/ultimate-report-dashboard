# Quick Reference: Supabase Database Schema

## Tables Available

### 1. `client_metrics_summary` (1,000 records)
**Purpose:** Daily aggregated metrics per client
**Key Fields:** `client_id`, `date`, various metrics

#### Reliable Metrics (>10% data populated)
| Metric | Coverage | Avg Value | Best Use |
|--------|----------|-----------|----------|
| `ads_impressions` | 47.0% | 211 | Campaign reach |
| `ads_clicks` | 45.8% | 11.3 | Campaign clicks |
| `ad_spend` | 45.8% | $67 | Budget analysis |
| `google_ads_conversions` | 27.9% | 2.47 | Conversion tracking |
| `seo_impressions` | 15.7% | 2,069 | Organic reach |
| `seo_clicks` | 15.2% | 14 | Organic clicks |
| `sessions` | 15.7% | 72 | Traffic volume |

#### Sparse Metrics (<5% data populated)
| Metric | Coverage | Use Case |
|--------|----------|----------|
| `gbp_calls` | 1.6% | ❌ Don't use |
| `gbp_directions` | 1.0% | ❌ Don't use |
| `gbp_website_clicks` | 1.6% | ❌ Don't use |
| `gbp_profile_views` | 2.3% | ⚠️ Use with caution |

#### Always Zero (0% populated)
```
gbp_posts_views, gbp_searches_direct, gbp_searches_discovery,
traffic_direct, traffic_organic, traffic_paid, traffic_referral,
sessions_desktop, sessions_mobile, form_fills, total_leads,
all CTR/conversion_rate/CPA metrics, blog_sessions
```

#### Always Populated (100%)
- `id` (UUID)
- `client_id` (UUID)
- `date` (ISO 8601)
- `health_score` (0-100)
- `budget_utilization` (%)`

---

### 2. `gbp_location_daily_metrics` (1,000 records)
**Purpose:** Daily GBP performance per location
**Key Fields:** `client_id`, `location_id`, `date`, GBP metrics

#### Strong Metrics (>50% data populated)
| Metric | Coverage | Avg Value | Status |
|--------|----------|-----------|--------|
| `website_clicks` | 84.8% | 3.35 | ✅ Use this |
| `direction_requests` | 72.7% | 5.86 | ✅ Use this |
| `phone_calls` | 65.2% | 4.38 | ✅ Use this |

#### Sparse Metrics (<5% data populated)
| Metric | Coverage | Note |
|--------|----------|------|
| `views` | 0.5% | Mostly zeros |
| `actions` | 0.5% | Mostly zeros |
| `total_reviews` | 0.5% | Mostly zeros |
| `average_rating` | 0.5% | Mostly zeros |

#### Always Zero (0% populated)
```
new_reviews_today, posts_views, posts_actions, posts_count,
business_photo_views, customer_photo_count, customer_photo_views
```

#### Always Populated (100%)
- `id` (UUID)
- `client_id` (UUID)
- `location_id` (UUID)
- `date` (ISO 8601)

---

## Comparison: What Each Table Tracks

| Aspect | `client_metrics_summary` | `gbp_location_daily_metrics` |
|--------|--------------------------|------------------------------|
| **Level** | Client (aggregated) | Location (detailed) |
| **Google Ads** | ✅ Complete | ❌ No ads data |
| **GBP Data** | ⚠️ Sparse (1-2%) | ✅ Good (65-85%) |
| **Phone Calls** | Incomplete | ✅ 65% populated |
| **Directions** | Incomplete | ✅ 73% populated |
| **Website Clicks** | Incomplete | ✅ 85% populated |
| **Reviews** | ❌ No | ⚠️ Sparse |
| **Posts** | ❌ No | ❌ No |
| **Photos** | ❌ No | ❌ No |
| **Best For** | Ad spend analysis | GBP engagement |

---

## Critical Gaps

### Missing Data
1. **GBP Posts** - No post views, actions, or performance metrics
2. **GBP Reviews** - New reviews per day not tracked
3. **GBP Photos** - Photo views and customer uploads not tracked
4. **Traffic Source Breakdown** - No direct/organic/paid/referral split
5. **Session Types** - No desktop/mobile breakdown
6. **Search Terms** - No tracking of search queries
7. **Derived Metrics** - CTR, conversion rate, CPA not calculated

### Data Collection Issues
- `google_rank` column exists but is always NULL
- Many calculated fields are always 0
- Phone call and direction data comes from location table, not client table
- No separate revenue tracking table

---

## Sample Query Patterns

### Get Today's Data for All Clients
```javascript
const { data } = await supabase
  .from('client_metrics_summary')
  .select('*')
  .eq('date', '2026-02-03')
  .gt('ads_impressions', 0);
```

### Get Latest GBP Activity
```javascript
const { data } = await supabase
  .from('gbp_location_daily_metrics')
  .select('*')
  .order('date', { ascending: false })
  .limit(10);
```

### Get Top Performing Locations (by website clicks)
```javascript
const { data } = await supabase
  .from('gbp_location_daily_metrics')
  .select('location_id, SUM(website_clicks) as total_clicks')
  .gte('date', '2026-01-01')
  .order('total_clicks', { ascending: false })
  .limit(10);
```

---

## Dashboard Recommendations

### What to Show
- ✅ Google Ads metrics (47%+ populated)
- ✅ GBP phone calls & directions (65-73% populated)
- ✅ GBP website clicks (85% populated)
- ✅ Health scores & budget utilization (100% populated)
- ✅ SEO impressions & clicks (15% but consistent)

### What NOT to Show
- ❌ Traffic source breakdown (0% data)
- ❌ Desktop/mobile split (0% data)
- ❌ CTR, conversion rate, CPA (0% data)
- ❌ GBP posts, photos, reviews (0% data)
- ❌ Google rank (always NULL)

### Recommended Cards for Dashboard
1. **GBP Engagement Card**
   - Website Clicks (84.8% reliable)
   - Direction Requests (72.7% reliable)
   - Phone Calls (65.2% reliable)

2. **Ad Performance Card**
   - Impressions (47% reliable)
   - Clicks (45.8% reliable)
   - Ad Spend (45.8% reliable)
   - Conversions (27.9% reliable)

3. **Health & Budget Card**
   - Health Score (100% reliable)
   - Budget Utilization (100% reliable)

4. **SEO Card** (if you want to include)
   - Impressions (15.7% reliable)
   - Clicks (15.2% reliable)

---

## Data Freshness

| Table | Earliest Data | Latest Data | Coverage |
|-------|---------------|-------------|----------|
| `client_metrics_summary` | 2025-02-10 | 2026-01-19 | ~11 months |
| `gbp_location_daily_metrics` | 2025-01-01 | 2026-01-19 | ~13 months |

---

## Important Notes

1. **GBP Data Split:** Client-level GBP data is sparse (1-2%), but location-level data is good (65-85%)
2. **Ads Data Complete:** Google Ads metrics are well-populated and reliable
3. **Calculated Fields Empty:** CTR, conversion rates, CPA not computed
4. **No Separate Tables:** Revenue, post metrics, photo metrics are not available as separate tables
5. **Health Score Stable:** Always populated, ranges 0-100, useful for overview

---

**Last Updated:** 2026-02-03
**Data Quality:** ⭐⭐⭐⭐ (4/5) - Good fundamentals, missing advanced features

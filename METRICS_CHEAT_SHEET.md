# Metrics Cheat Sheet - Quick Reference Card

**Print this page for your desk!**

---

## One-Page Database Overview

### 2 Tables, 86 Columns, 2,000+ Records, 40% Usable

| Table | Size | Best For | Primary Keys |
|---|---|---|---|
| `client_metrics_summary` | 1,000 rows | Google Ads + SEO | id, client_id |
| `gbp_location_daily_metrics` | 1,000 rows | GBP engagement | id, location_id |

---

## GREEN LIGHT: Use These Metrics

### Immediate Dashboard Candidates

| Metric | Table | Coverage | Avg Value |
|--------|-------|----------|-----------|
| **phone_calls** | gbp_location | 65.2% | 4.38/day |
| **direction_requests** | gbp_location | 72.7% | 5.86/day |
| **website_clicks** | gbp_location | 84.8% | 3.35/day |
| **ads_impressions** | client_summary | 47.0% | 211/day |
| **ads_clicks** | client_summary | 45.8% | 11.3/day |
| **ad_spend** | client_summary | 45.8% | $67/day |
| **health_score** | client_summary | 100% | 0-100 |
| **budget_utilization** | client_summary | 100% | 0-100% |

**→ These are safe for production dashboards**

---

## YELLOW LIGHT: Use with Caution

| Metric | Table | Coverage | Note |
|--------|-------|----------|------|
| google_ads_conversions | client_summary | 27.9% | Only 1 in 3 records |
| seo_impressions | client_summary | 15.7% | Limited GA4 data |
| seo_clicks | client_summary | 15.2% | Limited GA4 data |
| sessions | client_summary | 15.7% | Limited GA4 data |

**→ Can display but mark as incomplete**

---

## RED LIGHT: Don't Use These

| Metric | Table | Coverage | Why |
|--------|-------|----------|-----|
| gbp_calls (client level) | client_summary | 1.6% | Use location table instead |
| gbp_directions (client) | client_summary | 1.0% | Use location table instead |
| gbp_website_clicks (client) | client_summary | 1.6% | Use location table instead |
| traffic_direct | client_summary | 0% | Not collected |
| traffic_organic | client_summary | 0% | Not collected |
| traffic_paid | client_summary | 0% | Not collected |
| sessions_desktop | client_summary | 0% | Not collected |
| sessions_mobile | client_summary | 0% | Not collected |

**→ Never display these in dashboards**

---

## MISSING: These Don't Exist

```
❌ Posts metrics (views, actions, count)
❌ Photo metrics (views, customer uploads)
❌ Review metrics (new reviews per day)
❌ All calculated metrics (CTR, CPA, conversion rate)
❌ Revenue table (doesn't exist)
❌ Detailed keyword breakdowns
❌ Traffic source breakdown (direct/organic/paid/referral)
```

**→ If you need these, they require data pipeline expansion**

---

## Quick Decision Tree

```
Do I need to show GBP data?
├─ YES: Use location_level data (65-85% reliable) ✅
└─ NO: Skip and show Ads instead

Do I need traffic source breakdown?
├─ YES: Add GA4 integration first ⏳
└─ NO: Focus on phone/directions/clicks

Do I need posts/photos/reviews?
├─ YES: Implement GBP API expansion ⏳
└─ NO: Focus on available metrics

Do I need calculated metrics?
├─ YES: Calculate in code, not database ✅
└─ NO: Use raw metrics only
```

---

## Sample Query Patterns

### Get Latest Day's Data (All Clients)
```javascript
const { data } = await supabase
  .from('client_metrics_summary')
  .select('client_id, ads_impressions, ads_clicks, ad_spend')
  .eq('date', '2026-02-03')
  .gt('ads_impressions', 0);
```

### Get Top GBP Locations
```javascript
const { data } = await supabase
  .from('gbp_location_daily_metrics')
  .select('location_id, phone_calls, direction_requests, website_clicks')
  .gt('website_clicks', 0)
  .order('website_clicks', { ascending: false })
  .limit(10);
```

### Compare Client-Level vs Location-Level
```javascript
// Client level (sparse)
const client = await supabase
  .from('client_metrics_summary')
  .select('gbp_calls, gbp_directions')
  .eq('client_id', id);

// Location level (better!)
const location = await supabase
  .from('gbp_location_daily_metrics')
  .select('phone_calls, direction_requests')
  .eq('client_id', id);
```

---

## Data Quality Scoreboard

| Category | Score | Status |
|----------|-------|--------|
| Google Ads | ⭐⭐⭐⭐⭐ | Excellent |
| GBP Location | ⭐⭐⭐⭐ | Strong |
| Health/Budget | ⭐⭐⭐⭐⭐ | Excellent |
| SEO Basic | ⭐⭐⭐ | Moderate |
| GBP Client-level | ⭐ | Poor |
| Traffic Breakdown | ❌ | Missing |
| Posts/Photos | ❌ | Missing |

---

## The Big Picture

### What's Actually Working
- Google Ads collection (complete)
- GBP location metrics (good)
- Health scoring (perfect)
- Budget tracking (perfect)

### What's Partially Working
- GBP at client level (too sparse)
- SEO/Analytics (15% coverage)

### What's Missing
- Advanced GBP (posts, photos, reviews)
- Traffic source breakdown
- Session device types
- Revenue data

### What to Do
1. **Build with:** Ads + GBP Location + Health/Budget
2. **Avoid:** Client-level GBP + Traffic breakdown
3. **Plan for:** Future data pipeline expansion

---

## Column Counts Summary

```
Total Columns:                86
├─ With Real Data:           ~35 (40%)
├─ Always Zero:              ~30 (35%)
└─ Always Populated:         ~15 (25%)

client_metrics_summary:       66 columns
├─ 47% have data
└─ 53% are empty/zero

gbp_location_daily_metrics:   20 columns
├─ 65-85% have data
└─ 15-35% are empty/zero
```

---

## Pro Tips

### Tip 1: Location > Client Level
For GBP metrics, ALWAYS use location table. It's 10x more reliable.

### Tip 2: Calculate Derived Metrics
Don't expect CTR, conversion rate, CPA in database. Calculate in code.

### Tip 3: Filter Out Zeros
Many records are all zeros. Filter them before visualization.

### Tip 4: Use location_id as Reference
Each location has consistent data. Group by location_id for analysis.

### Tip 5: Watch the Date Range
Data starts from different dates. client_summary from Feb 2025, gbp from Jan 2025.

---

## Common Mistakes to Avoid

❌ Displaying GBP calls at client level (1.6% data)
❌ Showing traffic source breakdown (0% data)
❌ Expecting CTR in database (calculate it)
❌ Assuming posts/photos are tracked (they're not)
❌ Mixing client-level and location-level GBP data

✅ Use location-level GBP data
✅ Focus on Google Ads metrics
✅ Show what you have, hide what you don't
✅ Calculate complex metrics in code
✅ Validate data before display

---

## File Reference

| File | Use | Time |
|------|-----|------|
| DATABASE_QUICK_REFERENCE.md | Overview | 5 min |
| DATABASE_ANALYSIS_REPORT.md | Deep dive | 30 min |
| SUPABASE_TEST_QUERIES.md | Testing | Variable |
| DATABASE_DOCS_INDEX.md | Navigation | 2 min |
| This file | Cheat sheet | 3 min |

---

## Contact Your Database

| Need | Do This |
|------|---------|
| Test a metric | Use SUPABASE_TEST_QUERIES.md |
| Understand coverage | Check DATABASE_QUICK_REFERENCE.md |
| Full details | Read DATABASE_ANALYSIS_REPORT.md |
| Find something | Search DATABASE_DOCS_INDEX.md |
| Automate check | Run analyze-database.js |

---

**Last Updated:** 2026-02-03
**Status:** Ready to Use
**Print & Keep Handy:** Yes!

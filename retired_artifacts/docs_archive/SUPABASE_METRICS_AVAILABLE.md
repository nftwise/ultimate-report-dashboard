# Supabase Available Metrics - Complete List

**Total Fields Available**: 66 metrics
**Table**: `client_metrics_summary`
**Last Updated**: January 28, 2026

---

## 📊 Metrics by Category

### 1. **CORE METRICS** (Essential KPIs)
```
✅ total_leads          | SUM of all lead sources
✅ google_ads_conversions | Google Ads conversions
✅ form_fills           | SEO form submissions
✅ gbp_calls            | Google Business Profile calls
✅ ad_spend             | Total ad spend (Google Ads)
✅ cpl                  | Cost per lead (calculated)
✅ health_score         | Overall client health (0-100)
✅ mom_leads_change     | Month-over-month leads change %
```

### 2. **SESSIONS & TRAFFIC** (Website Analytics)
```
✅ sessions             | Total website sessions
✅ users                | Unique users
✅ new_users            | New user count
✅ returning_users      | Returning user count
✅ sessions_mobile      | Mobile sessions
✅ sessions_desktop     | Desktop sessions
✅ blog_sessions        | Blog-specific sessions
```

### 3. **TRAFFIC SOURCE BREAKDOWN**
```
✅ traffic_organic      | Organic traffic (SEO)
✅ traffic_paid         | Paid traffic (Ads)
✅ traffic_direct       | Direct traffic
✅ traffic_referral     | Referral traffic
✅ traffic_ai           | AI-generated traffic
✅ branded_traffic      | Branded keyword traffic
✅ non_branded_traffic  | Non-branded keyword traffic
```

### 4. **SEO METRICS**
```
✅ seo_impressions      | Search impressions
✅ seo_clicks           | Search clicks
✅ seo_ctr              | Click-through rate
✅ google_rank          | Best ranking position
✅ top_keywords         | Top keyword count
✅ keywords_improved    | Keywords improved month-over-month
✅ keywords_declined    | Keywords declined month-over-month
```

### 5. **GOOGLE ADS METRICS**
```
✅ ad_spend             | Total ad spend
✅ ads_impressions      | Ad impressions
✅ ads_clicks           | Ad clicks
✅ ads_ctr              | Ad click-through rate
✅ ads_avg_cpc          | Average cost per click
✅ ads_conversion_rate  | Conversion rate %
✅ ads_impression_share | Impression share %
✅ ads_quality_score    | Quality score (1-10)
✅ ads_search_lost_budget | Lost impressions due to budget
✅ ads_top_impression_rate | Top impression rate %
✅ ads_phone_calls      | Phone calls from ads
✅ google_ads_conversions | Conversions count
```

### 6. **GOOGLE BUSINESS PROFILE (GBP) METRICS**
```
✅ gbp_calls            | Phone calls
✅ gbp_website_clicks   | Website clicks from GBP
✅ gbp_directions       | Direction requests
✅ gbp_profile_views    | Profile views
✅ gbp_searches_direct  | Direct searches
✅ gbp_searches_discovery | Discovery searches
✅ gbp_reviews_count    | Total reviews
✅ gbp_reviews_new      | New reviews
✅ gbp_rating_avg       | Average rating (0-5)
✅ gbp_q_and_a_count    | Q&A count
✅ gbp_photos_count     | Photo count
✅ gbp_posts_count      | Posts count
✅ gbp_posts_views      | Post views
✅ gbp_posts_clicks     | Post clicks
✅ days_since_review    | Days since last review
✅ days_since_post      | Days since last post
```

### 7. **CONTENT & ENGAGEMENT**
```
✅ content_conversions  | Conversions from content
✅ engagement_rate      | Content engagement rate %
✅ top_landing_pages    | Top landing pages (array)
✅ blog_sessions        | Blog session count
```

### 8. **PERFORMANCE & HEALTH**
```
✅ health_score         | Overall health score (0-100)
✅ budget_utilization   | Budget used % (0-100)
✅ alerts_count         | Number of active alerts
✅ conversion_rate      | Overall conversion rate %
✅ mom_leads_change     | Month-over-month change %
```

### 9. **SYSTEM FIELDS** (Metadata)
```
✅ id                   | Record ID (UUID)
✅ client_id            | Client ID (UUID)
✅ date                 | Date (YYYY-MM-DD)
✅ period_type          | "daily" or "monthly"
✅ created_at           | Created timestamp
✅ updated_at           | Updated timestamp
```

---

## 🎯 Most Important Metrics for Admin Dashboard

### **Tier 1 - Must Have** (Essential for overview)
| Metric | Purpose | Sample |
|--------|---------|--------|
| `total_leads` | Total lead count | 72 |
| `google_ads_conversions` | Ads conversions | 22 |
| `form_fills` | SEO form submissions | 50 |
| `gbp_calls` | GBP phone calls | 0 |
| `health_score` | Client health | 85 |
| `mom_leads_change` | Trend (%) | +12.5 |
| `ad_spend` | Total spend | $1,200 |
| `sessions` | Website traffic | 500 |

### **Tier 2 - Should Have** (Detailed metrics)
| Metric | Purpose | Sample |
|--------|---------|--------|
| `seo_clicks` | SEO clicks | 45 |
| `ads_impressions` | Ad impressions | 2,000 |
| `gbp_profile_views` | GBP views | 120 |
| `conversion_rate` | Overall conversion % | 2.5 |
| `gbp_rating_avg` | Review rating | 4.8 |
| `keywords_improved` | SEO wins | 5 |
| `budget_utilization` | Budget used % | 85 |
| `new_users` | New visitors | 45 |

### **Tier 3 - Nice to Have** (Deep analytics)
| Metric | Purpose |
|--------|---------|
| `traffic_organic`, `traffic_paid` | Traffic source breakdown |
| `ads_avg_cpc`, `ads_quality_score` | Ad efficiency |
| `gbp_posts_views`, `days_since_post` | GBP engagement |
| `branded_traffic`, `non_branded_traffic` | SEO breakdown |
| `alerts_count` | Issues/warnings |

---

## 💡 Recommended Admin Dashboard Redesign

### **Option 1: Simple (Current)**
Show only Tier 1 metrics:
- Header stats: Total Clients, Total Leads, Form Fills, GBP Calls
- Client table columns: Name, Leads, SEO Forms, GBP Calls, Ads Conv, Health Score

### **Option 2: Balanced (Recommended)** ⭐
Show Tier 1 + key Tier 2:
- Header stats: Total Clients, Total Leads, Ad Spend, Conversions
- Expandable client cards with:
  - Basic: Name, Leads, Health Score, Status
  - Detailed: Ads Conv, Form Fills, GBP Calls, SEO Clicks, Conversion Rate
  - Chart: Month-over-month trend

### **Option 3: Comprehensive**
Show all relevant metrics in tabbed interface:
- Tab 1: Overview (Tier 1)
- Tab 2: SEO Analytics (seo_clicks, seo_ctr, keywords_improved, etc.)
- Tab 3: Ads Analytics (ads_impressions, ads_ctr, ads_quality_score, etc.)
- Tab 4: GBP Analytics (gbp_website_clicks, gbp_rating_avg, gbp_posts_views, etc.)
- Tab 5: Traffic Sources (traffic_organic, traffic_paid, traffic_direct, etc.)

---

## 📈 Data Quality Notes

**Available Data**:
- ✅ Last 30+ days of data
- ✅ Daily aggregations
- ✅ All 20 clients
- ✅ Complete metrics coverage

**Known Issues**:
- ⚠️ Some metrics show 0 (data not populated yet):
  - `gbp_calls` - Currently 0 for most clients
  - `google_rank` - Not populated
  - `top_keywords` - Shows 0
- ⚠️ Some clients have no data in certain categories

**Good Data Available**:
- ✅ form_fills (SEO forms) - 85+ total across clients
- ✅ google_ads_conversions - 358+ total
- ✅ sessions - Good coverage
- ✅ health_score - 60-85 range
- ✅ budget_utilization - 0-73% range

---

## 🔧 Implementation Tips

### **Quick Wins** (Easy to add)
```typescript
// Add these to client table immediately
const metricsToDisplay = [
  'total_leads',
  'google_ads_conversions',
  'form_fills',
  'sessions',
  'health_score',
  'mom_leads_change',
  'conversion_rate',
  'budget_utilization'
]
```

### **Performance Optimization**
```typescript
// Only SELECT what you need
const { data } = await supabaseAdmin
  .from('client_metrics_summary')
  .select(`
    client_id,
    total_leads,
    google_ads_conversions,
    form_fills,
    gbp_calls,
    health_score,
    mom_leads_change,
    conversion_rate
  `)
  .gte('date', '2026-01-01')
```

### **Aggregation Pattern**
```typescript
// Aggregate last 30 days per client
const metrics = await supabaseAdmin
  .from('client_metrics_summary')
  .select('*')
  .gte('date', dateFrom)

const aggregated = metrics.reduce((acc, m) => {
  if (!acc[m.client_id]) acc[m.client_id] = {}
  Object.keys(m).forEach(key => {
    if (typeof m[key] === 'number') {
      acc[m.client_id][key] = (acc[m.client_id][key] || 0) + m[key]
    }
  })
  return acc
}, {})
```

---

## 📋 Recommended Admin Dashboard Columns

| Position | Column | Field | Format |
|----------|--------|-------|--------|
| 1 | Client | name | Bold text |
| 2 | Health | health_score | Color badge (0-100) |
| 3 | Leads | total_leads | Bold number |
| 4 | SEO | form_fills | Green number |
| 5 | Conversions | google_ads_conversions | Purple number |
| 6 | Spend | ad_spend | Currency ($) |
| 7 | Trend | mom_leads_change | Arrow ↑↓ + % |
| 8 | Conversion % | conversion_rate | Percentage |
| 9 | Sessions | sessions | Gray number |
| 10 | Status | health_score | Badge |

---

## 🚀 Next Steps

1. **Immediate**: Update admin dashboard to use Tier 1 + key Tier 2 metrics
2. **Phase 2**: Add expandable detail rows (lazy load additional metrics)
3. **Phase 3**: Add filtering by metric ranges (e.g., health_score > 80)
4. **Phase 4**: Add date range picker to compare periods
5. **Phase 5**: Add export/download functionality

---

## Summary

**66 total metrics available** covering:
- ✅ Core KPIs (leads, conversions, spend)
- ✅ Website analytics (sessions, users, traffic)
- ✅ SEO performance (impressions, clicks, rankings)
- ✅ Google Ads details (impressions, CTR, quality score)
- ✅ GBP performance (calls, reviews, engagement)
- ✅ Health scoring and trends

**Recommendation**: Use **Option 2 (Balanced)** approach with header stats + client table showing 8-10 key metrics, with ability to expand for details.

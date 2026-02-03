# Client Details Dashboard - Metrics Verification

## Metrics Used in Dashboard vs Supabase Columns

| Dashboard Metric | Code Variable | Supabase Column | Status | Notes |
|---|---|---|---|---|
| **KPI Cards** | | | | |
| Total Leads | `totalLeads` | `total_leads` | ✅ | Sum of all daily total_leads |
| Website Sessions | `sessions` | `sessions` | ✅ | Sum of all daily sessions |
| Ad Spend | `adSpend` | `ad_spend` | ✅ | Sum of all daily ad_spend (was ads_spend - FIXED) |
| Cost Per Lead | `costPerLead` | Calculated | ✅ | ad_spend / totalLeads |
| **6-Month Performance Chart** | | | | |
| Chart Data | `dailyData` | Full dataset | ✅ | Passed to SixMonthBarChart component |
| **Daily Traffic Analysis** | | | | |
| Avg Daily Sessions | `sessions / dailyData.length` | `sessions` | ✅ | Daily average |
| Avg Daily Leads | `totalLeads / dailyData.length` | `total_leads` | ✅ | Daily average |
| Peak Sessions Day | `sessions` | `sessions` | ✅ | Total sessions in period |
| Total Conversions | `totalLeads` | `total_leads` | ✅ | Total leads in period |
| Daily Traffic Chart | `dailyData` | Full dataset | ✅ | Passed to DailyTrafficLineChart component |
| **SEO Performance** | | | | |
| Search Impressions | `seoImpressions` | `seo_impressions` | ✅ | Sum of all daily seo_impressions |
| Clicks | `seoClicks` | `seo_clicks` | ✅ | Sum of all daily seo_clicks |
| CTR | `seoCtr` | Calculated | ✅ | (seo_clicks / seo_impressions) * 100 |
| Health Score | `healthScore` | `health_score` | ✅ | Latest day health_score |
| **Source Attribution** | | | | |
| Traffic Organic | `trafficOrganic` | `traffic_organic` | ✅ | Sum of all daily traffic_organic |
| Traffic Paid | `trafficPaid` | `traffic_paid` | ✅ | Sum of all daily traffic_paid |
| Traffic Direct | `trafficDirect` | `traffic_direct` | ✅ | Sum of all daily traffic_direct |
| Traffic Referral | `trafficReferral` | `traffic_referral` | ✅ | Available in select but not used |
| Traffic AI | `trafficAi` | `traffic_ai` | ✅ | Sum of all daily traffic_ai |
| **Charts** | | | | |
| Traffic Source Donut | `dailyData` | Full dataset | ✅ | Passed to TrafficSourceDonut component |
| **Google Ads Section** | | | | |
| Conversions | `totalAdsConversions` | `google_ads_conversions` | ✅ | Sum of all daily google_ads_conversions |
| Clicks | Ad Clicks | `ads_clicks` | ✅ | Available in select |
| Spend | `adSpend` | `ad_spend` | ✅ | Sum of all daily ad_spend |
| CTR | Ad CTR | `ads_ctr` | ✅ | Available in select |
| **GBP Section** | | | | |
| Phone Calls | `totalGbpCalls` | `gbp_calls` | ✅ | Sum of all daily gbp_calls |
| **Form Submissions** | | | | |
| Form Fills | `totalFormFills` | `form_fills` | ✅ | Sum of all daily form_fills |

## Summary

### All Columns in SELECT Query
```
date, total_leads, form_fills, gbp_calls, google_ads_conversions, sessions,
seo_impressions, seo_clicks, seo_ctr, traffic_organic, traffic_paid,
traffic_direct, traffic_referral, traffic_ai, ads_impressions, ads_clicks,
ads_ctr, ad_spend, cpl, health_score, budget_utilization
```

### Metrics Status
- ✅ **total_leads** - Used ✓
- ✅ **form_fills** - Used ✓
- ✅ **gbp_calls** - Used ✓
- ✅ **google_ads_conversions** - Used ✓
- ✅ **sessions** - Used ✓
- ✅ **seo_impressions** - Used ✓
- ✅ **seo_clicks** - Used ✓
- ✅ **seo_ctr** - Selected but not displayed in current view
- ✅ **traffic_organic** - Used ✓
- ✅ **traffic_paid** - Used ✓
- ✅ **traffic_direct** - Used ✓
- ✅ **traffic_referral** - Selected but not used
- ✅ **traffic_ai** - Used ✓
- ✅ **ads_impressions** - Selected but not displayed
- ✅ **ads_clicks** - Selected but not displayed in current view
- ✅ **ads_ctr** - Selected but not displayed
- ✅ **ad_spend** - Used ✓
- ✅ **cpl** - Selected but not used (could use instead of calculated CPL)
- ✅ **health_score** - Used ✓
- ✅ **budget_utilization** - Selected but not displayed

### Potential Issues Found
1. **ads_clicks not displayed** - Available in Supabase but not shown in Google Ads section
2. **ads_ctr not displayed** - Available but not shown
3. **cpl column ignored** - Using calculated CPL instead of database CPL
4. **traffic_referral not used** - Selected but never used
5. **budget_utilization not used** - Selected but never used

### Recommendation
- Consider displaying ads_clicks, ads_ctr, and ads_impressions in Google Ads section
- Consider using database `cpl` instead of calculated value for consistency
- Remove unused columns from SELECT to optimize query


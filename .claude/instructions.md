# Project Instructions

## MANDATORY: Read Before Any Dashboard Work

Before working on any dashboard feature, you MUST read these files:

1. `DATABASE_SCHEMA.md` - Complete database schema
2. `CLAUDE.md` - Project overview and patterns

## Critical Information

### GBP Column Name Mapping (DIFFERENT between tables!)

| gbp_location_daily_metrics | client_metrics_summary |
|---------------------------|------------------------|
| phone_calls | gbp_calls |
| website_clicks | gbp_website_clicks |
| direction_requests | gbp_directions |
| views | gbp_profile_views |

### Always fetch from BOTH GBP tables and merge data!

```typescript
// Correct pattern
const { data: gbpData } = await supabase.from('gbp_location_daily_metrics')...
const { data: summaryData } = await supabase.from('client_metrics_summary')...
// Merge with preference for detailed data
```

## Dashboard Pages
- `/admin-dashboard/[clientSlug]` - Overview
- `/admin-dashboard/[clientSlug]/seo` - SEO Analytics
- `/admin-dashboard/[clientSlug]/google-ads` - Google Ads
- `/admin-dashboard/[clientSlug]/gbp` - GBP Analytics

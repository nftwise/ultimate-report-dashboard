# Claude Code Instructions

## IMPORTANT: Read Before Coding

Before working on any dashboard feature, Claude MUST read:

1. **DATABASE_SCHEMA.md** - Complete database schema with all tables and columns
2. **FRONTEND_IMPLEMENTATION_SUMMARY.md** - Frontend architecture documentation

## Project Overview

This is the Ultimate Report Dashboard - a Next.js application that displays marketing analytics for clients:
- **SEO Analytics** (GA4 + Google Search Console)
- **Google Ads Performance**
- **Google Business Profile (GBP)** metrics

## Key Database Tables

### Main Tables
- `clients` - Client information (25 clients)
- `client_metrics_summary` - **66 columns** of aggregated daily metrics (USE THIS FIRST)

### GBP Data (IMPORTANT - Different Column Names!)
| gbp_location_daily_metrics | client_metrics_summary |
|---------------------------|------------------------|
| `phone_calls` | `gbp_calls` |
| `website_clicks` | `gbp_website_clicks` |
| `direction_requests` | `gbp_directions` |
| `views` | `gbp_profile_views` |

### Google Ads Data
- `ads_campaign_metrics` - Campaign level data
- `ads_ad_group_metrics` - Ad group level data
- `campaign_conversion_actions` - Conversion tracking
- `campaign_search_terms` - Search terms performance

### SEO/Analytics Data
- `ga4_sessions` - Session data
- `ga4_events` - Event tracking
- `ga4_landing_pages` - Landing page performance
- `gsc_queries` - Search Console keywords
- `gsc_pages` - Search Console pages

## Dashboard Pages

- `/admin-dashboard/[clientSlug]` - Overview (all metrics)
- `/admin-dashboard/[clientSlug]/seo` - SEO Analytics
- `/admin-dashboard/[clientSlug]/google-ads` - Google Ads
- `/admin-dashboard/[clientSlug]/gbp` - Google Business Profile

## Design System

- **Colors**: #2c2419 (dark), #c4704f (accent), #d9a854 (gold), #9db5a0 (green), #10b981 (success)
- **Cards**: Glassmorphism with `rgba(255, 255, 255, 0.9)` + `backdrop-filter: blur(10px)`
- **Layout**: 4-tier structure (KPIs → Charts → Analysis → Granular Data)

## Common Patterns

### Fetching Data from Supabase
```typescript
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

const { data } = await supabase
  .from('table_name')
  .select('columns')
  .eq('client_id', client.id)
  .gte('date', dateFromISO)
  .lte('date', dateToISO)
  .order('date', { ascending: true });
```

### Always Merge GBP Data from Both Tables
```typescript
// Fetch from BOTH tables
const { data: gbpData } = await supabase.from('gbp_location_daily_metrics')...
const { data: summaryData } = await supabase.from('client_metrics_summary')...

// Merge with preference for detailed data, fallback to summary
```

## Tech Stack

- Next.js 14+ (App Router)
- TypeScript
- Supabase (PostgreSQL)
- Recharts for visualizations
- Tailwind CSS + inline styles

## Commands

```bash
npm run dev      # Development server
npm run build    # Production build
npm run lint     # Linting
```

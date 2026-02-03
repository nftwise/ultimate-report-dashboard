# Architecture Guidelines

## Data Fetching Policy

### CORE PRINCIPLE: Direct Supabase Access for Client Components

**All client-side components should fetch data directly from Supabase, NOT through API layer when possible.**

### When to Use Direct Supabase Client Connection
- ✅ Admin dashboard components (`/src/app/admin-dashboard/`)
- ✅ Client detail pages (`/src/app/admin-dashboard/[clientSlug]/`)
- ✅ User-facing dashboards with real-time data
- ✅ Charts and visualization components
- ✅ Any component rendering metrics or performance data

### When to Use API Layer
- ✅ Server-side rendering requirements (SSR)
- ✅ Data aggregation across multiple sources
- ✅ Complex business logic that shouldn't be exposed to client
- ✅ Authentication/Authorization checks
- ✅ External API integrations (GA4, Google Ads, etc.)

### Implementation Examples

#### ❌ AVOID THIS (Using API)
```typescript
// src/components/admin/MonthlyLeadsTrendChart.tsx
const response = await fetch(`/api/admin/monthly-leads-trend`);
```

#### ✅ DO THIS (Direct Supabase)
```typescript
// src/components/admin/MonthlyLeadsTrendChart.tsx
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const { data: metrics } = await supabase
  .from('client_metrics_summary')
  .select('date, form_fills')
  .gte('date', dateFromStr)
  .lte('date', dateToStr)
  .order('date', { ascending: true });
```

### Key Tables & Common Queries

#### client_metrics_summary (Primary Metrics)
```typescript
// Daily aggregated metrics for all clients
{
  client_id,
  date,
  total_leads,      // Sum of all lead sources
  form_fills,       // SEO form submissions (GA4 events ending in "successful")
  google_ads_conversions,
  cpl,              // Cost per lead/conversion
  period_type,      // 'daily', 'monthly', 'yearly'
}

// Query example:
supabase
  .from('client_metrics_summary')
  .select('*')
  .gte('date', '2025-01-01')
  .lte('date', '2025-02-03')
  .order('date', { ascending: true })
```

#### gbp_location_daily_metrics (GBP Data)
```typescript
{
  client_id,
  date,
  phone_calls,
  profile_views,
  // ... other GBP metrics
}
```

#### clients (Client Configuration)
```typescript
{
  id,
  name,
  slug,
  city,
  is_active,
  service_configs: [{
    gads_customer_id,    // Has Google Ads if truthy
    gsc_site_url,        // Has SEO if truthy
    gbp_location_id,     // Has GBP if truthy
  }]
}
```

### Environment Variables
Ensure these are available in browser (NEXT_PUBLIC_* prefix):
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### Performance Optimization
- Use date range filtering (`gte`/`lte`) to limit data
- Order by index columns only (`date`, `client_id`)
- Fetch only needed columns in `select()`
- Add console logging to debug data flow

### Testing Data Flow
```typescript
// Add console logging to verify data:
console.log('[ComponentName] Raw data from Supabase:', {
  recordCount: data?.length || 0,
  firstRecord: data?.[0],
  lastRecord: data?.[data.length - 1],
});
```

---

**Last Updated**: February 3, 2026
**Context**: User preference to minimize API layer and use direct Supabase queries for dashboard components.

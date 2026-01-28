# Admin Dashboard - Metrics Mapping & Data Loading Strategy

> **Last Updated**: January 28, 2026
> **Status**: Ready for Implementation

---

## 📊 ADMIN DASHBOARD DATA STRUCTURE

### Page: `/admin-dashboard`

The admin dashboard is a **BIRDVIEW** of all clients with aggregated KPIs and individual client performance table.

---

## 1️⃣ HEADER SECTION METRICS

### Stats Cards (4 cards with trend indicators)

#### Card 1: TOTAL CLIENTS
```
Source: Supabase `clients` table
Query: SELECT COUNT(*) FROM clients WHERE is_active = true

Display:
├─ Value: 20 (or actual count)
├─ Change: +12.5% (vs last month)
├─ Trend: UP ↑ (green badge)
└─ Timestamp: "5m ago"

SQL Query:
  SELECT COUNT(*) as count
  FROM clients
  WHERE is_active = true AND created_at >= NOW() - INTERVAL '30 days'
```

#### Card 2: TOTAL LEADS
```
Source: Supabase `client_metrics_summary` table
Query: SUM of all client leads for date range

Display:
├─ Value: 443 (total across all clients)
├─ Change: +8.3% (vs previous 30 days)
├─ Trend: UP ↑ (green badge)
└─ Timestamp: "5m ago"

SQL Query:
  SELECT COALESCE(SUM(total_leads), 0) as total_leads,
         COALESCE(SUM(google_ads_conversions), 0) as conversions,
         COALESCE(SUM(form_fills), 0) as form_fills
  FROM client_metrics_summary
  WHERE date BETWEEN NOW() - INTERVAL '30 days' AND NOW()
```

#### Card 3: TOTAL AD SPEND
```
Source: Supabase `client_metrics_summary` table
Query: SUM of all client ad_spend for date range

Display:
├─ Value: $20,618 (formatted currency)
├─ Change: -2.1% (vs previous 30 days)
├─ Trend: DOWN ↓ (red badge - optimization)
└─ Timestamp: "5m ago"

SQL Query:
  SELECT COALESCE(SUM(ad_spend), 0) as total_spend,
         COUNT(DISTINCT client_id) as active_clients
  FROM client_metrics_summary
  WHERE date BETWEEN NOW() - INTERVAL '30 days' AND NOW()
    AND ad_spend > 0
```

#### Card 4: AVG. COST PER LEAD
```
Source: Calculated from aggregated metrics
Formula: total_ad_spend / total_conversions

Display:
├─ Value: $58 (CPL)
├─ Change: -5.7% (vs previous 30 days)
├─ Trend: DOWN ↓ (red badge - efficiency gain)
└─ Timestamp: "5m ago"

Calculation:
  CPL = SUM(ad_spend) / SUM(google_ads_conversions)
  CPL_PREVIOUS = SUM(ad_spend_prev) / SUM(conversions_prev)
  CHANGE = ((CPL_PREVIOUS - CPL) / CPL_PREVIOUS) * 100
```

---

## 2️⃣ MONTHLY LEADS TREND SECTION

### Chart Data (6-month historical trend)

```
Source: Supabase `client_metrics_summary` table
Query: Monthly aggregated leads for last 6 months

Display Format:
├─ Months: Aug, Sep, Oct, Nov, Dec, Jan
├─ Values: [74, 88, 94, 78, 59, 53]
├─ Chart Type: Line chart with bars
└─ Summary Stats:
    ├─ Highest Month: 94 (Oct) - coral color
    ├─ Lowest Month: 53 (Jan) - chocolate color
    └─ Average: 74 (sage color)

SQL Query:
  SELECT DATE_TRUNC('month', date) as month,
         COALESCE(SUM(total_leads), 0) as leads_count,
         COALESCE(SUM(google_ads_conversions), 0) as conversions,
         COALESCE(SUM(form_fills), 0) as form_fills
  FROM client_metrics_summary
  WHERE date >= NOW() - INTERVAL '6 months'
    AND period_type = 'daily'
  GROUP BY DATE_TRUNC('month', date)
  ORDER BY month ASC

Processing:
  ├─ Aggregate daily records by month
  ├─ Sum leads across ALL clients per month
  ├─ Calculate highest/lowest/average
  └─ Format as chart points [{month: "Aug", value: 74}, ...]
```

---

## 3️⃣ CLIENT PERFORMANCE TABLE SECTION

### Table/Card View Toggle Data

All data loads from **TWO SOURCES**:

#### A. Client List (Lightweight)
```
Source: Supabase `clients` table + `service_configs` table

Fields Required:
  ├─ id (UUID)
  ├─ name (string) - client company name
  ├─ slug (string) - for search & URL
  ├─ city (string) - client location
  ├─ is_active (boolean)
  └─ service_configs.services (array: ['SEO', 'ADS', 'GBP'])

SQL Query:
  SELECT
    c.id,
    c.name,
    c.slug,
    c.city,
    c.is_active,
    ARRAY_AGG(DISTINCT 'SEO') FILTER (WHERE c.id IS NOT NULL) as services,
    ARRAY_AGG(DISTINCT 'ADS') FILTER (WHERE c.id IS NOT NULL) as services
  FROM clients c
  LEFT JOIN service_configs sc ON c.id = sc.client_id
  WHERE c.is_active = true
  ORDER BY c.name ASC
```

#### B. Client Metrics (from `client_metrics_summary`)
```
Source: Latest 30 days of aggregated data per client

Fields Per Client:
  ├─ Total Leads (sum of total_leads)
  ├─ Ad Spend (sum of ad_spend)
  ├─ Cost Per Lead (ad_spend / conversions)
  ├─ Conversions (sum of google_ads_conversions + form_fills)
  ├─ CPL Trend (vs previous 30 days)
  ├─ Calls (sum of gbp_calls)
  ├─ Website Clicks (sum of gbp_website_clicks)
  ├─ Status (health_score or derived from trends)
  └─ Trend Direction (↑ improving or ↓ declining)

SQL Query:
  SELECT
    client_id,
    COALESCE(SUM(total_leads), 0) as leads,
    COALESCE(SUM(ad_spend), 0) as spend,
    COALESCE(SUM(google_ads_conversions), 0) as conversions,
    CASE
      WHEN SUM(google_ads_conversions) > 0
      THEN SUM(ad_spend) / SUM(google_ads_conversions)
      ELSE 0
    END as cpl,
    COALESCE(SUM(gbp_calls), 0) as gbp_calls,
    COALESCE(SUM(gbp_website_clicks), 0) as website_clicks,
    COALESCE(SUM(health_score), 0) / COUNT(*) as health_score,
    COALESCE(SUM(mom_leads_change), 0) / COUNT(*) as trend_direction
  FROM client_metrics_summary
  WHERE date BETWEEN NOW() - INTERVAL '30 days' AND NOW()
  GROUP BY client_id
```

### Calculated Fields in Frontend

```javascript
// Per client row calculations:

1. Status Badge
   if (health_score > 80) status = "GOOD" (green)
   if (health_score < 50) status = "CRITICAL" (red)
   else status = "WATCH" (yellow)

2. Trend Arrow
   if (mom_leads_change > 0) trend = "↑" (green)
   else if (mom_leads_change < 0) trend = "↓" (red)
   else trend = "-" (gray)

3. Service Tags
   - Show "SEO" if seo_clicks > 0 OR seo_impressions > 0
   - Show "ADS" if ad_spend > 0 OR ads_clicks > 0
   - Show "GBP" if gbp_calls > 0 OR gbp_profile_views > 0

4. Active Status
   - Show "ACTIVE" if is_active = true (green)
   - Show "INACTIVE" if is_active = false (gray)
```

---

## 4️⃣ SEARCH & FILTERING

### Search Functionality
```
Source: In-memory filtering of loaded clients

Searchable Fields:
  ├─ client.name (case-insensitive)
  └─ client.slug (case-insensitive)

Example Queries:
  ├─ "whole body" → WHOLE BODY WELLNESS
  ├─ "core" → CorePosture
  ├─ "digrado" → Dr DiGrado
  └─ "@whole-body" → WHOLE BODY WELLNESS (by slug)
```

### View Toggle
```
Table View:
  └─ Displays: Name, Services, City, Status, Action button

Card View:
  └─ Grid: Name, Slug, City, Services, View Dashboard button
```

---

## 5️⃣ IMPLEMENTATION SEQUENCE

### Phase 1: Load Basic Client List (Fast)
```
1. Fetch from `clients` table
   - GET /api/clients/list
   - Returns: [{id, name, slug, city, is_active}, ...]
   - Time: ~200ms

2. Load in component state
   - useState: clients, loading, error
   - useEffect: fetchClients() on mount

3. Display client list (no metrics yet)
   - Table with basic info
   - Search works immediately
   - Filters by name/slug
```

### Phase 2: Load Aggregated KPI Cards (Medium)
```
1. Create new API endpoint
   - GET /api/admin/dashboard-stats
   - Returns: {
       totalClients: 20,
       totalLeads: 443,
       totalAdSpend: 20618,
       avgCPL: 58,
       changes: { leads: 8.3, spend: -2.1, cpl: -5.7, clients: 12.5 }
     }
   - Time: ~500ms (query aggregation)

2. Load on mount
   - useEffect: fetchDashboardStats()
   - Display in 4 KPI cards

3. Show trend indicators
   - Green badge for positive changes
   - Red badge for negative changes
```

### Phase 3: Load Monthly Trend Chart (Medium)
```
1. Create new API endpoint
   - GET /api/admin/monthly-leads-trend
   - Query: Last 6 months of aggregated leads
   - Returns: [{month: "Aug", value: 74}, ...]
   - Time: ~300ms

2. Load on mount
   - useEffect: fetchMonthlyTrend()
   - Render chart with bars/line

3. Show summary stats
   - Highest: 94 (Oct)
   - Lowest: 53 (Jan)
   - Average: 74
```

### Phase 4: Load Client Performance Metrics (Heavy)
```
1. Create new API endpoint
   - GET /api/admin/client-performance?limit=50
   - Returns: [{
       id, name, slug, city, is_active,
       leads, spend, cpl, conversions, calls, trend
     }, ...]
   - Time: ~800ms-1.5s (joins multiple tables)

2. Load on mount (or on demand)
   - useEffect: fetchClientMetrics()
   - Store in state: clientMetrics

3. Merge with client list
   - Combine clients + metrics by client_id
   - Calculate derived fields (status badge, trend)
   - Display in table/grid

4. Search filters both
   - Filter clients by name/slug
   - Also search across metrics columns
```

---

## 6️⃣ API ENDPOINTS TO CREATE

### 1. GET `/api/admin/dashboard-stats`
```typescript
Query Params: none
Response: {
  totalClients: number
  activeClients: number
  totalLeads: number
  totalAdSpend: number
  avgCPL: number
  changes: {
    clients: number (%)
    leads: number (%)
    spend: number (%)
    cpl: number (%)
  }
  timestamp: string
}
Time: ~500ms
Cache: 5 minutes
```

### 2. GET `/api/admin/monthly-leads-trend`
```typescript
Query Params: ?months=6
Response: {
  data: [{month: string, value: number}, ...]
  summary: {
    highest: number
    lowest: number
    average: number
    trend: 'up' | 'down' | 'stable'
  }
}
Time: ~300ms
Cache: 1 hour
```

### 3. GET `/api/admin/client-performance`
```typescript
Query Params: ?limit=50&offset=0&sortBy=leads
Response: {
  clients: [{
    id: string
    name: string
    slug: string
    city: string
    is_active: boolean
    metrics: {
      leads: number
      spend: number
      cpl: number
      conversions: number
      calls: number
      websiteClicks: number
      healthScore: number
      trendChange: number (%)
    }
    services: string[] ('SEO', 'ADS', 'GBP')
  }, ...]
  total: number
  timestamp: string
}
Time: ~800-1500ms
Cache: 15 minutes
```

### 4. GET `/api/clients/list` (Existing - Use As Is)
```typescript
Response: {
  clients: [{
    id: string
    name: string
    slug: string
    city: string
    is_active: boolean
  }, ...]
}
Time: ~200ms
Cache: 1 hour
```

---

## 7️⃣ LOADING STRATEGY

### Option A: Sequential (Safe, Slower)
```
1. Load clients list (200ms) ← Show skeleton
2. Load dashboard stats (500ms) ← Show KPI cards
3. Load monthly trend (300ms) ← Show chart
4. Load client metrics (1500ms) ← Show table/grid
```
**Total Time: ~2.5 seconds**

### Option B: Parallel (Fast, Recommended)
```
1. Load clients + dashboard stats + trend + metrics simultaneously
   └─ All 4 requests fire at once

Show Progressive:
  ├─ Clients list: 200ms (immediately sortable/searchable)
  ├─ KPI cards: 500ms (when dashboard stats ready)
  ├─ Chart: 300ms (when trend ready)
  └─ Table/metrics: 1500ms (when performance data ready)
```
**Total Time: ~1.5 seconds (parallel wall-clock time)**

### Option C: Lazy Load (Best UX, Most Complex)
```
1. Load clients + dashboard stats immediately (200ms)
2. Show skeleton for chart + table
3. Load monthly trend on scroll-near (300ms)
4. Load client metrics when scrolling to table (1500ms)
```

**RECOMMENDATION: Use Option B (Parallel) for best balance**

---

## 8️⃣ ERROR HANDLING

### For Each Endpoint:
```
├─ Failed to load stats
│  └─ Show "Unable to load dashboard stats" in KPI section
│     Use fallback: {totalClients: count, totalLeads: 0, ...}
│
├─ Failed to load trend
│  └─ Hide chart section or show "No data available"
│
├─ Failed to load metrics
│  └─ Show table with client list only (no metrics columns)
│     Let search/filter still work
│
└─ Timeout (>3 seconds)
   └─ Show partial results with toast: "Some data unavailable"
```

---

## 9️⃣ REQUIRED SUPABASE QUERIES

Copy these to your `src/lib/admin-queries.ts`:

```typescript
// 1. Dashboard Stats
export const getDashboardStats = async (supabase, days = 30) => {
  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - days);

  const { data, error } = await supabase
    .from('client_metrics_summary')
    .select('*')
    .gte('date', dateFrom.toISOString().split('T')[0]);

  // Aggregate and return
};

// 2. Monthly Trend
export const getMonthlyTrend = async (supabase, months = 6) => {
  const dateFrom = new Date();
  dateFrom.setMonth(dateFrom.getMonth() - months);

  const { data } = await supabase
    .from('client_metrics_summary')
    .select('date, total_leads')
    .gte('date', dateFrom.toISOString().split('T')[0])
    .order('date', { ascending: true });

  // Group by month and return
};

// 3. Client Performance
export const getClientPerformance = async (supabase, days = 30) => {
  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .eq('is_active', true);

  const { data: metrics } = await supabase
    .from('client_metrics_summary')
    .select('*')
    .gte('date', /* 30 days ago */);

  // Join and aggregate by client
};
```

---

## 🔟 TESTING CHECKLIST

- [ ] API endpoints respond within 2 seconds
- [ ] KPI cards show correct totals (verify against database)
- [ ] Monthly trend shows all 6 months
- [ ] Client list loads with all active clients
- [ ] Search filters work (by name and slug)
- [ ] Table view displays all metrics columns
- [ ] Card view shows responsive grid
- [ ] Status badges show correct colors
- [ ] Trend arrows point correct direction (up/down)
- [ ] Service tags only show relevant services
- [ ] No loading spinners after 2 seconds
- [ ] Mobile responsive (tested on iPhone/iPad)
- [ ] Dark mode colors working (if applicable)

---

## 📝 SUMMARY

**Admin Dashboard Data Loading:**

| Component | Source | Time | Records |
|-----------|--------|------|---------|
| KPI Cards | `client_metrics_summary` aggregate | 500ms | 1 (sum) |
| Monthly Trend | `client_metrics_summary` (6 months) | 300ms | 6 |
| Client List | `clients` table | 200ms | 20+ |
| Table Metrics | `client_metrics_summary` + `clients` join | 1500ms | 20+ |

**Recommended Load Order:**
1. Load clients + stats + trend + metrics **in parallel**
2. Display components **progressively** as data arrives
3. Use skeletons for pending data
4. Maintain search/filter even if metrics fail to load


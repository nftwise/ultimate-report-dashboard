---
description: Build a new full-stack dashboard feature (page + API route + charts). Use when asked to create a new page, add a new section, or build a new analytics view.
argument-hint: <feature description, e.g. "facebook ads page for zencare">
allowed-tools: Read Grep Glob Bash Edit Write
context: fork
---

# builder — Full-Stack Feature Developer

You are a senior full-stack developer building features for **Ultimate Report Dashboard**.

## Step 0: Load live project context

Current pages that exist:
!`find src/app/admin-dashboard -name "page.tsx" | sed 's|src/app/admin-dashboard/||; s|/page.tsx||' | sort`

Current components available:
!`ls src/components/admin/`

## Step 1: Read before touching anything

1. Read `DATABASE_SCHEMA.md` — exact column names (GBP names differ between tables!)
2. Read the most similar existing page as reference:
   - Analytics page → read `src/app/admin-dashboard/[clientSlug]/google-ads/page.tsx`
   - SEO/content page → read `src/app/admin-dashboard/[clientSlug]/seo/page.tsx`
3. Read `src/lib/format.ts` — always use `fmtNum`, `fmtCurrency`, `toLocalDateStr`

## Step 2: Clarify scope (ask once, then build)

Ask user ONE question if scope is unclear. After that — just build.

## Step 3: Build order

1. **API route** → `src/app/api/[feature]/route.ts`
2. **Page component** → `src/app/admin-dashboard/[clientSlug]/[feature]/page.tsx`
3. **Tab bar** if needed → `src/components/admin/ClientTabBar.tsx`

## Mandatory patterns (copy exactly)

### Full page skeleton:
```typescript
'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import AdminLayout from '@/components/admin/AdminLayout';
import ClientTabBar from '@/components/admin/ClientTabBar';
import DateRangePicker from '@/components/admin/DateRangePicker';
import ServiceNotActive from '@/components/admin/ServiceNotActive';
import { fmtNum, fmtCurrency, toLocalDateStr } from '@/lib/format';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default function FeaturePage() {
  const { clientSlug } = useParams();
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    // Fetch client by slug, then fetch data
  }, [clientSlug, dateFrom, dateTo]);

  // Loading state
  if (loading || !client) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid #f3f3f3', borderTop: '3px solid #c4704f', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#2c2419', opacity: 0.6 }}>Loading...</p>
        </div>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Feature not active for this client
  if (!client.has_feature) {
    return (
      <AdminLayout>
        <ClientTabBar clientSlug={clientSlug as string} clientName={client.name} clientCity={client.city} activeTab="feature" />
        <ServiceNotActive
          serviceName="Feature Name"
          description="This client does not have Feature Name configured."
        />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <ClientTabBar clientSlug={clientSlug as string} clientName={client.name} clientCity={client.city} activeTab="feature" />
      <DateRangePicker dateFrom={dateFrom} dateTo={dateTo}
        onDateFromChange={setDateFrom} onDateToChange={setDateTo} />
      {/* 4-tier layout: KPIs → Charts → Analysis → Table */}
    </AdminLayout>
  );
}
```

### Recharts pattern:
```typescript
import { LineChart, Line, BarChart, Bar, AreaChart, Area,
         XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

// Always wrap in ResponsiveContainer
<ResponsiveContainer width="100%" height={300}>
  <AreaChart data={chartData}>
    <CartesianGrid strokeDasharray="3 3" stroke="rgba(44,36,25,0.1)" />
    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
    <YAxis tick={{ fontSize: 12 }} />
    <Tooltip />
    <Area type="monotone" dataKey="value" stroke="#c4704f" fill="rgba(196,112,79,0.1)" />
  </AreaChart>
</ResponsiveContainer>
```

### Supabase query (client-side):
```typescript
const { data } = await supabase
  .from('table_name')
  .select('columns')
  .eq('client_id', client.id)
  .gte('date', dateFrom)
  .lte('date', dateTo)
  .order('date', { ascending: true });
```

### service_configs (for API credentials):
```typescript
// API credentials are NOT on clients table directly — use service_configs:
const { data } = await supabase
  .from('clients')
  .select('id, name, city, service_configs(ga_property_id, ads_customer_id)')
  .eq('slug', clientSlug)
  .single();
```

### Design system (non-negotiable):
```
Colors: #2c2419 (dark), #c4704f (accent), #d9a854 (gold), #9db5a0 (green), #10b981 (success)
Cards: background: rgba(255,255,255,0.9); backdropFilter: blur(10px); borderRadius: 12px
Layout: 4-tier — KPIs row → Charts row → Analysis → Granular table
```

## Critical GBP column mapping:
```
gbp_location_daily_metrics  →  client_metrics_summary
phone_calls                 →  gbp_calls
website_clicks              →  gbp_website_clicks
direction_requests          →  gbp_directions
views                       →  gbp_profile_views
```

## Output when done:
- Files created/modified
- `npm run dev` → navigate to `/admin-dashboard/[any-slug]/[feature]`
- New dependencies needed

---

Task: $ARGUMENTS

# Claude Code Instructions

> **NEW SESSION? Start here.** This file + DATABASE_SCHEMA.md = everything you need. No other MD files required.
> Last verified against codebase: 2026-04-08

---

## Skills — Use These First

3 skills in `.claude/skills/`. Auto-detect intent and invoke the correct one:

| Intent | Skill | Trigger words |
|--------|-------|--------------|
| Build new feature, page, dashboard | `/builder` | "build", "tạo", "thêm page", "làm trang", "create" |
| Fix bug, broken UI, wrong data | `/fixer` | "bug", "lỗi", "không hiển thị", "fix", "error", "broken" |
| Sync data, cron, backfill, new API | `/syncer` | "sync", "cron", "data thiếu", "backfill", "integrate" |

Edge cases:
- "cron bị lỗi" → `/fixer` | "thêm cron mới" → `/syncer` | "data hiển thị sai" → `/fixer` | "data bị thiếu hoàn toàn" → `/syncer`

---

## Project Overview

**WiseCRM** — Multi-client marketing analytics dashboard for chiropractic practices (~19 active clients).

**Tech Stack (verified):**
- Next.js 15.5.9 (App Router) + React 19.1.0 + TypeScript 5.9.3
- Supabase (PostgreSQL) — anon key for client reads, service_role for server writes
- Recharts 3.1.2 for charts, Tailwind CSS v4 + inline styles
- NextAuth.js — JWT sessions (30-day), roles: `admin` | `team` | `client`
- bcryptjs for password hashing

**Data sources integrated:**
- Google Analytics 4 (GA4 Data API v1)
- Google Search Console (Search Console API)
- Google Ads (Google Ads API v20)
- Google Business Profile (Business Profile Performance API)
- Facebook Ads (Marketing API v21)

---

## Dashboard Pages (all verified to exist)

### Admin/Team routes (`/admin-dashboard/`)
| Path | Purpose |
|------|---------|
| `/admin-dashboard` | Overview — redirects to first client or client list |
| `/admin-dashboard/clients` | Client management (CRUD, backfill, GBP status) |
| `/admin-dashboard/users` | User management (add/edit/deactivate/reset password) |
| `/admin-dashboard/[clientSlug]` | Client overview — all metrics |
| `/admin-dashboard/[clientSlug]/seo` | SEO: GA4 + GSC |
| `/admin-dashboard/[clientSlug]/google-ads` | Google Ads campaigns |
| `/admin-dashboard/[clientSlug]/gbp` | Google Business Profile |
| `/admin-dashboard/[clientSlug]/geo` | GEO / AI visibility (NEW) |
| `/admin-dashboard/settings` | Account settings — admin/team password change |
| `/admin-dashboard/settings/onboard-fb` | Facebook Ads onboarding |

### Client portal routes (`/portal/[clientSlug]/`)
Middleware blocks clients from `/admin-dashboard/*` → redirects to `/portal/[slug]`.
| Path | Purpose |
|------|---------|
| `/portal/[clientSlug]` | Client overview |
| `/portal/[clientSlug]/seo` | SEO view |
| `/portal/[clientSlug]/google-ads` | Ads view |
| `/portal/[clientSlug]/gbp` | GBP view |
| `/portal/[clientSlug]/geo` | GEO view |
| `/portal/[clientSlug]/facebook` | Facebook Ads view |
| `/portal/[clientSlug]/settings` | Client password change |

---

## Key Database Tables

See `DATABASE_SCHEMA.md` for full column lists.

### Critical — Read First
- `clients` — 19 active clients (is_active=true). Has `sync_group` (A/B/C) for cron batching.
- `service_configs` — Per-client API credentials JSON. **NOT in clients table.** Keys: `ga_property_id`, `gads_customer_id`, `gsc_site_url`, `callrail_account_id`
- `client_metrics_summary` — 66-col daily rollup. **USE THIS for dashboard reads** (fast, pre-aggregated)
- `system_settings` — Global config. Key `gbp_agency_master` stores GBP OAuth token.

### GBP Column Name Mapping (CRITICAL — different between tables!)
| `gbp_location_daily_metrics` | `client_metrics_summary` |
|------------------------------|--------------------------|
| `phone_calls` | `gbp_calls` |
| `website_clicks` | `gbp_website_clicks` |
| `direction_requests` | `gbp_directions` |
| `views` | `gbp_profile_views` |

### client_metrics_summary — KNOWN ZERO COLUMNS (never computed)
These columns exist in DB but are **always 0** — do not display or rely on:
- `ads_phone_calls` — hardcoded 0 (not available at campaign level)
- `days_since_review` — hardcoded 0 (needs historical lookup)
- `days_since_post` — hardcoded 0 (needs historical lookup)
- `alerts_count`, `content_conversions`, `gbp_searches_direct`, `gbp_searches_discovery`, `gbp_q_and_a_count`, `gbp_photos_count`, `mom_leads_change` — never computed in rollup

---

## Cron Architecture (GitHub Actions — NOT Vercel)

Vercel free tier → only 2 cron slots. All daily syncs run via **GitHub Actions** in 3 groups:

| Group | Schedule (UTC) | Clients | Workflow file |
|-------|---------------|---------|---------------|
| A | 09:00 daily | CA South + Orange County | `sync-group-a.yml` |
| B | 10:00 daily | CA North + Mountain + Central | `sync-group-b.yml` |
| C | 11:00 daily | East Coast + Europe | `sync-group-c.yml` |

Each group workflow calls ALL these endpoints in order:
1. `GET /api/cron/sync-ga4?group={A|B|C}` — GA4 sessions
2. `GET /api/cron/sync-gsc?group={A|B|C}` — Search Console
3. `GET /api/cron/sync-ads?group={A|B|C}` — Google Ads (**7-day rolling window** to catch retroactive conversions)
4. `GET /api/cron/sync-gbp?group={A|B|C}` — GBP (**90-day rolling window** to catch lag)
5. `GET /api/admin/run-rollup` — Aggregates into client_metrics_summary

**Additional workflows:**
- `sync-fb-ads.yml` — Facebook Ads daily at 10:25 UTC
- `refresh-fb-token.yml` — FB token renewal on 1st of month at 10:00 UTC
- `gbp-monthly-revalidation.yml` — Re-fetches last 3 months GBP on 2nd of month at 12:00 UTC
- `ci-gate.yml` — 17 data quality checks on every push

**Auth:** All cron endpoints require `Authorization: Bearer ${CRON_SECRET}` header.

---

## GBP API — CORRECT Approach

⚠️ **Always use `fetchGBPRangePerDay`** — returns a `Map<"YYYY-MM-DD", GBPMetrics>`.
Never use single-day queries (start=end) — GBP API suppresses/truncates them.

```typescript
import { fetchGBPRangePerDay, transformGBPMetrics } from '@/lib/gbp-fetch-utils';

// Returns Map<date, metrics> for every day in range
const perDayMap = await fetchGBPRangePerDay(locationId, '2026-03-01', '2026-03-31');

for (const [date, metrics] of perDayMap) {
  const row = transformGBPMetrics(metrics, location.id, location.client_id, date);
  await supabase.from('gbp_location_daily_metrics').upsert(row, {
    onConflict: 'location_id,date',
    ignoreDuplicates: !hasRealData, // never overwrite real data with API zeros
  });
}
```

Token refresh: `GBPTokenManager.getAccessToken()` in `src/lib/gbp-token-manager.ts` — auto-refreshes from `system_settings.gbp_agency_master`.

---

## Common Patterns

### Supabase — server-side (API routes)
```typescript
import { supabaseAdmin } from '@/lib/supabase'; // uses service_role key

const { data, error } = await supabaseAdmin
  .from('client_metrics_summary')
  .select('date, gbp_calls, gbp_profile_views, sessions, ad_spend')
  .eq('client_id', clientId)
  .eq('period_type', 'daily')
  .gte('date', '2026-03-01')
  .lte('date', '2026-03-31')
  .order('date', { ascending: true });
```

### Supabase — client-side (page components)
```typescript
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);
```

### GBP data — always merge from both tables
Dashboard pages should read from `client_metrics_summary` first (fast), fallback to `gbp_location_daily_metrics` for granular daily data.

### Get client from slug (server-side)
```typescript
const { data: client } = await supabaseAdmin
  .from('clients')
  .select('id, name, slug')
  .eq('slug', clientSlug)
  .eq('is_active', true)
  .single();
```

### Get service_configs for a client
```typescript
const { data: config } = await supabaseAdmin
  .from('service_configs')
  .select('ga_property_id, gads_customer_id, gsc_site_url')
  .eq('client_id', clientId)
  .single();
```

### Auth — server-side session check
```typescript
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const session = await getServerSession(authOptions);
const role = (session?.user as any)?.role; // 'admin' | 'team' | 'client'
const userId = (session?.user as any)?.id;
```

---

## Design System

- **Colors**: `#2c2419` (dark/text), `#c4704f` (accent/CTA), `#d9a854` (gold), `#9db5a0` (green), `#10b981` (success)
- **Design tokens**: `src/lib/design-tokens.ts` — COLORS, Z_INDEX, TRANSITIONS, FONT_SIZES, BORDER_RADIUS
- **Cards**: `background: rgba(255,255,255,0.9)` + `backdropFilter: blur(10px)` + `border: 1px solid rgba(44,36,25,0.1)`
- **Layout**: 4-tier — KPIs → Charts → Analysis → Granular Data
- **Sidebar width**: 220px, sticky, `background: linear-gradient(180deg, #f9f7f4, #f5f1ed)`

---

## Key Files — Important Locations

| File | Purpose |
|------|---------|
| `src/lib/gbp-fetch-utils.ts` | GBP API: `fetchGBPRangePerDay`, `transformGBPMetrics` |
| `src/lib/gbp-token-manager.ts` | GBP OAuth token refresh |
| `src/lib/auth.ts` | NextAuth config, JWT callbacks, role mapping |
| `src/lib/supabase.ts` | Supabase client (anon + admin) |
| `src/lib/design-tokens.ts` | Design system constants |
| `src/lib/format.ts` | `fmtCurrency`, `fmtNumber`, `fmtPct` helpers |
| `src/lib/telegram.ts` | `sendCronFailureAlert`, `saveCronStatus` |
| `src/middleware.ts` | Route protection: client → portal, admin/team → admin-dashboard |
| `src/components/admin/AdminLayout.tsx` | Shared sidebar layout (handles all 3 roles) |
| `src/app/api/admin/run-rollup/route.ts` | Main aggregation → client_metrics_summary |
| `src/app/api/cron/sync-gbp/route.ts` | GBP daily sync (90-day window) |
| `src/app/api/cron/sync-ads/route.ts` | Ads daily sync (7-day window for retroactive conversions) |
| `src/app/api/cron/fix-summary-lag/route.ts` | Patches stale zeros in client_metrics_summary |
| `.github/workflows/` | All cron workflows (A/B/C groups + FB + CI gate) |

---

## Commands

```bash
npm run dev      # Dev server (localhost:3000)
npm run build    # Production build
npm run lint     # ESLint
```

---

## Known Issues / Limitations (as of 2026-04-08)

- **Cinque Chiropractic, Healing Hands, Zen Care** — active clients with no GBP location configured yet (waiting for client to grant access)
- **North Alabama Spine & Rehab** — has GBP location in system but is an inactive client (no longer running ads)
- **Abundant Life GA4** — occasionally missing 3-4 days/month (property-level, not a bug)
- **`ads_phone_calls` in client_metrics_summary** — always 0, not available at campaign level
- **Facebook Messenger** — not accessible (pages owned by Business Portfolio need `business_management` permission)
- **Twilio SMS** — configured but requires $20 upgrade + A2P 10DLC registration before SMS works

---

## Workflow Orchestration

### Plan Mode
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- Stop and re-plan if something goes sideways — don't keep pushing

### Subagent Strategy
- Use subagents to keep main context clean
- Parallelize independent queries/tasks
- One focused task per subagent

### Verification
- Never mark complete without proving it works
- Check logs, run rollup, verify DB numbers match API

### Core Principles
- **Simplicity First** — minimal code change, maximal impact
- **No Laziness** — find root causes, no temp fixes
- **Minimal Impact** — only touch what's necessary

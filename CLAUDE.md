# Claude Code Instructions

## IMPORTANT: Read Before Coding

Before working on any dashboard feature, Claude MUST read:

1. **gemini/relay.md** - Latest system changes and historical context (MANDATORY)
2. **DATABASE_SCHEMA.md** - Complete database schema with all tables and columns
3. **FRONTEND_IMPLEMENTATION_SUMMARY.md** - Frontend architecture documentation

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

### GBP API: Date Range Fetching (CRITICAL!)

⚠️ **IMPORTANT**: Always fetch **date ranges**, never individual days!

**Why:** Google's API consolidates data differently:
- Single day (start = end): Incomplete data, 1-6 hour lag
- Date range (start ≠ end): Complete aggregated data, stable

```typescript
import { fetchGBPRange, fetchGBPDay, transformGBPMetrics } from '@/lib/gbp-fetch-utils';

// For backfill/bulk operations: fetch entire month
const metrics = await fetchGBPRange('locationId', '2026-02-01', '2026-02-28');
console.log(metrics.CALL_CLICKS); // 33 (complete data)

// For daily cron: fetch single day (uses range internally)
const metrics = await fetchGBPDay('locationId', '2026-02-01');

// Transform to database schema
const row = transformGBPMetrics(metrics, locationId, clientId, date);
await supabase.from('gbp_location_daily_metrics').upsert(row);
```

**Production Scripts** (in root directory):
- `diagnose_gbp.mjs` - Check token status & connectivity
- `import-gbp-token.mjs` - Initial OAuth setup
- `check_all_clients_gbp.mjs` - Verify data coverage
- `check_jan_vs_provided.mjs` - Validate API data
- `refetch_all_clients.mjs` - Bulk re-sync for all clients

**Cron Job**: `/src/app/api/cron/sync-gbp/route.ts` (runs daily 10:12 UTC)
- Auto-fetches yesterday's data
- Uses new `gbp-fetch-utils` internally
- No manual intervention needed

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

---

## Workflow Orchestration

### 1. Plan Node Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately — don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop
- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes — don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests — then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

## Task Management

1. **Plan First**: Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to `tasks/todo.md`
6. **Capture Lessons**: Update `tasks/lessons.md` after corrections

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.

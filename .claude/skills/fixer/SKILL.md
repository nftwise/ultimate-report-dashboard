---
description: Investigate and fix bugs in the dashboard. Use when something is broken, data isn't showing, a cron job is failing, or there's an error in the console/logs.
argument-hint: <bug description or paste error message>
allowed-tools: Read Grep Glob Bash Edit
context: fork
---

# fixer — Bug Investigator & Resolver

You are a senior debugger. Find root cause, fix it, verify it. Never guess.

## Step 0: Load live project state

Recent code changes (what was touched recently?):
!`git log --oneline -10`

Files changed in last commit:
!`git diff --name-only HEAD~1 HEAD 2>/dev/null | head -20`

## Step 1: Classify the bug

| Symptom | Where to look first |
|---------|-------------------|
| Data not showing on page | `src/app/admin-dashboard/[clientSlug]/[page]/page.tsx` → Supabase query + column names |
| API route returns null/error | `src/app/api/[route]/route.ts` → auth header, column names, RLS |
| Cron job not syncing | `src/app/api/cron/sync-*/route.ts` → timezone, credentials, env vars |
| Aggregated summary wrong | `src/app/api/admin/run-rollup/route.ts` |
| Auth/login broken | `src/middleware.ts` → `src/app/api/auth/` |
| TypeScript errors | `src/types/` + `tsconfig.json` |
| Facebook data missing | `src/app/api/facebook/` → Google Sheets token, column names |

## Step 2: Read before touching

Key files map:
```
src/lib/supabase.ts         — supabaseAdmin (server, bypasses RLS) vs createClient (client, respects RLS)
src/lib/format.ts           — fmtNum, fmtCurrency, toLocalDateStr
src/lib/telegram.ts         — sendCronFailureAlert
src/lib/gbp-fetch-utils.ts  — fetchGBPRange, fetchGBPDay, transformGBPMetrics
src/middleware.ts           — route protection, auth
src/types/                  — all TypeScript interfaces
```

## Step 3: Known bug patterns

### GBP column mismatch (most common bug):
```
gbp_location_daily_metrics → phone_calls, website_clicks, direction_requests, views
client_metrics_summary     → gbp_calls, gbp_website_clicks, gbp_directions, gbp_profile_views
```

### Timezone bug (cron jobs shifting date by 1 day):
```typescript
// WRONG:
new Date('2026-03-01').toISOString() // shifts to 2026-02-28 on PST servers

// CORRECT:
const now = new Date();
const caToday = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
caToday.setDate(caToday.getDate() - 1);
const targetDate = `${caToday.getFullYear()}-${String(caToday.getMonth()+1).padStart(2,'0')}-${String(caToday.getDate()).padStart(2,'0')}`;
```

### Supabase returns null unexpectedly:
- `createClient(ANON_KEY)` → client-side only, limited by RLS
- `supabaseAdmin` from `@/lib/supabase` → server-side, bypasses RLS
- Wrong: using anon client in API route to write data

### service_configs — credentials NOT on clients directly:
```typescript
// WRONG: clients.ga4_property_id (doesn't exist)
// CORRECT:
.select('id, name, service_configs(ga_property_id)')
// Then: (Array.isArray(c.service_configs) ? c.service_configs[0] : c.service_configs)?.ga_property_id
```

### Cron auth failing (401):
```typescript
const authHeader = request.headers.get('authorization');
const cronSecret = process.env.CRON_SECRET;
if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
// Fix: pass Authorization: Bearer <CRON_SECRET> header, or set CRON_SECRET in Vercel env
```

### fetchWithRetry — never use .catch(() => []):
```typescript
// WRONG — silently swallows errors:
const data = await fetchSomething().catch(() => []);

// CORRECT:
const fetchWithRetry = async (fn: () => Promise<any[]>, label: string) => {
  try { return await fn(); }
  catch (err: any) {
    await new Promise(r => setTimeout(r, 2000));
    return await fn(); // throws on 2nd failure, caught by outer try/catch
  }
};
```

## Step 4: Fix

- Minimal change only — don't refactor surrounding code
- Don't add features while fixing

## Step 5: Verify

```bash
npx tsc --noEmit 2>&1 | head -20
```

Confirm the specific symptom is gone. Check adjacent features still work.

## Output:
- Root cause (1-2 sentences, specific)
- File(s) + line numbers changed
- How to verify fix works

---

Bug report: $ARGUMENTS

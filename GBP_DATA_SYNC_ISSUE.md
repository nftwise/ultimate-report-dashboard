# GBP Data Sync Issue - Root Cause Analysis

**Date:** 2026-02-04
**Status:** 🔴 **DATA SYNC PROBLEM - Not a Code Problem**

---

## Executive Summary

The dashboard code is **correct** and **working as designed**. The issue is that **GBP data is not being synced to the database**.

- **GBP data latest date:** 2026-01-23 (11 days old)
- **Metrics data latest date:** 2026-02-03 (today)
- **Gap:** 11 days without GBP updates

When users view recent dates (Jan 24 - Feb 4), there's no GBP data to merge, so Phone Calls, Web Clicks, and Directions show 0.

---

## Data Sync Status

| Table | Latest Date | Days Ago | Status |
|-------|------------|----------|--------|
| `client_metrics_summary` | 2026-02-03 | 1 day | ✅ Current |
| `gbp_location_daily_metrics` | 2026-01-23 | 11 days | ❌ **Stale** |

---

## Why Phone Calls Show 0

### Current Situation:
```
User selects: 30-day range ending 2026-02-04
↓
Client metrics fetched: 2026-01-05 to 2026-02-04 ✅
GBP metrics fetched: 2026-01-05 to 2026-02-04 (but latest available is 2026-01-23)
↓
Merge logic tries to match dates:
  2026-01-24 (metrics available, GBP not available) → Phone Calls = 0
  2026-01-25 (metrics available, GBP not available) → Phone Calls = 0
  ...
  2026-02-04 (metrics available, GBP not available) → Phone Calls = 0
↓
Result: All recent data shows 0 for GBP metrics
```

### But if users select dates with GBP data:
```
User selects: 2026-01-15 to 2026-01-20
↓
Both tables have data for these dates
↓
Merge logic works perfectly:
  2026-01-19 (metrics=✅, GBP=✅ 5 calls) → Phone Calls = 5
  2026-01-15 (metrics=✅, GBP=✅ 7 calls) → Phone Calls = 7
```

---

## Test Results

### DeCarlo Chiropractic GBP Recent Data:
```
2026-01-23: 0 calls   ← Latest available
2026-01-22: 0 calls
2026-01-21: 0 calls
2026-01-20: 0 calls
2026-01-19: 5 calls   ← Has real data
2026-01-15: 7 calls   ← Has real data
2026-01-14: 2 calls   ← Has real data
```

Data stops syncing after Jan 23. No data from Jan 24 onwards.

---

## Root Cause

### Not a Code Issue ✅
- Merge logic is correct
- Date matching works properly
- GBP fetch query is correct
- Data types are correct
- Fallback logic works

### Is a Data Sync Issue ❌
- GBP integration stopped syncing 11 days ago
- Google Business Profile API may have:
  - Rate limit reached
  - Authentication expired
  - Integration disabled
  - API key revoked
  - Service suspended

---

## What Users See

### Before Jan 24:
```
Phone Calls: 5 ✅
Web Clicks: 15 ✅
Directions: 8 ✅
```
(GBP data available, merge works)

### From Jan 24 onwards:
```
Phone Calls: 0 ❌
Web Clicks: 0 ❌
Directions: 0 ❌
```
(No GBP data, merge returns empty, defaults to 0)

---

## Impact Assessment

| Aspect | Impact | Severity |
|--------|--------|----------|
| Dashboard Functionality | Merge logic works perfectly | 🟢 None |
| Code Logic | All correct, no bugs | 🟢 None |
| Data Accuracy | Shows 0 for missing GBP data | 🔴 High |
| User Experience | Confusing why recent dates show 0 | 🟡 Medium |
| Business Decisions | Can't analyze recent GBP performance | 🔴 High |

---

## Required Actions

### Immediate (Required):
1. **Check GBP Integration Status**
   - Verify API keys in environment
   - Check authentication tokens haven't expired
   - Test API connectivity
   - Review rate limit usage

2. **Check Data Sync Service**
   - Is background job running?
   - Are there any error logs?
   - Is database write permission intact?
   - Check for failures in past 11 days

3. **Manual Data Sync Test**
   ```sql
   -- Check when last GBP data was inserted
   SELECT MAX(created_at) FROM gbp_location_daily_metrics;
   -- Should be recent, not 11 days ago
   ```

### Diagnostic Queries:
```sql
-- Check GBP data freshness
SELECT
  MAX(date) as latest_date,
  COUNT(*) as total_records,
  COUNT(DISTINCT client_id) as unique_clients
FROM gbp_location_daily_metrics
WHERE date >= '2026-01-20';

-- Check if data creation stopped
SELECT date, COUNT(*) as records
FROM gbp_location_daily_metrics
WHERE date >= '2026-01-15'
GROUP BY date
ORDER BY date DESC;
```

---

## Verification Steps

### For Developers:
1. Run: `node check-gbp-date-range.js`
2. Verify latest GBP date vs today's date
3. If gap > 3 days: Data sync is broken
4. Check API integration service logs

### For Dashboard Users:
1. Select date range: 2026-01-10 to 2026-01-20
2. GBP metrics should show real numbers
3. Select date range: 2026-01-24 to 2026-02-04
4. GBP metrics will show 0 (because no data synced)

---

## Temporary Workaround

### Show Date Range Disclaimer:
Add message to dashboard:
```
⚠️ GBP data available through 2026-01-23
Current data may be incomplete
```

### Adjust Default Date Range:
Instead of "Last 30 days", use "Last 20 days" so it includes 2026-01-15 to 2026-02-04...
Actually no, that won't work either since data stops at 01-23.

**Better approach:** Change default to show data with actual GBP coverage:
```javascript
// Use last 20 days of available data instead of calendar days
const to = '2026-01-23'; // Latest GBP date
const from = '2026-01-03'; // 20 days before
```

---

## Prevention

### Add Monitoring:
```javascript
// Add to sync job
if (latestGbpDate < today - 3days) {
  alert('GBP data sync stopped');
  sendAlert('GBP_SYNC_FAILURE');
}
```

### Add Dashboard Warning:
```jsx
{latestGbpDate < today && (
  <div className="warning">
    ⚠️ GBP data is {daysStale} days old
  </div>
)}
```

---

## Summary

### The Dashboard Code: ✅ Working Perfectly
- Fetches both metrics and GBP data
- Merges by date correctly
- Handles missing data gracefully
- Shows 0 when no data available

### The Data Sync: ❌ Not Working
- GBP data stopped syncing 11 days ago
- Latest GBP date: 2026-01-23
- No data from Jan 24 onwards
- API integration likely broken

### Next Steps:
1. Check GBP API integration status
2. Verify authentication credentials
3. Review sync service logs
4. Restart data sync if needed
5. Verify data is being collected again

**The code isn't wrong - the data is stale.**

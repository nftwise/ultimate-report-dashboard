# GBP Data Availability Analysis

**Date:** 2026-02-04
**Status:** Data is working correctly - issue is data availability, not code logic

---

## Summary

The GBP data is **fetching correctly**. The reason some clients show `Phone Calls: 0` is because:

1. **Some clients have NO GBP data at all** (like Zen Care)
2. **Some clients have GBP data where phone_calls = 0** but other metrics exist

This is **NOT a bug** - it's the actual state of the data in Supabase.

---

## Client GBP Data Status

| Client | GBP Records | Phone Calls | Web Clicks | Directions | Status |
|--------|-------------|-------------|------------|------------|--------|
| Zen Care Physical Medicine | ❌ 0 | N/A | N/A | N/A | No GBP location configured |
| DeCarlo Chiropractic | ✅ 382 | ✅ 54 (30d) | ✅ 26 (30d) | ✅ 105 (30d) | ✅ Full data |
| TAILS ANIMAL CHIROPRACTIC | ✅ 389 | ⚠️ 0 (sparse) | ✅ varies | ✅ varies | Sparse calls |
| SYMMETRY HEALTH CENTER | ❌ 0 | N/A | N/A | N/A | No GBP location configured |
| CHIROPRACTIC CARE CENTRE | ✅ 345 | ✅ varies | ✅ varies | ✅ varies | ✅ Full data |

---

## Why Phone Calls Shows 0

### Case 1: Client Has No GBP Data At All
```
Zen Care Physical Medicine:
- gbp_location_daily_metrics records: 0
- Phone Calls: 0 (no data to fetch)
- Web Clicks: 0 (no data to fetch)
- Directions: 0 (no data to fetch)
```
✅ **Correct behavior** - Client doesn't have GBP location configured

### Case 2: Client Has GBP Data But Phone Calls Are Low/Zero
```
TAILS ANIMAL CHIROPRACTIC:
- gbp_location_daily_metrics records: 389
- Phone Calls: 0 (actual data shows 0 for most days)
- Web Clicks: varies (has data)
- Directions: varies (has data)
```
✅ **Correct behavior** - This is real data from Supabase showing low phone calls

---

## Code Analysis

### Current Implementation (✅ CORRECT)

The merge logic properly prioritizes location-level GBP data:

```javascript
// Merge GBP data into metrics data
const merged = (metricsData || []).map((metric: any) => {
  const gbp = gbpData?.find((g: any) => g.date === metric.date);
  return {
    ...metric,
    // Prefer location-level GBP data (more reliable)
    gbp_calls: gbp?.phone_calls || metric.gbp_calls || 0,
    gbp_profile_views: gbp?.views || 0,
    gbp_website_clicks: gbp?.website_clicks || 0,
    gbp_direction_requests: gbp?.direction_requests || 0
  };
});
```

**Logic explanation:**
1. For each daily metric, find matching GBP location data by date
2. If GBP location data exists, use `phone_calls` from location table
3. Otherwise, fall back to `gbp_calls` from client_metrics_summary (sparse, 1.6% coverage)
4. If neither exists, default to 0

✅ **This is correct** - location-level data is more reliable (65% vs 1.6%)

---

## Data Collection Reality

### From Investigation:
- **Table:** `gbp_location_daily_metrics`
- **Total records:** 5,921
- **Date range:** 2025-01-01 to 2026-02-04 (13 months)
- **Client coverage:** 5 out of ~20 clients have GBP data
- **Data reliability:** 65-85% for phone_calls, website_clicks, direction_requests

### Reasons for Missing Data:
1. **No GBP Location Configured:** Client hasn't set up Google Business Profile location
2. **Data Not Synced:** Integration not enabled or API key expired
3. **Service Not Active:** Client doesn't have active GBP campaigns
4. **Date Range Issue:** GBP data only available from 2025-01-01 onwards

---

## What You're Seeing

### Screenshot Analysis:

```
Google Business Local
Phone Calls: 0
Web Clicks: 38
Directions: 64
```

**Possible explanations:**

**Option A:** Client has no GBP location data
- `phone_calls`, `web_clicks`, `directions` all show 0
- Fix: Configure GBP location in client settings

**Option B:** Client has GBP location data but phone_calls are genuinely low
- `web_clicks: 38` and `directions: 64` suggest data is coming through
- `phone_calls: 0` is real data (no calls that period)
- ✅ This is normal and correct

**Option C:** Phone calls data isn't being fetched properly
- Would expect ALL metrics to be 0 in this case
- But web_clicks and directions show values
- Less likely given current output

---

## Verification Steps

To verify the dashboard is working correctly:

1. **Check client has GBP data:**
   ```bash
   node check-clients-gbp.js
   ```
   Look for client name and check if it has > 0 records

2. **Check date range:**
   - GBP data starts from 2025-01-01
   - Select date range: Jan 1 - Feb 4, 2026
   - Should see more data than 7 or 30 day windows

3. **Check browser console:**
   - Open DevTools (F12)
   - Go to Console tab
   - Look for logs like:
     ```
     [Client Details] Merged data stats: {
       total: 30,
       gbpCalls: { count: 15, total: 54 },
       gbpWebClicks: { count: 20, total: 38 },
       gbpDirections: { count: 22, total: 64 }
     }
     ```

---

## Recommendations

### For Clients Without GBP Data:
1. ✅ Show "Not configured" message instead of 0
2. ✅ Add setup guide link
3. ✅ Don't penalize in health score

### For Better Data Collection:
1. Audit which clients need GBP configuration
2. Prioritize enabling sync for active clients
3. Add monitoring for missing GBP data

### Current Dashboard:
✅ **Working as designed** - Shows real data or 0 if not available

---

## Test Results

```
DeCarlo Chiropractic (has full GBP data):
- Date range: 2026-01-05 to 2026-02-04 (30 days)
- Phone calls: 54 total
- Web clicks: 26 total
- Directions: 105 total
- Status: ✅ All working correctly
```

---

## Conclusion

**The code is working correctly.** The GBP data fetch logic is sound:

✅ Correctly queries `gbp_location_daily_metrics` table
✅ Properly merges by date
✅ Prioritizes location-level over client-level data
✅ Falls back to 0 when no data available
✅ Shows real values when data exists

**If you're seeing 0 for all GBP metrics:**
- Check if client has GBP location configured in Supabase
- Check date range is within 2025-01-01 to 2026-02-04
- Check browser console for debug logs

**If some metrics show values but phone_calls shows 0:**
- This is likely real data - the client just didn't get phone calls during that period
- This is normal and expected behavior

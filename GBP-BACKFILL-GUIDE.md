# GBP Backfill Guide

## 📋 Prerequisites

1. **GBP OAuth Token Setup** ✅
   - Admin email must be authenticated with GBP OAuth
   - Token stored in `.oauth-tokens/gbp-master.json` or Supabase
   - Check token status:
     ```bash
     curl http://localhost:3000/api/admin/debug-gbp
     ```

2. **Environment Variables** ✅
   - Supabase credentials in `.env.local`
   - GBP OAuth credentials configured

3. **TypeScript + ts-node** ✅
   ```bash
   npm install -g ts-node typescript
   ```

---

## 🚀 Quick Start (Recommended)

### Step 1: Start Dev Server
```bash
npm run dev
```

### Step 2: Run Backfill Script
```bash
# Simple version (recommended for first time)
npx ts-node scripts/gbp-backfill-simple.ts --year 2024 --dry-run

# If dry-run looks good, execute it
npx ts-node scripts/gbp-backfill-simple.ts --year 2024
```

---

## 📖 Usage Examples

### Backfill 1 Year (2024) - DRY RUN
```bash
npx ts-node scripts/gbp-backfill-simple.ts --year 2024 --dry-run
```
**Output preview without uploading**

### Backfill and Upload
```bash
npx ts-node scripts/gbp-backfill-simple.ts --year 2024
```
**Fetches and uploads to Supabase**

### Limit to First 5 Locations (Testing)
```bash
npx ts-node scripts/gbp-backfill-simple.ts --year 2024 --limit 5
```

### Backfill Last 90 Days
```bash
npx ts-node scripts/gbp-backfill-simple.ts --days-ago 90
```

### Backfill Specific Year with Verbose Output
```bash
npx ts-node scripts/gbp-backfill-simple.ts --year 2023 --days-ago 365
```

---

## 📊 Script Options

| Option | Default | Description |
|--------|---------|-------------|
| `--year` | 2024 | Year to backfill |
| `--days-ago` | 365 | Days back to fetch from today |
| `--limit` | 999 | Limit number of locations (useful for testing) |
| `--dry-run` | false | Preview without uploading |

---

## ⚙️ What the Script Does

### 1. Authenticate
- Reads GBP OAuth token from `.oauth-tokens/` or environment

### 2. Fetch Locations
- Gets all GBP locations from Google Business Profile API
- Maps to client accounts

### 3. Fetch Metrics (Per Location)
- `WEBSITE_CLICKS` - website traffic
- `BUSINESS_DIRECTION_REQUESTS` - direction requests
- `CALL_CLICKS` - phone calls
- Daily data for specified date range

### 4. Upload to Supabase
- Posts to `/api/admin/gbp/backfill`
- UPSERT to avoid duplicates
- Returns success/error report

---

## 📈 Expected Output

```
🚀 GBP Backfill Starting...

   API Base: http://localhost:3000
   Year: 2024
   Days: 365
   Dry Run: false

✅ Using GBP token from gbp-master.json
🌍 Fetching GBP locations...
✅ Found 3 locations

📅 Date range: 2024-01-01 to 2025-01-23

   📍 Location 1
      → 365 daily records
   📍 Location 2
      → 365 daily records
   📍 Location 3
      → 365 daily records

✅ Fetched data:
   Locations: 3
   Daily Metrics: 1095

📤 Uploading to backfill endpoint...

✅ Backfill Complete!

📊 Upload Results:
   Locations: 3 inserted, 0 skipped
   Metrics: 1095 inserted, 0 skipped

✨ Done!
```

---

## 🔄 Daily Cronjob Setup

After backfill, set up daily sync:

### Option A: Manual Daily Run
```bash
# Add to crontab (Linux/Mac)
0 2 * * * cd /path/to/project && npx ts-node scripts/gbp-backfill-simple.ts --days-ago 1 >> /tmp/gbp-sync.log 2>&1
```

### Option B: Node Cronjob
```bash
# Create: scripts/gbp-daily-sync.ts
# (Will be provided in next update)
```

### Option C: API Endpoint Cronjob
```bash
# Use: POST /api/cron/gbp-sync
# Trigger from: external service (EasyCron, GitHub Actions, etc.)
```

---

## ❌ Troubleshooting

### ❌ "GBP OAuth token not found"
```bash
# Set up GBP OAuth first
npm run auth-gbp
# Or use admin endpoint:
curl http://localhost:3000/api/admin/gbp-reauth
```

### ❌ "No GBP locations found"
- Check if OAuth scope includes `business.manage`
- Verify token is valid: `curl http://localhost:3000/api/admin/debug-gbp`
- Make sure GBP locations are created in Google Business Profile

### ❌ "Upload failed: 401 Unauthorized"
- Supabase credentials may be missing
- Check `.env.local` has `SUPABASE_SERVICE_ROLE_KEY`

### ❌ Rate Limited (429 errors)
- Script has built-in delays (200ms between requests)
- Reduce `--limit` for batch processing
- Or run with smaller `--days-ago` values

---

## 📝 API Endpoint Reference

### POST `/api/admin/gbp/backfill`

**Request:**
```json
{
  "locations": [
    {
      "client_id": "UUID or name",
      "gbp_location_id": "locations/ChIJXXX...",
      "location_name": "Business Name",
      "address": "123 Main St",
      "phone": "(555) 123-4567",
      "website": "https://example.com",
      "business_type": "Chiropractic"
    }
  ],
  "daily_metrics": [
    {
      "gbp_location_id": "locations/ChIJXXX...",
      "date": "2024-01-15",
      "views": 150,
      "actions": 45,
      "direction_requests": 12,
      "phone_calls": 8,
      "website_clicks": 25,
      "total_reviews": 42,
      "average_rating": 4.8
    }
  ],
  "posts": [],
  "photos": []
}
```

**Response:**
```json
{
  "success": true,
  "message": "Backfill completed",
  "results": {
    "locations": { "inserted": 3, "skipped": 0, "errors": [] },
    "daily_metrics": { "inserted": 1095, "skipped": 0, "errors": [] },
    "posts": { "inserted": 0, "skipped": 0, "errors": [] },
    "photos": { "inserted": 0, "skipped": 0, "errors": [] }
  }
}
```

---

## 💡 Tips

1. **Always do dry-run first:**
   ```bash
   npx ts-node scripts/gbp-backfill-simple.ts --year 2024 --dry-run
   ```

2. **Test with fewer locations:**
   ```bash
   npx ts-node scripts/gbp-backfill-simple.ts --year 2024 --limit 1
   ```

3. **Verify in Supabase:**
   - Check `gbp_locations` table for location records
   - Check `gbp_location_daily_metrics` table for daily data
   - Check `gbp_sync_log` for sync history

4. **Monitor logs:**
   ```bash
   tail -f /tmp/gbp-sync.log
   ```

---

## 🎯 Next Steps

After backfill:

1. **Create GBP Dashboard Page**
   - Display daily metrics
   - Show trending data
   - Compare locations

2. **Set Up Daily Cronjob**
   - Auto-sync latest data
   - Keep 1-year history

3. **Add GBP OAuth Auth**
   - Allow clients to authenticate
   - Auto-populate their GBP data

---

## 📞 Support

Issues? Check:
- `.env.local` - Supabase credentials
- GBP OAuth token - Valid and not expired
- API endpoint - Running on `http://localhost:3000`
- TypeScript - `npx ts-node --version`

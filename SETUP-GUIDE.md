# 🚀 Complete Setup & Integration Guide

> **All-in-one guide for setup, integration, deployment, and troubleshooting**
>
> Latest Update: January 28, 2026

---

## 📋 TABLE OF CONTENTS

1. [Quick Start (5 Minutes)](#1-quick-start-5-minutes)
2. [Complete Setup Guide](#2-complete-setup-guide)
3. [Service Integration (GA, GSC, GBP, Ads, CallRail)](#3-service-integration)
4. [Backfill & Historical Data](#4-backfill--historical-data)
5. [Deployment (Vercel)](#5-deployment-vercel)
6. [Troubleshooting](#6-troubleshooting)

---

## 1. QUICK START (5 MINUTES)

### Step 1: Add Your Clients (2 minutes)

Database approach (recommended):
```sql
-- Add client to Supabase clients table
INSERT INTO clients (id, slug, name, contact_email, city, owner, is_active)
VALUES (
  gen_random_uuid(),
  'dr-digrado',
  'Dr DiGrado Chiropractic',
  'admin@drdigrado.com',
  'Austin, TX',
  'Dr DiGrado',
  true
);

-- Add service configs
INSERT INTO service_configs (client_id, ga_property_id, gads_customer_id, gsc_site_url)
SELECT id, '326814792', '2812810609', 'https://drdigrado.com'
FROM clients WHERE slug = 'dr-digrado';
```

Legacy JSON approach (if using clients.json):
```json
{
  "clients": [
    {
      "id": "dr-digrado",
      "companyName": "Dr DiGrado Chiropractic",
      "googleAnalyticsPropertyId": "326814792",
      "googleAdsCustomerId": "2812810609",
      "callrailAccountId": "ACCe5277425fcef4c6cbc46addc72f11323"
    }
  ]
}
```

### Step 2: Start Dashboard (1 minute)

```bash
npm run dev
```

Wait for: `✓ Ready → Local: http://localhost:3000`

### Step 3: Open Admin Dashboard (30 seconds)

Go to: `http://localhost:3000/admin-dashboard`

### Step 4: Select a Client (10 seconds)

Click dropdown and select any client to see their dashboard!

---

## 2. COMPLETE SETUP GUIDE

### Multi-Tenant Architecture

One system, many clients:

```
┌─────────────────────────────────────────┐
│  Admin Dashboard                        │
│  ├─ Dropdown: [Dr DiGrado ▼]            │
│  │  - Dr DiGrado                        │
│  │  - Polished Cary Salon               │
│  │  - ...22 more clients                │
│  └─ Shows selected client's data only   │
└─────────────────────────────────────────┘
```

**How it works:**
1. Admin selects client
2. Browser sends: `?clientId=dr-digrado`
3. API looks up client's credentials
4. API fetches THEIR Google Analytics, Ads, etc.
5. Dashboard shows THEIR data only

**Key files:**
- `src/lib/server-utils.ts` - Fetches client config from Supabase
- `src/app/api/dashboard/route.ts` - Main API endpoint
- `src/app/admin-dashboard/page.tsx` - Admin page

---

## 3. SERVICE INTEGRATION

### 3.1 Google Analytics Setup

1. **Enable API**
   - Go: https://console.cloud.google.com/
   - **APIs & Services** → **Library**
   - Search: "Google Analytics Data API"
   - Click **Enable**

2. **Create Service Account**
   - **APIs & Services** → **Credentials**
   - **Create Credentials** → **Service Account**
   - Fill details, click **Create and Continue**

3. **Create Private Key**
   - Find service account → **Keys** tab
   - **Add Key** → **Create new key**
   - Select **JSON**, download

4. **Add to Google Analytics Property**
   - Go: https://analytics.google.com
   - **Admin** → **Property** → **Property access management**
   - **Add users** → paste service account email
   - Give **Editor** access

5. **Add to Environment**
   ```bash
   GOOGLE_CLIENT_EMAIL=your-service-account@...iam.gserviceaccount.com
   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
   GOOGLE_ANALYTICS_PROPERTY_ID=123456789
   ```

---

### 3.2 Google Search Console Setup

1. **Verify Property**
   - Go: https://search.google.com/search-console
   - Ensure property verified (e.g., `https://drdigrado.com`)

2. **Add Service Account**
   - **Settings** → **Users and permissions**
   - **Add user** → enter service account email
   - Give **Full** access

3. **Wait for Propagation**
   - Google takes 5-10 minutes

4. **Add to Environment**
   ```bash
   GOOGLE_SEARCH_CONSOLE_SITE_URL=https://drdigrado.com
   ```

---

### 3.3 Google Business Profile (GBP) Setup

1. **Enable APIs**
   - https://console.cloud.google.com/
   - Enable: **Business Profile Performance API**
   - Enable: **My Business Business Information API**

2. **Get Location IDs**
   ```bash
   curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
     https://mybusinessbusinessinformation.googleapis.com/v1/accounts/{ACCOUNT_ID}/locations
   ```
   Format: `accounts/1234567890/locations/9876543210`

3. **Add to Client Config**
   ```sql
   UPDATE service_configs
   SET gbp_location_id = 'accounts/1234567890/locations/9876543210'
   WHERE client_id = (SELECT id FROM clients WHERE slug = 'decarlo-chiro');
   ```

4. **OAuth Setup (Optional)**
   - Visit: `http://localhost:3000/api/auth/google-business`
   - Authorize with your Google account
   - Token auto-saved to Supabase

---

### 3.4 Google Ads Setup

1. **Get Developer Token**
   - Go: https://ads.google.com
   - **Tools** → **API Center**
   - Request developer token (24-48 hours)

2. **Create OAuth Credentials**
   - https://console.cloud.google.com/
   - **APIs & Services** → **Credentials**
   - **Create Credentials** → **OAuth 2.0 Client ID**
   - Select **Desktop application**

3. **Add to Environment**
   ```bash
   GOOGLE_ADS_DEVELOPER_TOKEN=your_token
   GOOGLE_ADS_CLIENT_ID=your_client_id
   GOOGLE_ADS_CLIENT_SECRET=your_client_secret
   GOOGLE_ADS_REFRESH_TOKEN=your_refresh_token
   GOOGLE_ADS_CUSTOMER_ID=1234567890
   ```

---

### 3.5 CallRail Setup

1. **Get API Token**
   - Go: https://app.callrail.com
   - **Settings** → **API**
   - Click **Generate API Token**

2. **Get Account ID**
   - **Account Settings** → **General**
   - Copy Account ID

3. **Add to Environment**
   ```bash
   CALLRAIL_API_TOKEN=your_token
   CALLRAIL_ACCOUNT_ID=your_account_id
   ```

---

## 4. BACKFILL & HISTORICAL DATA

### Strategy

**Instead of real-time API calls** (slow):
- Fetch data once to Supabase (fast DB queries)
- Daily 2 AM cronjob auto-updates

**Benefits:**
- Dashboard loads in < 1 second
- 90% API quota reduction
- No timeout issues

### Setup

#### Step 1: Check Status
```bash
curl http://localhost:3000/api/admin/check-supabase-data
```

Expected:
- ✅ `client_metrics_summary`: 9,000+ records
- ✅ `gbp_locations`: 18 locations
- ✅ `gbp_location_daily_metrics`: 6,000+ records

#### Step 2: Run Backfill (Dry-Run First)
```bash
# Preview without uploading
npx tsx scripts/gbp-backfill-simple.ts --year 2024 --dry-run

# Preview metrics backfill
npx tsx scripts/backfill-metrics.ts 180 --dry-run
```

#### Step 3: Execute Backfill
```bash
# Run GBP backfill
npx tsx scripts/gbp-backfill-simple.ts --year 2024

# Run metrics backfill (180 days)
npx tsx scripts/backfill-metrics.ts 180
```

#### Step 4: Verify
Check Supabase tables:
- `gbp_locations` - location records
- `gbp_location_daily_metrics` - daily data
- `client_metrics_summary` - aggregated metrics

### Daily Cronjob Setup

**Already configured in Vercel:**
```
0 2 * * *  POST /api/admin/run-rollup
```

This runs at **2 AM UTC** every day.

---

## 5. DEPLOYMENT (VERCEL)

### Pre-Deployment Checklist

- [ ] Test build: `npm run build`
- [ ] Test start: `npm start`
- [ ] All APIs working locally
- [ ] All env vars set

### Required Environment Variables

Set in **Vercel Dashboard** → **Settings** → **Environment Variables**:

```bash
# Google Analytics
GOOGLE_CLIENT_EMAIL=analysis-api@...iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
GOOGLE_ANALYTICS_PROPERTY_ID=326814792

# Google Search Console
GOOGLE_SEARCH_CONSOLE_SITE_URL=https://drdigrado.com

# Google Ads (optional)
GOOGLE_ADS_DEVELOPER_TOKEN=your_token
GOOGLE_ADS_CLIENT_ID=your_id
GOOGLE_ADS_CLIENT_SECRET=your_secret
GOOGLE_ADS_REFRESH_TOKEN=your_token
GOOGLE_ADS_CUSTOMER_ID=1234567890

# CallRail
CALLRAIL_API_TOKEN=your_token
CALLRAIL_ACCOUNT_ID=your_id

# NextAuth (generate new for production!)
NEXTAUTH_SECRET=generate_with_openssl_rand_base64_32
NEXTAUTH_URL=https://your-domain.vercel.app

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key

# Google OAuth (GBP)
GOOGLE_OAUTH_CLIENT_ID=your_oauth_id
GOOGLE_OAUTH_CLIENT_SECRET=your_oauth_secret
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
```

### Deploy Methods

**Method 1: Vercel CLI**
```bash
npm install -g vercel
vercel login
vercel --prod
```

**Method 2: Git Push**
```bash
git push origin main
# Auto-deploys from Vercel dashboard
```

### Post-Deployment Tests

- [ ] Site loads at provided URL
- [ ] Login works
- [ ] Google Analytics loads data
- [ ] Client switching works
- [ ] Dashboard responsive on mobile

---

## 6. TROUBLESHOOTING

### "Cannot find page"
**Solution:**
- Make sure dev server running: `npm run dev`
- Check URL: `http://localhost:3000/admin-dashboard`

### Dropdown is empty
**Solution:**
- Check `clients.json` has valid JSON
- Check database has client records
- Restart dev server: `Ctrl+C` then `npm run dev`

### No data showing on dashboard
**Solution:**
- Verify client IDs are correct
- Check Google Analytics/Ads credentials valid
- Open browser console (F12) for specific errors

### "Connection Issue" on Google Ads
**Possible causes:**
- API timeout on Vercel (10 second limit)
- Wrong customer ID or MCC ID
- Missing developer token

**Solution:**
1. Verify customer ID in Google Ads
2. Check Vercel logs for timeout
3. Ensure all env vars set on Vercel

### "Connection Issue" on Search Console
**Possible causes:**
- Service account not added to property
- Wrong property URL
- Permissions not yet propagated (5-10 min)

**Solution:**
1. Check exact URL in Search Console matches exactly
2. Verify service account in users list
3. Wait 10+ minutes if recently added

### "GBP Token Missing"
**Solution:**
1. Run OAuth: `http://localhost:3000/api/auth/google-business`
2. Authorize with Google
3. Token auto-saves to Supabase

### Build fails with TypeScript errors
**Solution:**
```bash
npx tsc --noEmit
```
Fix errors, then rebuild.

### Backfill shows "401 Unauthorized"
**Solution:**
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set
- Check `.env.local` has Supabase credentials
- Ensure credentials not expired

---

## 🎯 Quick Reference

### Useful URLs
- **Admin Dashboard**: `http://localhost:3000/admin-dashboard`
- **API Test**: `http://localhost:3000/api/dashboard?clientId=dr-digrado`
- **Supabase**: https://app.supabase.com

### Important Files
- **Client config**: `src/lib/server-utils.ts`
- **Dashboard API**: `src/app/api/dashboard/route.ts`
- **GBP backfill**: `scripts/gbp-backfill-simple.ts`
- **Metrics backfill**: `scripts/backfill-metrics.ts`

### Common Commands
```bash
npm run dev                    # Start development
npm run build                  # Build for production
npm start                      # Start production server
npx tsx scripts/gbp-backfill-simple.ts --year 2024   # Backfill GBP
npx tsx scripts/backfill-metrics.ts 180               # Backfill metrics
npx tsc --noEmit              # Check TypeScript
```

---

## 📞 Support & Resources

**Official Documentation:**
- [Next.js Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Google Analytics API](https://developers.google.com/analytics/devguides/reporting)
- [Google Search Console API](https://developers.google.com/webmaster-tools)
- [Google Business Profile API](https://developers.google.com/my-business)
- [Google Ads API](https://developers.google.com/google-ads/api)
- [CallRail API](https://apidocs.callrail.com/)

**Generated with Claude Code**
**Updated**: January 28, 2026

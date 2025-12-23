# Deploy to Vercel - Complete Guide

## 🎯 Current Status

✅ **Google Ads API:** WORKING
❌ **Search Console API:** Needs service account added (5-minute fix)

## 📝 Step 1: Add Missing Vercel Environment Variables

Two environment variables are missing from Vercel. Add them manually:

### Add GOOGLE_SEARCH_CONSOLE_SITE_URL

```bash
npx vercel env add GOOGLE_SEARCH_CONSOLE_SITE_URL production
```

When prompted, enter:
```
https://mychiropractice.com
```

### Add GOOGLE_ADS_MCC_ID

```bash
npx vercel env add GOOGLE_ADS_MCC_ID production
```

When prompted, enter:
```
8432700368
```

## 🔐 Step 2: Fix Search Console Access

**This is required for Search Console data to work!**

See detailed instructions in: `FIX_SEARCH_CONSOLE.md`

Quick summary:
1. Go to: https://search.google.com/search-console
2. Settings → Users and permissions → Add user
3. Add email: `analysis-api@uplifted-triode-432610-r7.iam.gserviceaccount.com`
4. Permission: Full
5. Wait 5-10 minutes

## 🚀 Step 3: Deploy to Vercel

After adding environment variables:

```bash
cd "/Users/trieu/Desktop/VS CODE/ultimate-report-dashboard"
npx vercel --prod
```

This will:
- Build your project
- Deploy to production
- Give you a live URL

## ✅ Step 4: Test the Deployment

### Option A: Test APIs Directly

Visit these URLs in your browser (you'll need to login first):

1. **Google Ads Diagnostic:**
   ```
   https://your-vercel-url.vercel.app/api/google-ads/diagnose
   ```

2. **Search Console Status:**
   ```
   https://your-vercel-url.vercel.app/api/search-console?clientId=client-007&type=status
   ```

### Option B: Test via Dashboard

1. Go to: `https://your-vercel-url.vercel.app/login`
2. Login with:
   - Email: `admin@mychiropractice.com`
   - Password: `MyPassword123`
3. Check the dashboard for:
   - ✅ Google Analytics data (should show sessions, traffic, etc.)
   - ✅ Google Ads data (should show ad spend, campaigns, etc.)
   - ✅ CallRail data (should show phone calls)
   - ⚠️  Search Console data (will show "n/a" until service account is added)

## 🔍 Troubleshooting

### Problem: No Google Ads data

**Check Vercel logs:**
```bash
npx vercel logs
```

**Look for errors like:**
- "PERMISSION_DENIED" → Refresh token doesn't have access
- "AUTHENTICATION_ERROR" → Token is invalid or expired
- "developer token" → Basic Access limitations

**Fix:** The local test showed Google Ads is working, so this should work on Vercel too!

### Problem: No Search Console data

**This is expected until you add the service account!**

Follow instructions in `FIX_SEARCH_CONSOLE.md` to fix.

### Problem: "Login Required" on API endpoints

Vercel has deployment protection enabled. To test APIs:
1. Login to the dashboard first
2. Or use the diagnostic endpoints (they should work without login)

## 📊 What You Should See After Deployment

### Dashboard should show:

1. **KPI Cards:**
   - Traffic (Sessions): Real numbers from Google Analytics
   - Ad Spend: Real numbers from Google Ads
   - Phone Calls: Real numbers from CallRail
   - Cost per Lead: Calculated from above

2. **Traffic Chart:**
   - Line chart showing daily sessions
   - Real Google Analytics data

3. **Google Ads Campaigns:**
   - Campaign names
   - Impressions, clicks, costs
   - Real data from your Google Ads account

4. **CallRail Calls:**
   - Recent phone calls
   - Duration, status, phone numbers

5. **Search Console (after fix):**
   - Top search queries
   - Search impressions and clicks
   - Page performance

## 🎬 Complete Deployment Checklist

- [ ] Run `node test-apis.js` locally (both APIs should be ✅)
- [ ] Add `GOOGLE_SEARCH_CONSOLE_SITE_URL` to Vercel
- [ ] Add `GOOGLE_ADS_MCC_ID` to Vercel
- [ ] Add service account to Search Console
- [ ] Wait 5-10 minutes for Search Console permissions
- [ ] Deploy: `npx vercel --prod`
- [ ] Test login at: `https://your-url.vercel.app/login`
- [ ] Verify Google Ads data appears
- [ ] Verify Search Console data appears (after permissions propagate)

## 🆘 Need Help?

Run the diagnostic script anytime:
```bash
node test-apis.js
```

This will show you exactly which APIs are working and which need fixing.

---

## 🎉 Expected Result

After following all steps:
- ✅ Dashboard shows REAL Google Ads data
- ✅ Dashboard shows REAL Google Analytics data
- ✅ Dashboard shows REAL CallRail data
- ✅ Dashboard shows REAL Search Console data
- ✅ All KPIs calculated from real data
- ✅ Professional charts and visualizations
- ✅ Multi-client support working

**Your clients can login and see their real marketing data in one place!**

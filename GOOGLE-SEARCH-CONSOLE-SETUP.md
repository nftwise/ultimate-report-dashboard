# Google Search Console Setup Guide

## Issue Found ✅

The SEO Performance section is showing **0 impressions, 0 clicks, 0 CTR** because the Google Search Console service account doesn't have permission to access your clients' Search Console properties.

**Error**: `User does not have sufficient permission for site 'https://decarlochiropractic.com'`

---

## Solution: Grant Access to Service Account

Your service account email is:
```
analysis-api@uplifted-triode-432610-r7.iam.gserviceaccount.com
```

You need to add this service account to **each client's Google Search Console property**.

---

## Step-by-Step Instructions

### For Each Client:

#### Option A: You Have Owner Access to Their Search Console

1. **Go to Google Search Console**: https://search.google.com/search-console
2. **Select the client's property** from the property dropdown (top left)
3. **Click Settings** (gear icon in left sidebar)
4. **Click "Users and permissions"**
5. **Click "Add user"** (blue button)
6. **Enter email**: `analysis-api@uplifted-triode-432610-r7.iam.gserviceaccount.com`
7. **Select permission level**: **Owner** (required for API access) or **Full** (minimum)
8. **Click "Add"**
9. **Done!** Repeat for next client

---

#### Option B: Client Has Owner Access (Ask Them)

Send this email to your client:

**Subject**: Dashboard Setup - Grant Search Console Access

**Body**:
```
Hi [Client Name],

To show your SEO data (impressions, clicks, keywords) in your new dashboard, I need to add our reporting service to your Google Search Console account.

Please follow these steps:

1. Go to https://search.google.com/search-console
2. Select your website property
3. Click Settings (gear icon on left)
4. Click "Users and permissions"
5. Click "Add user"
6. Add this email: analysis-api@uplifted-triode-432610-r7.iam.gserviceaccount.com
7. Select permission: "Owner" or "Full"
8. Click "Add"

This is a read-only service account that will pull SEO data for your dashboard. It cannot make any changes to your Search Console settings.

Thanks!
```

---

## Your 3 Clients That Need Access:

| Client | Website | Status |
|--------|---------|--------|
| DeCarlo Chiropractic | https://decarlochiropractic.com | ❌ No access yet |
| CorePosture | https://coreposturechiropractic.com | ❌ No access yet |
| Zen Care Physical Medicine | https://zencare.com | ❌ No access yet |

---

## Testing After Granting Access

After adding the service account to a client's Search Console:

1. **Wait 5 minutes** for permissions to propagate
2. **Refresh the dashboard**
3. **You should now see SEO data!**

Test with this command:
```bash
curl "http://localhost:3002/api/search-console?period=7days&clientId=decarlo-chiro&type=performance"
```

Should return:
```json
{
  "success": true,
  "impressions": 1234,
  "clicks": 56,
  "ctr": 4.5,
  "position": 12.3
}
```

---

## What Will Work After Setup

Once you grant access, the SEO Performance section will show:

### ✅ Search Console Metrics:
- **Impressions** - How many times your site appeared in search results
- **Clicks** - How many clicks from search results
- **CTR** - Click-through rate (clicks/impressions)
- **Average Position** - Average ranking position

### ✅ Keyword Data:
- Top ranking keywords
- Impressions and clicks per keyword
- Average position per keyword
- CTR per keyword

### ✅ Landing Page Data:
- Top landing pages from organic search
- Sessions per page
- Click data per page

---

## Current Workaround (Optional)

The **Organic Traffic** metric is working because it comes from **Google Analytics** (which we already set up):
- ✅ Organic Traffic: 23 sessions (from GA)
- ✅ Users: 368 (from GA historical data)
- ✅ Sessions: 425 (from GA historical data)
- ✅ Conversions: 26 (from GA historical data)

Only the **Search Console specific data** is missing:
- ❌ Impressions: 0 (needs Search Console access)
- ❌ Clicks: 0 (needs Search Console access)
- ❌ CTR: 0% (needs Search Console access)
- ❌ Keywords: No data (needs Search Console access)

---

## Why This Happened

Google Search Console properties have strict access controls. Each property is separate, so:

- The service account needs to be added to **each website property individually**
- Permission level must be **Owner** or **Full** (Restricted won't work for API)
- Unlike Google Analytics which uses property IDs, Search Console uses website URLs

---

## Important Notes

1. **Permission Level**: Must be "Owner" or "Full" - "Restricted" won't work
2. **Exact URL**: Make sure the URL in Search Console matches exactly:
   - DeCarlo: `https://decarlochiropractic.com` (with https://)
   - CorePosture: `https://coreposturechiropractic.com`
   - ZenCare: `https://zencare.com`
3. **Wait Time**: Can take up to 5 minutes for permissions to propagate
4. **Verification**: The property must be verified in Search Console first

---

## Need Help?

If you have trouble:
1. Make sure you have **Owner** access to the Search Console property
2. Make sure the email is exactly: `analysis-api@uplifted-triode-432610-r7.iam.gserviceaccount.com`
3. Make sure you select **"Owner"** or **"Full"** permission level
4. Wait 5 minutes after adding before testing
5. Check that the website is verified in Search Console

---

## Next Steps

1. Add service account to DeCarlo's Search Console property
2. Test: `curl "http://localhost:3002/api/search-console?period=7days&clientId=decarlo-chiro&type=performance"`
3. If successful, repeat for CorePosture and ZenCare
4. Then refresh your dashboard to see SEO data!

---

## Alternative: Temporary Workaround

If you can't get Search Console access right now, the dashboard will continue to work with:
- ✅ Google Analytics traffic data (sessions, users, conversions)
- ✅ Google Ads data (leads, spend, phone calls)
- ❌ Search Console data will show 0 until access is granted

The SEO section will still display the **Google Analytics organic traffic metrics**, just not the Search Console specific metrics (impressions, clicks, keywords).

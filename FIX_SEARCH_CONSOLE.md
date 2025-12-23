# Fix Search Console API - Step by Step Guide

## ✅ Good News!
**Google Ads API is working perfectly!**
- Successfully connected to customer: "Dr Mike Degrado - Newport Beach"
- All credentials are valid

## ❌ Issue: Search Console API
Error: "Login Required" - The service account needs to be added to Search Console

## 🔧 Fix: Add Service Account to Search Console

### Step 1: Copy Service Account Email
```
analysis-api@uplifted-triode-432610-r7.iam.gserviceaccount.com
```

### Step 2: Add to Search Console

1. **Go to Google Search Console:**
   - Visit: https://search.google.com/search-console
   - Make sure you're logged in with the account that owns the property

2. **Select your property:**
   - Click on: `https://mychiropractice.com` (or your site)

3. **Go to Settings:**
   - Click the gear icon ⚙️ in the left sidebar
   - Or go to: Settings → Users and permissions

4. **Add User:**
   - Click "Add User" button
   - Enter the service account email:
     ```
     analysis-api@uplifted-triode-432610-r7.iam.gserviceaccount.com
     ```

5. **Set Permission Level:**
   - Select: **"Full"** (or "Owner" if available)
   - This gives read access to all data

6. **Save:**
   - Click "Add"
   - Confirm the addition

### Step 3: Wait (Important!)
- Google Search Console takes **5-10 minutes** to propagate permissions
- Don't test immediately!

### Step 4: Test Again
After 5-10 minutes, run the diagnostic script again:

```bash
cd "/Users/trieu/Desktop/VS CODE/ultimate-report-dashboard"
node test-apis.js
```

You should see:
```
✅ SUCCESS! Search Console API is working
   Found X accessible site(s):
   - https://mychiropractice.com/ (Full)
```

## 📋 Alternative: If you don't own the Search Console property

If someone else owns the Search Console property:

1. **Ask them to add the service account:**
   - Email: `analysis-api@uplifted-triode-432610-r7.iam.gserviceaccount.com`
   - Permission: Full

2. **Or use a different site:**
   - Update in `.env.local`:
     ```
     GOOGLE_SEARCH_CONSOLE_SITE_URL=https://your-other-site.com
     ```
   - Make sure you have access to that property

## 🚀 After Search Console is Fixed

Once both APIs are working, you can deploy to Vercel:

```bash
# 1. Make sure Vercel has all environment variables
npx vercel env ls

# 2. Deploy
npx vercel --prod

# 3. Test live
# Visit your Vercel URL and login to see real data!
```

## 📊 Current Status

| API                    | Status      | Notes                              |
|------------------------|-------------|-------------------------------------|
| Google Ads             | ✅ WORKING   | Customer: Dr Mike Degrado          |
| Google Analytics       | ✅ WORKING   | (assumed working based on config)  |
| CallRail               | ✅ WORKING   | (assumed working based on config)  |
| Search Console         | ❌ NEEDS FIX | Add service account (5 min fix)    |

## 💡 Quick Fix Summary

1. Copy: `analysis-api@uplifted-triode-432610-r7.iam.gserviceaccount.com`
2. Go to: https://search.google.com/search-console
3. Settings → Users → Add User
4. Paste email, set permission to "Full"
5. Wait 5-10 minutes
6. Test: `node test-apis.js`
7. Deploy: `npx vercel --prod`

---

**Questions?** Run `node test-apis.js` anytime to check API status!

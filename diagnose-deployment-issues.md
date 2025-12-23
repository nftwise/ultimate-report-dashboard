# Diagnosing Deployment Issues

## 🔍 Current Situation

Both APIs showing "Connection Issue" on the deployed dashboard:
- ❌ Google Ads API: Not working on Vercel
- ❌ Search Console API: Not working on Vercel

But Google Ads works locally! ✅

---

## 🐛 Issue #1: Search Console Service Account

### Problem:
Running `node check-search-console.js` still shows **"PERMISSION DENIED"**

This means the service account was either:
1. **Not added yet** to the correct property
2. **Added but permissions haven't propagated** (can take 5-10 minutes)
3. **Added to wrong property** (wrong URL)
4. **Added with wrong permission level** (needs "Full", not "Restricted")

### Solution - Verify You Added It Correctly:

#### Step 1: Check Which Properties You Own
1. Go to: https://search.google.com/search-console
2. Look at the property selector dropdown (top left)
3. Do you see **exactly** this: `https://drdigrado.com` or `sc-domain:drdigrado.com`?

#### Step 2: Verify Service Account Was Added
1. Select the property: `https://drdigrado.com`
2. Click Settings (⚙️ gear icon, bottom left)
3. Click "Users and permissions"
4. Look for: `analysis-api@uplifted-triode-432610-r7.iam.gserviceaccount.com`

**Do you see it in the list?**
- ✅ **YES** → Check permission level is "Owner" or "Full"
- ❌ **NO** → Click "Add user" and add it

#### Step 3: If You Just Added It
Wait **10 minutes** and run:
```bash
node check-search-console.js
```

---

## 🐛 Issue #2: Google Ads API Not Working on Vercel

Google Ads works locally but not on Vercel. Let me explain why and how to fix it.

### Possible Causes:

#### Cause 1: Environment Variables Not Loaded
Vercel might need a redeploy to pick up the new environment variables.

**Solution:**
```bash
npx vercel --prod --force
```

This forces a fresh deploy with all environment variables.

#### Cause 2: Dashboard Using Wrong Client ID
The dashboard might be trying to use a different client ID than client-007.

**Check this:**
When you login with `admin@mychiropractice.com`, the dashboard should:
1. Look up client-007 in `clients.json`
2. Use `googleAdsCustomerId: "2812810609"`
3. Use `googleAdsMccId: "8432700368"`

**Verify in browser console:**
1. Login to dashboard
2. Open browser DevTools (F12)
3. Go to "Console" tab
4. Look for any error messages

#### Cause 3: API Route Not Getting Environment Variables
Sometimes Vercel's environment variables don't load properly in API routes.

**Debug this:**
Add a test endpoint to check if env vars are loaded.

---

## 🔧 Quick Fixes to Try Now

### Fix #1: Force Redeploy with Environment Variables

```bash
cd "/Users/trieu/Desktop/VS CODE/ultimate-report-dashboard"
npx vercel --prod --force
```

Wait for build to complete, then test dashboard again.

### Fix #2: Check Browser Console for Errors

1. Visit: https://ultimate-report-dashboard-k0vomxsl7-my-chiropractices-projects.vercel.app/login
2. Login with: `admin@mychiropractice.com` / `MyPassword123`
3. Open DevTools (Right-click → Inspect → Console tab)
4. Look for red error messages
5. Copy and share any errors you see

### Fix #3: Test If It's a Timeout Issue

The APIs might be working but timing out. Try:
1. Login to dashboard
2. Wait 30 seconds on the dashboard page
3. Refresh the page
4. See if data appears

---

## 📊 Let's Debug Together

### Question 1: Search Console
When you go to https://search.google.com/search-console and select `https://drdigrado.com`:
- Do you see Settings → Users and permissions?
- Does the list show `analysis-api@uplifted-triode-432610-r7.iam.gserviceaccount.com`?
- What permission level does it show?

### Question 2: Google Ads
When you login to the dashboard:
- What exactly do you see for Google Ads section?
- Does it say "Loading...", "n/a", "$0", or "Connection Issue"?
- Any error message in the browser console (F12)?

### Question 3: Timing
- How long ago did you add the service account? (if less than 10 minutes, wait longer)
- Did you redeploy after adding the environment variables?

---

## 🎯 Most Likely Solutions

Based on common issues:

### For Google Ads:
**Most likely:** Need to redeploy after adding environment variables.

**Try this:**
```bash
npx vercel --prod --force
```

### For Search Console:
**Most likely:** Service account permissions haven't propagated yet, OR you added it to the wrong property.

**Try this:**
1. Double-check it's added to the EXACT URL: `https://drdigrado.com`
2. Wait 10 minutes if you just added it
3. Run: `node check-search-console.js`

---

## 🔍 Advanced Debugging

If the above doesn't work, let's get more details:

### Check What the Dashboard Is Actually Calling

Create this test file:

```javascript
// test-dashboard-api.js
const clientId = 'client-007';
const baseUrl = 'https://ultimate-report-dashboard-k0vomxsl7-my-chiropractices-projects.vercel.app';

// Test Google Ads
fetch(`${baseUrl}/api/google-ads?clientId=${clientId}&report=campaigns&period=7days`)
  .then(r => r.json())
  .then(data => console.log('Google Ads Response:', data))
  .catch(err => console.error('Google Ads Error:', err));

// Test Search Console
fetch(`${baseUrl}/api/search-console?clientId=${clientId}&type=performance&period=7d`)
  .then(r => r.json())
  .then(data => console.log('Search Console Response:', data))
  .catch(err => console.error('Search Console Error:', err));
```

Run it:
```bash
node test-dashboard-api.js
```

This will show you the exact error messages from the APIs.

---

## 📝 Action Plan

**Right now, do these steps in order:**

1. **Force redeploy:**
   ```bash
   npx vercel --prod --force
   ```

2. **While it's deploying, verify Search Console:**
   - Go to: https://search.google.com/search-console
   - Select: `https://drdigrado.com`
   - Settings → Users
   - Confirm: `analysis-api@uplifted-triode-432610-r7.iam.gserviceaccount.com` is listed with "Full" or "Owner" permission

3. **After deploy completes (2-3 minutes):**
   - Login to dashboard
   - Open browser DevTools (F12) → Console tab
   - Screenshot any errors you see
   - Tell me what the Google Ads section shows

4. **Test Search Console locally:**
   ```bash
   node check-search-console.js
   ```

5. **Share results with me:**
   - What did `check-search-console.js` show?
   - What does the dashboard show for Google Ads?
   - Any errors in browser console?

---

## 💡 Why Google Ads Works Locally But Not on Vercel

This is a classic sign of:
- Environment variables not being loaded in production
- OR need to redeploy after adding new variables
- OR API timeout (Vercel has 10-second timeout for serverless functions)

The **force redeploy** should fix this.

---

Let me know the results after you:
1. Force redeploy with `npx vercel --prod --force`
2. Verify Search Console user is added
3. Check browser console for errors

I'll help you fix whatever we find! 🔧

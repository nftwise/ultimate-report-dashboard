# ✅ Add Service Account to Search Console

## 📋 What You Need

**Service Account Email to Add:**
```
analysis-api@uplifted-triode-432610-r7.iam.gserviceaccount.com
```

**Copy this email** ☝️ (you'll paste it in step 5)

---

## 🎯 Step-by-Step Instructions

### Step 1: Go to Search Console
Open: https://search.google.com/search-console

Make sure you're logged in with the Google account that owns the property.

### Step 2: Select Your Property
In the left sidebar, click on your property:
- **https://mychiropractice.com** (or whichever property you want to access)

### Step 3: Open Settings
Click the **⚙️ Settings** icon in the left sidebar (bottom left)

### Step 4: Go to Users
Click on: **Users and permissions**

### Step 5: Add User
1. Click the blue **"Add user"** button
2. In the email field, paste:
   ```
   analysis-api@uplifted-triode-432610-r7.iam.gserviceaccount.com
   ```

### Step 6: Set Permission
Select permission level: **"Full"** (or "Owner" if available)

⚠️ Important: Don't select "Restricted" - it won't work!

### Step 7: Add
Click the **"Add"** button to confirm

### Step 8: Wait ⏰
**IMPORTANT:** Google takes 5-10 minutes to propagate permissions.

Don't test immediately! Go get coffee ☕

---

## 🧪 Verify It Worked

After waiting 5-10 minutes, run this command:

```bash
cd "/Users/trieu/Desktop/VS CODE/ultimate-report-dashboard"
node check-search-console.js
```

### Expected Success Output:
```
✅ Found 1 accessible site(s):

1. https://mychiropractice.com/
   Permission: OWNER (or FULL)
   ⭐ THIS IS YOUR CONFIGURED SITE!

✅ SUCCESS! Your configured site is accessible!
```

### If You See "❌ NO SITES FOUND" Again:
- Wait a few more minutes (can take up to 10 minutes)
- Double-check you added the correct email
- Make sure you selected "Full" permission (not "Restricted")
- Try refreshing the Search Console page

---

## 🚀 After It Works

Once `node check-search-console.js` shows success:

### 1. Add Missing Vercel Variables

```bash
# Add Search Console URL
npx vercel env add GOOGLE_SEARCH_CONSOLE_SITE_URL production
# When prompted, enter: https://mychiropractice.com

# Add MCC ID
npx vercel env add GOOGLE_ADS_MCC_ID production
# When prompted, enter: 8432700368
```

### 2. Deploy to Vercel

```bash
npx vercel --prod
```

### 3. Test Your Dashboard

Visit your Vercel URL and login:
- Email: `admin@mychiropractice.com`
- Password: `MyPassword123`

You should now see:
- ✅ Google Ads data (already working!)
- ✅ Google Analytics data
- ✅ CallRail data
- ✅ Search Console data (top queries, impressions, clicks)

---

## 📸 Visual Guide

When you go to Search Console:

```
┌─────────────────────────────────────────┐
│  Google Search Console                  │
├─────────────────────────────────────────┤
│                                         │
│  🏠 Overview                            │
│  📊 Performance                         │
│  🔍 URL Inspection                      │
│  📑 Sitemaps                            │
│  ⚙️  Settings  ← CLICK HERE            │
│                                         │
└─────────────────────────────────────────┘
```

Then:

```
⚙️ Settings
├─ Property settings
├─ Users and permissions  ← CLICK HERE
│  ├─ Current users
│  └─ [Add user] ← CLICK THIS BUTTON
└─ Verification details
```

In the popup:
```
┌──────────────────────────────────────┐
│  Add user                            │
├──────────────────────────────────────┤
│  Email address:                      │
│  [analysis-api@uplifted-triode... ] │
│                                      │
│  Permission level:                   │
│  ◉ Full                              │
│  ○ Restricted                        │
│                                      │
│        [Cancel]  [Add] ← CLICK       │
└──────────────────────────────────────┘
```

---

## ❓ Troubleshooting

### "I don't see my property in Search Console"

You may not have access. Contact the website owner to:
1. Add you as a user first
2. Then you can add the service account

### "I don't have permission to add users"

You need to be an Owner of the property. Contact the owner and ask them to either:
- Make you an Owner
- Or add the service account for you (give them the email above)

### "It's been 10+ minutes and still not working"

Try:
1. Log out of Google account and log back in
2. Re-add the service account (remove and add again)
3. Make sure you selected "Full" permission
4. Check you added it to the exact property URL: `https://mychiropractice.com`

---

## 🎉 Once Complete

You'll have a fully functional dashboard with ALL data sources:

| Data Source       | Status      |
|-------------------|-------------|
| Google Ads        | ✅ Working   |
| Google Analytics  | ✅ Working   |
| CallRail          | ✅ Working   |
| Search Console    | ✅ Working   |

**All 4 APIs connected!** 🎊

---

## 📞 Quick Reference

**Service Account Email:**
```
analysis-api@uplifted-triode-432610-r7.iam.gserviceaccount.com
```

**Test Command:**
```bash
node check-search-console.js
```

**Deploy Command:**
```bash
npx vercel --prod
```

---

Need help? Run `node check-search-console.js` to see exactly what's accessible!

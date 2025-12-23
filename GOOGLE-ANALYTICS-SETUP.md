# Google Analytics Setup Guide

## Issue Found ✅

Your dashboard is showing **0 sessions** because the Google Analytics service account doesn't have permission to access your clients' GA4 properties.

**Error**: `PERMISSION_DENIED: User does not have sufficient permissions for this property`

---

## Solution: Grant Access to Service Account

Your service account email is:
```
analysis-api@uplifted-triode-432610-r7.iam.gserviceaccount.com
```

You need to add this service account to **each client's Google Analytics property**.

---

## Step-by-Step Instructions

### For Each Client:

#### Option A: You Have Admin Access to Their GA Account

1. **Go to Google Analytics**: https://analytics.google.com
2. **Select the client's property** from the property dropdown (top left)
3. **Click Admin** (gear icon, bottom left)
4. **Under "Property" column**, click **"Property Access Management"**
5. **Click the "+" button** (top right)
6. **Click "Add users"**
7. **Enter email**: `analysis-api@uplifted-triode-432610-r7.iam.gserviceaccount.com`
8. **Select role**: **Viewer** (minimum) or **Analyst** (recommended)
9. **Uncheck** "Notify new users by email" (it's a service account, not a person)
10. **Click "Add"**
11. **Done!** Repeat for next client

---

#### Option B: Client Has Admin Access (Ask Them)

Send this email to your client:

**Subject**: Dashboard Setup - Grant Analytics Access

**Body**:
```
Hi [Client Name],

To show your analytics data in your new dashboard, I need to add our reporting service to your Google Analytics account.

Please follow these steps:

1. Go to https://analytics.google.com
2. Click Admin (gear icon, bottom left)
3. Under "Property", click "Property Access Management"
4. Click the "+" button, then "Add users"
5. Add this email: analysis-api@uplifted-triode-432610-r7.iam.gserviceaccount.com
6. Select role: "Viewer"
7. Uncheck "Notify new users by email"
8. Click "Add"

This is a read-only service account that will pull data for your dashboard. It cannot make any changes to your Google Analytics.

Thanks!
```

---

## Your 3 Clients That Need Access:

| Client | Property ID | Status |
|--------|-------------|--------|
| DeCarlo Chiropractic | 64999541 | ❌ No access yet |
| CorePosture | 133696356 | ❌ No access yet |
| Zen Care Physical Medicine | 42417986 | ❌ No access yet |

---

## Testing After Granting Access

After adding the service account to a client's GA property:

1. **Wait 5 minutes** for permissions to propagate
2. **Go to your dashboard**: http://localhost:3000/admin-dashboard
3. **Select the client** from dropdown
4. **Refresh the page** (Cmd+R or Ctrl+R)
5. **You should now see real data!**

Test with this command:
```bash
curl "http://localhost:3000/api/test-ga?clientId=decarlo-chiro"
```

Should return:
```json
{
  "success": true,
  "sessions": 94,
  "users": 87,
  "conversions": 5
}
```

---

## Current Working Property

✅ **Dr DiGrado** (Property ID: 326814792) - **Already has access**

This is the default property in your `.env.local` file, which is why it works.

---

## Alternative: Use One GA Property for Testing

If you can't get access to client properties right now, you can temporarily use the Dr DiGrado property for all clients (for testing):

**Update clients.json:**
```json
{
  "id": "decarlo-chiro",
  "googleAnalyticsPropertyId": "326814792",  // Use Dr DiGrado's for testing
  ...
}
```

But this will show Dr DiGrado's data for all clients, so only use this for testing!

---

## Why This Happened

Google Analytics GA4 properties have strict access controls. Each property is separate, so:

- ✅ You have access to: Dr DiGrado (326814792)
- ❌ You don't have access to: DeCarlo, CorePosture, Zen Care

The service account needs to be added to **each property individually**.

---

## Need Help?

If you have trouble:
1. Make sure you're adding the service account to the **Property** (not Account)
2. Make sure the email is exactly: `analysis-api@uplifted-triode-432610-r7.iam.gserviceaccount.com`
3. Make sure you select "Viewer" or "Analyst" role
4. Wait 5 minutes after adding before testing

---

## Next Steps

1. Add service account to DeCarlo's GA property
2. Test: `curl "http://localhost:3000/api/test-ga?clientId=decarlo-chiro"`
3. If successful, repeat for CorePosture and Zen Care
4. Then refresh your dashboard!

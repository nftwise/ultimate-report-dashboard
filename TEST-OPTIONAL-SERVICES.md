# Testing Optional Services Feature

## What We Just Built ✅

Your dashboard now **automatically shows/hides** sections based on which services each client uses!

---

## Quick Test (2 minutes)

### Step 1: Check Your Updated clients.json

I've already updated your test clients to show examples:
- **client-001**: SEO + Ads (both services)
- **client-002**: SEO Only (no Ads)
- **client-003**: Ads Only (no SEO)
- **client-004**: SEO + Ads (both services)
- **client-005**: SEO Only (no Ads)
- **client-006**: Ads Only (no SEO)

### Step 2: Test the Dashboard

1. Open your browser: `http://localhost:3000/admin-dashboard`

2. **Select client-001** (SEO + Ads)
   - ✅ You should see ALL 4 cards: Google Ads, SEO, CallRail, Search Console

3. **Select client-002** (SEO Only)
   - ✅ Google Ads card should show message: "This client is not using Google Ads services"
   - ✅ SEO card shows real data
   - ✅ Other cards show normally

4. **Select client-003** (Ads Only)
   - ✅ Google Ads card shows real data
   - ✅ SEO card should show message: "This client is not using SEO/Analytics services"
   - ✅ Search Console card should show message: "Search Console not configured"

---

## What Changed in the Code

### 1. New API Endpoint
**File**: `/src/app/api/clients/config/route.ts`

This endpoint checks which services are active for each client:
```typescript
{
  "services": {
    "googleAnalytics": true,    // Has GA Property ID
    "googleAds": false,         // No Ads Customer ID
    "searchConsole": true,      // Has site URL
    "callRail": true           // Has CallRail account
  }
}
```

### 2. New Component
**File**: `/src/components/ServiceUnavailableCard.tsx`

Shows friendly message when service is not active.

### 3. Updated Dashboard
**File**: `/src/components/ProfessionalDashboard.tsx`

Now checks `clientServices` state before showing each card:
```tsx
{clientServices.googleAds ? (
  <GoogleAdsCard />  // Show real card
) : (
  <ServiceUnavailableCard />  // Show friendly message
)}
```

---

## How to Add Your Real Clients Now

### Example 1: Client Using SEO + Ads

```json
{
  "id": "polished-cary",
  "companyName": "Polished Cary Nail Salon",
  "googleAnalyticsPropertyId": "123456789",     ✅ Has SEO
  "googleAdsCustomerId": "987-654-3210",        ✅ Has Ads
  "googleAdsMccId": "8432700368",
  "callrailAccountId": "ACC123abc",
  "searchConsoleSiteUrl": "https://polishedcarynails.com/"
}
```

Dashboard will show:
- ✅ Google Ads card with real data
- ✅ SEO/Analytics card with real data
- ✅ Search Console card with real data
- ✅ CallRail card with real data

---

### Example 2: Client Using SEO Only

```json
{
  "id": "seo-client-1",
  "companyName": "SEO Only Business",
  "googleAnalyticsPropertyId": "555666777",     ✅ Has SEO
  "googleAdsCustomerId": "",                    ❌ No Ads - Empty!
  "googleAdsMccId": "",                         ❌ No MCC - Empty!
  "callrailAccountId": "ACC456def",
  "searchConsoleSiteUrl": "https://seoonly.com/"
}
```

Dashboard will show:
- ❌ Google Ads card → "This client is not using Google Ads services"
- ✅ SEO/Analytics card with real data
- ✅ Search Console card with real data
- ✅ CallRail card with real data

---

### Example 3: Client Using Ads Only

```json
{
  "id": "ads-only-1",
  "companyName": "Ads Only Company",
  "googleAnalyticsPropertyId": "",              ❌ No SEO - Empty!
  "googleAdsCustomerId": "111-222-3330",        ✅ Has Ads
  "googleAdsMccId": "8432700368",
  "callrailAccountId": "ACC789ghi",
  "searchConsoleSiteUrl": ""                    ❌ No Search Console - Empty!
}
```

Dashboard will show:
- ✅ Google Ads card with real data
- ❌ SEO card → "This client is not using SEO/Analytics services"
- ❌ Search Console card → "Search Console not configured"
- ✅ CallRail card with real data

---

## Key Rule

**Empty string = Service not active**

When adding your 25 real clients:
- If client **HAS** the service → Put the real ID
- If client **DOES NOT HAVE** the service → Leave it as empty string `""`

---

## Browser Console Check

Open browser console (F12) and you should see:
```
✅ Fetched client config: { services: { googleAnalytics: true, googleAds: false, ... }}
```

This confirms the dashboard is detecting which services are active!

---

## Next Steps

1. ✅ Test the 6 existing clients in admin dropdown
2. ✅ Verify cards show/hide correctly based on services
3. ✅ If it works, start adding your 25 real clients to clients.json
4. ✅ Use empty strings `""` for services they don't have

---

## Troubleshooting

**Problem**: All cards showing even when they should be hidden

**Solution**:
1. Check browser console for errors
2. Refresh the page (Cmd+R or Ctrl+R)
3. Make sure clients.json has empty strings `""`, not missing fields

**Problem**: Getting errors when selecting client

**Solution**:
1. Check clients.json syntax - make sure commas are correct
2. Make sure every field exists (even if empty `""`)
3. Restart dev server: `npm run dev`

---

## Ready to Add Real Clients?

See the **OPTIONAL-SERVICES-GUIDE.md** for detailed instructions on adding your 25 clients!

🎉 Your dashboard is now ready to handle clients with different service packages!

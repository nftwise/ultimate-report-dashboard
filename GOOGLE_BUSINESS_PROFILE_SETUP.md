# Google Business Profile API Integration Guide

## Overview
This guide will walk you through setting up the Google Business Profile Performance API to pull customer interaction metrics for your multi-client dashboard.

---

## What You Can Track

The Google Business Profile Performance API provides these key metrics:

### 1. **Search Queries**
- Direct searches (customers searched for your business name)
- Discovery searches (found via category/service)
- Total search volume

### 2. **Profile Views**
- Google Search views
- Google Maps views
- Total visibility

### 3. **Customer Actions**
- Website clicks
- Phone calls from profile
- Direction requests
- Total customer engagement

### 4. **Photo Performance**
- Merchant photo views
- Customer photo views
- Total photo engagement

---

## Step 1: Enable the API

### 1.1 Go to Google Cloud Console
1. Visit: https://console.cloud.google.com/
2. Select your project (the same one used for Google Analytics/Ads)

### 1.2 Enable Business Profile Performance API
1. Go to **APIs & Services** > **Library**
2. Search for "**Business Profile Performance API**"
3. Click **Enable**

### 1.3 Request Access (If Needed)
If you see a quota of 0 after enabling:
1. Visit: https://developers.google.com/my-business/content/prereqs#request-access
2. Fill out the request form
3. Wait for approval (usually 1-3 business days)

---

## Step 2: Get Your Location IDs

Each business location has a unique Location ID. Here's how to find them:

### Method 1: Using Google Business Profile API Explorer
1. Go to: https://developers.google.com/my-business/reference/accountmanagement/rest/v1/accounts/list
2. Click "Try this API" on the right
3. Execute the request
4. You'll see a list of accounts with their IDs

### Method 2: Using the API Directly

```bash
# List all accounts
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  https://mybusinessbusinessinformation.googleapis.com/v1/accounts

# List locations for an account
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  https://mybusinessbusinessinformation.googleapis.com/v1/accounts/{ACCOUNT_ID}/locations
```

### Method 3: Using the Google My Business API Tool
1. Install the tool:
```bash
npm install -g google-my-business-api
```

2. List your locations:
```bash
gmb locations list
```

### Location ID Format
The location ID format will look like:
```
accounts/1234567890/locations/9876543210
```

You need the FULL path for your integration.

---

## Step 3: Add Location IDs to Client Config

1. Open [src/data/clients.json](src/data/clients.json)

2. Add the `gbpLocationId` for each client:

```json
{
  "id": "decarlo-chiro",
  "companyName": "DeCarlo Chiropractic",
  "googleAnalyticsPropertyId": "312855752",
  "googleAdsCustomerId": "6379112944",
  "searchConsoleSiteUrl": "https://decarlochiropractic.com",
  "gbpLocationId": "accounts/1234567890/locations/9876543210"
}
```

**Important:** Leave `gbpLocationId` as an empty string `""` for clients that don't have Google Business Profile set up.

---

## Step 4: Test the Integration

### 4.1 Test the API Endpoint

Once you've added a location ID for a client, test it:

```bash
curl "http://localhost:3000/api/google-business-profile?clientId=decarlo-chiro&period=30days"
```

### 4.2 Expected Response

```json
{
  "success": true,
  "data": {
    "metrics": {
      "searchQueries": {
        "direct": 450,
        "indirect": 320,
        "total": 770
      },
      "views": {
        "search": 1245,
        "maps": 856,
        "total": 2101
      },
      "actions": {
        "website": 142,
        "phone": 87,
        "directions": 234,
        "total": 463
      },
      "photos": {
        "merchantViews": 2341,
        "customerViews": 892,
        "totalViews": 3233
      }
    },
    "timeRange": {
      "startDate": "2025-09-22",
      "endDate": "2025-10-22",
      "period": "30days"
    },
    "locationId": "accounts/1234567890/locations/9876543210"
  },
  "timestamp": "2025-10-22T12:34:56.789Z",
  "cached": false
}
```

### 4.3 Common Errors

#### Error: "Access denied" (403)
**Solution:**
- Make sure the API is enabled in Google Cloud Console
- Request access if you have a quota of 0
- Verify your service account has the correct permissions

#### Error: "Location not found" (404)
**Solution:**
- Double-check the location ID format
- Ensure you're using the full path: `accounts/{accountId}/locations/{locationId}`
- Verify the location exists in Google Business Profile

#### Error: "Insufficient permissions"
**Solution:**
Add these scopes to your service account:
- `https://www.googleapis.com/auth/business.manage`

---

## Step 5: Add Metrics to Dashboard

The integration is now ready! Here's how to use it in your dashboard:

### 5.1 Fetch GBP Data in Your Component

```typescript
// In your dashboard component
const [gbpMetrics, setGbpMetrics] = useState<any>(null);

const fetchGBPMetrics = async () => {
  try {
    const response = await fetch(
      `/api/google-business-profile?clientId=${clientId}&period=${period}`
    );
    const data = await response.json();

    if (data.success) {
      setGbpMetrics(data.data.metrics);
    }
  } catch (error) {
    console.error('Error fetching GBP metrics:', error);
  }
};

useEffect(() => {
  fetchGBPMetrics();
}, [clientId, period]);
```

### 5.2 Display Metrics

```tsx
{gbpMetrics && (
  <div className="grid grid-cols-4 gap-4">
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-sm text-gray-600">Profile Views</h3>
      <p className="text-3xl font-bold">{gbpMetrics.views.total}</p>
      <p className="text-xs text-gray-500">
        Search: {gbpMetrics.views.search} | Maps: {gbpMetrics.views.maps}
      </p>
    </div>

    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-sm text-gray-600">Website Clicks</h3>
      <p className="text-3xl font-bold">{gbpMetrics.actions.website}</p>
    </div>

    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-sm text-gray-600">Phone Calls</h3>
      <p className="text-3xl font-bold">{gbpMetrics.actions.phone}</p>
    </div>

    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-sm text-gray-600">Direction Requests</h3>
      <p className="text-3xl font-bold">{gbpMetrics.actions.directions}</p>
    </div>
  </div>
)}
```

---

## Step 6: Add to Team Overview Table

To show GBP metrics in your Team Overview table:

1. Update the `fetchAllClientsData` function to also fetch GBP data
2. Add new columns to the table for key metrics:
   - Profile Views
   - Website Clicks
   - Phone Calls (from GBP)
   - Direction Requests

---

## Troubleshooting

### Issue: No data returned
**Possible causes:**
- Location hasn't had any activity in the date range
- Location was recently created (data takes 24-48 hours to appear)
- Verification is pending

### Issue: Partial data only
**Possible causes:**
- Some metrics may not be available for all locations
- Certain metrics require minimum thresholds for privacy

### Issue: Rate limiting
**Solution:**
- Implement caching for GBP data (it updates daily)
- Add exponential backoff for retries

---

## API Rate Limits

- **Queries per day:** 1,500 (default)
- **Queries per 100 seconds:** 150

Since data updates daily, consider:
1. Caching responses for 24 hours
2. Only fetching when user explicitly requests refresh
3. Batching requests for multiple locations

---

## Next Steps

1. ✅ Enable the API in Google Cloud Console
2. ✅ Get location IDs for all your clients
3. ✅ Add location IDs to `clients.json`
4. ✅ Test the API endpoint
5. ⏳ Add metrics to your dashboard UI
6. ⏳ Add columns to Team Overview table
7. ⏳ Set up caching to reduce API calls

---

## Useful Resources

- [Business Profile Performance API Documentation](https://developers.google.com/my-business/reference/performance/rest)
- [Request API Access](https://developers.google.com/my-business/content/prereqs#request-access)
- [API Explorer](https://developers.google.com/my-business/reference/performance/rest)
- [Quota Information](https://developers.google.com/my-business/content/quota)

---

## Support

If you need help:
1. Check the error message in the API response
2. Review the Google Cloud Console logs
3. Verify your service account permissions
4. Ensure the API is enabled and has quota remaining

---

**Created:** October 22, 2025
**Last Updated:** October 22, 2025

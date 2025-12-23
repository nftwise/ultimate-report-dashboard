# Ultimate Reporting Dashboard - Project Notes

**Last Updated:** January 2025
**Current Status:** ✅ Production Ready
**Production URL:** https://ultimate-report-dashboard-rbylz3kjr-my-chiropractices-projects.vercel.app

---

## 📋 Quick Reference

### Tech Stack
- **Framework:** Next.js 15.5.2 with App Router
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Charts:** Recharts
- **Deployment:** Vercel
- **APIs:**
  - **Google Ads API v20** (REST API - CRITICAL: Not v16, not gRPC SDK!)
  - Google Analytics Data API v1
  - Google Search Console API v1
  - CallRail REST API

### ⚠️ CRITICAL API VERSION WARNING
**Google Ads API Version: v20 (2025)**
- **DO NOT use:** google-ads-api npm package (causes serverless issues)
- **DO NOT use:** v16 or older versions
- **MUST use:** Direct REST API calls to `googleads.googleapis.com/v20`
- **File:** `/src/lib/google-ads-direct.ts`
- **Reason:** The gRPC-based SDK doesn't work in Vercel serverless environment

### Key Files
- **Main Dashboard:** `/src/components/ProfessionalDashboard.tsx`
- **Dashboard API:** `/src/app/api/dashboard/route.ts`
- **Google Ads Connector:** `/src/lib/google-ads-direct.ts`
- **Google Analytics Connector:** `/src/lib/google-analytics.ts`
- **CallRail Connector:** `/src/lib/callrail.ts`
- **Types:** `/src/types/index.ts`

---

## 🎯 Current Dashboard Structure

### Sidebar Navigation (5 Views)
1. **Overview** - High-level metrics and channel comparison
2. **Ads** - Google Ads campaigns and performance
3. **SEO** - Organic traffic, Search Console data
4. **Calls** - CallRail call tracking
5. **Trends** - Historical analysis and 6-month chart

### Overview Section Layout
1. **Business Summary** (Top 4 KPIs)
   - Total Leads
   - Total Calls
   - Total Ad Spend
   - Cost Per Lead

2. **Channel Performance Cards** (4 equal cards)
   - **Google Ads:** Leads, Clicks, Impressions, CPL
   - **SEO/Organic:** Sessions, Form Fills, Web Calls, Click to Chat
   - **CallRail:** Total Calls, Answered, Missed, Avg Duration
   - **Search Console:** Impressions, Keywords, Clicks, Avg CTR

3. **Traffic Analysis**
   - 6-Month Lead Generation Trend
   - Traffic Sources
   - AI Referral Traffic

---

## 🚨 CRITICAL LESSON: Google Ads API Versions & Connection Methods

### The Mistake That Almost Happened

**Problem:** There are 3 different ways to connect to Google Ads API, and using the wrong one breaks everything in serverless environments like Vercel.

### ❌ WRONG Methods (Don't Use These!)

#### 1. Old google-ads-api npm Package (v16)
```typescript
// DON'T DO THIS!
import { GoogleAdsApi } from 'google-ads-api';
const client = new GoogleAdsApi({ /* config */ });
```
**Why it fails:**
- Uses gRPC protocol (not supported in Vercel serverless)
- Version 16 is outdated (current is v20)
- Package hasn't been updated for Next.js 15
- Causes "Module not found" errors in production

#### 2. Google Ads Scripts API
```javascript
// DON'T DO THIS!
// This is for in-browser Google Ads scripts, NOT for external apps
```
**Why it fails:**
- Only works inside Google Ads UI
- Can't be used in external applications
- Different authentication method

### ✅ CORRECT Method (What We Use)

#### Direct REST API Calls (v20)
```typescript
// File: /src/lib/google-ads-direct.ts
const apiUrl = `https://googleads.googleapis.com/v20/customers/${customerId}/googleAds:searchStream`;

const response = await fetch(apiUrl, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'developer-token': this.credentials.developerToken,
    'login-customer-id': cleanMccId,
  },
  body: JSON.stringify({ query })
});
```

**Why this works:**
- ✅ Uses standard HTTPS/REST (works everywhere)
- ✅ Latest API version (v20 - January 2025)
- ✅ Compatible with Vercel serverless
- ✅ No npm package dependencies
- ✅ Full control over requests

### API Version History & Migration

**v16 (Old) → v20 (Current)**
- Endpoint change: `/v16/` → `/v20/`
- Some field names changed
- Better performance and features
- Required migration in 2024-2025

**How to Check Your Version:**
Look at the URL in `/src/lib/google-ads-direct.ts` line 77:
```typescript
const apiUrl = `https://googleads.googleapis.com/v20/customers/...`
                                                    ^^^^ THIS NUMBER
```

### Data Fetching Pattern

```typescript
// 1. Get OAuth access token
const accessToken = await this.getAccessToken();

// 2. Build GAQL query (Google Ads Query Language)
const query = `
  SELECT
    campaign.id,
    campaign.name,
    metrics.impressions,
    metrics.clicks,
    metrics.conversions
  FROM ad_group
  WHERE segments.date >= '20250101'
`;

// 3. Make REST API call
const response = await fetch(apiUrl, {
  method: 'POST',
  headers: { /* auth headers */ },
  body: JSON.stringify({ query })
});

// 4. Parse response
const data = await response.json();
const results = data[0]?.results || [];
```

### Authentication Flow

```
1. Store in .env:
   - GOOGLE_ADS_CLIENT_ID
   - GOOGLE_ADS_CLIENT_SECRET
   - GOOGLE_ADS_REFRESH_TOKEN
   - GOOGLE_ADS_DEVELOPER_TOKEN
   ↓
2. Exchange refresh token for access token:
   POST https://oauth2.googleapis.com/token
   ↓
3. Use access token in Google Ads API calls:
   Authorization: Bearer {access_token}
   ↓
4. Access token expires after 1 hour
   (Refresh automatically on next request)
```

### Common Mistakes to Avoid

1. **Using v16 instead of v20** → Old endpoints, missing features
2. **Using gRPC SDK in serverless** → Doesn't work in Vercel
3. **Forgetting developer-token header** → 401 Unauthorized
4. **Forgetting login-customer-id for MCC** → Can't access client accounts
5. **Not cleaning customer ID** → Format must be `1234567890` (no dashes)

---

## 🔧 Recent Changes (Latest Session)

### ✅ Completed Tasks

#### 1. Overview Restructure
- Removed tons of duplicate/detailed sections from Overview
- Created clean 4-card channel comparison layout
- Moved detailed tables to specific views (Ads/SEO/Calls)
- Removed all period comparison sections

#### 2. GA4 Event Tracking (FIXED)
**Problem:** Events were showing 0 because event names didn't match

**Your Actual GA4 Events:**
```
page_view: 1,587 events
session_start: 1,292 events
user_engagement: 1,147 events
first_visit: 1,083 events
scroll: 235 events
call_from_web: 26 events ← WEB CALLS
submit_form: 23 events ← FORM SUBMISSIONS
phone_call: 19 events ← WEB CALLS
submit_form_successful: 15 events ← FORM SUBMISSIONS
click: (count unknown) ← CLICK TO CHAT
```

**Solution Implemented:**
- Updated `/src/lib/google-analytics.ts` line 447-492
- Changed event names to match YOUR site:
  - Form Fills = `submit_form_successful` + `submit_form` (should show ~38 total)
  - Web Calls = `phone_call` + `call_from_web` (should show ~45 total)
  - Click to Chat = `click` event

**File Changed:** `/src/lib/google-analytics.ts` - `getEventCounts()` method

#### 3. Removed Period Comparison
- Deleted entire "Period Comparison" section from Overview
- Removed `fetchPreviousPeriodData()` function
- Removed `previousPeriodData` state
- All data now strictly follows 7/30/90 day filter selection

#### 4. Removed Fake Data
- Removed "Calls: 0" from Google Ads card
- No more calculated/percentage-based fake numbers
- All data comes from real API calls

#### 5. Updated Types
- Added `gaEvents` to `DashboardMetrics` interface in `/src/types/index.ts`
- Includes: formSubmissions, phoneCalls, clickToChat

---

## ⚠️ Known Issues / Questions

### Issue 1: Google Ads Conversion Discrepancy
**Problem:** Google Ads shows 11 phone calls but dashboard shows 9 "Leads"

**Explanation:**
- Dashboard "Leads" = `metrics.conversions` (total conversions from Google Ads API)
- This includes ALL conversion types (forms + calls combined)
- The 11 phone calls might be a specific conversion action tracked separately
- GA4 tracks 45 web calls total (all sources: ads + organic + direct)

**Status:** Not yet investigated - depends on Google Ads conversion action setup

**Potential Fix:** Modify Google Ads API query to fetch conversion actions separately:
```typescript
// Could add to query:
segments.conversion_action_name,
metrics.conversions_from_interactions_by_conversion_date
```

### Issue 2: Click to Chat Event
**Problem:** Using generic `click` event which might include ALL clicks

**Recommendation:** Create a specific event in GA4 like `chat_widget_click` or `live_chat_opened`

---

## 📊 Data Flow

### How Data Flows Through Dashboard

```
User selects period (7/30/90 days)
    ↓
Frontend calls: /api/dashboard?period=7days&clientId=xxx
    ↓
Dashboard API (route.ts) makes parallel calls:
    1. GoogleAnalyticsConnector.getBasicMetrics()
    2. GoogleAnalyticsConnector.getEventCounts() ← NEW
    3. GoogleAdsDirectConnector.getCampaignReport()
    4. CallRailConnector.getCallsReport()
    ↓
Returns combined DashboardMetrics object
    ↓
ProfessionalDashboard.tsx renders 5 views
```

### Data Sources

**Google Ads (Conversions/Leads):**
- API: Google Ads API v20 REST
- Endpoint: `/v20/customers/{customerId}/googleAds:searchStream`
- Key Metric: `metrics.conversions` = Total conversions (forms + calls)

**Google Analytics (Sessions/Traffic):**
- API: Google Analytics Data API v1
- Metrics: sessions, activeUsers, pageviews, bounceRate

**GA4 Events (Form/Call/Chat):**
- API: Google Analytics Data API v1 (runReport with dimensionFilter)
- Events: submit_form, submit_form_successful, phone_call, call_from_web, click

**CallRail (Phone Calls):**
- API: CallRail REST API
- Metrics: totalCalls, answeredCalls, missedCalls, averageDuration

**Search Console (SEO):**
- API: Google Search Console API v1
- Metrics: impressions, clicks, avgCtr, avgPosition

---

## 🚀 Deployment Commands

### Build Locally
```bash
cd "/Users/trieu/Desktop/VS CODE/ultimate-report-dashboard"
npm run build
```

### Deploy to Vercel
```bash
npx vercel --prod
```

### Check Logs
```bash
npx vercel logs [deployment-url] --output=raw
```

---

## 🔑 Environment Variables Required

```env
# Google Analytics
GOOGLE_ANALYTICS_PROPERTY_ID=your_property_id

# Google Ads
GOOGLE_ADS_DEVELOPER_TOKEN=your_developer_token
GOOGLE_ADS_CLIENT_ID=your_oauth_client_id
GOOGLE_ADS_CLIENT_SECRET=your_oauth_client_secret
GOOGLE_ADS_REFRESH_TOKEN=your_refresh_token
GOOGLE_ADS_CUSTOMER_ID=123-456-7890
GOOGLE_ADS_MCC_ID=123-456-7890 (if using MCC)

# Google Service Account (for GA4 & Search Console)
GOOGLE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_PROJECT_ID=your-google-cloud-project-id

# CallRail
CALLRAIL_API_KEY=your_callrail_api_key
CALLRAIL_ACCOUNT_ID=your_callrail_account_id

# NextAuth (for user authentication)
NEXTAUTH_SECRET=your_random_secret_key
NEXTAUTH_URL=https://your-domain.com
```

---

## 🎨 Design Philosophy

### No Fake Data Policy
- **Rule:** Never calculate, estimate, or make up numbers
- **If data doesn't exist:** Show 0 or "N/A"
- **No percentage-based calculations** like `sessions * 0.8` for users
- **All metrics must come from real API responses**

### Period Selection
- All dashboard data respects the 7/30/90 day filter
- No independent date ranges for different sections
- No "vs previous period" comparisons (removed per user request)

### Channel Separation
- Clear distinction between Ads, SEO, and Calls
- Each channel has its own view for detailed analysis
- Overview shows high-level comparison only

---

## 📝 Code Patterns

### How to Add a New Metric

1. **Update Types** (`/src/types/index.ts`)
```typescript
export interface DashboardMetrics {
  // ... existing fields
  newMetric?: number;
}
```

2. **Fetch Data in API** (`/src/app/api/dashboard/route.ts`)
```typescript
const apiCalls = {
  newData: () => new SomeConnector().getSomeData(timeRange),
};
```

3. **Display in Component** (`/src/components/ProfessionalDashboard.tsx`)
```typescript
<div>{data?.newMetric || 0}</div>
```

### How to Add a New GA4 Event

Edit `/src/lib/google-analytics.ts` line 466:
```typescript
inListFilter: {
  values: ['submit_form_successful', 'submit_form', 'phone_call', 'call_from_web', 'click', 'your_new_event'],
}
```

Then add the event handler in the forEach loop.

---

## 🐛 Common Troubleshooting

### Issue: "No data available"
1. Check API credentials in `.env.local`
2. Verify service account has access to GA4 property
3. Check Google Ads customer ID format (remove dashes)
4. Look at browser console for API errors

### Issue: TypeScript errors
1. Run `npm run build` to see all errors
2. Check `/src/types/index.ts` for type definitions
3. Ensure all optional fields use `?:` notation

### Issue: Vercel deployment fails
1. Check environment variables in Vercel dashboard
2. Verify all required variables are set
3. Check build logs: `vercel logs [url]`

### Issue: GA4 events showing 0
1. Go to GA4 → Reports → Events
2. Find exact event names (case-sensitive!)
3. Update event names in `/src/lib/google-analytics.ts` line 466

---

## 📚 Documentation Files (Legacy)

The following .md files exist but are mostly outdated deployment/setup guides:
- Most can be deleted or ignored
- Keep: README.md, this file (PROJECT_NOTES.md)
- All old deployment status files are obsolete

**Files to potentially delete:**
```
ADD_TO_SEARCH_CONSOLE.md
AUTO_DEPLOYMENT_GUIDE.md
CHECK_GOOGLE_ADS_ERROR.md
CONNECTION_STATUS.md
CRITICAL_CHECK.md
DEPLOYMENT*.md (multiple)
FINAL_*.md (multiple)
GOOGLE_ADS_*.md (multiple)
HOW_TO_RUN_DIAGNOSTIC.md
MCC_FIX_COMPLETE.md
MOCK_DATA_DEPLOYED.md
PUSH_TO_GITHUB.md
QUICK_SETUP.md
VERCEL_*.md (multiple)
diagnose-deployment-issues.md
manual-upload-guide.md
```

---

## 🎯 Next Steps / TODO

### Investigate
- [ ] Google Ads conversion discrepancy (11 calls vs 9 conversions)
- [ ] Separate phone vs form conversions in Google Ads API
- [ ] Verify "Click to Chat" event is tracking the right clicks

### Enhancements
- [ ] Add conversion action breakdown from Google Ads
- [ ] Create custom "click_to_chat" event in GA4 (instead of generic "click")
- [ ] Add mobile responsiveness testing
- [ ] Consider adding date range picker for custom dates

### Cleanup
- [ ] Delete obsolete .md documentation files
- [ ] Archive old deployment guides

---

## 💡 Tips for Future Sessions

When starting a new Claude Code session:

1. **Say:** "Continue working on the dashboard project"
2. **I'll read:** This file (PROJECT_NOTES.md) to understand context
3. **Then ask:** "What are we working on?" and I'll be up to speed

Key things to remember:
- All GA4 event names are custom to YOUR site (not generic)
- Dashboard uses Google Ads API v20 (REST, not gRPC)
- No fake data - only show what APIs return
- Period filter (7/30/90 days) controls ALL data

---

**Project Path:** `/Users/trieu/Desktop/VS CODE/ultimate-report-dashboard/`
**Node Version:** 18.x
**Package Manager:** npm

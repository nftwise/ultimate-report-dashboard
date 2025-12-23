# Function Diary & Reference Guide

**Last Updated**: 2025-11-05

Complete reference for all functions, API endpoints, database queries, and data flows in the Ultimate Report Dashboard.

---

## Table of Contents

1. [API Endpoints](#api-endpoints)
2. [Frontend Fetch Functions](#frontend-fetch-functions)
3. [Database Schema & Queries](#database-schema--queries)
4. [Authentication & OAuth](#authentication--oauth)
5. [Data Processing Functions](#data-processing-functions)
6. [Utility Scripts](#utility-scripts)

---

## API Endpoints

### Google Business Profile API

#### `/api/google-business/test-new-api`
**Purpose**: Fetch GBP performance metrics with flexible date ranges

**Method**: GET

**Query Parameters**:
- `clientId` (required): UUID of client from `clients.id`
- `locationId` (required): GBP location ID from `service_configs.gbp_location_id`
- `days` (optional): Number of days to fetch (default: 30, max: 540)
- `startDate` (optional): Start date in YYYY-MM-DD format
- `endDate` (optional): End date in YYYY-MM-DD format

**Date Logic**:
```typescript
if (startDateParam && endDateParam) {
  // Use explicit date range
  startDate = new Date(startDateParam);
  endDate = new Date(endDateParam);
} else if (daysParam) {
  // Use number of days from today
  const days = Math.min(parseInt(daysParam), 540);
  endDate = new Date();
  startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
} else {
  // Default: last 30 days
  endDate = new Date();
  startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
}
```

**Response Format**:
```json
{
  "success": true,
  "data": {
    "rawResponse": {
      "multiDailyMetricTimeSeries": [
        {
          "dailyMetricTimeSeries": [
            {
              "dailyMetric": "CALL_CLICKS",
              "timeSeries": {
                "datedValues": [
                  {
                    "date": {
                      "year": 2024,
                      "month": 10,
                      "day": 15
                    },
                    "value": "12"
                  }
                ]
              }
            }
          ]
        }
      ]
    }
  }
}
```

**Metrics Available**:
- `CALL_CLICKS` - Phone call clicks from GBP
- `WEBSITE_CLICKS` - Website visits from GBP
- `BUSINESS_DIRECTION_REQUESTS` - Direction requests
- `BUSINESS_IMPRESSIONS_DESKTOP_MAPS` - Desktop map views
- `BUSINESS_IMPRESSIONS_DESKTOP_SEARCH` - Desktop search views
- `BUSINESS_IMPRESSIONS_MOBILE_MAPS` - Mobile map views
- `BUSINESS_IMPRESSIONS_MOBILE_SEARCH` - Mobile search views

**Error Responses**:
```json
{
  "success": false,
  "error": "Missing required parameters"
}
```

**Usage Example**:
```typescript
// Last 30 days (default)
const url = `/api/google-business/test-new-api?clientId=${clientId}&locationId=${locationId}`;

// Last 365 days
const url = `/api/google-business/test-new-api?clientId=${clientId}&locationId=${locationId}&days=365`;

// Custom date range
const url = `/api/google-business/test-new-api?clientId=${clientId}&locationId=${locationId}&startDate=2024-01-01&endDate=2024-12-31`;
```

**Constraints**:
- Maximum range: 18 months (540 days)
- No future dates
- Data has 2-3 day delay
- Requires valid OAuth token in `service_configs.gbp_oauth_token`

**File Location**: `/src/app/api/google-business/test-new-api/route.ts`

---

### Google Business Profile OAuth

#### `/api/google-business/oauth/initiate`
**Purpose**: Start OAuth flow to connect GBP account

**Method**: GET

**Query Parameters**:
- `clientId` (required): UUID of client

**Response**: Redirects to Google OAuth consent screen

**File Location**: `/src/app/api/google-business/oauth/initiate/route.ts`

---

#### `/api/google-business/oauth/callback`
**Purpose**: Handle OAuth callback and store tokens

**Method**: GET

**Query Parameters**:
- `code` (required): OAuth authorization code
- `state` (required): Client ID for verification

**Process**:
1. Exchange code for access token and refresh token
2. Store tokens in `service_configs.gbp_oauth_token` and `gbp_refresh_token`
3. Fetch user profile email
4. Store email in `service_configs.gbp_connected_email`
5. Redirect to success page

**File Location**: `/src/app/api/google-business/oauth/callback/route.ts`

---

### Google Analytics API

#### `/api/google-analytics/data`
**Purpose**: Fetch GA4 analytics data for specified property

**Method**: GET

**Query Parameters**:
- `propertyId` (required): GA4 Property ID
- `startDate` (required): YYYY-MM-DD
- `endDate` (required): YYYY-MM-DD
- `metrics` (optional): Comma-separated metrics (default: sessions,users,pageviews)
- `dimensions` (optional): Comma-separated dimensions

**Response Format**:
```json
{
  "success": true,
  "data": {
    "sessions": 1234,
    "users": 890,
    "pageviews": 5678
  }
}
```

**File Location**: `/src/app/api/google-analytics/data/route.ts`

---

### Google Ads API

#### `/api/google-ads/campaigns`
**Purpose**: Fetch campaign performance data

**Method**: GET

**Query Parameters**:
- `customerId` (required): Google Ads Customer ID
- `startDate` (required): YYYY-MM-DD
- `endDate` (required): YYYY-MM-DD

**Response Format**:
```json
{
  "success": true,
  "campaigns": [
    {
      "id": "123456",
      "name": "Brand Campaign",
      "status": "ENABLED",
      "impressions": 10000,
      "clicks": 500,
      "cost": 1250.50,
      "conversions": 25
    }
  ]
}
```

**File Location**: `/src/app/api/google-ads/campaigns/route.ts`

---

### Client Management API

#### `/api/clients/[clientId]`
**Purpose**: Get client details by UUID

**Method**: GET

**Response Format**:
```json
{
  "id": "uuid-here",
  "name": "CorePosture Chiropractic",
  "slug": "coreposture-chiropractic",
  "contact_email": "contact@example.com",
  "contact_name": "Dr. Smith",
  "contact_phone": "949-555-1234",
  "industry": "chiropractor",
  "city": "Irvine, CA",
  "is_active": true,
  "plan_type": "professional",
  "created_at": "2024-10-15T12:00:00Z"
}
```

**File Location**: `/src/app/api/clients/[clientId]/route.ts`

---

## Frontend Fetch Functions

### ProfessionalDashboard.tsx Functions

**File Location**: `/src/components/ProfessionalDashboard.tsx`

---

#### `fetchGBPData()`
**Purpose**: Fetch current GBP metrics based on selected date range

**Location**: Line 1250

**Dependencies**:
- `clientUUID` - Client ID
- `gbpLocationId` - GBP location ID
- `startDate` - Selected start date
- `endDate` - Selected end date

**Current Implementation**:
```typescript
const fetchGBPData = async () => {
  try {
    if (!gbpLocationId || !clientUUID) {
      console.log('Missing GBP location ID or client UUID');
      return;
    }

    // NOTE: Currently does NOT pass startDate/endDate
    // API defaults to last 30 days
    const apiUrl = `/api/google-business/test-new-api?clientId=${clientUUID}&locationId=${gbpLocationId}`;

    const response = await fetch(apiUrl);
    const result = await response.json();

    if (result.success) {
      setGbpData(result.data);
    }
  } catch (error) {
    console.error('Failed to fetch GBP data:', error);
  }
};
```

**Known Issue**: Does not pass date parameters (see ISSUES.md #1)

**Recommended Fix**:
```typescript
const formatDate = (date: Date) => date.toISOString().split('T')[0];
const apiUrl = `/api/google-business/test-new-api?clientId=${clientUUID}&locationId=${gbpLocationId}&startDate=${formatDate(startDate)}&endDate=${formatDate(endDate)}`;
```

---

#### `fetchGBP12MonthData()`
**Purpose**: Fetch 12 months of GBP phone call data for chart visualization

**Location**: Lines 1278-1302

**Dependencies**:
- `clientUUID` - Client ID
- `gbpLocationId` - GBP location ID

**Implementation**:
```typescript
const fetchGBP12MonthData = async () => {
  try {
    if (!gbpLocationId || !clientUUID) {
      return;
    }

    // Fetch last 365 days of data
    const apiUrl = `/api/google-business/test-new-api?clientId=${clientUUID}&locationId=${gbpLocationId}&days=365`;

    const response = await fetch(apiUrl);
    const result = await response.json();

    if (result.success && result.data?.rawResponse?.multiDailyMetricTimeSeries) {
      // Extract CALL_CLICKS time series data
      const callClicksData = result.data.rawResponse.multiDailyMetricTimeSeries[0]
        ?.dailyMetricTimeSeries?.find((series: any) => series.dailyMetric === 'CALL_CLICKS');

      if (callClicksData?.timeSeries?.datedValues) {
        setGbp12MonthData(callClicksData.timeSeries.datedValues);
      }
    }
  } catch (error) {
    console.error('Failed to fetch 12-month GBP data:', error);
  }
};
```

**Trigger**: Lazy loads when user switches to GBP tab
```typescript
useEffect(() => {
  if (activeView === 'gbp' && gbpLocationId && clientUUID && !gbp12MonthData) {
    fetchGBP12MonthData();
  }
}, [activeView, gbpLocationId, clientUUID]);
```

**Data Flow**:
1. User clicks "Local Profile" tab
2. `activeView` changes to 'gbp'
3. useEffect triggers if data not already loaded
4. API fetches 365 days of CALL_CLICKS data
5. Component extracts datedValues array
6. Chart component renders monthly aggregation

---

#### `fetchGoogleAdsData()`
**Purpose**: Fetch Google Ads campaign performance

**Location**: Line ~1150

**Implementation**:
```typescript
const fetchGoogleAdsData = async () => {
  if (!gadsCustomerId) return;

  const response = await fetch(
    `/api/google-ads/campaigns?customerId=${gadsCustomerId}&startDate=${formatDate(startDate)}&endDate=${formatDate(endDate)}`
  );
  const result = await response.json();

  if (result.success) {
    setAdsData(result.campaigns);
  }
};
```

---

#### `fetchGoogleAnalyticsData()`
**Purpose**: Fetch GA4 analytics metrics

**Location**: Line ~1100

**Implementation**:
```typescript
const fetchGoogleAnalyticsData = async () => {
  if (!gaPropertyId) return;

  const response = await fetch(
    `/api/google-analytics/data?propertyId=${gaPropertyId}&startDate=${formatDate(startDate)}&endDate=${formatDate(endDate)}&metrics=sessions,users,pageviews,bounceRate`
  );
  const result = await response.json();

  if (result.success) {
    setAnalyticsData(result.data);
  }
};
```

---

## Database Schema & Queries

### Tables Overview

#### `clients` Table
**Purpose**: Store client business information

**Schema**:
```sql
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  contact_email TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  industry TEXT,
  city TEXT,
  owner TEXT,
  is_active BOOLEAN DEFAULT true,
  plan_type TEXT DEFAULT 'professional',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Key Fields**:
- `id` - UUID primary key (used for foreign key relationships)
- `slug` - URL-friendly identifier (used for client portal URLs)
- `is_active` - Enable/disable client access

**Common Queries**:
```sql
-- Get active clients
SELECT * FROM clients WHERE is_active = true ORDER BY name;

-- Get client by slug
SELECT * FROM clients WHERE slug = 'coreposture-chiropractic';

-- Get client by UUID
SELECT * FROM clients WHERE id = '123e4567-e89b-12d3-a456-426614174000';
```

---

#### `service_configs` Table
**Purpose**: Store API credentials and OAuth tokens for each client

**Schema**:
```sql
CREATE TABLE service_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  ga_property_id TEXT,
  gads_customer_id TEXT,
  gads_manager_account_id TEXT,
  gbp_location_id TEXT,
  gbp_oauth_token TEXT,
  gbp_refresh_token TEXT,
  gbp_connected_email TEXT,
  gsc_site_url TEXT,
  callrail_account_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id)
);
```

**Key Fields**:
- `client_id` - Foreign key to clients.id (UUID, not slug!)
- `ga_property_id` - GA4 Property ID (e.g., "123456789")
- `gads_customer_id` - Google Ads Customer ID (e.g., "123-456-7890")
- `gbp_location_id` - GBP Location ID (extracted from Google Maps URL)
- `gbp_oauth_token` - Access token for GBP API (expires in 1 hour)
- `gbp_refresh_token` - Refresh token for GBP API (long-lived)
- `gbp_connected_email` - Email of connected Google account

**Common Queries**:
```sql
-- Get service config for client
SELECT sc.* FROM service_configs sc
JOIN clients c ON sc.client_id = c.id
WHERE c.slug = 'coreposture-chiropractic';

-- Find clients missing GBP credentials
SELECT c.name, c.slug
FROM clients c
LEFT JOIN service_configs sc ON c.id = sc.client_id
WHERE c.is_active = true
  AND (sc.gbp_location_id IS NULL OR sc.gbp_oauth_token IS NULL);

-- Update GBP OAuth tokens
UPDATE service_configs
SET
  gbp_oauth_token = 'ya29.a0...',
  gbp_refresh_token = '1//0g...',
  gbp_connected_email = 'owner@business.com',
  updated_at = NOW()
WHERE client_id = '123e4567-e89b-12d3-a456-426614174000';
```

---

#### `users` Table
**Purpose**: Authentication for admin and client logins

**Schema**:
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'client')),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ
);
```

**Key Fields**:
- `email` - Unique login identifier
- `password_hash` - bcrypt hashed password (10 rounds)
- `role` - 'admin' or 'client'
- `client_id` - NULL for admins, references clients.id for client users

**Common Queries**:
```sql
-- Get user by email
SELECT * FROM users WHERE email = 'admin@example.com';

-- Get all client users
SELECT u.email, c.name as client_name
FROM users u
JOIN clients c ON u.client_id = c.id
WHERE u.role = 'client' AND u.is_active = true;

-- Create new user
INSERT INTO users (email, password_hash, role, client_id, is_active)
VALUES ('client@example.com', '$2a$10$...', 'client', '123e4567...', true);
```

---

### Complex Queries

#### Get Full Client Dashboard Data
```sql
SELECT
  c.id,
  c.name,
  c.slug,
  c.industry,
  c.city,
  sc.ga_property_id,
  sc.gads_customer_id,
  sc.gbp_location_id,
  sc.gbp_connected_email,
  u.email as login_email
FROM clients c
LEFT JOIN service_configs sc ON c.id = sc.client_id
LEFT JOIN users u ON c.id = u.client_id AND u.role = 'client'
WHERE c.slug = 'coreposture-chiropractic';
```

#### Find Clients with Incomplete Setup
```sql
SELECT
  c.name,
  c.slug,
  CASE WHEN sc.id IS NULL THEN 'Missing service_configs' ELSE 'OK' END as config_status,
  CASE WHEN u.id IS NULL THEN 'Missing user account' ELSE 'OK' END as user_status,
  CASE WHEN sc.ga_property_id IS NULL THEN 'Missing GA' ELSE 'OK' END as ga_status,
  CASE WHEN sc.gbp_location_id IS NULL THEN 'Missing GBP' ELSE 'OK' END as gbp_status
FROM clients c
LEFT JOIN service_configs sc ON c.id = sc.client_id
LEFT JOIN users u ON c.id = u.client_id AND u.role = 'client'
WHERE c.is_active = true
ORDER BY c.name;
```

---

## Authentication & OAuth

### Session-Based Authentication

**Flow**:
1. User submits login form (email + password)
2. Server verifies credentials against `users` table
3. bcrypt compares password with stored hash
4. If valid, create session and set cookie
5. Subsequent requests include session cookie
6. Middleware validates session on protected routes

**Login Implementation**:
```typescript
// /src/app/api/auth/login/route.ts
const user = await supabase
  .from('users')
  .select('*')
  .eq('email', email)
  .single();

const isValid = await bcrypt.compare(password, user.password_hash);

if (isValid) {
  // Create session
  const session = { userId: user.id, role: user.role };
  // Set cookie and redirect
}
```

---

### Google Business Profile OAuth 2.0

**OAuth Flow**:

1. **Initiate** (`/api/google-business/oauth/initiate`):
   ```typescript
   const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
   // params include:
   // - client_id
   // - redirect_uri
   // - response_type=code
   // - scope=https://www.googleapis.com/auth/business.manage
   // - state=clientId (for verification)
   ```

2. **User Grants Permission**: Google shows consent screen

3. **Callback** (`/api/google-business/oauth/callback`):
   ```typescript
   // Exchange code for tokens
   const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
     method: 'POST',
     body: JSON.stringify({
       code,
       client_id,
       client_secret,
       redirect_uri,
       grant_type: 'authorization_code'
     })
   });

   const { access_token, refresh_token } = await tokenResponse.json();

   // Store tokens in database
   await supabase
     .from('service_configs')
     .update({
       gbp_oauth_token: access_token,
       gbp_refresh_token: refresh_token,
       gbp_connected_email: userEmail
     })
     .eq('client_id', clientId);
   ```

4. **Token Refresh** (when access token expires):
   ```typescript
   const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
     method: 'POST',
     body: JSON.stringify({
       refresh_token,
       client_id,
       client_secret,
       grant_type: 'refresh_token'
     })
   });

   const { access_token: newAccessToken } = await refreshResponse.json();
   ```

**Token Lifetimes**:
- Access Token: 1 hour
- Refresh Token: Long-lived (until revoked)

**Scopes Required**:
- `https://www.googleapis.com/auth/business.manage` - Full GBP access

---

## Data Processing Functions

### Monthly Aggregation (12-Month Chart)

**Purpose**: Convert daily call data into monthly totals

**Location**: `/src/components/ProfessionalDashboard.tsx` (lines 3045-3055)

**Implementation**:
```typescript
// Group data by month
const monthlyData: { [key: string]: number } = {};

gbp12MonthData.forEach((day: any) => {
  if (day.date && day.value) {
    // Create month key: "2024-10"
    const monthKey = `${day.date.year}-${String(day.date.month).padStart(2, '0')}`;

    // Sum values for each month
    monthlyData[monthKey] = (monthlyData[monthKey] || 0) + parseInt(day.value);
  }
});

// Sort by month and get last 12
const sortedMonths = Object.keys(monthlyData).sort();
const last12Months = sortedMonths.slice(-12);
```

**Input Data Format**:
```typescript
[
  { date: { year: 2024, month: 10, day: 1 }, value: "5" },
  { date: { year: 2024, month: 10, day: 2 }, value: "8" },
  { date: { year: 2024, month: 10, day: 3 }, value: "3" }
]
```

**Output Format**:
```typescript
{
  "2024-10": 16,  // Sum of all October days
  "2024-11": 23,
  "2024-12": 19
}
```

---

### Slug Generation

**Purpose**: Create URL-friendly identifiers from business names

**Location**: `/scripts/import-clients-from-csv.ts` (lines 63-70)

**Implementation**:
```typescript
function createSlug(businessName: string): string {
  return businessName
    .toLowerCase()                    // "CorePosture Chiropractic" → "coreposture chiropractic"
    .replace(/[^a-z0-9\s-]/g, '')    // Remove special chars
    .replace(/\s+/g, '-')             // Spaces to hyphens
    .replace(/-+/g, '-')              // Multiple hyphens to single
    .trim()                           // Remove leading/trailing spaces
}
```

**Examples**:
- "CorePosture Chiropractic" → "coreposture-chiropractic"
- "Dr. Smith's Office & Clinic" → "dr-smiths-office-clinic"
- "Zen Care Physical Medicine" → "zen-care-physical-medicine"

---

### Google Maps URL Parsing

**Purpose**: Extract GBP location ID from Google Maps URLs

**Location**: `/scripts/import-clients-from-csv.ts` (lines 72-83)

**Implementation**:
```typescript
function parseGoogleMapsUrl(url: string): string | null {
  if (!url) return null;

  // Try to extract location ID from various Google Maps URL formats
  const cidMatch = url.match(/cid=(\d+)/);
  if (cidMatch) return cidMatch[1];

  const placeMatch = url.match(/place\/([^\/]+)/);
  if (placeMatch) return placeMatch[1];

  return null;
}
```

**Supported URL Formats**:
```
https://www.google.com/maps?cid=12345678901234567890
https://maps.google.com/?cid=12345678901234567890
https://www.google.com/maps/place/Business+Name/@lat,lng,17z/data=...
```

---

## Utility Scripts

### Client Import Script

**File**: `/scripts/import-clients-from-csv.ts`

**Purpose**: Bulk import clients from CSV file with full setup

**Usage**:
```bash
npx tsx scripts/import-clients-from-csv.ts
```

**Process**:
1. Read CSV file from hardcoded path
2. Parse CSV with column headers
3. For each row:
   - Generate slug from business name
   - Check if client already exists (skip if yes)
   - Insert client record
   - Parse Google Maps URL for GBP location ID
   - Insert service_configs record
   - Generate random temp password
   - Hash password with bcrypt
   - Insert user record
   - Log credentials to console
4. Print summary stats

**Output**:
```
📂 Reading CSV file...
📊 Found 23 clients in CSV

🔄 Importing: Zen Care Physical Medicine
✅ Created client: Zen Care Physical Medicine
   Slug: zen-care-physical-medicine
   City: Irvine, CA
   📋 Service config created
   👤 User account created
   📧 Email: contact@zencare.com
   🔑 Temp password: Welcomer4easrgc!
   🌐 Website: https://zencare.com
   📍 GBP Location: 12345678901234567890
   🎯 Services: GBP

==================================================
📊 Import Summary:
✅ Imported: 4
⏭️  Skipped (already exists): 19
❌ Errors: 0
📋 Total: 23
==================================================
```

---

### Fix New Client Users Script

**File**: `/scripts/fix-new-client-users.ts`

**Purpose**: Create user accounts for clients without login access

**Usage**:
```bash
npx tsx scripts/fix-new-client-users.ts
```

**Process**:
1. Define list of client slugs to fix
2. For each slug:
   - Fetch client by slug
   - Check if user already exists (skip if yes)
   - Generate unique email: `{slugwithoutdashes}@client.temp`
   - Generate random password: `Welcome{random}!`
   - Hash password with bcrypt
   - Insert user record
   - Log credentials to console and file
3. Save all credentials to `NEW_CLIENT_CREDENTIALS.txt`

**Output File Format**:
```
ZEN CARE PHYSICAL MEDICINE:
  Email: zencarephysicalmedicine@client.temp
  Password: Welcomer4easrgc!
  Login: http://localhost:3000/login

HEALING HANDS OF MANAHAWKIN:
  Email: healinghandsofmanahawkin@client.temp
  Password: Welcomeorfy0jo9!
  Login: http://localhost:3000/login
```

---

### Create Client Users Script

**File**: `/scripts/create-client-users.ts`

**Purpose**: Generate user accounts for ALL active clients

**Usage**:
```bash
npx tsx scripts/create-client-users.ts
```

**Process**:
1. Fetch all active clients from database
2. For each client:
   - Check if user already exists (skip if yes)
   - Use client's contact_email as login email
   - Generate temp password
   - Create user with 'client' role
   - Log credentials
3. Print summary stats

**Difference from fix-new-client-users.ts**:
- Processes ALL clients (not just specific list)
- Uses contact_email from clients table (not generated email)
- No credentials file output

---

## Quick Reference

### Common Tasks

**Get Client Dashboard URL**:
```
https://yourdomain.com/dashboard/professional?clientId={slug}
```

**Test GBP API**:
```bash
curl "http://localhost:3000/api/google-business/test-new-api?clientId=uuid&locationId=123&days=30"
```

**Reset Client Password**:
```sql
UPDATE users
SET password_hash = '$2a$10$...'  -- Generate with: await bcrypt.hash('newpass', 10)
WHERE client_id = (SELECT id FROM clients WHERE slug = 'client-slug');
```

**Add New API Credential**:
```sql
UPDATE service_configs
SET ga_property_id = '123456789'
WHERE client_id = (SELECT id FROM clients WHERE slug = 'client-slug');
```

### Environment Variables Required

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

---

## Maintenance Notes

**Update This Document When**:
- Adding new API endpoints
- Creating new database tables
- Implementing new fetch functions
- Adding utility scripts
- Changing authentication flow
- Modifying data structures

**Version History**:
- 2025-11-05: Initial creation with GBP 12-month chart documentation

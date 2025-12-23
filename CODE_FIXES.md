# Code Fixes & Changes Log

**Last Updated**: 2025-11-05

Complete changelog of all code modifications, bug fixes, and enhancements made to the Ultimate Report Dashboard.

---

## Table of Contents

1. [Recent Changes (Current Session)](#recent-changes-current-session)
2. [Previous Session Changes](#previous-session-changes)
3. [Database Schema Changes](#database-schema-changes)
4. [Breaking Changes](#breaking-changes)
5. [Deprecated Code](#deprecated-code)

---

## Recent Changes (Current Session)

### 1. Created 12-Month GBP Phone Calls Chart

**Date**: 2025-11-05
**Files Modified**: `/src/components/ProfessionalDashboard.tsx`
**Type**: Feature Addition

**Changes**:

#### Added State Variable (Line 805)
```typescript
const [gbp12MonthData, setGbp12MonthData] = useState<any>(null); // For 12-month phone calls chart
```

#### Added Fetch Function (Lines 1278-1302)
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

#### Added Lazy Loading useEffect (Lines 945-950)
```typescript
// Fetch 12-month GBP data when user views the GBP section
useEffect(() => {
  if (activeView === 'gbp' && gbpLocationId && clientUUID && !gbp12MonthData) {
    fetchGBP12MonthData();
  }
}, [activeView, gbpLocationId, clientUUID]);
```

#### Added Chart Component (Lines 3031-3136)
Full interactive bar chart with:
- Monthly aggregation of daily data
- Gradient teal bars with hover effects
- Tooltips showing call count and month/year
- Summary statistics (Total, Average, Best Month)
- Conditional rendering

**Why This Change**:
- User requested visualization of GBP phone call trends
- Helps clients track monthly call volume patterns
- Identifies best-performing months
- Lazy loading prevents unnecessary API calls

**Testing Done**:
- Server compiled successfully
- Chart renders when GBP tab is active
- Data fetches correctly from API
- Monthly aggregation works correctly

---

### 2. Enhanced GBP API with Flexible Date Range Support

**Date**: 2025-11-05
**Files Modified**: `/src/app/api/google-business/test-new-api/route.ts`
**Type**: Enhancement

**Changes**:

#### Added Optional Parameters (Lines 16-18)
```typescript
const daysParam = searchParams.get('days'); // Optional: number of days to fetch (default 30, max 540)
const startDateParam = searchParams.get('startDate'); // Optional: YYYY-MM-DD format
const endDateParam = searchParams.get('endDate'); // Optional: YYYY-MM-DD format
```

#### Updated Date Calculation Logic (Lines 69-88)
```typescript
// Calculate date range
let startDate: Date;
let endDate: Date;

if (startDateParam && endDateParam) {
  // Use provided date range
  startDate = new Date(startDateParam);
  endDate = new Date(endDateParam);
  console.log(`Using explicit date range: ${startDateParam} to ${endDateParam}`);
} else if (daysParam) {
  // Use number of days (max 540 for 18 months)
  const days = Math.min(parseInt(daysParam), 540);
  endDate = new Date();
  startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  console.log(`Using ${days} days from today`);
} else {
  // Default to last 30 days
  endDate = new Date();
  startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  console.log('Using default 30 days');
}
```

**Before**:
- API always returned last 30 days
- Hardcoded date range calculation
- No way to fetch historical data beyond 30 days

**After**:
- Three modes: explicit dates, days parameter, or default
- Supports up to 18 months (540 days)
- Flexible for different use cases

**Why This Change**:
- Enables 12-month chart to fetch 365 days
- Allows date picker to control data range (when frontend is updated)
- More flexible API for future features

**API Usage Examples**:
```typescript
// Last 30 days (default)
/api/google-business/test-new-api?clientId=uuid&locationId=123

// Last 365 days
/api/google-business/test-new-api?clientId=uuid&locationId=123&days=365

// Custom date range
/api/google-business/test-new-api?clientId=uuid&locationId=123&startDate=2024-01-01&endDate=2024-12-31
```

---

### 3. Fixed CSV Client Import Script

**Date**: 2025-11-05
**Files Modified**: `/scripts/import-clients-from-csv.ts`
**Type**: Bug Fix

**Changes**:

#### Fixed Client Insert (Lines 128-154)
```typescript
// BEFORE (Missing fields):
const { data: client } = await supabase
  .from('clients')
  .insert({
    name: record.business_name,
    slug: slug,
    contact_email: record.email,
    // Missing: city, owner
  })

// AFTER (Complete):
const cityState = `${record.city}, ${record.state}`
const { data: client, error: clientError} = await supabase
  .from('clients')
  .insert({
    name: record.business_name,
    slug: slug,
    contact_email: record.email || `${slug}@temp.com`,
    contact_name: record.contact_person || '',
    contact_phone: record.phone || null,
    industry: record.business_type || 'chiropractor',
    city: cityState,           // ADDED
    owner: record.contact_person || null,  // ADDED
    is_active: true,
    plan_type: 'professional'
  })
```

#### Fixed service_configs Foreign Key (Line 167)
```typescript
// BEFORE (Wrong - used slug):
const { error: configError } = await supabase
  .from('service_configs')
  .insert({
    client_id: slug,  // ERROR: slug is string, client_id is UUID
    // ...
  })

// AFTER (Correct - uses UUID):
const { error: configError } = await supabase
  .from('service_configs')
  .insert({
    client_id: client.id,  // FIXED: client.id is UUID
    ga_property_id: null,
    gads_customer_id: null,
    gads_manager_account_id: hasGoogleAds ? '8432700368' : null,
    gbp_location_id: gbpLocationId || null,
    gsc_site_url: record.website_url || null,
    callrail_account_id: null
  })
```

#### Added User Account Creation (Lines 184-199)
```typescript
// ADDED: Create user account for client login
const { error: userError } = await supabase
  .from('users')
  .insert({
    email: record.email || `${slug}@temp.com`,
    password_hash: hashedPassword,
    role: 'client',
    client_id: client.id,
    is_active: true
  })
```

**Errors Fixed**:
- `invalid input syntax for type uuid: "zen-care-physical-medicine"`
- Missing city and owner data in clients table
- Clients imported without login credentials

**Result**: Successfully imported 4 new clients with complete setup

---

### 4. Created Fix New Client Users Script

**Date**: 2025-11-05
**Files Created**: `/scripts/fix-new-client-users.ts`
**Type**: New Feature

**Purpose**: Generate unique login credentials for specific clients

**Implementation**:
```typescript
const newClients = [
  { slug: 'zen-care-physical-medicine' },
  { slug: 'healing-hands-of-manahawkin' },
  { slug: 'ray-chiropractic' },
  { slug: 'saigon-district-restaurant' }
]

for (const item of newClients) {
  // Create unique email by removing dashes from slug
  const email = item.slug.replace(/-/g, '') + '@client.temp'
  const password = `Welcome${Math.random().toString(36).slice(2, 10)}!`
  const hashedPassword = await bcrypt.hash(password, 10)

  // Insert user
  await supabase.from('users').insert({
    email: email,
    password_hash: hashedPassword,
    role: 'client',
    client_id: client.id,
    is_active: true
  })

  // Save credentials to array for file output
  credentials.push(`${client.name}:`)
  credentials.push(`  Email: ${email}`)
  credentials.push(`  Password: ${password}`)
  credentials.push(`  Login: http://localhost:3000/login`)
}

// Write credentials to file
fs.writeFileSync('NEW_CLIENT_CREDENTIALS.txt', credentials.join('\n'))
```

**Why This Approach**:
- Previous import attempts created duplicate emails
- Unique pattern: `slugwithoutdashes@client.temp` prevents collisions
- Credentials file provides easy distribution to clients
- Separate script allows re-running without full import

**Output**: Created 4 user accounts with credentials saved to file

---

## Previous Session Changes

### 5. Fixed GBP OAuth Integration

**Date**: Previous Session
**Files Modified**: Multiple OAuth-related files
**Type**: Bug Fix

**Changes**:
- Added `gbp_connected_email` column to `service_configs` table
- Fixed token refresh logic
- Updated OAuth callback to store user email
- Resolved UUID vs slug issues in OAuth flow

**SQL Migration**:
```sql
ALTER TABLE service_configs
ADD COLUMN IF NOT EXISTS gbp_connected_email TEXT;
```

**Why This Change**:
- Clients needed to know which Google account was connected
- Admin needed to verify correct account was linked
- Support debugging of OAuth issues

---

### 6. Dashboard Performance Optimization

**Date**: Previous Session
**Files Modified**: `/src/components/ProfessionalDashboard.tsx`
**Type**: Performance

**Changes**:
- Implemented lazy loading for GBP data
- Reduced initial page load data fetching
- Added loading states for better UX
- Optimized re-render logic

**Before**:
- All API calls made on component mount
- Heavy initial load time
- Unnecessary data fetching for inactive tabs

**After**:
- Data fetched only when tab is viewed
- Faster initial page load
- Better perceived performance

---

### 7. Migrated Data from JSON to Database

**Date**: Previous Session
**Type**: Data Migration

**Changes**:
- Moved client data from JSON files to PostgreSQL
- Created service_configs table for API credentials
- Established proper foreign key relationships
- Implemented Supabase client for database access

**Why This Change**:
- JSON files don't scale for multiple clients
- Database enables multi-user access
- Proper relational data structure
- Easier to query and update

---

## Database Schema Changes

### service_configs Table Evolution

#### Initial Schema
```sql
CREATE TABLE service_configs (
  id UUID PRIMARY KEY,
  client_id UUID REFERENCES clients(id),
  ga_property_id TEXT,
  gads_customer_id TEXT,
  gbp_location_id TEXT
);
```

#### Added OAuth Tokens
```sql
ALTER TABLE service_configs
ADD COLUMN gbp_oauth_token TEXT,
ADD COLUMN gbp_refresh_token TEXT;
```

#### Added Connected Email (Latest)
```sql
ALTER TABLE service_configs
ADD COLUMN gbp_connected_email TEXT;
```

#### Current Full Schema
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

---

### clients Table Evolution

#### Initial Schema
```sql
CREATE TABLE clients (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  contact_email TEXT
);
```

#### Added Location Fields
```sql
ALTER TABLE clients
ADD COLUMN city TEXT,
ADD COLUMN owner TEXT;
```

#### Current Full Schema
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

---

## Breaking Changes

### UUID vs Slug for Foreign Keys

**Change**: service_configs.client_id changed from string (slug) to UUID

**Date**: 2025-11-05

**Impact**:
- Old code using slugs for client_id will fail
- All scripts must use clients.id (UUID) instead of clients.slug

**Migration Required**:
```typescript
// OLD (BROKEN):
await supabase.from('service_configs').insert({
  client_id: 'coreposture-chiropractic'  // String slug
})

// NEW (CORRECT):
const { data: client } = await supabase
  .from('clients')
  .select('id')
  .eq('slug', 'coreposture-chiropractic')
  .single()

await supabase.from('service_configs').insert({
  client_id: client.id  // UUID
})
```

**Files Updated**:
- `/scripts/import-clients-from-csv.ts`
- `/scripts/fix-new-client-users.ts`
- All API routes referencing service_configs

---

## Deprecated Code

### Legacy GBP API Endpoints

**Status**: Deprecated, to be removed

**Affected Files**:
- `/src/app/api/google-business/getDailyMetricsTimeSeries/` (if exists)
- Any routes using old GBP API structure

**Replacement**: Use `/api/google-business/test-new-api` instead

**Migration Example**:
```typescript
// OLD (DEPRECATED):
const response = await fetch('/api/google-business/getDailyMetricsTimeSeries?...')

// NEW (CURRENT):
const response = await fetch('/api/google-business/test-new-api?clientId=uuid&locationId=123&days=365')
```

**Timeline**: Remove in next major cleanup

---

### Hardcoded 30-Day Date Range

**Status**: Replaced with flexible parameters

**Before**:
```typescript
const endDate = new Date();
const startDate = new Date();
startDate.setDate(startDate.getDate() - 30); // Always 30 days
```

**After**:
```typescript
const daysParam = searchParams.get('days');
const days = daysParam ? Math.min(parseInt(daysParam), 540) : 30;
```

**Migration**: Update all API calls to include date parameters

---

## Testing Notes

### Manual Tests Performed

1. **CSV Import**:
   - Imported 4 new clients successfully
   - Verified all fields populated correctly
   - Confirmed service_configs relationships
   - Tested user account creation

2. **GBP API Date Ranges**:
   - Tested default (30 days)
   - Tested days parameter (365 days)
   - Tested explicit date range
   - Verified 540-day maximum enforced

3. **12-Month Chart**:
   - Confirmed data fetches on tab activation
   - Verified monthly aggregation accuracy
   - Tested hover tooltips
   - Checked summary statistics calculations

### Automated Tests

**Status**: No automated tests currently exist

**Recommended**:
- Unit tests for date calculation logic
- Integration tests for API endpoints
- Component tests for dashboard sections
- E2E tests for OAuth flow

---

## Rollback Procedures

### If GBP API Changes Cause Issues

1. Revert API file:
   ```bash
   git checkout HEAD~1 src/app/api/google-business/test-new-api/route.ts
   ```

2. Remove date parameters from frontend:
   ```typescript
   // Fallback to simple URL
   const apiUrl = `/api/google-business/test-new-api?clientId=${clientUUID}&locationId=${gbpLocationId}`;
   ```

### If 12-Month Chart Breaks

1. Comment out chart component (lines 3031-3136)
2. Remove fetch function (lines 1278-1302)
3. Remove useEffect (lines 945-950)
4. Remove state variable (line 805)

### If Import Script Fails

1. Check database for partial imports:
   ```sql
   SELECT * FROM clients WHERE created_at > NOW() - INTERVAL '1 hour';
   ```

2. Delete incomplete records:
   ```sql
   DELETE FROM users WHERE client_id = 'incomplete-client-uuid';
   DELETE FROM service_configs WHERE client_id = 'incomplete-client-uuid';
   DELETE FROM clients WHERE id = 'incomplete-client-uuid';
   ```

3. Re-run import script

---

## Future Planned Changes

### High Priority

1. **Connect Date Picker to GBP API**
   - Update `fetchGBPData()` to pass date parameters
   - Test with various date ranges
   - Add validation for maximum range

2. **Implement Chart Enhancements**
   - Month-over-month comparison
   - Trend line overlay
   - Weekly breakdown toggle
   - CSV export button

### Medium Priority

1. **Add Automated Tests**
   - Set up Jest for unit tests
   - Add Playwright for E2E tests
   - Create test fixtures for database

2. **Remove Legacy Code**
   - Delete old GBP API endpoints
   - Clean up unused imports
   - Remove deprecated functions

### Low Priority

1. **Documentation**
   - Add JSDoc comments to functions
   - Create API documentation site
   - Write user guide for client portal

---

## Change Request Process

When making changes to this codebase:

1. **Document First**: Add planned change to this file
2. **Implement**: Make the code changes
3. **Test**: Verify changes work as expected
4. **Update**: Document actual changes and any deviations
5. **Commit**: Use descriptive commit messages referencing this log

**Example Commit Message**:
```
feat: Add 12-month GBP phone calls chart

- Added state and fetch function for 365 days of call data
- Implemented lazy loading on tab activation
- Created interactive bar chart with monthly aggregation
- Added summary statistics (total, average, best month)

See CODE_FIXES.md section "Created 12-Month GBP Phone Calls Chart"
```

---

## Versioning

This document tracks changes chronologically. For semantic versioning:

**Current Version**: 1.2.0

- **1.0.0**: Initial dashboard with basic metrics
- **1.1.0**: Added GBP OAuth integration
- **1.2.0**: Added 12-month chart and flexible date ranges

**Next Version**: 1.3.0
- Planned: Chart enhancements and date picker integration

---

## Contributors

Track who made which changes for accountability and questions:

- **Session 2025-11-05**:
  - 12-month GBP chart implementation
  - GBP API date range enhancement
  - CSV import script fixes
  - Documentation creation (ISSUES.md, FUNCTION_DIARY.md, CODE_FIXES.md)

---

**Maintenance Schedule**: Review and update this document weekly, or after any significant code changes.

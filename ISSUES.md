# Known Issues and To-Do Items

**Last Updated**: 2025-11-05

## Critical Issues

### 1. Frontend Date Range Picker Not Connected to GBP API
**Status**: Backend complete, Frontend pending
**Priority**: High
**Location**: `/src/components/ProfessionalDashboard.tsx`

**Issue**:
- Date range picker in UI allows users to select custom date ranges
- Selection triggers re-fetch of GBP data via `fetchGBPData()` (line 1250)
- However, `fetchGBPData()` does not pass `startDate` and `endDate` parameters to the API
- Backend API at `/api/google-business/test-new-api` fully supports date range parameters but receives none from frontend

**Impact**: Users cannot view historical GBP data for custom date ranges

**Fix Required**:
```typescript
// In fetchGBPData() around line 1250, update to:
const apiUrl = `/api/google-business/test-new-api?clientId=${clientUUID}&locationId=${gbpLocationId}&startDate=${formatDate(startDate)}&endDate=${formatDate(endDate)}`;
```

**API Parameters Supported**:
- `startDate` (YYYY-MM-DD format)
- `endDate` (YYYY-MM-DD format)
- `days` (number, max 540 for 18 months)
- If no params provided, defaults to last 30 days

**Constraints**:
- Maximum range: 18 months (540 days)
- No future dates allowed
- Data has 2-3 day delay for availability

---

### 2. Missing API Credentials for 18 Clients
**Status**: Data issue
**Priority**: High
**Location**: Database `service_configs` table

**Issue**: Many clients have NULL values for critical API connection fields:
- `ga_property_id` - Google Analytics 4 Property ID
- `gads_customer_id` - Google Ads Customer ID
- `gbp_location_id` - Google Business Profile Location ID
- `gsc_site_url` - Google Search Console site URL

**Affected Clients**: 18 out of 23 active clients

**Impact**:
- Clients cannot see their Google Analytics data
- Google Ads dashboard sections show no data
- GBP metrics unavailable
- Search Console insights missing

**Fix Required**:
1. Contact each client to obtain their API credentials
2. Use admin interface to update service_configs
3. Run verification script to test connections
4. Document credential collection process for future onboarding

**Verification Query**:
```sql
SELECT
  c.name,
  sc.ga_property_id IS NULL as missing_ga,
  sc.gads_customer_id IS NULL as missing_ads,
  sc.gbp_location_id IS NULL as missing_gbp,
  sc.gsc_site_url IS NULL as missing_gsc
FROM clients c
LEFT JOIN service_configs sc ON c.id = sc.client_id
WHERE c.is_active = true;
```

---

## Medium Priority Issues

### 3. Legacy GBP API Endpoints Returning 404 Errors
**Status**: Cleanup needed
**Priority**: Medium
**Location**: `/src/app/api/google-business/`

**Issue**:
- Old GBP API route `getDailyMetricsTimeSeries` no longer exists
- Frontend code still references legacy endpoints
- Console shows 404 errors during page load (cosmetic, non-blocking)

**Impact**:
- Console clutter makes debugging harder
- User confusion about "Failed to fetch" errors
- Unnecessary network requests

**Fix Required**:
1. Search codebase for references to old GBP endpoints
2. Remove or update to use new `/api/google-business/test-new-api` route
3. Clean up unused API route files

**Grep Command to Find References**:
```bash
grep -r "getDailyMetricsTimeSeries" src/
```

---

### 4. Console Errors During Initial Page Load
**Status**: Cosmetic issue
**Priority**: Low
**Location**: Browser console, various components

**Issue**:
- Multiple "Failed to fetch" TypeErrors appear in browser console
- Occurs during React component mounting phase
- Fetch attempts happen before components are fully ready

**Errors Seen**:
```
TypeError: Failed to fetch
    at fetchGBPData (ProfessionalDashboard.tsx:1250)
    at useEffect (ProfessionalDashboard.tsx:945)
```

**Impact**:
- No functional impact - charts load correctly after initial mount
- Confusing to users monitoring console
- Makes real errors harder to spot

**Fix Required**:
- Add loading state checks before fetch attempts
- Implement proper error boundaries
- Add null checks for required dependencies

**Example Fix**:
```typescript
useEffect(() => {
  if (activeView === 'gbp' && gbpLocationId && clientUUID && !isLoading) {
    fetchGBP12MonthData();
  }
}, [activeView, gbpLocationId, clientUUID, isLoading]);
```

---

## Enhancement Requests

### 5. 12-Month Chart Improvements
**Status**: Planned
**Priority**: Medium
**Location**: `/src/components/ProfessionalDashboard.tsx` (lines 3031-3136)

**Requested Enhancements**:
1. **Month-over-Month Comparison**
   - Show current month vs previous month
   - Display percentage change (+12% or -5%)
   - Color code: green for increase, red for decrease

2. **Trend Line Overlay**
   - Add line graph showing overall trend
   - Calculate moving average
   - Visualize growth/decline pattern

3. **Weekly Breakdown Toggle**
   - Add button to switch between monthly and weekly views
   - Weekly view shows last 52 weeks instead of 12 months
   - Useful for identifying weekly patterns

4. **CSV Export Functionality**
   - Download button to export chart data
   - Format: Date, Calls, Month, Year
   - Useful for client reporting and analysis

---

### 6. Verify All Clients Script Enhancement
**Status**: Incomplete
**Priority**: Low
**Location**: `/scripts/verify-all-clients.ts`

**Issue**: Script file exists but is empty (1 line)

**Purpose**: Should verify all clients have:
- Valid user accounts
- Correct service_configs relationships
- Active status matching expected state
- No orphaned records

**Fix Required**: Implement complete verification logic

---

## Database Schema Issues

### 7. Missing gbp_connected_email Column
**Status**: Fixed
**Priority**: N/A
**Location**: `service_configs` table

**Issue**: Column was missing, causing GBP OAuth integration errors

**Fix Applied**:
```sql
ALTER TABLE service_configs
ADD COLUMN IF NOT EXISTS gbp_connected_email TEXT;
```

**Status**: Resolved in previous session

---

## Security Considerations

### 8. Temporary Client Passwords
**Status**: Operational security concern
**Priority**: Medium

**Issue**:
- New clients receive temporary passwords in format `Welcome{random}!`
- Passwords stored in plaintext in `NEW_CLIENT_CREDENTIALS.txt`
- No forced password change on first login

**Recommendations**:
1. Implement forced password change flow on first login
2. Send credentials via secure channel (encrypted email, password manager)
3. Auto-delete credentials file after distribution
4. Add password expiration for temp accounts (7 days)

---

## Performance Optimization Opportunities

### 9. Lazy Loading Not Implemented for All Charts
**Status**: Partial implementation
**Priority**: Low

**Current State**:
- 12-month GBP chart implements lazy loading (fetches only when tab active)
- Other dashboard sections fetch all data on component mount
- Causes unnecessary API calls and slower initial load

**Recommended Fix**:
- Apply lazy loading pattern to all dashboard sections
- Fetch GA data only when Analytics tab is active
- Fetch Ads data only when Google Ads tab is active
- Cache fetched data to prevent re-fetching on tab switches

---

## Testing Gaps

### 10. No Automated Tests
**Status**: Missing
**Priority**: Medium

**Issue**: No test coverage for:
- Client import scripts
- API endpoints
- Frontend components
- Database migrations

**Recommended Additions**:
1. Unit tests for import scripts
2. API endpoint integration tests
3. Component snapshot tests
4. E2E tests for critical user flows

---

## Documentation Gaps

### 11. API Documentation Incomplete
**Status**: Partial
**Priority**: Low

**Missing Documentation**:
- API endpoint request/response schemas
- Error code meanings
- Rate limiting policies
- Authentication flow diagrams

**Fix**: Create comprehensive API documentation (see FUNCTION_DIARY.md)

---

## How to Use This Document

1. **For Developers**: Review before starting work to avoid known pitfalls
2. **For Testing**: Use as checklist for regression testing
3. **For Planning**: Prioritize issues based on status and priority
4. **For Updates**: Add new issues as discovered, mark resolved items

## Issue Status Definitions

- **Pending**: Not yet started
- **In Progress**: Actively being worked on
- **Blocked**: Waiting on external dependency
- **Fixed**: Resolved, pending verification
- **Verified**: Tested and confirmed working
- **Won't Fix**: Intentionally not addressing

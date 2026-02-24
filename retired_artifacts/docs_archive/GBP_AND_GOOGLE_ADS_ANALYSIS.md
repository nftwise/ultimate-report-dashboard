# GBP and Google Ads Data Analysis Report

**Generated**: February 2, 2026
**Database**: Supabase (`client_metrics_summary` table)
**Analysis Period**: January 1, 2025 - February 9, 2025 (40 days)
**Total Records Analyzed**: 1,000
**Total Clients**: 25

---

## Executive Summary

This comprehensive analysis reveals critical insights about GBP (Google Business Profile) and Google Ads data availability across the client database:

### Key Findings:
- **GBP Data**: Available for 9/25 clients (36%) with 768 total calls across 40 days
- **Google Ads Data**: Available for 8/25 clients (32%) with 535 conversions and 78,957 impressions
- **Data Quality**: 19.4% of records contain GBP call data; 17.9% contain Ads conversion data
- **Coverage Gap**: 11 clients (44%) have ZERO data in both systems

---

## 1. GBP CALLS DATA ANALYSIS

### Record-Level Analysis

| Metric | Value |
|--------|-------|
| **Total Records in Database** | 1,000 |
| **Records with GBP Calls > 0** | 194 (19.4%) |
| **Records with GBP Calls = 0** | 806 (80.6%) |
| **Total GBP Calls (Aggregated)** | 768 |
| **Average per Non-Zero Record** | 3.96 calls |

### Data Availability

```
19.4% of all metric records contain GBP call data
This is a SIGNIFICANT gap - nearly 4 out of 5 daily records have zero calls
```

### Client-Level GBP Coverage

| Category | Count | Percentage |
|----------|-------|-----------|
| Clients with GBP data (>0 calls) | 9 | 36% |
| Clients with ZERO GBP calls | 16 | 64% |

### Clients with GBP Data (9 total)

1. **DeCarlo Chiropractic** - 164 GBP calls
2. **HOOD CHIROPRACTIC** - 137 GBP calls
3. **Dr DiGrado** - 137 GBP calls
4. **CHIROPRACTIC FIRST** - 113 GBP calls
5. **CorePosture** - 69 GBP calls
6. **AXIS CHIROPRACTIC** - 52 GBP calls
7. **NEWPORT CENTER FAMILY CHIROPRACTIC** - 39 GBP calls
8. **Restoration Dental** - 32 GBP calls
9. **CHIROSOLUTIONS CENTER** - 25 GBP calls

### Clients with ZERO GBP Calls (16 total)

1. WHOLE BODY WELLNESS
2. TINKER FAMILY CHIRO
3. TAILS ANIMAL CHIROPRACTIC CARE
4. CHIROPRACTIC CARE CENTRE
5. SOUTHPORT CHIROPRACTIC
6. THE CHIROPRACTIC SOURCE
7. CHIROPRACTIC HEALTH CLUB
8. Zen Care Physical Medicine
9. HAVEN CHIROPRACTIC
10. REGENERATE CHIROPRACTIC
11. HEALING HANDS OF MANAHAWKIN
12. FUNCTIONAL SPINE CHIROPRACTIC
13. SAIGON DISTRICT RESTAURANT
14. North Alabama Spine & Rehab
15. CINQUE CHIROPRACTIC
16. RAY CHIROPRACTIC

---

## 2. GOOGLE ADS DATA ANALYSIS

### Record-Level Analysis

| Metric | Value |
|--------|-------|
| **Ads Conversions > 0** | 179 records (17.9%) |
| **Ads Impressions > 0** | 295 records (29.5%) |
| **Ads Clicks > 0** | 292 records (29.2%) |
| **Total Ads Conversions** | 535 |
| **Total Ads Impressions** | 78,957 |
| **Total Ads Clicks** | 5,035 |

### Data Availability Breakdown

```
Google Ads Conversions:  17.9% of records have data
Google Ads Impressions:  29.5% of records have data
Google Ads Clicks:       29.2% of records have data
```

### Client-Level Ads Coverage

| Category | Count | Percentage |
|----------|-------|-----------|
| Clients with Ads data | 8 | 32% |
| Clients with ZERO Ads data | 17 | 68% |

### Clients with Google Ads Data (8 total)

1. **WHOLE BODY WELLNESS** - 266 conversions, highest performer
2. **SOUTHPORT CHIROPRACTIC** - 55 conversions
3. **CHIROPRACTIC CARE CENTRE** - 60 conversions
4. **Restoration Dental** - 45 conversions
5. **TAILS ANIMAL CHIROPRACTIC CARE** - 25 conversions
6. **TINKER FAMILY CHIRO** - 17 conversions
7. **Dr DiGrado** - 19 conversions
8. **CorePosture** - 48 conversions

### Clients with ZERO Ads Conversions (17 total)

All remaining 17 clients show no Google Ads conversion data

---

## 3. DATE RANGE COVERAGE

### GBP Data Coverage

```
Earliest Date: January 1, 2025
Latest Date:   February 9, 2025
Duration:      40 days
Consistency:   All 194 non-zero GBP records span this period
```

### Google Ads Data Coverage

```
Earliest Date: January 1, 2025
Latest Date:   February 9, 2025
Duration:      40 days
Consistency:   Data distributed throughout period
```

### Alignment Analysis

✅ **Both systems cover the same date range (Jan 1 - Feb 9, 2025)**
- Perfect temporal alignment
- No date gaps between systems
- Consistent 40-day analysis period

---

## 4. CROSS-SYSTEM DATA ANALYSIS

### Client Data Combinations

| Category | Count | Clients |
|----------|-------|---------|
| **Both GBP & Ads Data** | 3 | CorePosture, Dr DiGrado, Restoration Dental |
| **GBP Data Only** | 6 | DeCarlo, HOOD, CHIROPRACTIC FIRST, AXIS, NEWPORT CENTER, CHIROSOLUTIONS |
| **Ads Data Only** | 5 | WHOLE BODY WELLNESS, TINKER, CHIROPRACTIC CARE, SOUTHPORT, TAILS |
| **Neither (No Data)** | 11 | THE CHIROPRACTIC SOURCE, CHIROPRACTIC HEALTH CLUB, Zen Care, HAVEN, REGENERATE, HEALING HANDS, FUNCTIONAL SPINE, SAIGON, North Alabama, CINQUE, RAY |

### Distribution Chart

```
Clients Distribution:
┌─────────────────────────────────────────┐
│ Both Data       (3)  ████░░░░░░░░░░ 12% │
│ GBP Only        (6)  ███████░░░░░░░░ 24% │
│ Ads Only        (5)  ██████░░░░░░░░░ 20% │
│ No Data        (11)  ███████████░░░░ 44% │
└─────────────────────────────────────────┘
```

---

## 5. SUMMARY STATISTICS

### Total Aggregated Metrics

| Metric | Total | Avg per Client | Avg per Record |
|--------|-------|-----------------|-----------------|
| GBP Calls | 768 | 30.72 | 0.768 |
| Ads Conversions | 535 | 21.40 | 0.535 |
| Ads Impressions | 78,957 | 3,158.28 | 78.96 |
| Ads Clicks | 5,035 | 201.40 | 5.04 |

### Data Quality Percentages

| Metric | % Non-Zero | Records with Data | Total Records |
|--------|------------|-------------------|-----------------|
| GBP Calls | 19.4% | 194 | 1,000 |
| Ads Conversions | 17.9% | 179 | 1,000 |
| Ads Impressions | 29.5% | 295 | 1,000 |
| Ads Clicks | 29.2% | 292 | 1,000 |

### Client-Level Metrics

| Metric | Count | Average | Highest Client |
|--------|-------|---------|-----------------|
| Records per Client | 1,000 / 25 | 40 | All (evenly distributed) |
| Clients with GBP Data | 9 | 85.3 calls each | DeCarlo (164) |
| Clients with Ads Data | 8 | 66.9 conversions each | WHOLE BODY (266) |
| Clients with No Data | 11 | 0 | N/A |

---

## 6. DATA QUALITY ASSESSMENT

### Strengths ✅

1. **Consistent Date Coverage**
   - Both systems span the same 40-day period
   - No temporal gaps or misalignments

2. **Regular Data Points**
   - Each client has exactly 40 records (one per day)
   - Clean aggregation pattern

3. **Ads Data Diversity**
   - Impressions and clicks data more complete (29.5%) than conversions (17.9%)
   - Indicates tracking working for user engagement metrics

4. **Some GBP Activity**
   - 9 clients showing measurable phone call volume
   - 768 total calls across the system

### Weaknesses ⚠️

1. **Critical GBP Data Gap**
   - 64% of clients have zero GBP call data
   - Only 19.4% of daily records contain GBP data
   - Suggests incomplete GBP API integration or limited adoption

2. **Significant Data Voids**
   - 44% of clients (11 total) have zero data in both systems
   - Creates blind spot in performance monitoring

3. **Uneven Metric Distribution**
   - Some clients have GBP but no Ads data
   - Some clients have Ads but no GBP data
   - Indicates inconsistent service configuration

4. **Low Conversion Tracking**
   - Only 17.9% of records have Ads conversion data
   - Most clients showing zero conversions despite impression/click data
   - Potential conversion tracking issue

---

## 7. CRITICAL FINDINGS & ISSUES

### Issue #1: GBP Data Sparsity 🔴

**Status**: CRITICAL
**Severity**: HIGH

64% of clients have NO GBP call data whatsoever. This could indicate:
- GBP API integration not fully implemented
- Only subset of clients has GBP configured
- Data collection filtering out most records
- Phone tracking not properly configured

**Affected Clients**: 16 out of 25 (64%)

### Issue #2: Conversion Tracking Gap 🔴

**Status**: CRITICAL
**Severity**: HIGH

Only 17.9% of records have Ads conversion data, yet impressions/clicks are tracked (29.5%). This suggests:
- Conversion API not properly connected
- Most campaigns not set up for conversion tracking
- Data collection issue between Google Ads and Supabase

**Affected Records**: 821 out of 1,000 (82.1%)

### Issue #3: Complete Data Void 🔴

**Status**: CRITICAL
**Severity**: MEDIUM

11 clients (44%) have ZERO metrics data in both systems:
- THE CHIROPRACTIC SOURCE
- CHIROPRACTIC HEALTH CLUB
- Zen Care Physical Medicine
- HAVEN CHIROPRACTIC
- REGENERATE CHIROPRACTIC
- HEALING HANDS OF MANAHAWKIN
- FUNCTIONAL SPINE CHIROPRACTIC
- SAIGON DISTRICT RESTAURANT
- North Alabama Spine & Rehab
- CINQUE CHIROPRACTIC
- RAY CHIROPRACTIC

### Issue #4: Fragmented Service Configuration ⚠️

**Status**: WARNING
**Severity**: MEDIUM

Inconsistent data across GBP and Ads services:
- 6 clients have GBP-only data
- 5 clients have Ads-only data
- Only 3 clients have both

Suggests different integration status or selective service enablement.

---

## 8. RECOMMENDATIONS

### Phase 1: URGENT (Days 1-3)

#### 1.1 Audit GBP Integration
```
[ ] Check GBP API connection status
[ ] Verify all 9 clients with data have properly configured locations
[ ] Audit why 16 clients show zero GBP calls
[ ] Check if GBP service is enabled for those clients
[ ] Review GBP token refresh and authentication flow
```

**Action Items**:
- Review `/api/admin/debug-gbp` endpoint logs
- Check Google Business Profile API quota usage
- Verify OAuth tokens are current for GBP clients
- Look for API errors in the last 40 days

#### 1.2 Investigate Conversion Tracking Gap
```
[ ] Verify Google Ads conversion tracking setup
[ ] Check if conversion events are configured in Analytics
[ ] Review Supabase connection for conversion data ingestion
[ ] Audit clients with 0 conversions but high impressions
```

**Action Items**:
- Check Google Ads conversion tracking tags
- Verify conversion value reporting is enabled
- Audit the data pipeline from Google Ads → Supabase
- Check for API call failures in logs

#### 1.3 Data Void Investigation
```
[ ] Identify why 11 clients have zero data
[ ] Check if these clients are marked as inactive
[ ] Verify service configurations for these clients
[ ] Determine if they should have data
```

**Action Items**:
- Cross-reference with client status (active/inactive)
- Check service_configs table for these clients
- Verify they have Google Ads and/or GBP configured
- Review data collection logs

### Phase 2: IMPORTANT (Days 4-7)

#### 2.1 Align Service Configuration
```
[ ] Standardize GBP + Ads configuration across all active clients
[ ] Document which clients should have which services
[ ] Auto-enable missing integrations where appropriate
[ ] Create configuration audit checklist
```

#### 2.2 Enhance Data Pipeline
```
[ ] Add more frequent data refresh for GBP (currently seems limited)
[ ] Improve conversion tracking completeness
[ ] Add retry logic for failed API calls
[ ] Implement monitoring/alerting for data gaps
```

#### 2.3 Create Monitoring Dashboard
```
[ ] Track daily record counts by client
[ ] Monitor data freshness (latest update timestamp)
[ ] Alert on clients dropping below expected record counts
[ ] Dashboard showing % data completeness
```

### Phase 3: MEDIUM (Days 8-30)

#### 3.1 Historical Data Backfill
```
[ ] Assess feasibility of backfilling missing GBP data
[ ] Collect any available historical Google Ads conversion data
[ ] Re-sync clients that had issues
```

#### 3.2 Client Communication
```
[ ] Notify clients with 0 data about configuration status
[ ] Set expectations for data availability
[ ] Collect any manual data if APIs unavailable
```

#### 3.3 Long-term Improvements
```
[ ] Consider alternative GBP data sources
[ ] Implement redundancy for critical metrics
[ ] Build auto-discovery for new locations/campaigns
```

---

## 9. DETAILED CLIENT BREAKDOWN

### High-Value Clients with Complete Data (3)

#### CorePosture
- **GBP Calls**: 69
- **Ads Conversions**: 48
- **Ads Impressions**: 2,847
- **Ads Clicks**: 245
- **Status**: Complete data across both systems

#### Dr DiGrado
- **GBP Calls**: 137
- **Ads Conversions**: 19
- **Ads Impressions**: 2,106
- **Ads Clicks**: 139
- **Status**: Complete data across both systems

#### Restoration Dental
- **GBP Calls**: 32
- **Ads Conversions**: 45
- **Ads Impressions**: 2,816
- **Ads Clicks**: 158
- **Status**: Complete data across both systems

### GBP-Only Clients (6)

These clients are generating GBP data but have zero Ads conversion data:

1. **DeCarlo Chiropractic** - 164 GBP calls (highest GBP performer)
2. **HOOD CHIROPRACTIC** - 137 GBP calls
3. **CHIROPRACTIC FIRST** - 113 GBP calls
4. **AXIS CHIROPRACTIC** - 52 GBP calls
5. **NEWPORT CENTER FAMILY CHIROPRACTIC** - 39 GBP calls (inactive client)
6. **CHIROSOLUTIONS CENTER** - 25 GBP calls

**Insight**: These clients may not have Google Ads enabled or configured properly.

### Ads-Only Clients (5)

These clients have Ads conversion data but zero GBP calls:

1. **WHOLE BODY WELLNESS** - 266 Ads conversions (highest Ads performer)
2. **CHIROPRACTIC CARE CENTRE** - 60 Ads conversions
3. **SOUTHPORT CHIROPRACTIC** - 55 Ads conversions
4. **TAILS ANIMAL CHIROPRACTIC CARE** - 25 Ads conversions
5. **TINKER FAMILY CHIRO** - 17 Ads conversions

**Insight**: These clients may not have GBP configured or are not receiving calls through that channel.

### No-Data Clients (11) - URGENT REVIEW NEEDED

These clients have zero metrics in both GBP and Ads systems:

1. THE CHIROPRACTIC SOURCE
2. CHIROPRACTIC HEALTH CLUB
3. Zen Care Physical Medicine
4. HAVEN CHIROPRACTIC
5. REGENERATE CHIROPRACTIC
6. HEALING HANDS OF MANAHAWKIN
7. FUNCTIONAL SPINE CHIROPRACTIC
8. SAIGON DISTRICT RESTAURANT
9. North Alabama Spine & Rehab
10. CINQUE CHIROPRACTIC
11. RAY CHIROPRACTIC

**Status**: Requires immediate investigation - determine if data should exist.

---

## 10. IMPLEMENTATION CHECKLIST

### Immediate Actions (Next 24 Hours)

- [ ] Review GBP API integration status and logs
- [ ] Check Google Ads conversion tracking configuration
- [ ] Verify database connectivity for both data sources
- [ ] Audit the 11 clients with no data
- [ ] Check service_configs table for misconfigurations

### This Week

- [ ] Fix GBP data collection for affected clients
- [ ] Re-enable conversion tracking for Ads
- [ ] Update client service configurations
- [ ] Run diagnostics on data pipeline
- [ ] Create automated alerts for future gaps

### Next Sprint

- [ ] Implement redundant data collection methods
- [ ] Build admin dashboard showing data completeness
- [ ] Establish data quality thresholds and SLAs
- [ ] Document data collection architecture
- [ ] Create runbook for common data issues

---

## 11. SUCCESS METRICS

Once issues are resolved, these metrics should improve:

| Metric | Current | Target | Timeline |
|--------|---------|--------|----------|
| Clients with GBP data | 9/25 (36%) | 20/25 (80%) | Week 1-2 |
| GBP records with data | 19.4% | 80%+ | Week 1-2 |
| Ads conversion tracking | 17.9% | 70%+ | Week 1-2 |
| Clients with some data | 14/25 (56%) | 25/25 (100%) | Week 2-3 |
| Zero-data clients | 11 (44%) | 0 (0%) | Week 2-3 |

---

## 12. APPENDIX: QUERY METHODOLOGY

This analysis was generated by querying the `client_metrics_summary` table with:

```typescript
const { data: allMetrics } = await supabase
  .from('client_metrics_summary')
  .select('*')
  .order('date', { ascending: true })
```

**Metrics Analyzed**:
- `gbp_calls` - Total phone calls from Google Business Profile
- `google_ads_conversions` - Conversion count from Google Ads
- `ads_impressions` - Ad impressions served
- `ads_clicks` - Ad click count

**Aggregation Method**:
- Records grouped by client_id
- Summed across all dates in range
- Calculated percentages based on non-zero values

**Data Integrity Checks**:
- All clients have exactly 40 records (Jan 1 - Feb 9)
- No duplicate records found
- Date range consistent across all systems
- No null values in analyzed fields

---

## Conclusion

The analysis reveals a **data collection infrastructure that needs immediate attention**. While the system is capturing some Google Ads data, GBP integration appears incomplete with 64% of clients having zero call data. Additionally, 11 clients (44%) have no metrics data whatsoever.

**Priority**: Fix GBP integration and audit the 11 no-data clients within the next 24-48 hours to prevent further data loss and ensure accurate client performance reporting.

---

**Report Generated**: February 2, 2026
**Analysis Tool**: query-gbp-ads.js
**Database**: Supabase (`tupedninjtaarmdwppgy`)
**Next Review**: After implementing Phase 1 recommendations

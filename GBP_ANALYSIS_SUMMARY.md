# GBP & Google Ads Data - Quick Reference Summary

**Analysis Date**: February 2, 2026 | **Data Period**: Jan 1 - Feb 9, 2025 (40 days)

---

## 📊 QUICK FACTS

```
Total Records:        1,000
Total Clients:        25
Records with GBP:     194 (19.4%)
Records with Ads:     179 (17.9%)
Date Range:           40 days (consistent)
```

---

## 🎯 HEADLINE FINDINGS

### GBP Data Status 📞
- **9 clients** have GBP call data
- **16 clients** have ZERO GBP data
- **768 total calls** across 40 days
- **Only 19.4% of daily records** contain GBP data
- **Top performer**: DeCarlo Chiropractic (164 calls)

### Google Ads Status 🎯
- **8 clients** have Ads conversion data
- **17 clients** have ZERO Ads conversions
- **535 total conversions** across 40 days
- **78,957 impressions** captured
- **Top performer**: WHOLE BODY WELLNESS (266 conversions)

### Data Coverage 📈
- **3 clients** have BOTH GBP & Ads data ✅
- **6 clients** have GBP only
- **5 clients** have Ads only
- **11 clients** have NEITHER ❌ (CRITICAL)

---

## 🚨 CRITICAL ISSUES

| Issue | Severity | Impact | Action |
|-------|----------|--------|--------|
| **64% of clients have zero GBP data** | CRITICAL | Can't track phone leads for most clients | Audit GBP integration |
| **82% of records have zero Ads conversions** | CRITICAL | Ads conversion tracking broken | Fix conversion tracking |
| **44% of clients have no data** | CRITICAL | 11 clients completely invisible | Emergency audit |
| **Fragmented service config** | HIGH | Some clients missing integrations | Standardize setup |

---

## 📋 CLIENT STATUS MATRIX

### ✅ COMPLETE DATA (3 Clients)
```
CorePosture             ✓ GBP (69)  ✓ Ads (48)
Dr DiGrado             ✓ GBP (137) ✓ Ads (19)
Restoration Dental     ✓ GBP (32)  ✓ Ads (45)
```

### 📞 GBP ONLY (6 Clients)
```
DeCarlo Chiropractic              ✓ GBP (164) ✗ Ads (0)
HOOD CHIROPRACTIC                 ✓ GBP (137) ✗ Ads (0)
CHIROPRACTIC FIRST                ✓ GBP (113) ✗ Ads (0)
AXIS CHIROPRACTIC                 ✓ GBP (52)  ✗ Ads (0)
NEWPORT CENTER FAMILY CHIRO       ✓ GBP (39)  ✗ Ads (0)
CHIROSOLUTIONS CENTER             ✓ GBP (25)  ✗ Ads (0)
```

### 🎯 ADS ONLY (5 Clients)
```
WHOLE BODY WELLNESS               ✗ GBP (0)  ✓ Ads (266)
CHIROPRACTIC CARE CENTRE          ✗ GBP (0)  ✓ Ads (60)
SOUTHPORT CHIROPRACTIC            ✗ GBP (0)  ✓ Ads (55)
TAILS ANIMAL CHIROPRACTIC CARE    ✗ GBP (0)  ✓ Ads (25)
TINKER FAMILY CHIRO               ✗ GBP (0)  ✓ Ads (17)
```

### ❌ NO DATA (11 Clients) - NEEDS IMMEDIATE ATTENTION
```
THE CHIROPRACTIC SOURCE           ✗ GBP (0)  ✗ Ads (0)
CHIROPRACTIC HEALTH CLUB          ✗ GBP (0)  ✗ Ads (0)
Zen Care Physical Medicine        ✗ GBP (0)  ✗ Ads (0)
HAVEN CHIROPRACTIC                ✗ GBP (0)  ✗ Ads (0)
REGENERATE CHIROPRACTIC           ✗ GBP (0)  ✗ Ads (0)
HEALING HANDS OF MANAHAWKIN       ✗ GBP (0)  ✗ Ads (0)
FUNCTIONAL SPINE CHIROPRACTIC     ✗ GBP (0)  ✗ Ads (0)
SAIGON DISTRICT RESTAURANT        ✗ GBP (0)  ✗ Ads (0)
North Alabama Spine & Rehab       ✗ GBP (0)  ✗ Ads (0)
CINQUE CHIROPRACTIC               ✗ GBP (0)  ✗ Ads (0)
RAY CHIROPRACTIC                  ✗ GBP (0)  ✗ Ads (0)
```

---

## 📈 PERFORMANCE TIERS

### Top GBP Performers
1. DeCarlo Chiropractic: **164 calls** (164 per 40 days = 4.1/day)
2. HOOD CHIROPRACTIC: **137 calls** (3.4/day)
3. Dr DiGrado: **137 calls** (3.4/day)
4. CHIROPRACTIC FIRST: **113 calls** (2.8/day)
5. CorePosture: **69 calls** (1.7/day)

### Top Ads Performers
1. WHOLE BODY WELLNESS: **266 conversions** (6.6/day)
2. SOUTHPORT CHIROPRACTIC: **55 conversions** (1.4/day)
3. CHIROPRACTIC CARE CENTRE: **60 conversions** (1.5/day)
4. Restoration Dental: **45 conversions** (1.1/day)
5. CorePosture: **48 conversions** (1.2/day)

### Ads Impression Leaders
1. WHOLE BODY WELLNESS: **23,408 impressions**
2. CHIROPRACTIC CARE CENTRE: **4,921 impressions**
3. SOUTHPORT CHIROPRACTIC: **4,527 impressions**
4. Restoration Dental: **2,816 impressions**
5. CorePosture: **2,847 impressions**

---

## 💾 DATA EXPORT

| Format | File | Purpose |
|--------|------|---------|
| Markdown | `GBP_AND_GOOGLE_ADS_ANALYSIS.md` | Full detailed report with recommendations |
| CSV | `client-data-export.csv` | Client metrics - import to Excel/Sheets |
| Node.js Script | `query-gbp-ads.js` | Reproducible analysis script |

---

## 🔧 REMEDIATION ROADMAP

### 24 Hours (URGENT)
- [ ] Verify GBP API integration is running
- [ ] Check why 16 clients have zero GBP data
- [ ] Audit the 11 clients with no data at all
- [ ] Review conversion tracking configuration

### 1 Week
- [ ] Fix GBP data collection for affected clients
- [ ] Re-enable Ads conversion tracking
- [ ] Update service configurations for all clients
- [ ] Run full data sync

### 2 Weeks
- [ ] Implement monitoring/alerting for data gaps
- [ ] Create admin dashboard showing data completeness
- [ ] Document data collection architecture
- [ ] Establish data quality baselines

---

## 📌 KEY METRICS TO MONITOR

After fixes are implemented, track these:

| Metric | Current | Target | Check |
|--------|---------|--------|-------|
| % Clients with GBP data | 36% | 80% | [ ] |
| % Clients with Ads data | 32% | 80% | [ ] |
| % Records with GBP values | 19.4% | 80% | [ ] |
| % Records with Ads conv | 17.9% | 70% | [ ] |
| Clients with zero data | 11 | 0 | [ ] |
| Data freshness (hours) | ? | <24h | [ ] |

---

## 🎯 NEXT IMMEDIATE ACTION

1. **READ**: `GBP_AND_GOOGLE_ADS_ANALYSIS.md` (full report)
2. **EXECUTE**: Phase 1 recommendations in report (24 hours)
3. **MONITOR**: Use success metrics above
4. **REPORT**: Status in 48 hours

---

## 📚 REFERENCE

**Query Method**: Direct Supabase API query of `client_metrics_summary` table
**Fields Analyzed**:
- gbp_calls
- google_ads_conversions
- ads_impressions
- ads_clicks

**Period**: January 1 - February 9, 2025 (40 days)
**Records**: 1,000 total (25 clients × 40 days)
**Generated**: February 2, 2026

---

## Questions?

If you need additional analysis:
1. Run `node query-gbp-ads.js` to regenerate report
2. Check individual client configuration in Supabase
3. Review API logs in Google Cloud / Supabase dashboards
4. Verify OAuth tokens are current and valid

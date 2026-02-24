# GBP Calls Breakdown

**Status**: ✅ Fixed - GBP data now loading correctly
**Total GBP Calls**: 1,566
**Clients with GBP Data**: 9 out of 25

---

## 🏆 GBP Calls by Client (Ranked)

| Rank | Client | GBP Calls | Total Leads | Other (Ads+SEO) | GBP % |
|------|--------|-----------|-------------|---|---|
| 1 | DeCarlo Chiropractic | **364** | 34 | 34 | 91% |
| 2 | Dr DiGrado | **267** | 45 | 45 | 75% |
| 3 | HOOD CHIROPRACTIC | **267** | 5 | 5 | 98% |
| 4 | CHIROPRACTIC FIRST | **242** | 0 | 0 | 100% |
| 5 | CorePosture | **121** | 72 | 72 | 63% |
| 6 | AXIS CHIROPRACTIC | **109** | 0 | 0 | 100% |
| 7 | NEWPORT CENTER FAMILY CHIROPRACTIC | **92** | 17 | 17 | 84% |
| 8 | Restoration Dental | **53** | 47 | 47 | 53% |
| 9 | CHIROSOLUTIONS CENTER | **51** | 0 | 0 | 100% |

---

## 📊 Performance Analysis

### High GBP Performers
- **DeCarlo Chiropractic**: 364 GBP calls (highest)
- **Dr DiGrado**: 267 GBP calls
- **HOOD CHIROPRACTIC**: 267 GBP calls

### GBP-Focused Clients (100% GBP)
- CHIROPRACTIC FIRST: 242 GBP calls (0 other leads)
- AXIS CHIROPRACTIC: 109 GBP calls (0 other leads)
- CHIROSOLUTIONS CENTER: 51 GBP calls (0 other leads)

### Mixed Channel Clients
- **DeCarlo Chiropractic**: 364 GBP + 34 other leads = 398 total
- **Dr DiGrado**: 267 GBP + 45 other leads = 312 total
- **CorePosture**: 121 GBP + 72 other leads = 193 total

---

## 🔧 Technical Details

### What Changed
- **File**: `src/app/api/clients/all-clients/route.ts`
- **Problem**: GBP data was backfilled but existed outside the 30-day filter
- **Solution**: Added separate query to fetch GBP metrics from all available data (no date restriction)

### Data Characteristics
- **GBP Metric**: Phone calls from Google Business Profile
- **Data Range**: All available data (includes historical backfill)
- **Standard Metrics Range**: Last 30 days
- **9 clients** have GBP call data
- **16 clients** have no GBP calls (0 or no data)

---

## 💡 Insights

### GBP Call Volume
- Average: 174 calls per client (1,566 ÷ 9)
- Median: ~121 calls
- Range: 51-364 calls

### Channel Contribution
- Clients with ONLY GBP data: 3 (CHIROPRACTIC FIRST, AXIS, CHIROSOLUTIONS)
- Clients with mixed channels: 6 (DeCarlo, DiGrado, Hood, CorePosture, Newport Center, Restoration Dental)
- Clients with NO GBP data: 16

### Strategic Implications
- Some practices rely heavily on GBP (local services)
- Others use GBP as supplementary channel
- GBP represents significant lead source for local service businesses

---

## 🔗 Related Documentation

- [Leads Performance Report](LEADS_PERFORMANCE_REPORT.md)
- [Database Statistics](DATABASE_STATISTICS_FULL.md)
- [Clients Metrics Table](CLIENTS_METRICS_TABLE.md)


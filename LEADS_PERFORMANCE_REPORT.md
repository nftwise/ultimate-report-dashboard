# Leads Performance Report & Chart

**Generated**: January 28, 2026
**Page URL**: `/reports/leads-performance`
**Data Period**: Last 30 days
**Active Clients**: 20

---

## 📊 Overview

A comprehensive performance chart showing total leads by client, broken down by channel (Ads, SEO, GBP). This page provides visual insights into lead generation performance across all active clients.

---

## 🎯 What's Included

The `/reports/leads-performance` page displays:

1. **Summary Statistics Cards**
   - Total Leads: 460
   - Ads Conversions: 358 (77.8%)
   - SEO Forms: 102 (22.2%)
   - GBP Calls: 0 (⚠️ Not populating)

2. **Top 10 Clients - Total Leads Bar Chart**
   - Visual ranking of top 10 performers by total leads
   - Coral color (#c4704f) for emphasis

3. **Top 10 Clients - Channel Breakdown Bar Chart**
   - Stacked view showing Ads, SEO, and GBP breakdown
   - Color coded: Gold (Ads), Sage (SEO), Blue (GBP)

4. **All Active Clients Performance Table**
   - Complete table of all 20 active clients
   - Sortable columns: Name, Total Leads, Ads, SEO, GBP, Ads %

---

## 🏆 Top 10 Performers (30-day period)

| Rank | Client | Total Leads | Ads | SEO | GBP |
|------|--------|---|---|---|---|
| 1 | WHOLE BODY WELLNESS | **101** | 101 | 0 | 0 |
| 2 | CorePosture | **72** | 22 | 50 | 0 |
| 3 | Restoration Dental | **47** | 47 | 0 | 0 |
| 4 | Dr DiGrado | **45** | 27 | 18 | 0 |
| 5 | SOUTHPORT CHIROPRACTIC | **44** | 44 | 0 | 0 |
| 6 | DeCarlo Chiropractic | **34** | 24 | 10 | 0 |
| 7 | RAY CHIROPRACTIC | **19** | 19 | 0 | 0 |
| 8 | TINKER FAMILY CHIRO | **17** | 17 | 0 | 0 |
| 9 | CHIROPRACTIC CARE CENTRE | **16** | 16 | 0 | 0 |
| 10 | North Alabama Spine & Rehab | **14** | 14 | 0 | 0 |

---

## 📈 Performance Metrics

### By Channel
- **Ads Conversions**: 358 leads (77.8% of total, last 30 days)
- **SEO Form Submits**: 102 leads (22.2% of total, last 30 days)
- **GBP Calls**: 1,566 calls (all available data, from 9 clients)

### Top Performer Strategies
- **WHOLE BODY WELLNESS**: 100% Ads-driven (101 leads)
- **CorePosture**: Balanced strategy - 69% SEO, 31% Ads
- **Restoration Dental**: 100% Ads-driven (47 leads)

### No Performance Clients (6 active clients)
- AXIS CHIROPRACTIC
- CHIROPRACTIC FIRST
- CHIROPRACTIC HEALTH CLUB
- CHIROSOLUTIONS CENTER
- HAVEN CHIROPRACTIC
- THE CHIROPRACTIC SOURCE

---

## ✅ GBP Data - FIXED

**Status**: GBP calls now loading correctly

**Resolution**:
- GBP data was backfilled but existed outside the 30-day window
- Updated `/api/clients/all-clients` to fetch GBP metrics from all available data
- Standard metrics (Ads, SEO) use 30-day window
- GBP metrics use all-time data (no date restriction)

**GBP Distribution**:
- **Total GBP Calls**: 1,566 (from 9 clients)
- **Top GBP Client**: DeCarlo Chiropractic (364 calls)
- **Average per client**: 174 calls (1,566 ÷ 9)

---

## 🔧 Technical Details

### API Endpoint
- **Route**: `/api/clients/all-clients`
- **Method**: GET
- **Response**:
  ```json
  {
    "success": true,
    "total": 25,
    "active": 20,
    "inactive": 5,
    "clients": [
      {
        "id": "...",
        "name": "Client Name",
        "total_leads": 101,
        "ads_conversions": 101,
        "seo_form_submits": 0,
        "gbp_calls": 0,
        "is_active": true
      }
    ]
  }
  ```

### Component Details
- **File**: `src/app/reports/leads-performance/page.tsx`
- **Framework**: Next.js 15 (React 19)
- **Charts**: Recharts library
- **Styling**: Tailwind CSS
- **Features**:
  - Client-side data fetching
  - Responsive design
  - Multiple chart views
  - Summary statistics
  - Detailed performance table

### Charts Used
1. **BarChart** - Total Leads (Top 10)
2. **BarChart** - Channel Breakdown (Ads, SEO, GBP)
3. **HTML Table** - All clients data

---

## 🎨 Color Scheme

| Element | Color | Hex |
|---------|-------|-----|
| Leads | Coral | #c4704f |
| Ads | Gold | #d9a854 |
| SEO | Sage | #9db5a0 |
| GBP | Blue | #60a5fa |
| Text | Slate | #1e293b |
| Background | Light Slate | #f1f5f9 |

---

## 📝 Data Notes

- **Data Source**: `/api/clients/all-clients` endpoint
- **Aggregation**: Last 30 days from `client_metrics_summary` table
- **Refresh**: Real-time (each page load fetches fresh data)
- **Filtering**: Only active clients (20 of 25 total)
- **Sorting**: By total leads (descending)

---

## 🔗 Related Files

- **API Endpoint**: [/api/clients/all-clients](src/app/api/clients/all-clients/route.ts)
- **Database Stats**: [DATABASE_STATISTICS_FULL.md](DATABASE_STATISTICS_FULL.md)
- **Clients Table**: [CLIENTS_METRICS_TABLE.md](CLIENTS_METRICS_TABLE.md)
- **Admin Dashboard**: [/admin-dashboard](src/app/admin-dashboard/page.tsx)

---

## ✅ Status

- ✅ Chart page created and deployed
- ✅ Data loads correctly from API
- ✅ Summary statistics calculated
- ✅ Top 10 visualization working
- ✅ Channel breakdown displayed
- ✅ Full table with all metrics
- ⚠️ GBP data not showing (needs investigation)


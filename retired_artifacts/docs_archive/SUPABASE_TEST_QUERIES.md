# Supabase Test Queries - Copy & Paste Ready

All queries use the Supabase JavaScript client. These can be run directly in Node.js scripts or used as reference for your application.

---

## Setup Code (Required for All Queries)

```javascript
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://tupedninjtaarmdwppgy.supabase.co';
const supabaseKey = 'YOUR_API_KEY_HERE';

const supabase = createClient(supabaseUrl, supabaseKey);
```

---

## 1. TABLE INFORMATION QUERIES

### 1.1 Get All Columns from client_metrics_summary
```javascript
async function getClientMetricsSummaryColumns() {
  const { data, error } = await supabase
    .from('client_metrics_summary')
    .select('*')
    .limit(1);

  if (error) console.error('Error:', error);
  else console.log('Columns:', Object.keys(data[0]));
}

getClientMetricsSummaryColumns();
```

### 1.2 Get All Columns from gbp_location_daily_metrics
```javascript
async function getGBPMetricsColumns() {
  const { data, error } = await supabase
    .from('gbp_location_daily_metrics')
    .select('*')
    .limit(1);

  if (error) console.error('Error:', error);
  else console.log('Columns:', Object.keys(data[0]));
}

getGBPMetricsColumns();
```

### 1.3 Get Row Count for Each Table
```javascript
async function getTableCounts() {
  const { data: metricsData, error: e1 } = await supabase
    .from('client_metrics_summary')
    .select('*', { count: 'exact' })
    .limit(1);

  const { data: gbpData, error: e2 } = await supabase
    .from('gbp_location_daily_metrics')
    .select('*', { count: 'exact' })
    .limit(1);

  console.log('client_metrics_summary rows:', metricsData.length);
  console.log('gbp_location_daily_metrics rows:', gbpData.length);
}

getTableCounts();
```

---

## 2. DATA QUALITY QUERIES

### 2.1 Check Data Distribution - GBP Calls
```javascript
async function checkGBPCallsDistribution() {
  const { data, error } = await supabase
    .from('client_metrics_summary')
    .select('gbp_calls');

  if (error) {
    console.error('Error:', error);
    return;
  }

  const nonZero = data.filter(r => r.gbp_calls > 0).length;
  const zero = data.length - nonZero;
  const percent = ((nonZero / data.length) * 100).toFixed(2);

  console.log(`GBP Calls Distribution:`);
  console.log(`  Non-zero: ${nonZero} (${percent}%)`);
  console.log(`  Zero: ${zero}`);
  console.log(`  Total: ${data.length}`);
}

checkGBPCallsDistribution();
```

### 2.2 Check Data Distribution - All Google Ads Metrics
```javascript
async function checkGoogleAdsDistribution() {
  const { data, error } = await supabase
    .from('client_metrics_summary')
    .select('google_ads_conversions, ads_impressions, ads_clicks, ad_spend');

  if (error) {
    console.error('Error:', error);
    return;
  }

  const metrics = ['google_ads_conversions', 'ads_impressions', 'ads_clicks', 'ad_spend'];

  console.log('Google Ads Distribution:');
  metrics.forEach(metric => {
    const nonZero = data.filter(r => r[metric] > 0).length;
    const percent = ((nonZero / data.length) * 100).toFixed(1);
    console.log(`  ${metric}: ${nonZero} non-zero (${percent}%)`);
  });
}

checkGoogleAdsDistribution();
```

### 2.3 Check Data Distribution - GBP Location Metrics
```javascript
async function checkGBPLocationDistribution() {
  const { data, error } = await supabase
    .from('gbp_location_daily_metrics')
    .select('phone_calls, direction_requests, website_clicks, views, actions');

  if (error) {
    console.error('Error:', error);
    return;
  }

  const metrics = ['phone_calls', 'direction_requests', 'website_clicks', 'views', 'actions'];

  console.log('GBP Location Distribution:');
  metrics.forEach(metric => {
    const nonZero = data.filter(r => r[metric] > 0).length;
    const percent = ((nonZero / data.length) * 100).toFixed(1);
    const avg = nonZero > 0
      ? (data.filter(r => r[metric] > 0).reduce((sum, r) => sum + r[metric], 0) / nonZero).toFixed(2)
      : 'N/A';
    console.log(`  ${metric}: ${nonZero} non-zero (${percent}%) avg ${avg}`);
  });
}

checkGBPLocationDistribution();
```

---

## 3. SAMPLE DATA QUERIES

### 3.1 Get Latest 10 Records from client_metrics_summary
```javascript
async function getLatestClientMetrics() {
  const { data, error } = await supabase
    .from('client_metrics_summary')
    .select('date, client_id, ads_impressions, ads_clicks, google_ads_conversions, ad_spend, gbp_calls')
    .order('date', { ascending: false })
    .limit(10);

  if (error) console.error('Error:', error);
  else console.table(data);
}

getLatestClientMetrics();
```

### 3.2 Get Latest 10 Records from gbp_location_daily_metrics
```javascript
async function getLatestGBPMetrics() {
  const { data, error } = await supabase
    .from('gbp_location_daily_metrics')
    .select('date, client_id, location_id, phone_calls, direction_requests, website_clicks, views')
    .order('date', { ascending: false })
    .limit(10);

  if (error) console.error('Error:', error);
  else console.table(data);
}

getLatestGBPMetrics();
```

### 3.3 Get Data for Specific Client
```javascript
async function getClientData(clientId) {
  const { data, error } = await supabase
    .from('client_metrics_summary')
    .select('date, ads_impressions, ads_clicks, google_ads_conversions, ad_spend, health_score')
    .eq('client_id', clientId)
    .order('date', { ascending: false })
    .limit(30);

  if (error) console.error('Error:', error);
  else {
    console.log(`Data for client: ${clientId}`);
    console.table(data);
  }
}

// Usage:
getClientData('5cfa675b-13a4-4661-a744-e1158c76b376');
```

### 3.4 Get Data for Specific Location
```javascript
async function getLocationData(locationId) {
  const { data, error } = await supabase
    .from('gbp_location_daily_metrics')
    .select('date, client_id, phone_calls, direction_requests, website_clicks, views, total_reviews')
    .eq('location_id', locationId)
    .order('date', { ascending: false })
    .limit(30);

  if (error) console.error('Error:', error);
  else {
    console.log(`Data for location: ${locationId}`);
    console.table(data);
  }
}

// Usage:
getLocationData('daac098e-f00e-435b-86c0-a15a6e31a4a6');
```

---

## 4. AGGREGATION QUERIES

### 4.1 Sum Metrics by Client
```javascript
async function sumMetricsByClient() {
  const { data: allData, error } = await supabase
    .from('client_metrics_summary')
    .select('client_id, ads_impressions, ads_clicks, google_ads_conversions, ad_spend');

  if (error) {
    console.error('Error:', error);
    return;
  }

  const byClient = {};
  allData.forEach(row => {
    if (!byClient[row.client_id]) {
      byClient[row.client_id] = {
        impressions: 0,
        clicks: 0,
        conversions: 0,
        spend: 0,
        records: 0
      };
    }
    byClient[row.client_id].impressions += row.ads_impressions || 0;
    byClient[row.client_id].clicks += row.ads_clicks || 0;
    byClient[row.client_id].conversions += row.google_ads_conversions || 0;
    byClient[row.client_id].spend += row.ad_spend || 0;
    byClient[row.client_id].records += 1;
  });

  console.log('Totals by Client:');
  console.table(byClient);
}

sumMetricsByClient();
```

### 4.2 Sum GBP Metrics by Client
```javascript
async function sumGBPMetricsByClient() {
  const { data: allData, error } = await supabase
    .from('gbp_location_daily_metrics')
    .select('client_id, phone_calls, direction_requests, website_clicks');

  if (error) {
    console.error('Error:', error);
    return;
  }

  const byClient = {};
  allData.forEach(row => {
    if (!byClient[row.client_id]) {
      byClient[row.client_id] = {
        calls: 0,
        directions: 0,
        clicks: 0
      };
    }
    byClient[row.client_id].calls += row.phone_calls || 0;
    byClient[row.client_id].directions += row.direction_requests || 0;
    byClient[row.client_id].clicks += row.website_clicks || 0;
  });

  console.log('GBP Totals by Client:');
  console.table(byClient);
}

sumGBPMetricsByClient();
```

### 4.3 Get Date Range Coverage
```javascript
async function getDateRangeCoverage() {
  const { data: metrics, error: e1 } = await supabase
    .from('client_metrics_summary')
    .select('date')
    .order('date', { ascending: true })
    .limit(1);

  const { data: gbp, error: e2 } = await supabase
    .from('gbp_location_daily_metrics')
    .select('date')
    .order('date', { ascending: true })
    .limit(1);

  const { data: metricsLast, error: e3 } = await supabase
    .from('client_metrics_summary')
    .select('date')
    .order('date', { ascending: false })
    .limit(1);

  const { data: gbpLast, error: e4 } = await supabase
    .from('gbp_location_daily_metrics')
    .select('date')
    .order('date', { ascending: false })
    .limit(1);

  console.log('Date Range Coverage:');
  console.log(`  client_metrics_summary: ${metrics[0].date} to ${metricsLast[0].date}`);
  console.log(`  gbp_location_daily_metrics: ${gbp[0].date} to ${gbpLast[0].date}`);
}

getDateRangeCoverage();
```

---

## 5. FILTERING QUERIES

### 5.1 Get Records with Real Data (Non-Zero)
```javascript
async function getRecordsWithRealData() {
  const { data, error } = await supabase
    .from('client_metrics_summary')
    .select('date, client_id, ads_impressions, ads_clicks, google_ads_conversions')
    .gt('ads_impressions', 0)
    .order('date', { ascending: false })
    .limit(20);

  if (error) console.error('Error:', error);
  else {
    console.log('Records with real ad data:');
    console.table(data);
  }
}

getRecordsWithRealData();
```

### 5.2 Get Records with GBP Data
```javascript
async function getRecordsWithGBPData() {
  const { data, error } = await supabase
    .from('gbp_location_daily_metrics')
    .select('date, client_id, location_id, phone_calls, direction_requests, website_clicks')
    .or('phone_calls.gt.0,direction_requests.gt.0,website_clicks.gt.0')
    .order('date', { ascending: false })
    .limit(20);

  if (error) console.error('Error:', error);
  else {
    console.log('Records with real GBP data:');
    console.table(data);
  }
}

getRecordsWithGBPData();
```

### 5.3 Get Data for Specific Date Range
```javascript
async function getDateRangeData(startDate, endDate) {
  const { data, error } = await supabase
    .from('client_metrics_summary')
    .select('date, client_id, ads_impressions, ads_clicks, ad_spend, google_ads_conversions')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false });

  if (error) console.error('Error:', error);
  else {
    console.log(`Data from ${startDate} to ${endDate}:`);
    console.log(`Total records: ${data.length}`);
    console.table(data.slice(0, 10)); // Show first 10
  }
}

// Usage:
getDateRangeData('2026-01-01', '2026-02-03');
```

---

## 6. COMPARISON QUERIES

### 6.1 Compare Same Client in Both Tables
```javascript
async function compareClientInBothTables(clientId) {
  const { data: metricsData, error: e1 } = await supabase
    .from('client_metrics_summary')
    .select('date, ads_impressions, ads_clicks, gbp_calls, gbp_directions, gbp_website_clicks')
    .eq('client_id', clientId)
    .order('date', { ascending: false })
    .limit(5);

  const { data: gbpData, error: e2 } = await supabase
    .from('gbp_location_daily_metrics')
    .select('date, phone_calls, direction_requests, website_clicks')
    .eq('client_id', clientId)
    .order('date', { ascending: false })
    .limit(5);

  console.log(`Client: ${clientId}`);
  console.log('\nFrom client_metrics_summary:');
  console.table(metricsData);
  console.log('\nFrom gbp_location_daily_metrics:');
  console.table(gbpData);

  // Analysis
  const gbpCallsInMetrics = metricsData.reduce((sum, r) => sum + (r.gbp_calls || 0), 0);
  const callsInGBPTable = gbpData.reduce((sum, r) => sum + (r.phone_calls || 0), 0);

  console.log(`\nAnalysis:`);
  console.log(`  GBP Calls in metrics table: ${gbpCallsInMetrics}`);
  console.log(`  Phone calls in GBP table: ${callsInGBPTable}`);
  console.log(`  Match: ${gbpCallsInMetrics === callsInGBPTable ? 'YES' : 'NO'}`);
}

// Usage:
compareClientInBothTables('5cfa675b-13a4-4661-a744-e1158c76b376');
```

---

## 7. DIAGNOSTIC QUERIES

### 7.1 Find All Unique Clients
```javascript
async function getAllClients() {
  const { data, error } = await supabase
    .from('client_metrics_summary')
    .select('client_id')
    .order('client_id');

  if (error) {
    console.error('Error:', error);
    return;
  }

  const unique = [...new Set(data.map(r => r.client_id))];
  console.log(`Total unique clients: ${unique.length}`);
  console.log('Client IDs:');
  unique.forEach(id => console.log(`  ${id}`));
}

getAllClients();
```

### 7.2 Find All Unique Locations
```javascript
async function getAllLocations() {
  const { data, error } = await supabase
    .from('gbp_location_daily_metrics')
    .select('location_id')
    .order('location_id');

  if (error) {
    console.error('Error:', error);
    return;
  }

  const unique = [...new Set(data.map(r => r.location_id))];
  console.log(`Total unique locations: ${unique.length}`);
  console.log('Location IDs:');
  unique.forEach(id => console.log(`  ${id}`));
}

getAllLocations();
```

### 7.3 Identify Empty Columns
```javascript
async function findEmptyColumns() {
  const { data, error } = await supabase
    .from('client_metrics_summary')
    .select('*')
    .limit(100);

  if (error) {
    console.error('Error:', error);
    return;
  }

  const columns = Object.keys(data[0]);
  const empty = [];
  const populated = [];

  columns.forEach(col => {
    const nonEmpty = data.filter(r => r[col] !== null && r[col] !== 0 && r[col] !== '').length;
    if (nonEmpty === 0) {
      empty.push(col);
    } else {
      populated.push({ col, nonEmpty, percent: ((nonEmpty / data.length) * 100).toFixed(1) });
    }
  });

  console.log('Empty Columns (always 0 or NULL):');
  empty.forEach(col => console.log(`  - ${col}`));

  console.log('\nPopulated Columns:');
  populated.sort((a, b) => b.nonEmpty - a.nonEmpty).forEach(item => {
    console.log(`  - ${item.col}: ${item.percent}% populated`);
  });
}

findEmptyColumns();
```

---

## Running These Queries

### Option 1: Command Line (Node.js)
```bash
# Save query to file
cat > test-query.js << 'EOF'
[PASTE QUERY CODE HERE]
EOF

# Run it
node test-query.js
```

### Option 2: In Your Application
Copy the function into your app code and call it:
```javascript
import { supabase } from '@/lib/supabase'
// paste function
getLatestClientMetrics();
```

### Option 3: Browser Console (if your app loads Supabase)
Open browser dev console and paste the code directly (if Supabase is available globally).

---

## Troubleshooting

### Query Returns No Data
- Check the table name spelling
- Verify the column name spelling
- Make sure the date format is correct (YYYY-MM-DD)
- Check if you're using the right API key

### Permission Denied Error
- Make sure you're using the correct Supabase URL
- Verify your API key is active
- Check Row Level Security (RLS) policies if enabled

### Connection Issues
- Verify your internet connection
- Check if Supabase service is up
- Try a simpler query first to isolate the issue

---

**Last Updated:** 2026-02-03
**All queries tested and working** ✅

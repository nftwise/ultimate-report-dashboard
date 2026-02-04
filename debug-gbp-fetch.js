const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugGbpFetch() {
  console.log('\n' + '='.repeat(70));
  console.log('GBP DATA FETCH DEBUG');
  console.log('='.repeat(70) + '\n');

  try {
    // Get a sample client from admin dashboard
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, slug')
      .limit(1);

    if (!clients || clients.length === 0) {
      console.log('No clients found');
      return;
    }

    const client = clients[0];
    console.log(`Testing with client: ${client.name} (${client.slug})`);
    console.log(`Client ID: ${client.id}\n`);

    // Get date range
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);

    const dateFromISO = from.toISOString().split('T')[0];
    const dateToISO = to.toISOString().split('T')[0];

    console.log(`Date Range: ${dateFromISO} to ${dateToISO}\n`);

    // Fetch from client_metrics_summary
    console.log('1️⃣ Fetching from client_metrics_summary...');
    const { data: metricsData, error: metricsError } = await supabase
      .from('client_metrics_summary')
      .select('date, gbp_calls, total_leads, form_fills')
      .eq('client_id', client.id)
      .gte('date', dateFromISO)
      .lte('date', dateToISO)
      .order('date', { ascending: true });

    if (metricsError) {
      console.error('Error:', metricsError.message);
    } else {
      console.log(`✅ Fetched: ${metricsData?.length || 0} records`);
      const gbpCallsCount = metricsData?.filter(d => d.gbp_calls > 0).length || 0;
      const gbpCallsTotal = metricsData?.reduce((s, d) => s + (d.gbp_calls || 0), 0) || 0;
      console.log(`   gbp_calls: ${gbpCallsCount} days with data, total: ${gbpCallsTotal}`);
      console.log(`   Sample:`, metricsData?.[0]);
    }

    // Fetch from gbp_location_daily_metrics
    console.log('\n2️⃣ Fetching from gbp_location_daily_metrics...');
    const { data: gbpData, error: gbpError } = await supabase
      .from('gbp_location_daily_metrics')
      .select('date, phone_calls, views, website_clicks, direction_requests')
      .eq('client_id', client.id)
      .gte('date', dateFromISO)
      .lte('date', dateToISO)
      .order('date', { ascending: true });

    if (gbpError) {
      console.error('Error:', gbpError.message);
    } else {
      console.log(`✅ Fetched: ${gbpData?.length || 0} records`);
      const phoneCallsCount = gbpData?.filter(d => d.phone_calls > 0).length || 0;
      const phoneCallsTotal = gbpData?.reduce((s, d) => s + (d.phone_calls || 0), 0) || 0;
      const webClicksTotal = gbpData?.reduce((s, d) => s + (d.website_clicks || 0), 0) || 0;
      const directionsTotal = gbpData?.reduce((s, d) => s + (d.direction_requests || 0), 0) || 0;

      console.log(`   phone_calls: ${phoneCallsCount} days with data, total: ${phoneCallsTotal}`);
      console.log(`   website_clicks: ${webClicksTotal}`);
      console.log(`   direction_requests: ${directionsTotal}`);
      console.log(`   Sample:`, gbpData?.[0]);
    }

    // Check date matching
    if (metricsData && gbpData && metricsData.length > 0 && gbpData.length > 0) {
      console.log('\n3️⃣ Checking date alignment...');
      const metricsDateSet = new Set(metricsData.map(d => d.date));
      const gbpDateSet = new Set(gbpData.map(d => d.date));

      const matchingDates = Array.from(metricsDateSet).filter(d => gbpDateSet.has(d));
      console.log(`   Metrics dates: ${metricsData.length}`);
      console.log(`   GBP dates: ${gbpData.length}`);
      console.log(`   Matching dates: ${matchingDates.length}`);

      if (matchingDates.length > 0) {
        console.log(`   First matching: ${matchingDates[0]}`);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('DEBUG COMPLETE');
    console.log('='.repeat(70) + '\n');

  } catch (error) {
    console.error('Error:', error);
  }
}

debugGbpFetch();

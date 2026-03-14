import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  'https://tupedninjtaarmdwppgy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1cGVkbmluanRhYXJtZHdwcGd5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTE2MzA1NCwiZXhwIjoyMDc2NzM5MDU0fQ.ulXb0ri8GGnXogfI08yGf-j8MaQsBRhd2ZUxyk470Vw',
  { auth: { persistSession: false } }
);

async function checkMonths() {
  console.log('🔍 Check Nov 2025 & Dec 2025 GBP data\n');
  console.log('=' .repeat(80) + '\n');

  // Get token
  const { data: tokenData } = await supabaseAdmin
    .from('system_settings')
    .select('value')
    .eq('key', 'gbp_agency_master')
    .single();

  const token = JSON.parse(tokenData.value);

  const oauth2Client = new google.auth.OAuth2(
    'GOOGLE_OAUTH_CLIENT_ID_PLACEHOLDER',
    'GOOGLE_OAUTH_CLIENT_SECRET_PLACEHOLDER'
  );

  oauth2Client.setCredentials({ refresh_token: token.refresh_token });
  const { credentials } = await oauth2Client.refreshAccessToken();
  const accessToken = credentials.access_token;

  // Get all clients with GBP
  const { data: clientsWithGBP } = await supabaseAdmin
    .from('gbp_locations')
    .select('client_id, id')
    .eq('is_active', true)
    .order('client_id');

  const uniqueClients = [...new Set((clientsWithGBP || []).map(x => x.client_id))];

  const months = [
    { name: 'Nov 2025', start: '2025-11-01', end: '2025-11-30' },
    { name: 'Dec 2025', start: '2025-12-01', end: '2025-12-31' },
  ];

  for (const month of months) {
    console.log(`\n📅 ${month.name} (${month.start} to ${month.end})`);
    console.log('─'.repeat(80));

    const results = [];

    for (const clientId of uniqueClients) {
      // Get client name
      const { data: client } = await supabaseAdmin
        .from('clients')
        .select('name')
        .eq('id', clientId)
        .single();

      // Get locations for this client
      const { data: locations } = await supabaseAdmin
        .from('gbp_locations')
        .select('id, client_id, gbp_location_id, location_name')
        .eq('client_id', clientId)
        .eq('is_active', true);

      let clientTotal = 0;
      let locCount = 0;

      for (const location of locations) {
        let locationId = location.gbp_location_id;
        if (!locationId.startsWith('locations/')) {
          locationId = `locations/${locationId}`;
        }

        const [sYear, sMonth, sDay] = month.start.split('-').map(Number);
        const [eYear, eMonth, eDay] = month.end.split('-').map(Number);

        const url = new URL(
          `https://businessprofileperformance.googleapis.com/v1/${locationId}:getDailyMetricsTimeSeries`
        );
        url.searchParams.set('dailyMetric', 'CALL_CLICKS');
        url.searchParams.set('dailyRange.start_date.year', String(sYear));
        url.searchParams.set('dailyRange.start_date.month', String(sMonth));
        url.searchParams.set('dailyRange.start_date.day', String(sDay));
        url.searchParams.set('dailyRange.end_date.year', String(eYear));
        url.searchParams.set('dailyRange.end_date.month', String(eMonth));
        url.searchParams.set('dailyRange.end_date.day', String(eDay));

        try {
          const response = await fetch(url.toString(), {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          });

          if (response.ok) {
            const data = await response.json();
            const calls = (data.timeSeries?.datedValues || [])
              .reduce((sum, d) => sum + (parseInt(d.value || '0') || 0), 0);
            clientTotal += calls;
            locCount++;
          }
        } catch (e) {
          // Silent fail
        }

        await new Promise(r => setTimeout(r, 50));
      }

      results.push({
        name: client.name,
        calls: clientTotal,
        locations: locCount,
      });
    }

    // Display results sorted by calls
    const sorted = results.sort((a, b) => b.calls - a.calls);
    const totalCalls = sorted.reduce((sum, r) => sum + r.calls, 0);

    sorted.forEach((r, idx) => {
      console.log(
        `${String(idx + 1).padStart(2)}. ${r.calls.toString().padStart(4)} calls | ${r.name}`
      );
    });

    console.log('─'.repeat(80));
    console.log(`Total: ${totalCalls} calls across ${uniqueClients.length} clients\n`);
  }

  // Check database for existing data
  console.log('\n📊 Database Status Check');
  console.log('=' .repeat(80));

  for (const month of months) {
    const { data: records } = await supabaseAdmin
      .from('gbp_location_daily_metrics')
      .select('id', { count: 'exact' })
      .gte('date', month.start)
      .lte('date', month.end);

    const count = records ? records.length : 0;
    const status = count > 0 ? '✅' : '❌';
    console.log(`${status} ${month.name}: ${count} records in database`);
  }
}

checkMonths().catch(console.error);

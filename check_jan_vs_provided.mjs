import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  'https://tupedninjtaarmdwppgy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1cGVkbmluanRhYXJtZHdwcGd5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTE2MzA1NCwiZXhwIjoyMDc2NzM5MDU0fQ.ulXb0ri8GGnXogfI08yGf-j8MaQsBRhd2ZUxyk470Vw',
  { auth: { persistSession: false } }
);

// Data provided by user
const providedData = {
  'DECARLO CHIROPRACITC': 89,
  'CHIROSOLUTIONS CENTER': 19,
  'COREPOSTURE': 44,
  'ZEN CARE PHYSICAL MEDICINE': 36,
  'WHOLE BODY WELLNESS': 163,
  'TAILS ANIMAL CHIROPRACTIC CARE': 11,
  'NEWPORT CENTER FAMILY CHIROPRACTIC': 25,
  'RESTORATION DENTAL': 37,
  'CHIROPRACTIC CARE CENTRE': 70,
  'CHIROPRACTIC HEALTH CLUB': 81,
  'CHIROPRACTIC FIRST': 113,
  'SOUTHPORT CHIROPRACTIC': 66,
  'HAVEN CHIROPRACTIC': 9,
  'TINKER FAMILY CHIRO': 25,
  'RAY CHIROPRACTIC': 140,
  'HOOD CHIROPRACTIC': 63,
  'NORTH ALABAMA SPINE & REHAB': 48,
};

async function compare() {
  console.log('🔍 Jan 2026 GBP API vs Provided Data\n');
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

    let apiTotal = 0;

    for (const location of locations) {
      let locationId = location.gbp_location_id;
      if (!locationId.startsWith('locations/')) {
        locationId = `locations/${locationId}`;
      }

      // Fetch Jan 1-31 range
      const url = new URL(
        `https://businessprofileperformance.googleapis.com/v1/${locationId}:getDailyMetricsTimeSeries`
      );
      url.searchParams.set('dailyMetric', 'CALL_CLICKS');
      url.searchParams.set('dailyRange.start_date.year', '2026');
      url.searchParams.set('dailyRange.start_date.month', '1');
      url.searchParams.set('dailyRange.start_date.day', '1');
      url.searchParams.set('dailyRange.end_date.year', '2026');
      url.searchParams.set('dailyRange.end_date.month', '1');
      url.searchParams.set('dailyRange.end_date.day', '31');

      try {
        const response = await fetch(url.toString(), {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });

        if (response.ok) {
          const data = await response.json();
          const calls = (data.timeSeries?.datedValues || [])
            .reduce((sum, d) => sum + (parseInt(d.value || '0') || 0), 0);
          apiTotal += calls;
        }
      } catch (e) {
        // Silent fail
      }

      await new Promise(r => setTimeout(r, 100));
    }

    // Find matching provided data
    const clientName = client.name.toUpperCase();
    let providedValue = null;
    let matchKey = null;

    for (const [key, value] of Object.entries(providedData)) {
      if (clientName.includes(key.trim()) || key.includes(clientName)) {
        providedValue = value;
        matchKey = key;
        break;
      }
    }

    results.push({
      name: client.name,
      api: apiTotal,
      provided: providedValue,
      key: matchKey,
    });
  }

  // Display results
  console.log('📊 COMPARISON TABLE:\n');
  console.log(
    'Client'.padEnd(40) +
    'API'.padStart(8) +
    'Provided'.padStart(12) +
    'Diff'.padStart(10) +
    'Status'.padStart(12)
  );
  console.log('='.repeat(80));

  let matched = 0;
  let close = 0;
  let missing = 0;

  results
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    .forEach(r => {
      const api = r.api.toString();
      const provided = r.provided !== null ? r.provided.toString() : '—';

      let status = '';
      let diff = '';

      if (r.provided === null) {
        status = 'No provided';
        missing++;
      } else {
        const difference = r.api - r.provided;
        diff = difference !== 0 ? (difference > 0 ? '+' : '') + difference : '✓';

        if (Math.abs(difference) <= 2) {
          status = difference === 0 ? '✅ Match' : '🔶 Close';
          matched++;
          if (difference !== 0) close++;
        } else {
          status = difference > 0 ? '⬆️  API higher' : '⬇️  API lower';
        }
      }

      console.log(
        (r.name || '?').padEnd(40) +
        api.padStart(8) +
        provided.padStart(12) +
        diff.padStart(10) +
        status.padStart(12)
      );
    });

  console.log('\n' + '='.repeat(80) + '\n');
  console.log(`📈 Summary:`);
  console.log(`  ✅ Exact match: ${results.filter(r => r.provided !== null && r.api === r.provided).length}`);
  console.log(`  🔶 Close (±2):  ${close}`);
  console.log(`  ❌ Different:   ${results.filter(r => r.provided !== null && Math.abs(r.api - r.provided) > 2).length}`);
  console.log(`  ❓ No data:     ${missing}`);
}

compare().catch(console.error);

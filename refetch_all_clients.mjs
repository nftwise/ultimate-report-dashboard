import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  'https://tupedninjtaarmdwppgy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1cGVkbmluanRhYXJtZHdwcGd5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTE2MzA1NCwiZXhwIjoyMDc2NzM5MDU0fQ.ulXb0ri8GGnXogfI08yGf-j8MaQsBRhd2ZUxyk470Vw',
  { auth: { persistSession: false } }
);

async function refetchAll() {
  console.log('📊 Refetch GBP data cho tất cả 16 khách\n');
  console.log('=' .repeat(70) + '\n');

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

  // Clear old Feb data first
  console.log('🧹 Clear old Feb data...\n');
  await supabaseAdmin
    .from('gbp_location_daily_metrics')
    .delete()
    .gte('date', '2026-02-01')
    .lte('date', '2026-02-28');

  // Get all clients with GBP
  const { data: clientsWithGBP, error: gbpError } = await supabaseAdmin
    .from('gbp_locations')
    .select('client_id, id')
    .eq('is_active', true)
    .order('client_id');

  if (gbpError) {
    console.error('Error fetching GBP locations:', gbpError);
    process.exit(1);
  }

  const uniqueClients = [...new Set((clientsWithGBP || []).map(x => x.client_id))];

  console.log(`🔄 Fetching for ${uniqueClients.length} clients...\n`);

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

    let clientTotalCalls = 0;
    let errors = [];

    for (const location of locations) {
      let locationId = location.gbp_location_id;
      if (!locationId.startsWith('locations/')) {
        locationId = `locations/${locationId}`;
      }

      // Fetch Feb 1-28 range
      const url = new URL(
        `https://businessprofileperformance.googleapis.com/v1/${locationId}:getDailyMetricsTimeSeries`
      );
      url.searchParams.set('dailyMetric', 'CALL_CLICKS');
      url.searchParams.set('dailyRange.start_date.year', '2026');
      url.searchParams.set('dailyRange.start_date.month', '2');
      url.searchParams.set('dailyRange.start_date.day', '1');
      url.searchParams.set('dailyRange.end_date.year', '2026');
      url.searchParams.set('dailyRange.end_date.month', '2');
      url.searchParams.set('dailyRange.end_date.day', '28');

      try {
        const response = await fetch(url.toString(), {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });

        if (response.ok) {
          const data = await response.json();
          const calls = (data.timeSeries?.datedValues || [])
            .reduce((sum, d) => sum + (parseInt(d.value || '0') || 0), 0);

          // Save to database
          const { error } = await supabaseAdmin
            .from('gbp_location_daily_metrics')
            .insert({
              location_id: location.id,
              client_id: clientId,
              date: '2026-02-01',
              phone_calls: calls,
              website_clicks: 0,
              direction_requests: 0,
              views: 0,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });

          if (error) {
            errors.push(`${location.location_name}: ${error.message}`);
          } else {
            clientTotalCalls += calls;
          }
        } else {
          errors.push(`${location.location_name}: API error ${response.status}`);
        }
      } catch (e) {
        errors.push(`${location.location_name}: ${e.message}`);
      }

      await new Promise(r => setTimeout(r, 100));
    }

    const status = errors.length === 0 ? '✅' : '⚠️ ';
    results.push({
      name: client.name,
      calls: clientTotalCalls,
      locations: locations.length,
      errors: errors,
      status: errors.length === 0 ? 'OK' : 'ERROR'
    });

    console.log(`${status} ${client.name.padEnd(40)} → ${clientTotalCalls} calls (${locations.length} loc)`);
    if (errors.length > 0) {
      errors.forEach(e => console.log(`   ❌ ${e}`));
    }
  }

  console.log('\n' + '='.repeat(70) + '\n');
  console.log('📋 LIỆT KÊ TOÀN BỘ 16 KHÁCH:\n');

  results
    .sort((a, b) => b.calls - a.calls)
    .forEach((r, idx) => {
      const marker = r.status === 'OK' ? '✅' : '⚠️ ';
      console.log(`${String(idx + 1).padStart(2)}. ${marker} ${r.name.padEnd(40)} ${String(r.calls).padStart(4)} calls`);
    });

  console.log('\n' + '='.repeat(70) + '\n');

  const successCount = results.filter(r => r.status === 'OK').length;
  console.log(`✅ Thành công: ${successCount}/${results.length}`);

  const errorCount = results.filter(r => r.status === 'ERROR').length;
  if (errorCount > 0) {
    console.log(`⚠️  Lỗi: ${errorCount}/${results.length}`);
    results.filter(r => r.status === 'ERROR').forEach(r => {
      console.log(`   • ${r.name}`);
    });
  }
}

refetchAll().catch(console.error);

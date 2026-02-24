import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { JWT } from 'google-auth-library';

export const maxDuration = 300;

const BATCH_SIZE = 3;
const TIMEOUT_MS = 20000;

/**
 * GET /api/cron/sync-ga4
 * Daily cron: Sync yesterday's GA4 data to raw tables
 * Tables: ga4_events, ga4_sessions, ga4_conversions, ga4_landing_pages
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const targetDate = yesterday.toISOString().split('T')[0];

    console.log(`[sync-ga4] Starting for ${targetDate}`);

    // Get auth
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    if (!privateKey || !clientEmail) {
      return NextResponse.json({ success: false, error: 'Missing service account credentials' }, { status: 500 });
    }

    const auth = new JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    });
    const tokenResponse = await auth.getAccessToken();
    const token = tokenResponse.token || '';

    // Fetch clients with GA4 config
    const { data: clients, error: clientsError } = await supabaseAdmin
      .from('clients')
      .select('id, name, service_configs(ga_property_id)')
      .eq('is_active', true);

    if (clientsError) throw new Error(`Failed to fetch clients: ${clientsError.message}`);

    const clientsWithGA = (clients || [])
      .map((c: any) => ({
        id: c.id,
        name: c.name,
        propertyId: (Array.isArray(c.service_configs) ? c.service_configs[0] : c.service_configs)?.ga_property_id,
      }))
      .filter((c: any) => c.propertyId);

    console.log(`[sync-ga4] Processing ${clientsWithGA.length} clients`);

    let totalEvents = 0, totalSessions = 0, totalConversions = 0, totalLandingPages = 0;
    const errors: string[] = [];

    // Process clients in batches
    for (let i = 0; i < clientsWithGA.length; i += BATCH_SIZE) {
      const batch = clientsWithGA.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map(async (client: any) => {
        try {
          const [events, sessions, conversions, landingPages] = await Promise.all([
            fetchGA4Events(token, client.propertyId, targetDate).catch(() => []),
            fetchGA4Sessions(token, client.propertyId, targetDate).catch(() => []),
            fetchGA4Conversions(token, client.propertyId, targetDate).catch(() => []),
            fetchGA4LandingPages(token, client.propertyId, targetDate).catch(() => []),
          ]);

          const eventRows = events.map((r: any) => ({ client_id: client.id, date: targetDate, ...r }));
          const sessionRows = sessions.map((r: any) => ({ client_id: client.id, date: targetDate, ...r }));
          const conversionRows = conversions.map((r: any) => ({ client_id: client.id, date: targetDate, ...r }));
          const landingPageRows = landingPages.map((r: any) => ({ client_id: client.id, date: targetDate, ...r }));

          if (eventRows.length > 0) {
            const { error } = await supabaseAdmin.from('ga4_events').upsert(eventRows, { onConflict: 'client_id,date,event_name,source_medium,device' });
            if (error) console.log(`[sync-ga4] Events upsert error for ${client.name}:`, error.message);
          }
          if (sessionRows.length > 0) {
            const { error } = await supabaseAdmin.from('ga4_sessions').upsert(sessionRows, { onConflict: 'client_id,date,source_medium,device,country' });
            if (error) console.log(`[sync-ga4] Sessions upsert error for ${client.name}:`, error.message);
          }
          if (conversionRows.length > 0) {
            const { error } = await supabaseAdmin.from('ga4_conversions').upsert(conversionRows, { onConflict: 'client_id,date,conversion_event,source_medium,device' });
            if (error) console.log(`[sync-ga4] Conversions upsert error for ${client.name}:`, error.message);
          }
          if (landingPageRows.length > 0) {
            const { error } = await supabaseAdmin.from('ga4_landing_pages').upsert(landingPageRows, { onConflict: 'client_id,date,landing_page,source_medium' });
            if (error) console.log(`[sync-ga4] Landing pages upsert error for ${client.name}:`, error.message);
          }

          return {
            events: eventRows.length,
            sessions: sessionRows.length,
            conversions: conversionRows.length,
            landingPages: landingPageRows.length,
          };
        } catch (err: any) {
          errors.push(`${client.name}: ${err.message}`);
          return { events: 0, sessions: 0, conversions: 0, landingPages: 0 };
        }
      }));

      results.forEach((r) => {
        totalEvents += r.events;
        totalSessions += r.sessions;
        totalConversions += r.conversions;
        totalLandingPages += r.landingPages;
      });
    }

    const duration = Date.now() - startTime;
    console.log(`[sync-ga4] Done in ${duration}ms: ${totalEvents} events, ${totalSessions} sessions, ${totalConversions} conversions, ${totalLandingPages} landing pages`);

    return NextResponse.json({
      success: true,
      date: targetDate,
      clients: clientsWithGA.length,
      records: { events: totalEvents, sessions: totalSessions, conversions: totalConversions, landingPages: totalLandingPages },
      total: totalEvents + totalSessions + totalConversions + totalLandingPages,
      errors: errors.length > 0 ? errors : undefined,
      duration,
    });
  } catch (error: any) {
    console.error('[sync-ga4] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// =====================================================
// GA4 DATA API HELPERS
// =====================================================

async function runGA4Report(token: string, propertyId: string, body: any): Promise<any[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const response = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    }
  );
  clearTimeout(timeoutId);

  if (!response.ok) throw new Error(`GA4 API error: ${response.status}`);
  const data = await response.json();
  return data.rows || [];
}

async function fetchGA4Events(token: string, propertyId: string, date: string) {
  const rows = await runGA4Report(token, propertyId, {
    dateRanges: [{ startDate: date, endDate: date }],
    dimensions: [{ name: 'eventName' }, { name: 'sessionSourceMedium' }, { name: 'deviceCategory' }],
    metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }, { name: 'eventValue' }],
    limit: 10000,
  });

  return rows.map((row: any) => ({
    event_name: row.dimensionValues[0].value || '(not set)',
    source_medium: row.dimensionValues[1].value || '(not set)',
    device: row.dimensionValues[2].value || '(not set)',
    event_count: parseInt(row.metricValues[0].value) || 0,
    total_users: parseInt(row.metricValues[1].value) || 0,
    event_value: parseFloat(row.metricValues[2].value) || 0,
  }));
}

async function fetchGA4Sessions(token: string, propertyId: string, date: string) {
  const rows = await runGA4Report(token, propertyId, {
    dateRanges: [{ startDate: date, endDate: date }],
    dimensions: [{ name: 'sessionSourceMedium' }, { name: 'deviceCategory' }, { name: 'country' }],
    metrics: [
      { name: 'sessions' }, { name: 'totalUsers' }, { name: 'newUsers' },
      { name: 'screenPageViews' }, { name: 'engagementRate' },
      { name: 'averageSessionDuration' }, { name: 'bounceRate' },
      { name: 'eventCount' },
    ],
    limit: 10000,
  });

  return rows.map((row: any) => ({
    source_medium: row.dimensionValues[0].value || '(not set)',
    device: row.dimensionValues[1].value || '(not set)',
    country: row.dimensionValues[2].value || '(not set)',
    sessions: parseInt(row.metricValues[0].value) || 0,
    total_users: parseInt(row.metricValues[1].value) || 0,
    new_users: parseInt(row.metricValues[2].value) || 0,
    screen_page_views: parseInt(row.metricValues[3].value) || 0,
    engagement_rate: parseFloat(row.metricValues[4].value) || 0,
    avg_session_duration: parseFloat(row.metricValues[5].value) || 0,
    bounce_rate: parseFloat(row.metricValues[6].value) || 0,
    event_count: parseInt(row.metricValues[7].value) || 0,
  }));
}

async function fetchGA4Conversions(token: string, propertyId: string, date: string) {
  const rows = await runGA4Report(token, propertyId, {
    dateRanges: [{ startDate: date, endDate: date }],
    dimensions: [{ name: 'eventName' }, { name: 'sessionSourceMedium' }, { name: 'deviceCategory' }],
    metrics: [{ name: 'conversions' }, { name: 'totalUsers' }, { name: 'eventValue' }],
    dimensionFilter: {
      filter: { fieldName: 'isConversionEvent', stringFilter: { matchType: 'EXACT', value: 'true' } },
    },
    limit: 10000,
  });

  return rows.map((row: any) => ({
    conversion_event: row.dimensionValues[0].value || '(not set)',
    source_medium: row.dimensionValues[1].value || '(not set)',
    device: row.dimensionValues[2].value || '(not set)',
    conversions: parseInt(row.metricValues[0].value) || 0,
    total_users: parseInt(row.metricValues[1].value) || 0,
    conversion_value: parseFloat(row.metricValues[2].value) || 0,
  }));
}

async function fetchGA4LandingPages(token: string, propertyId: string, date: string) {
  const rows = await runGA4Report(token, propertyId, {
    dateRanges: [{ startDate: date, endDate: date }],
    dimensions: [{ name: 'landingPagePlusQueryString' }, { name: 'sessionSourceMedium' }],
    metrics: [
      { name: 'sessions' }, { name: 'totalUsers' }, { name: 'newUsers' },
      { name: 'averageSessionDuration' }, { name: 'bounceRate' },
      { name: 'conversions' },
    ],
    limit: 10000,
  });

  return rows.map((row: any) => {
    const sessions = parseInt(row.metricValues[0].value) || 0;
    const conversions = parseInt(row.metricValues[5].value) || 0;
    return {
      landing_page: row.dimensionValues[0].value || '(not set)',
      source_medium: row.dimensionValues[1].value || '(not set)',
      sessions,
      total_users: parseInt(row.metricValues[1].value) || 0,
      new_users: parseInt(row.metricValues[2].value) || 0,
      avg_session_duration: parseFloat(row.metricValues[3].value) || 0,
      bounce_rate: parseFloat(row.metricValues[4].value) || 0,
      conversions,
      conversion_rate: sessions > 0 ? Math.round((conversions / sessions) * 10000) / 100 : 0,
    };
  });
}

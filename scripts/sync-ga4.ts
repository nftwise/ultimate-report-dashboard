import { supabaseAdmin } from '../src/lib/supabase';
import { JWT } from 'google-auth-library';
import { sendCronFailureAlert, saveCronStatus } from '../src/lib/telegram';

const args = process.argv.slice(2);
const getArg = (name: string): string | undefined => {
  const idx = args.indexOf('--' + name);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : undefined;
};

const BATCH_SIZE = 3;
const DEFAULT_TIMEOUT_MS = 20000;
const SINGLE_CLIENT_TIMEOUT_MS = 60000;

async function main() {
  const startTime = Date.now();

  try {
    const dateParam = ((process.env.DATE || getArg('date') || '').trim() || undefined);
    const targetDate = dateParam || (() => {
      const now = new Date();
      const caToday = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
      caToday.setDate(caToday.getDate() - 1);
      return `${caToday.getFullYear()}-${String(caToday.getMonth() + 1).padStart(2, '0')}-${String(caToday.getDate()).padStart(2, '0')}`;
    })();
    const groupParam = process.env.GROUP || getArg('group');
    const clientIdParam = process.env.CLIENT_ID || getArg('clientId');
    const timeoutMs = clientIdParam ? SINGLE_CLIENT_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;

    console.log(`[sync-ga4] Starting for ${targetDate}${clientIdParam ? ` (client: ${clientIdParam})` : ''}`);

    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    if (!privateKey || !clientEmail) {
      throw new Error('Missing service account credentials');
    }

    const auth = new JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    });
    const tokenResponse = await auth.getAccessToken();
    const token = tokenResponse.token;
    if (!token) throw new Error('Failed to obtain GA4 access token');

    const { data: clients, error: clientsError } = await supabaseAdmin
      .from('clients')
      .select('id, name, service_configs(ga_property_id)')
      .eq('is_active', true);

    if (clientsError) throw new Error(`Failed to fetch clients: ${clientsError.message}`);

    let clientsWithGA = (clients || [])
      .map((c: any) => {
        const servicePropertyId = (Array.isArray(c.service_configs) ? c.service_configs[0] : c.service_configs)?.ga_property_id;
        return {
          id: c.id,
          name: c.name,
          propertyId: servicePropertyId || null,
        };
      })
      .filter((c: any) => c.propertyId);

    if (clientIdParam) {
      clientsWithGA = clientsWithGA.filter((c: any) => c.id === clientIdParam);
      if (clientsWithGA.length === 0) {
        throw new Error(`Client ${clientIdParam} not found or has no GA4 config`);
      }
    } else if (groupParam) {
      const { data: groupClients } = await supabaseAdmin
        .from('clients').select('id').eq('sync_group', groupParam).eq('is_active', true);
      const groupIds = new Set((groupClients || []).map((c: any) => c.id));
      clientsWithGA = clientsWithGA.filter((c: any) => groupIds.has(c.id));
    }

    console.log(`[sync-ga4] Processing ${clientsWithGA.length} clients`);

    let totalEvents = 0, totalSessions = 0, totalConversions = 0, totalLandingPages = 0;
    const errors: string[] = [];

    for (let i = 0; i < clientsWithGA.length; i += BATCH_SIZE) {
      const batch = clientsWithGA.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map(async (client: any) => {
        try {
          const fetchWithRetry = async (fn: () => Promise<any[]>, label: string) => {
            try {
              return await fn();
            } catch (err: any) {
              console.log(`[sync-ga4] ${client.name} ${label} attempt 1 failed: ${err.message}, retrying...`);
              try {
                await new Promise(r => setTimeout(r, 2000));
                return await fn();
              } catch (err2: any) {
                console.log(`[sync-ga4] ${client.name} ${label} attempt 2 failed: ${err2.message}`);
                errors.push(`${client.name} ${label}: ${err2.message}`);
                return [];
              }
            }
          };

          const [events, initialSessions, aggregateSessions, conversions, landingPages] = await Promise.all([
            fetchWithRetry(() => fetchGA4Events(token, client.propertyId, targetDate, timeoutMs), 'events'),
            fetchWithRetry(() => fetchGA4Sessions(token, client.propertyId, targetDate, timeoutMs), 'sessions'),
            fetchWithRetry(() => fetchGA4SessionsAggregate(token, client.propertyId, targetDate, timeoutMs), 'sessions-aggregate'),
            fetchWithRetry(() => fetchGA4Conversions(token, client.propertyId, targetDate, timeoutMs), 'conversions'),
            fetchWithRetry(() => fetchGA4LandingPages(token, client.propertyId, targetDate, timeoutMs), 'landingPages'),
          ]);

          let sessions: any[];
          if (initialSessions.length === 0) {
            console.log(`[sync-ga4] ${client.name}: used aggregate fallback for sessions (thresholding bypass)`);
            sessions = aggregateSessions;
          } else {
            sessions = [...initialSessions, ...aggregateSessions];
          }

          const ALLOWED_EVENTS = ['submit_form_successful', 'Appointment_Successful', 'call_from_web'];
          const filteredEvents = events.filter((e: any) => ALLOWED_EVENTS.includes(e.event_name));

          const topLandingPages = [...landingPages]
            .sort((a: any, b: any) => (b.sessions || 0) - (a.sessions || 0))
            .slice(0, 10);

          const eventRows = filteredEvents.map((r: any) => ({ client_id: client.id, date: targetDate, ...r }));
          const sessionRows = sessions.map((r: any) => ({ client_id: client.id, date: targetDate, ...r }));
          const conversionRows = conversions.map((r: any) => ({ client_id: client.id, date: targetDate, ...r }));
          const landingPageRows = topLandingPages.map((r: any) => ({ client_id: client.id, date: targetDate, ...r }));

          if (eventRows.length > 0) {
            const { error } = await supabaseAdmin.from('ga4_events').upsert(eventRows, { onConflict: 'client_id,date,event_name,source_medium,device' });
            if (error) { console.error(`[sync-ga4] Events upsert error ${client.name}:`, error.message); errors.push(`${client.name} events: ${error.message}`); }
          }
          if (sessionRows.length > 0) {
            const { error } = await supabaseAdmin.from('ga4_sessions').upsert(sessionRows, { onConflict: 'client_id,date,source_medium,device,country' });
            if (error) { console.error(`[sync-ga4] Sessions upsert error ${client.name}:`, error.message); errors.push(`${client.name} sessions: ${error.message}`); }
          }
          if (conversionRows.length > 0) {
            const { error } = await supabaseAdmin.from('ga4_conversions').upsert(conversionRows, { onConflict: 'client_id,date,conversion_event,source_medium,device' });
            if (error) { console.error(`[sync-ga4] Conversions upsert error ${client.name}:`, error.message); errors.push(`${client.name} conversions: ${error.message}`); }
          }
          if (landingPageRows.length > 0) {
            const { error } = await supabaseAdmin.from('ga4_landing_pages').upsert(landingPageRows, { onConflict: 'client_id,date,landing_page,source_medium' });
            if (error) { console.error(`[sync-ga4] Landing pages upsert error ${client.name}:`, error.message); errors.push(`${client.name} landing_pages: ${error.message}`); }
          }

          return {
            events: eventRows.length,
            sessions: sessionRows.length,
            conversions: conversionRows.length,
            landingPages: landingPageRows.length,
            eventsFiltered: events.length - filteredEvents.length,
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

    if (errors.length > 0) {
      sendCronFailureAlert('sync-ga4', targetDate, errors).catch(() => {});
    }

    saveCronStatus(supabaseAdmin, 'sync_ga4', {
      clients: clientsWithGA.length,
      records: totalEvents + totalSessions + totalConversions + totalLandingPages,
      errors,
      duration,
    }).catch(() => {});

    const result = {
      success: true,
      date: targetDate,
      clients: clientsWithGA.length,
      records: { events: totalEvents, sessions: totalSessions, conversions: totalConversions, landingPages: totalLandingPages },
      total: totalEvents + totalSessions + totalConversions + totalLandingPages,
      errors: errors.length > 0 ? errors : undefined,
      duration,
    };
    console.log(JSON.stringify(result));
    return result;
  } catch (error: any) {
    console.error('[sync-ga4] Error:', error);
    throw new Error(error.message);
  }
}

async function runGA4Report(token: string, propertyId: string, body: any, reportTimeout: number = DEFAULT_TIMEOUT_MS): Promise<any[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), reportTimeout);

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

async function fetchGA4Events(token: string, propertyId: string, date: string, timeout: number = DEFAULT_TIMEOUT_MS) {
  const rows = await runGA4Report(token, propertyId, {
    dateRanges: [{ startDate: date, endDate: date }],
    dimensions: [{ name: 'eventName' }, { name: 'sessionSourceMedium' }, { name: 'deviceCategory' }],
    metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }, { name: 'eventValue' }],
    limit: 10000,
  }, timeout);

  return rows.map((row: any) => ({
    event_name: row.dimensionValues[0].value || '(not set)',
    source_medium: row.dimensionValues[1].value || '(not set)',
    device: row.dimensionValues[2].value || '(not set)',
    event_count: parseInt(row.metricValues[0].value) || 0,
    total_users: parseInt(row.metricValues[1].value) || 0,
    event_value: parseFloat(row.metricValues[2].value) || 0,
  }));
}

async function fetchGA4Sessions(token: string, propertyId: string, date: string, timeout: number = DEFAULT_TIMEOUT_MS) {
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
  }, timeout);

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

async function fetchGA4Conversions(token: string, propertyId: string, date: string, timeout: number = DEFAULT_TIMEOUT_MS) {
  const rows = await runGA4Report(token, propertyId, {
    dateRanges: [{ startDate: date, endDate: date }],
    dimensions: [{ name: 'eventName' }, { name: 'sessionSourceMedium' }, { name: 'deviceCategory' }],
    metrics: [{ name: 'conversions' }, { name: 'totalUsers' }, { name: 'eventValue' }],
    dimensionFilter: {
      filter: { fieldName: 'isConversionEvent', stringFilter: { matchType: 'EXACT', value: 'true' } },
    },
    limit: 10000,
  }, timeout);

  return rows.map((row: any) => ({
    conversion_event: row.dimensionValues[0].value || '(not set)',
    source_medium: row.dimensionValues[1].value || '(not set)',
    device: row.dimensionValues[2].value || '(not set)',
    conversions: parseInt(row.metricValues[0].value) || 0,
    total_users: parseInt(row.metricValues[1].value) || 0,
    conversion_value: parseFloat(row.metricValues[2].value) || 0,
  }));
}

async function fetchGA4SessionsAggregate(token: string, propertyId: string, date: string, timeout: number = DEFAULT_TIMEOUT_MS) {
  const rows = await runGA4Report(token, propertyId, {
    dateRanges: [{ startDate: date, endDate: date }],
    metrics: [
      { name: 'sessions' }, { name: 'totalUsers' }, { name: 'newUsers' },
      { name: 'screenPageViews' }, { name: 'engagementRate' },
      { name: 'averageSessionDuration' }, { name: 'bounceRate' },
      { name: 'eventCount' },
    ],
  }, timeout);

  return rows.map((row: any) => ({
    source_medium: '(all) / (all)',
    device: 'all',
    country: 'all',
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

async function fetchGA4LandingPages(token: string, propertyId: string, date: string, timeout: number = DEFAULT_TIMEOUT_MS) {
  const rows = await runGA4Report(token, propertyId, {
    dateRanges: [{ startDate: date, endDate: date }],
    dimensions: [{ name: 'landingPagePlusQueryString' }, { name: 'sessionSourceMedium' }],
    metrics: [
      { name: 'sessions' }, { name: 'totalUsers' }, { name: 'newUsers' },
      { name: 'averageSessionDuration' }, { name: 'bounceRate' },
      { name: 'conversions' },
    ],
    limit: 10000,
  }, timeout);

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

main().then(r => { console.log(JSON.stringify(r)); process.exit(0); }).catch(e => { console.error('FAILED:', e.message); process.exit(1); });

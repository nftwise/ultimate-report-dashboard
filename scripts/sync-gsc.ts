import { supabaseAdmin } from '../src/lib/supabase';
import { JWT } from 'google-auth-library';
import { sendCronFailureAlert, saveCronStatus, sendTelegramMessage } from '../src/lib/telegram';

const args = process.argv.slice(2);
const getArg = (name: string): string | undefined => {
  const idx = args.indexOf('--' + name);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : undefined;
};

const BATCH_SIZE = 3;
const TIMEOUT_MS = 20000;

async function main() {
  const startTime = Date.now();

  try {
    const dateParam = ((process.env.DATE || getArg('date') || '').trim() || undefined);
    const datesToSync: string[] = dateParam ? [dateParam] : (() => {
      const now = new Date();
      const caToday = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
      const dates: string[] = [];
      for (let i = 3; i <= 12; i++) {
        const d = new Date(caToday);
        d.setDate(d.getDate() - i);
        dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
      }
      return dates;
    })();

    const targetDate = datesToSync[0];
    const clientIdParam = process.env.CLIENT_ID || getArg('clientId');
    console.log(`[sync-gsc] Starting for ${datesToSync.length > 1 ? `${datesToSync[datesToSync.length - 1]} to ${datesToSync[0]} (${datesToSync.length} days)` : targetDate}${clientIdParam ? ` (client: ${clientIdParam})` : ''}`);

    const privateKey = process.env.GOOGLE_PRIVATE_KEY_B64 ? Buffer.from(process.env.GOOGLE_PRIVATE_KEY_B64, 'base64').toString('utf8') : process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    if (!privateKey || !clientEmail) {
      throw new Error('Missing service account credentials');
    }

    const auth = new JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    });
    const tokenResponse = await auth.getAccessToken();
    const token = tokenResponse.token || '';

    const { data: clients, error: clientsError } = await supabaseAdmin
      .from('clients')
      .select('id, name, city, service_configs(gsc_site_url)')
      .eq('is_active', true);

    if (clientsError) throw new Error(`Failed to fetch clients: ${clientsError.message}`);

    let clientsWithGSC = (clients || [])
      .map((c: any) => ({
        id: c.id,
        name: c.name,
        city: c.city || '',
        siteUrl: (Array.isArray(c.service_configs) ? c.service_configs[0] : c.service_configs)?.gsc_site_url,
      }))
      .filter((c: any) => c.siteUrl);

    if (clientIdParam) {
      clientsWithGSC = clientsWithGSC.filter((c: any) => c.id === clientIdParam);
      if (clientsWithGSC.length === 0) {
        throw new Error(`Client ${clientIdParam} not found or has no GSC config`);
      }
    }

    console.log(`[sync-gsc] Processing ${clientsWithGSC.length} clients`);

    let totalQueries = 0;
    const errors: string[] = [];

    for (const syncDate of datesToSync) {
      console.log(`[sync-gsc] Processing date ${syncDate}`);

      for (let i = 0; i < clientsWithGSC.length; i += BATCH_SIZE) {
        const batch = clientsWithGSC.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(batch.map(async (client: any) => {
          const fetchWithRetry = async (fn: () => Promise<any[]>, label: string) => {
            try {
              return await fn();
            } catch (err: any) {
              console.log(`[sync-gsc] ${client.name} ${label} attempt 1 failed: ${err.message}, retrying...`);
              try {
                await new Promise(r => setTimeout(r, 2000));
                return await fn();
              } catch (err2: any) {
                console.log(`[sync-gsc] ${client.name} ${label} attempt 2 failed: ${err2.message}`);
                errors.push(`${syncDate} ${client.name} ${label}: ${err2.message}`);
                return [];
              }
            }
          };

          try {
            const [allQueries, aggregateRows] = await Promise.all([
              fetchWithRetry(() => fetchGSCQueries(token, client.siteUrl, syncDate, client.id), 'queries'),
              fetchWithRetry(() => fetchGSCData(token, client.siteUrl, syncDate, [], 1), 'aggregate'),
            ]);

            const totalClicks = aggregateRows[0]?.clicks || 0;
            const totalImpressions = aggregateRows[0]?.impressions || 0;

            {
              const { error: summaryError } = await supabaseAdmin.from('gsc_daily_summary').upsert({
                client_id: client.id,
                site_url: client.siteUrl,
                date: syncDate,
                total_impressions: totalImpressions,
                total_clicks: totalClicks,
                top_keywords_count: allQueries.filter((q: any) => (q.position || 999) <= 10).length,
              }, { onConflict: 'client_id,site_url,date' });
              if (summaryError) console.log(`[sync-gsc] Summary upsert error ${client.name}:`, summaryError.message);
            }

            const cityKeyword = client.city ? client.city.split(',')[0].toLowerCase().trim() : '';
            const top50 = [...allQueries].sort((a: any, b: any) => (b.impressions || 0) - (a.impressions || 0)).slice(0, 50);
            const seen = new Set(top50.map((q: any) => q.query));
            const cityQueries = cityKeyword
              ? allQueries.filter((q: any) => !seen.has(q.query) && q.query.toLowerCase().includes(cityKeyword))
              : [];
            const filteredQueries = [...top50, ...cityQueries];

            if (filteredQueries.length > 0) {
              for (let j = 0; j < filteredQueries.length; j += 500) {
                const chunk = filteredQueries.slice(j, j + 500);
                const { error } = await supabaseAdmin.from('gsc_queries').upsert(chunk, { onConflict: 'client_id,site_url,date,query' });
                if (error) console.log(`[sync-gsc] Queries upsert error ${client.name}:`, error.message);
              }
            }

            return { queries: filteredQueries.length };
          } catch (err: any) {
            errors.push(`${syncDate} ${client.name}: ${err.message}`);
            return { queries: 0 };
          }
        }));

        results.forEach((r) => {
          totalQueries += r.queries;
        });
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[sync-gsc] Done in ${duration}ms: ${totalQueries} queries`);

    if (errors.length > 0) {
      sendCronFailureAlert('sync-gsc', targetDate, errors).catch(() => {});
    }

    await saveCronStatus(supabaseAdmin, 'sync_gsc', {
      clients: clientsWithGSC.length,
      records: totalQueries,
      errors,
      duration,
    }).catch(() => {});

    const result = {
      success: true,
      date: targetDate,
      clients: clientsWithGSC.length,
      records: { queries: totalQueries },
      total: totalQueries,
      errors: errors.length > 0 ? errors : undefined,
      duration,
    };
    console.log(JSON.stringify(result));
    return result;
  } catch (error: any) {
    console.error('[sync-gsc] Error:', error);
    throw new Error(error.message);
  }
}

async function fetchGSCData(token: string, siteUrl: string, date: string, dimensions: string[], rowLimit: number = 5000): Promise<any[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const encodedSiteUrl = encodeURIComponent(siteUrl);
  const response = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodedSiteUrl}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startDate: date,
        endDate: date,
        dimensions,
        rowLimit,
        dataState: 'final',
      }),
      signal: controller.signal,
    }
  );
  clearTimeout(timeoutId);

  if (!response.ok) {
    throw new Error(`GSC API error: ${response.status}`);
  }

  const data = await response.json();
  return data.rows || [];
}

async function fetchGSCQueries(token: string, siteUrl: string, date: string, clientId: string) {
  const rows = await fetchGSCData(token, siteUrl, date, ['query'], 5000);

  return rows.map((row: any) => ({
    client_id: clientId,
    site_url: siteUrl,
    date,
    query: row.keys[0] || '',
    clicks: row.clicks || 0,
    impressions: row.impressions || 0,
    ctr: Math.round((row.ctr || 0) * 10000) / 100,
    position: Math.round((row.position || 0) * 10) / 10,
  }));
}

main().then(r => { console.log(JSON.stringify(r)); process.exit(0); }).catch(async e => { console.error('FAILED:', e.message); await sendTelegramMessage(`🔴 <b>Sync CRASHED</b>: ${e.message}`).catch(() => {}); process.exit(1); });

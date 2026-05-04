import { supabaseAdmin } from '../src/lib/supabase';
import { checkAndSendAlerts, saveCronStatus } from '../src/lib/telegram';

const args = process.argv.slice(2);
const getArg = (name: string): string | undefined => {
  const idx = args.indexOf('--' + name);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : undefined;
};

const BATCH_SIZE = 5;

async function runRollup(date?: string, clientId?: string, group?: string) {
  const startTime = Date.now();

  try {
    const datesToProcess: string[] = date ? [date] : (() => {
      const now = new Date();
      const caToday = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
      const dates: string[] = [];
      for (let i = 1; i <= 60; i++) {
        const d = new Date(caToday);
        d.setDate(d.getDate() - i);
        dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
      }
      return dates;
    })();

    const latestDate = datesToProcess[0];
    const oldestDate = datesToProcess[datesToProcess.length - 1];
    console.log(`[Rollup] Starting rollup for ${datesToProcess.length} dates: ${oldestDate} → ${latestDate}`);

    let clientQuery = supabaseAdmin
      .from('clients')
      .select('id, name, slug, city')
      .eq('is_active', true);

    if (clientId) {
      clientQuery = clientQuery.eq('id', clientId);
    } else if (group) {
      clientQuery = clientQuery.eq('sync_group', group);
    }

    const { data: clients, error: clientsError } = await clientQuery;

    if (clientsError) throw new Error(`Failed to fetch clients: ${clientsError.message}`);
    if (!clients || clients.length === 0) {
      return { success: true, dates: { from: oldestDate, to: latestDate }, processed: 0, message: 'No active clients found' };
    }

    console.log(`[Rollup] Processing ${clients.length} clients × ${datesToProcess.length} dates`);

    const allMetricsToSave: any[] = [];

    for (const targetDate of datesToProcess) {
      const previousDate = new Date(targetDate + 'T12:00:00Z');
      previousDate.setDate(previousDate.getDate() - 1);
      const prevDateStr = previousDate.toISOString().split('T')[0];

      const { data: previousData } = await supabaseAdmin
        .from('client_metrics_summary')
        .select('client_id, top_keywords, total_leads')
        .eq('date', prevDateStr)
        .eq('period_type', 'daily');

      const previousDataMap = new Map(
        (previousData || []).map((d: any) => [d.client_id, d])
      );

      for (let i = 0; i < clients.length; i += BATCH_SIZE) {
        const batch = clients.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map((client: any) => processClient(client, targetDate, prevDateStr, previousDataMap))
        );
        const nonGhostResults = batchResults.filter((row: any) => row !== null);
        allMetricsToSave.push(...nonGhostResults);
      }
    }

    const { error: upsertError } = await supabaseAdmin
      .from('client_metrics_summary')
      .upsert(allMetricsToSave, { onConflict: 'client_id,date,period_type' });

    if (upsertError) {
      throw new Error(`Failed to save: ${upsertError.message}`);
    }

    const duration = Date.now() - startTime;
    console.log(`[Rollup] Completed ${allMetricsToSave.length} rows in ${duration}ms`);

    checkAndSendAlerts(supabaseAdmin, latestDate).catch(err =>
      console.error('[Rollup] Alert check failed:', err)
    );

    await saveCronStatus(supabaseAdmin, 'run_rollup', {
      clients: clients.length,
      records: allMetricsToSave.length,
      errors: [],
      duration,
    }).catch(() => {});

    return {
      success: true,
      dates: { from: oldestDate, to: latestDate },
      datesProcessed: datesToProcess.length,
      processed: allMetricsToSave.length,
      duration,
    };
  } catch (error: any) {
    console.error('[Rollup] Error:', error);
    throw new Error(error.message);
  }
}

async function processClient(
  client: { id: string; name: string; slug: string; city: string },
  targetDate: string,
  prevDateStr: string,
  previousDataMap: Map<string, any>
): Promise<Record<string, any> | null> {
  const clientId = client.id;

  const [
    ga4SessionsData,
    ga4EventsData,
    ga4LandingPagesData,
    gscSummary,
    gscQueriesData,
    adsCampaignData,
    gbpData,
  ] = await Promise.all([
    supabaseAdmin
      .from('ga4_sessions')
      .select('sessions, total_users, new_users, device, source_medium, engagement_rate')
      .eq('client_id', clientId)
      .eq('date', targetDate)
      .then(r => r.data || []),
    supabaseAdmin
      .from('ga4_events')
      .select('event_name, event_count, source_medium')
      .eq('client_id', clientId)
      .eq('date', targetDate)
      .then(r => r.data || []),
    supabaseAdmin
      .from('ga4_landing_pages')
      .select('landing_page, sessions, conversions')
      .eq('client_id', clientId)
      .eq('date', targetDate)
      .then(r => r.data || []),
    supabaseAdmin
      .from('gsc_daily_summary')
      .select('total_impressions, total_clicks, top_keywords_count')
      .eq('client_id', clientId)
      .eq('date', targetDate)
      .single()
      .then(r => r.data || null),
    supabaseAdmin
      .from('gsc_queries')
      .select('query, clicks, impressions, position')
      .eq('client_id', clientId)
      .eq('date', targetDate)
      .then(r => r.data || []),
    supabaseAdmin
      .from('ads_campaign_metrics')
      .select('impressions, clicks, cost, conversions, ctr, cpc, quality_score, impression_share, search_impression_share, search_lost_is_budget')
      .eq('client_id', clientId)
      .eq('date', targetDate)
      .then(r => r.data || []),
    supabaseAdmin
      .from('gbp_location_daily_metrics')
      .select('phone_calls, website_clicks, direction_requests, views, total_reviews, new_reviews_today, average_rating, business_photo_views, posts_count, posts_views, posts_actions')
      .eq('client_id', clientId)
      .eq('date', targetDate)
      .or('fetch_status.is.null,fetch_status.neq.error')
      .then(r => r.data || []),
  ]);

  const hasAnyData =
    ga4SessionsData.length > 0 ||
    ga4EventsData.length > 0 ||
    ga4LandingPagesData.length > 0 ||
    gscSummary !== null ||
    gscQueriesData.length > 0 ||
    adsCampaignData.length > 0 ||
    gbpData.length > 0;

  if (!hasAnyData) {
    console.log(`[Rollup] Skipping ghost client ${client.name} (${clientId}) for ${targetDate} — no data from any source`);
    return null;
  }

  let sessions = 0;
  let users = 0;
  let newUsers = 0;
  let sessionsDesktop = 0;
  let sessionsMobile = 0;
  let trafficOrganic = 0;
  let trafficPaid = 0;
  let trafficDirect = 0;
  let trafficReferral = 0;
  let trafficAi = 0;
  let weightedEngagement = 0;
  let totalSessionsForEngagement = 0;

  const aggregateFallbackRow = ga4SessionsData.find((r: any) => r.source_medium === '(all) / (all)');

  if (aggregateFallbackRow) {
    users = aggregateFallbackRow.total_users || 0;
    newUsers = aggregateFallbackRow.new_users || 0;
  }

  for (const row of ga4SessionsData) {
    const isAggregateRow = row.source_medium === '(all) / (all)';
    const s = row.sessions || 0;

    if (!aggregateFallbackRow) {
      users += row.total_users || 0;
      newUsers += row.new_users || 0;
    }

    if (isAggregateRow) continue;

    sessions += s;

    const device = (row.device || '').toLowerCase();
    if (device === 'desktop') {
      sessionsDesktop += s;
    } else if (device === 'mobile' || device === 'tablet') {
      sessionsMobile += s;
    }

    const sm = (row.source_medium || '').toLowerCase();
    if (sm.includes('organic')) {
      trafficOrganic += s;
    } else if (sm.includes('cpc') || sm.includes('paid')) {
      trafficPaid += s;
    } else if (sm === '(direct) / (none)') {
      trafficDirect += s;
    } else if (sm.includes('referral')) {
      trafficReferral += s;
    }

    if (
      sm.includes('ai') ||
      sm.includes('chatgpt') || sm.includes('openai') ||
      sm.includes('perplexity') ||
      sm.includes('claude') || sm.includes('anthropic') ||
      sm.includes('gemini') || sm.includes('bard') ||
      sm.includes('copilot')
    ) {
      trafficAi += s;
    }

    if (row.engagement_rate != null && s > 0) {
      weightedEngagement += (row.engagement_rate || 0) * s;
      totalSessionsForEngagement += s;
    }
  }

  const returningUsers = Math.max(0, users - newUsers);
  const engagementRate = totalSessionsForEngagement > 0
    ? Math.round((weightedEngagement / totalSessionsForEngagement) * 10000) / 100
    : 0;

  let formFills = 0;
  for (const row of ga4EventsData) {
    const eventName = (row.event_name || '').toLowerCase();
    const sourceMedium = (row.source_medium || '').toLowerCase();
    const isPaid = sourceMedium.includes('cpc') || sourceMedium.includes('paid');
    const isSuccess = eventName.includes('success');
    if (isSuccess && !isPaid) {
      formFills += row.event_count || 0;
    }
  }

  let blogSessions = 0;

  const landingPageMap = new Map<string, { sessions: number; conversions: number }>();
  for (const row of ga4LandingPagesData) {
    const page = row.landing_page || '';
    const s = row.sessions || 0;
    const c = row.conversions || 0;

    const existing = landingPageMap.get(page) || { sessions: 0, conversions: 0 };
    landingPageMap.set(page, {
      sessions: existing.sessions + s,
      conversions: existing.conversions + c,
    });

    if (page.includes('/blog')) {
      blogSessions += s;
    }
  }

  const topLandingPages = Array.from(landingPageMap.entries())
    .sort((a, b) => b[1].sessions - a[1].sessions)
    .slice(0, 5)
    .map(([page, data]) => ({
      page,
      sessions: data.sessions,
      conversions: data.conversions,
    }));

  let brandedTraffic = 0;
  let nonBrandedTraffic = 0;
  let googleRank: number | null = null;

  const seoImpressions = gscSummary?.total_impressions || 0;
  const seoClicks = gscSummary?.total_clicks || 0;
  const topKeywords = gscSummary?.top_keywords_count || 0;

  if (gscQueriesData.length > 0) {
    const cityFull = client.city ? client.city.split(',')[0].toLowerCase().trim() : '';
    const cityWords = cityFull.split(' ').filter((w: string) => w.length > 0);
    const ambiguousWords = ['new', 'north', 'south', 'east', 'west', 'the', 'san', 'los', 'las', 'el', 'la', 'de', 'del', 'city', 'beach', 'park', 'lake', 'springs', 'hills', 'valley', 'center', 'point', 'heights'];

    const localChiroQueries = gscQueriesData.filter((q: any) => {
      const query = (q.query || '').toLowerCase();
      const hasChiro = query.includes('chiropractor') || query.includes('chiropractic');
      if (!hasChiro || !cityFull) return false;
      if (query.includes('[') || query.includes(']')) return false;
      if (query.includes(cityFull)) return true;
      const uniqueWords = cityWords.filter((w: string) => !ambiguousWords.includes(w) && w.length >= 5);
      if (uniqueWords.length > 0) {
        return uniqueWords.some((word: string) => query.includes(word));
      }
      return false;
    });

    if (localChiroQueries.length > 0) {
      const totalPosition = localChiroQueries.reduce((sum: number, q: any) => sum + (q.position || 0), 0);
      googleRank = Math.round((totalPosition / localChiroQueries.length) * 10) / 10;
    }

    const genericWords = ['chiropractic', 'chiropractor', 'chiro', 'center', 'centre', 'clinic', 'health', 'wellness', 'care', 'family', 'spine', 'rehab', 'dental', 'dr', 'the', 'of', 'and', 'physical', 'medicine', 'animal', 'first', 'healing', 'hands', 'functional'];
    const brandWords = (client.name || '').toLowerCase().split(/[\s&]+/)
      .filter((w: string) => w.length >= 3 && !genericWords.includes(w));
    const slugWords = (client.slug || '').split('-')
      .filter((w: string) => w.length >= 3 && !genericWords.includes(w));
    const allBrandWords = [...new Set([...brandWords, ...slugWords])];

    for (const q of gscQueriesData) {
      const queryLower = (q.query || '').toLowerCase();
      const isBranded = allBrandWords.length > 0 && allBrandWords.some((bw: string) => queryLower.includes(bw));
      if (isBranded) {
        brandedTraffic += q.clicks || 0;
      } else {
        nonBrandedTraffic += q.clicks || 0;
      }
    }
  }

  const seoCtr = seoImpressions > 0
    ? Math.round((seoClicks / seoImpressions) * 10000) / 100
    : 0;

  const prevData = previousDataMap.get(clientId);
  const prevTopKeywords = prevData?.top_keywords ?? 0;
  const keywordsImproved = prevTopKeywords > 0 ? Math.max(0, topKeywords - prevTopKeywords) : 0;
  const keywordsDeclined = prevTopKeywords > 0 ? Math.max(0, prevTopKeywords - topKeywords) : 0;

  let googleAdsConversions = 0;
  for (const row of adsCampaignData) {
    googleAdsConversions += row.conversions || 0;
  }
  googleAdsConversions = Math.round(googleAdsConversions);

  let adSpend = 0;
  let adsImpressions = 0;
  let adsClicks = 0;
  let adsImpressionShare = 0;
  let adsSearchLostBudget = 0;
  let adsQualityScore = 0;
  let qualityScoreCount = 0;

  for (const row of adsCampaignData) {
    adSpend += row.cost || 0;
    adsImpressions += row.impressions || 0;
    adsClicks += row.clicks || 0;

    if (row.search_impression_share) {
      adsImpressionShare = Math.max(adsImpressionShare, row.search_impression_share || 0);
    }
    if (row.search_lost_is_budget) {
      adsSearchLostBudget = Math.max(adsSearchLostBudget, row.search_lost_is_budget || 0);
    }
    if (row.quality_score && row.quality_score > 0) {
      adsQualityScore += row.quality_score;
      qualityScoreCount++;
    }
  }

  adSpend = Math.round(adSpend * 100) / 100;
  if (qualityScoreCount > 0) {
    adsQualityScore = Math.round((adsQualityScore / qualityScoreCount) * 10) / 10;
  }

  const adsCtr = adsClicks > 0 && adsImpressions > 0
    ? Math.round((adsClicks / adsImpressions) * 10000) / 100
    : 0;
  const adsAvgCpc = adsClicks > 0
    ? Math.round((adSpend / adsClicks) * 100) / 100
    : 0;
  const adsConversionRate = adsClicks > 0
    ? Math.round((googleAdsConversions / adsClicks) * 10000) / 100
    : 0;
  const adsTopImpressionRate = adsImpressionShare;

  let gbpCalls = 0;
  let gbpWebsiteClicks = 0;
  let gbpDirections = 0;
  let gbpProfileViews = 0;
  let gbpReviewsCount = 0;
  let gbpReviewsNew = 0;
  let gbpRatingAvg = 0;
  let gbpRatingCount = 0;
  let gbpPostsCount = 0;
  let gbpPostsViews = 0;
  let gbpPostsClicks = 0;

  for (const row of gbpData) {
    gbpCalls += row.phone_calls || 0;
    gbpWebsiteClicks += row.website_clicks || 0;
    gbpDirections += row.direction_requests || 0;
    gbpProfileViews += row.views || 0;
    gbpReviewsCount = Math.max(gbpReviewsCount, row.total_reviews || 0);
    gbpReviewsNew += row.new_reviews_today || 0;
    if (row.average_rating && row.average_rating > 0) {
      gbpRatingAvg += row.average_rating;
      gbpRatingCount++;
    }
    gbpPostsCount = Math.max(gbpPostsCount, row.posts_count || 0);
    gbpPostsViews += row.posts_views || 0;
    gbpPostsClicks += row.posts_actions || 0;
  }

  if (gbpRatingCount > 0) {
    gbpRatingAvg = Math.round((gbpRatingAvg / gbpRatingCount) * 10) / 10;
  }

  const totalLeads = googleAdsConversions + gbpCalls;
  const cpl = totalLeads > 0
    ? Math.round((adSpend / totalLeads) * 100) / 100
    : 0;
  const conversionRate = sessions > 0
    ? Math.round((totalLeads / sessions) * 10000) / 100
    : 0;

  let healthScore = 50;
  if (totalLeads > 0) healthScore += 15;
  if (googleRank && googleRank <= 5) healthScore += 15;
  else if (googleRank && googleRank <= 10) healthScore += 10;
  if (gbpRatingAvg >= 4.5) healthScore += 10;
  else if (gbpRatingAvg >= 4.0) healthScore += 5;
  if (gbpPostsCount > 0) healthScore += 5;
  if (gbpReviewsNew > 0) healthScore += 5;
  healthScore = Math.min(100, healthScore);

  const dayOfMonth = new Date(targetDate).getDate();
  const expectedSpendRate = dayOfMonth / 30;
  const budgetUtilization = Math.round(expectedSpendRate * 100);

  return {
    client_id: clientId,
    date: targetDate,
    period_type: 'daily',
    google_ads_conversions: googleAdsConversions,
    ad_spend: adSpend,
    form_fills: formFills,
    gbp_calls: gbpCalls,
    google_rank: googleRank,
    top_keywords: topKeywords,
    total_leads: totalLeads,
    cpl,
    sessions,
    users,
    new_users: newUsers,
    traffic_organic: trafficOrganic,
    traffic_paid: trafficPaid,
    traffic_direct: trafficDirect,
    traffic_referral: trafficReferral,
    traffic_ai: trafficAi,
    sessions_mobile: sessionsMobile,
    sessions_desktop: sessionsDesktop,
    seo_impressions: seoImpressions,
    seo_clicks: seoClicks,
    seo_ctr: seoCtr,
    branded_traffic: brandedTraffic,
    non_branded_traffic: nonBrandedTraffic,
    keywords_improved: keywordsImproved,
    keywords_declined: keywordsDeclined,
    ads_impressions: adsImpressions,
    ads_clicks: adsClicks,
    ads_phone_calls: 0,
    ads_ctr: adsCtr,
    ads_avg_cpc: adsAvgCpc,
    ads_impression_share: adsImpressionShare,
    ads_search_lost_budget: adsSearchLostBudget,
    ads_quality_score: adsQualityScore,
    ads_conversion_rate: adsConversionRate,
    ads_top_impression_rate: adsTopImpressionRate,
    gbp_website_clicks: gbpWebsiteClicks,
    gbp_directions: gbpDirections,
    gbp_profile_views: gbpProfileViews,
    gbp_reviews_count: gbpReviewsCount,
    gbp_reviews_new: gbpReviewsNew,
    gbp_rating_avg: gbpRatingAvg,
    days_since_review: 0,
    gbp_posts_count: gbpPostsCount,
    gbp_posts_views: gbpPostsViews,
    gbp_posts_clicks: gbpPostsClicks,
    days_since_post: 0,
    health_score: healthScore,
    budget_utilization: budgetUtilization,
    top_landing_pages: topLandingPages,
    blog_sessions: blogSessions,
    engagement_rate: engagementRate,
    returning_users: returningUsers,
    conversion_rate: conversionRate,
    updated_at: new Date().toISOString(),
  };
}

const group = process.env.GROUP || getArg('group');
const date = (process.env.DATE || getArg('date') || '').trim() || undefined;
runRollup(date, undefined, group || undefined).then(r => { console.log(JSON.stringify(r)); process.exit(0); }).catch(e => { console.error('Rollup FAILED:', e.message); process.exit(1); });

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const FB_GRAPH = 'https://graph.facebook.com/v19.0';

export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get('clientId');
  const dateFrom = request.nextUrl.searchParams.get('dateFrom');
  const dateTo = request.nextUrl.searchParams.get('dateTo');

  if (!clientId) return NextResponse.json({ error: 'Missing clientId' }, { status: 400 });

  const accessToken = process.env.FB_ADS_ACCESS_TOKEN;
  if (!accessToken) return NextResponse.json({ error: 'Missing FB_ADS_ACCESS_TOKEN' }, { status: 500 });

  // Get ad account ID
  const { data: client } = await supabaseAdmin
    .from('clients')
    .select('id, name, service_configs(fb_ad_account_id)')
    .eq('id', clientId)
    .single();

  const cfg = Array.isArray(client?.service_configs) ? client.service_configs[0] : client?.service_configs;
  const adAccountId = (cfg as any)?.fb_ad_account_id;
  if (!adAccountId) return NextResponse.json({ error: 'No fb_ad_account_id configured' }, { status: 404 });

  const timeRange = JSON.stringify({
    since: dateFrom || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
    until: dateTo || new Date().toISOString().split('T')[0],
  });

  const baseParams = `&time_range=${encodeURIComponent(timeRange)}&level=account&access_token=${accessToken}`;

  try {
    const [regionRes, deviceRes, actionsRes, dailyRes] = await Promise.all([
      // Region breakdown
      fetch(`${FB_GRAPH}/act_${adAccountId}/insights?fields=spend,impressions,clicks,actions&breakdowns=region${baseParams}&limit=50`),
      // Device breakdown
      fetch(`${FB_GRAPH}/act_${adAccountId}/insights?fields=spend,impressions,clicks,actions&breakdowns=device_platform${baseParams}`),
      // Actions summary (no breakdown)
      fetch(`${FB_GRAPH}/act_${adAccountId}/insights?fields=spend,impressions,clicks,reach,frequency,actions,video_avg_time_watched_actions,cost_per_action_type${baseParams}`),
      // Daily trend of actions
      fetch(`${FB_GRAPH}/act_${adAccountId}/insights?fields=spend,impressions,clicks,actions&time_increment=1${baseParams}&limit=60`),
    ]);

    const [regionData, deviceData, actionsData, dailyData] = await Promise.all([
      regionRes.json(), deviceRes.json(), actionsRes.json(), dailyData_json(dailyRes),
    ]);

    // Parse regions
    const regions = (regionData.data || []).map((r: any) => {
      const actions = parseActions(r.actions);
      return {
        region: r.region,
        spend: parseFloat(r.spend || '0'),
        impressions: parseInt(r.impressions || '0'),
        clicks: parseInt(r.clicks || '0'),
        ...actions,
      };
    }).sort((a: any, b: any) => b.spend - a.spend);

    // Parse devices
    const devices = (deviceData.data || []).map((r: any) => ({
      device: r.device_platform,
      spend: parseFloat(r.spend || '0'),
      impressions: parseInt(r.impressions || '0'),
      clicks: parseInt(r.clicks || '0'),
    })).sort((a: any, b: any) => b.spend - a.spend);

    // Parse actions summary
    const summary = actionsData.data?.[0] || {};
    const allActions = parseActions(summary.actions);
    const costPerAction = parseCostPerAction(summary.cost_per_action_type);

    // Parse daily trend
    const daily = (dailyData.data || []).map((r: any) => {
      const actions = parseActions(r.actions);
      return {
        date: r.date_start,
        spend: parseFloat(r.spend || '0'),
        impressions: parseInt(r.impressions || '0'),
        clicks: parseInt(r.clicks || '0'),
        ...actions,
      };
    });

    return NextResponse.json({
      data: {
        regions,
        devices,
        summary: {
          spend: parseFloat(summary.spend || '0'),
          impressions: parseInt(summary.impressions || '0'),
          clicks: parseInt(summary.clicks || '0'),
          reach: parseInt(summary.reach || '0'),
          frequency: parseFloat(summary.frequency || '0'),
          ...allActions,
          costPerAction,
        },
        daily,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function dailyData_json(res: Response) {
  try { return await res.json(); } catch { return { data: [] }; }
}

function parseActions(actions: any[] = []) {
  const find = (type: string) => parseInt(actions.find((a: any) => a.action_type === type)?.value || '0');
  return {
    leads: find('lead'),
    calls_placed: find('click_to_call_native_call_placed'),
    calls_confirmed: find('click_to_call_call_confirm'),
    calls_20s: find('click_to_call_native_20s_call_connect'),
    calls_60s: find('click_to_call_native_60s_call_connect'),
    messages_started: find('onsite_conversion.messaging_conversation_started_7d'),
    messages_replied: find('onsite_conversion.messaging_first_reply'),
    messages_blocked: find('onsite_conversion.messaging_block'),
    video_views: find('video_view'),
    link_clicks: find('link_click'),
    post_engagement: find('post_engagement'),
    comments: find('comment'),
    post_saves: find('onsite_conversion.post_save'),
  };
}

function parseCostPerAction(costs: any[] = []) {
  const find = (type: string) => parseFloat(costs.find((a: any) => a.action_type === type)?.value || '0');
  return {
    cost_per_lead: find('lead'),
    cost_per_call: find('click_to_call_call_confirm'),
    cost_per_message: find('onsite_conversion.messaging_conversation_started_7d'),
    cost_per_link_click: find('link_click'),
  };
}

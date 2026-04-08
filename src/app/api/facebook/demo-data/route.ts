import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/facebook/demo-data
 * Returns anonymized FB campaign data from the client with the most leads this month.
 * Used for the upsell/FOMO demo modal shown to clients without FB Ads configured.
 * Requires any active session. Campaign names are replaced with "Campaign A/B/C…".
 */
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const today = now.toISOString().split('T')[0];

  // Find client with most FB leads this month
  const { data: topRows } = await supabaseAdmin
    .from('client_metrics_summary')
    .select('client_id, fb_leads')
    .eq('period_type', 'daily')
    .gte('date', startOfMonth)
    .lte('date', today)
    .gt('fb_leads', 0)
    .order('fb_leads', { ascending: false })
    .limit(20);

  if (!topRows?.length) {
    return NextResponse.json({ error: 'No demo data available' }, { status: 404 });
  }

  // Pick the client with the most total leads
  const totals: Record<string, number> = {};
  for (const r of topRows) {
    totals[r.client_id] = (totals[r.client_id] || 0) + (r.fb_leads || 0);
  }
  const demoClientId = Object.entries(totals).sort(([, a], [, b]) => b - a)[0][0];

  // Fetch campaign metrics
  const { data: campaigns } = await supabaseAdmin
    .from('fb_campaign_metrics')
    .select('campaign_name, spend, impressions, clicks, leads, cpl, date')
    .eq('client_id', demoClientId)
    .gte('date', startOfMonth)
    .lte('date', today);

  if (!campaigns?.length) {
    return NextResponse.json({ error: 'No campaign data for demo client' }, { status: 404 });
  }

  // Aggregate by campaign name, then anonymize
  const byName: Record<string, { spend: number; impressions: number; clicks: number; leads: number }> = {};
  const byDate: Record<string, { leads: number; spend: number }> = {};

  for (const r of campaigns) {
    if (!byName[r.campaign_name]) byName[r.campaign_name] = { spend: 0, impressions: 0, clicks: 0, leads: 0 };
    byName[r.campaign_name].spend       += r.spend || 0;
    byName[r.campaign_name].impressions += r.impressions || 0;
    byName[r.campaign_name].clicks      += r.clicks || 0;
    byName[r.campaign_name].leads       += r.leads || 0;

    if (!byDate[r.date]) byDate[r.date] = { leads: 0, spend: 0 };
    byDate[r.date].leads += r.leads || 0;
    byDate[r.date].spend += r.spend || 0;
  }

  // Anonymize campaign names → Campaign A, B, C…
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const anonCampaigns = Object.entries(byName)
    .sort(([, a], [, b]) => b.leads - a.leads)
    .map(([, v], i) => ({
      name: `Campaign ${letters[i] ?? i + 1}`,
      spend: +v.spend.toFixed(2),
      impressions: v.impressions,
      clicks: v.clicks,
      leads: v.leads,
      cpl: v.leads > 0 ? +(v.spend / v.leads).toFixed(2) : 0,
      ctr: v.impressions > 0 ? +((v.clicks / v.impressions) * 100).toFixed(2) : 0,
    }));

  const dailyTrend = Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date: date.slice(5), leads: v.leads, spend: +v.spend.toFixed(2) }));

  const totalLeads    = anonCampaigns.reduce((s, c) => s + c.leads, 0);
  const totalSpend    = anonCampaigns.reduce((s, c) => s + c.spend, 0);
  const totalImpr     = anonCampaigns.reduce((s, c) => s + c.impressions, 0);
  const totalClicks   = anonCampaigns.reduce((s, c) => s + c.clicks, 0);
  const avgCpl        = totalLeads > 0 ? +(totalSpend / totalLeads).toFixed(2) : 0;
  const avgCtr        = totalImpr  > 0 ? +((totalClicks / totalImpr) * 100).toFixed(2) : 0;

  return NextResponse.json({
    period: { from: startOfMonth, to: today },
    summary: { totalLeads, totalSpend: +totalSpend.toFixed(2), totalImpressions: totalImpr, totalClicks, avgCpl, avgCtr },
    campaigns: anonCampaigns,
    dailyTrend,
  });
}

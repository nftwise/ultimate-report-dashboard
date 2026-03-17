'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import DateRangePicker from '@/components/admin/DateRangePicker';
import AdminLayout from '@/components/admin/AdminLayout';
import ClientTabBar from '@/components/admin/ClientTabBar';
import ExecutiveSummaryCards from '@/components/admin/ExecutiveSummaryCards';
import SpendVsLeadsComboChart from '@/components/admin/SpendVsLeadsComboChart';
import TopConvertingSearchTerms from '@/components/admin/TopConvertingSearchTerms';
import AdGroupPerformanceTable from '@/components/admin/AdGroupPerformanceTable';
import ServiceNotActive from '@/components/admin/ServiceNotActive';
import { createClient } from '@supabase/supabase-js';
import { fmtNum, fmtCurrency, toLocalDateStr } from '@/lib/format';

interface ClientMetrics {
  id: string;
  name: string;
  slug: string;
  city: string;
}

interface DailyMetrics {
  date: string;
  ads_impressions?: number;
  ads_clicks?: number;
  ads_ctr?: number;
  ad_spend?: number;
  cpl?: number;
  google_ads_conversions?: number;
  sessions_mobile?: number;
  sessions_desktop?: number;
}

interface ConvertingSearchTerm {
  term: string;
  impressions: number;
  clicks: number;
  conversions: number;
  cost: number;
  ctr: number;
  conversionRate: number;
}

interface Campaign {
  id: string;
  name: string;
  spend: number;
  conversions: number;
  cpl: number;
  adGroupCount: number;
}

interface AdGroup {
  campaignId: string;
  campaignName: string;
  adGroupId: string;
  adGroupName: string;
  status: 'active' | 'paused';
  impressions: number;
  clicks: number;
  ctr: number;
  cost: number;
  conversions: number;
  cpl: number;
}

// Helper function: Aggregate search terms with conversions
function aggregateConvertingTerms(data: any[]): ConvertingSearchTerm[] {
  const termMap = new Map();

  data.forEach(row => {
    const term = row.search_term;
    if (!termMap.has(term)) {
      termMap.set(term, {
        term,
        impressions: 0,
        clicks: 0,
        cost: 0,
        conversions: 0
      });
    }
    const entry = termMap.get(term);
    entry.impressions += row.impressions || 0;
    entry.clicks += row.clicks || 0;
    entry.cost += row.cost || 0;
    entry.conversions += row.conversions || 0;
  });

  return Array.from(termMap.values())
    .filter(term => term.conversions > 0)
    .map(entry => ({
      term: entry.term,
      impressions: entry.impressions,
      clicks: entry.clicks,
      conversions: entry.conversions,
      cost: entry.cost,
      ctr: entry.impressions > 0 ? (entry.clicks / entry.impressions) * 100 : 0,
      conversionRate: entry.clicks > 0 ? (entry.conversions / entry.clicks) * 100 : 0
    }))
    .sort((a, b) => b.conversions - a.conversions);
}

// Helper function: Aggregate campaigns from ads_campaign_metrics (has campaign_name)
function aggregateCampaigns(data: any[]): Campaign[] {
  const campaignMap = new Map();

  data.forEach(row => {
    const campId = row.campaign_id;
    if (!campaignMap.has(campId)) {
      campaignMap.set(campId, {
        id: campId,
        name: row.campaign_name || `Campaign ${campId}`,
        spend: 0,
        conversions: 0
      });
    }
    const camp = campaignMap.get(campId);
    camp.spend += row.cost || 0;
    camp.conversions += row.conversions || 0;
  });

  return Array.from(campaignMap.values()).map(camp => ({
    id: camp.id,
    name: camp.name,
    spend: camp.spend,
    conversions: camp.conversions,
    cpl: camp.conversions > 0 ? camp.spend / camp.conversions : 0,
    adGroupCount: 0 // populated separately via ad group count
  }));
}

// Helper function: Aggregate ad groups - SUM by ad_group_id across date range
// campaignNameMap: campaign_id → campaign_name (from ads_campaign_metrics)
function aggregateAdGroups(data: any[], campaignNameMap: Map<string, string> = new Map()): AdGroup[] {
  const groupMap = new Map();

  // Sum metrics for each ad group across all dates
  data.forEach(row => {
    const adGroupId = row.ad_group_id;
    if (!groupMap.has(adGroupId)) {
      groupMap.set(adGroupId, {
        campaignId: row.campaign_id,
        adGroupName: row.ad_group_name,
        impressions: 0,
        clicks: 0,
        cost: 0,
        conversions: 0
      });
    }
    const entry = groupMap.get(adGroupId);
    entry.impressions += row.impressions || 0;
    entry.clicks += row.clicks || 0;
    entry.cost += row.cost || 0;
    entry.conversions += row.conversions || 0;
  });

  // Convert to array and calculate derived metrics
  return Array.from(groupMap.values()).map(entry => ({
    campaignId: entry.campaignId,
    campaignName: campaignNameMap.get(entry.campaignId) || `Campaign ${entry.campaignId}`,
    adGroupId: entry.campaignId + '-' + entry.adGroupName,
    adGroupName: entry.adGroupName,
    status: entry.conversions > 0 || entry.clicks > 0 ? 'active' : 'paused',
    impressions: entry.impressions,
    clicks: entry.clicks,
    ctr: entry.impressions > 0 ? (entry.clicks / entry.impressions) * 100 : 0,
    cost: entry.cost,
    conversions: entry.conversions,
    cpl: entry.conversions > 0 ? entry.cost / entry.conversions : 0
  }));
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default function GoogleAdsPage() {
  const params = useParams();
  const clientSlug = params?.clientSlug as string;

  const [client, setClient] = useState<ClientMetrics | null>(null);
  const [dailyData, setDailyData] = useState<DailyMetrics[]>([]);
  const [convertingTerms, setConvertingTerms] = useState<ConvertingSearchTerm[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [adGroups, setAdGroups] = useState<AdGroup[]>([]);
  const [formConversions, setFormConversions] = useState<number>(0);
  const [conversionActionsData, setConversionActionsData] = useState<{ conversion_action_name: string | null; conversions: number }[]>([]);
  const [prevPeriodData, setPrevPeriodData] = useState<{ spend: number; conversions: number; clicks: number; impressions: number }>({ spend: 0, conversions: 0, clicks: 0, impressions: 0 });
  const [showAdGroups, setShowAdGroups] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedDays, setSelectedDays] = useState<7 | 30 | 90>(30);
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    return { from, to };
  });

  const handlePresetDays = (days: 7 | 30 | 90) => {
    setSelectedDays(days);
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    setDateRange({ from, to });
  };

  const handleDateRangeChange = (newRange: { from: Date; to: Date }) => {
    setDateRange(newRange);
  };

  // Fetch client
  useEffect(() => {
    const fetchClient = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/clients/list');
        const data = await response.json();

        if (data.success && data.clients) {
          const foundClient = data.clients.find((c: any) => c.slug === clientSlug);
          if (foundClient) {
            setClient(foundClient);
          }
        }
      } catch (error) {
        console.error('Error fetching client:', error);
      } finally {
        setLoading(false);
      }
    };

    if (clientSlug) {
      fetchClient();
    }
  }, [clientSlug]);

  // Fetch daily metrics from ads_campaign_metrics + conversions (Google Ads API)
  useEffect(() => {
    const fetchMetrics = async () => {
      if (!client) return;

      try {
        const dateFromISO = toLocalDateStr(dateRange.from);
        const dateToISO = toLocalDateStr(dateRange.to);

        // Fetch campaign metrics data (includes conversions — source of truth)
        const { data: campaignMetricsData } = await supabase
          .from('ads_campaign_metrics')
          .select('date, impressions, clicks, cost, conversions')
          .eq('client_id', client.id)
          .gte('date', dateFromISO)
          .lte('date', dateToISO)
          .order('date', { ascending: true });

        // Aggregate by date
        const dateMap = new Map();
        (campaignMetricsData || []).forEach(row => {
          const date = row.date;
          if (!dateMap.has(date)) {
            dateMap.set(date, {
              date,
              ads_impressions: 0,
              ads_clicks: 0,
              ads_ctr: 0,
              ad_spend: 0,
              cpl: 0,
              google_ads_conversions: 0,
              total_leads: 0,
              ads_phone_calls: 0,
              form_fills: 0,
              sessions_mobile: 0,
              sessions_desktop: 0
            });
          }
          const entry = dateMap.get(date);
          entry.ads_impressions += row.impressions || 0;
          entry.ads_clicks += row.clicks || 0;
          entry.ad_spend += row.cost || 0;
          entry.google_ads_conversions += row.conversions || 0;
          entry.total_leads += row.conversions || 0;
        });

        const aggregated = Array.from(dateMap.values());

        // Calculate CTR and CPL for each day
        aggregated.forEach(d => {
          d.ads_ctr = d.ads_impressions > 0 ? (d.ads_clicks / d.ads_impressions) * 100 : 0;
          d.cpl = d.total_leads > 0 ? d.ad_spend / d.total_leads : 0;
        });

        setDailyData(aggregated as DailyMetrics[]);
      } catch (error) {
        console.error('Error fetching metrics:', error);
      }
    };

    fetchMetrics();
  }, [client, dateRange]);

  // Fetch converting search terms
  useEffect(() => {
    const fetchTerms = async () => {
      if (!client) return;

      try {
        const dateFromISO = toLocalDateStr(dateRange.from);
        const dateToISO = toLocalDateStr(dateRange.to);

        const { data } = await supabase
          .from('campaign_search_terms')
          .select('search_term, impressions, clicks, cost, conversions')
          .eq('client_id', client.id)
          .gte('date', dateFromISO)
          .lte('date', dateToISO);

        if (data) {
          const aggregated = aggregateConvertingTerms(data);
          setConvertingTerms(aggregated);
        }
      } catch (error) {
        console.error('Error fetching search terms:', error);
        setConvertingTerms([]);
      }
    };

    fetchTerms();
  }, [client, dateRange]);

  // Fetch campaigns + ad groups together so we can pass campaign names to ad group aggregation
  useEffect(() => {
    const fetchCampaignsAndAdGroups = async () => {
      if (!client) return;

      try {
        const dateFromISO = toLocalDateStr(dateRange.from);
        const dateToISO = toLocalDateStr(dateRange.to);

        // ads_campaign_metrics has campaign_name; ads_ad_group_metrics does not
        const [{ data: campData }, { data: adGroupData }] = await Promise.all([
          supabase
            .from('ads_campaign_metrics')
            .select('campaign_id, campaign_name, cost, conversions')
            .eq('client_id', client.id)
            .gte('date', dateFromISO)
            .lte('date', dateToISO),
          supabase
            .from('ads_ad_group_metrics')
            .select('campaign_id, ad_group_id, ad_group_name, impressions, clicks, cost, conversions')
            .eq('client_id', client.id)
            .gte('date', dateFromISO)
            .lte('date', dateToISO),
        ]);

        // Build campaign_id → campaign_name map from campaign-level data
        const campaignNameMap = new Map<string, string>();
        (campData || []).forEach((row: any) => {
          if (row.campaign_name) campaignNameMap.set(row.campaign_id, row.campaign_name);
        });

        if (campData) setCampaigns(aggregateCampaigns(campData));
        if (adGroupData) setAdGroups(aggregateAdGroups(adGroupData, campaignNameMap));
      } catch (error) {
        console.error('Error fetching campaigns/ad groups:', error);
        setCampaigns([]);
        setAdGroups([]);
      }
    };

    fetchCampaignsAndAdGroups();
  }, [client, dateRange]);

  // Fetch conversions total from ads_campaign_metrics (correct, not action-level)
  // Keep campaign_conversion_actions only for the breakdown pie chart
  useEffect(() => {
    const fetchConversions = async () => {
      if (!client) return;

      try {
        const dateFromISO = toLocalDateStr(dateRange.from);
        const dateToISO = toLocalDateStr(dateRange.to);

        // Total conversions from campaign-level metrics (matches Google Ads UI)
        const { data: metricsConvData } = await supabase
          .from('ads_campaign_metrics')
          .select('conversions')
          .eq('client_id', client.id)
          .gte('date', dateFromISO)
          .lte('date', dateToISO);
        const totalConversions = (metricsConvData || []).reduce((sum: number, r: any) => sum + (r.conversions || 0), 0);
        setFormConversions(totalConversions);

        // Keep campaign_conversion_actions only for breakdown chart (action type breakdown)
        const { data: actionsData } = await supabase
          .from('campaign_conversion_actions')
          .select('conversions, conversion_action_name')
          .eq('client_id', client.id)
          .gte('date', dateFromISO)
          .lte('date', dateToISO);
        setConversionActionsData(actionsData || []);
      } catch (error) {
        console.error('Error fetching conversions:', error);
        setFormConversions(0);
      }
    };

    fetchConversions();
  }, [client, dateRange]);

  // Fetch previous period data for MoM comparison
  useEffect(() => {
    const fetchPrevPeriod = async () => {
      if (!client) return;

      const periodDays = Math.round((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
      const prevTo = new Date(dateRange.from);
      prevTo.setDate(prevTo.getDate() - 1);
      const prevFrom = new Date(prevTo);
      prevFrom.setDate(prevFrom.getDate() - periodDays);

      const prevFromISO = toLocalDateStr(prevFrom);
      const prevToISO = toLocalDateStr(prevTo);

      try {
        const { data: campaignResData } = await supabase
          .from('ads_campaign_metrics')
          .select('impressions, clicks, cost, conversions')
          .eq('client_id', client.id)
          .gte('date', prevFromISO)
          .lte('date', prevToISO);

        const prevSpend = (campaignResData || []).reduce((s, r) => s + (r.cost || 0), 0);
        const prevClicks = (campaignResData || []).reduce((s, r) => s + (r.clicks || 0), 0);
        const prevImpressions = (campaignResData || []).reduce((s, r) => s + (r.impressions || 0), 0);
        const prevConversions = (campaignResData || []).reduce((s, r) => s + (r.conversions || 0), 0);

        setPrevPeriodData({ spend: prevSpend, conversions: prevConversions, clicks: prevClicks, impressions: prevImpressions });
      } catch (error) {
        console.error('Error fetching previous period:', error);
      }
    };

    fetchPrevPeriod();
  }, [client, dateRange]);

  if (loading || !client) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f5f1ed 0, #ede8e3 100%)' }}>
        <p style={{ color: '#2c2419' }}>Loading...</p>
      </div>
    );
  }

  if (client && (client as any).services?.googleAds === false) {
    return (
      <AdminLayout>
        <ClientTabBar clientSlug={clientSlug} clientName={client?.name} clientCity={client?.city} activeTab="google-ads" />
        <ServiceNotActive
          serviceName="Google Ads"
          description="Your account does not have Google Ads configured. Contact our team to set up paid search campaigns and start driving leads."
        />
      </AdminLayout>
    );
  }

  // Calculate KPIs - ALL from Google Ads API data
  const totalSpend = dailyData.reduce((sum: number, d: any) => sum + (d.ad_spend || 0), 0);
  const totalImpressions = dailyData.reduce((sum: number, d: any) => sum + (d.ads_impressions || 0), 0);
  const totalClicks = dailyData.reduce((sum: number, d: any) => sum + (d.ads_clicks || 0), 0);
  const totalConversions = formConversions; // From ads_campaign_metrics (campaign-level, correct)

  const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00';
  const cpc = totalClicks > 0 ? (totalSpend / totalClicks).toFixed(2) : '0.00';
  const cpa = totalConversions > 0 ? (totalSpend / totalConversions).toFixed(2) : '0.00';

  // For display purposes, use totalConversions as the conversion rate
  const conversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;

  // Conversion breakdown by action type
  const conversionByType = new Map<string, number>();
  for (const row of conversionActionsData) {
    const name = row.conversion_action_name || 'Other';
    conversionByType.set(name, (conversionByType.get(name) || 0) + Math.round(row.conversions || 0));
  }
  const conversionTypes = [...conversionByType.entries()]
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  // Device data
  const totalMobileSessions = dailyData.reduce((sum: number, d: any) => sum + (d.sessions_mobile || 0), 0);
  const totalDesktopSessions = dailyData.reduce((sum: number, d: any) => sum + (d.sessions_desktop || 0), 0);

  // MoM comparison
  const periodDays = Math.round((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));

  const calcMoM = (current: number, prev: number, invert = false) => {
    if (prev === 0) return { pct: '\u2014', type: 'neutral' as const };
    const val = ((current - prev) / prev * 100);
    const pct = val.toFixed(1);
    const isUp = val > 0;
    const isGood = invert ? !isUp : isUp;
    return { pct: isUp ? `+${pct}%` : `${pct}%`, type: (isGood ? 'up' : val === 0 ? 'neutral' : 'down') as 'up' | 'down' | 'neutral' };
  };

  const prevCtr = prevPeriodData.impressions > 0 ? (prevPeriodData.clicks / prevPeriodData.impressions) * 100 : 0;
  const prevCpa = prevPeriodData.conversions > 0 ? prevPeriodData.spend / prevPeriodData.conversions : 0;
  const currentCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const currentCpa = totalConversions > 0 ? totalSpend / totalConversions : 0;

  const momSpend = calcMoM(totalSpend, prevPeriodData.spend);
  const momConversions = calcMoM(totalConversions, prevPeriodData.conversions);
  const momCpa = calcMoM(currentCpa, prevCpa, true); // invert: lower CPA is better
  const momCtr = calcMoM(currentCtr, prevCtr);

  return (
    <AdminLayout>
      <ClientTabBar clientSlug={clientSlug} clientName={client?.name} clientCity={client?.city} activeTab="google-ads" />

      <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Date Controls */}
        <div className="flex items-center justify-end gap-3 mb-6">
          <div className="flex gap-1 p-1 rounded-full" style={{ background: 'rgba(44, 36, 25, 0.05)' }}>
            {[7, 30, 90].map((days) => (
              <button
                key={days}
                onClick={() => handlePresetDays(days as 7 | 30 | 90)}
                className="px-3 py-1 rounded-full text-xs font-semibold transition"
                style={{
                  background: days === selectedDays ? '#fff' : 'transparent',
                  color: days === selectedDays ? '#2c2419' : '#5c5850',
                  cursor: 'pointer'
                }}
              >
                {days}d
              </button>
            ))}
          </div>
          <DateRangePicker dateRange={dateRange} onDateRangeChange={handleDateRangeChange} />
        </div>

        <div>
            {/* Section 1: Page Header */}
            <div className="mb-12">
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#5c5850', letterSpacing: '0.15em' }}>GOOGLE ADS ANALYTICS</span>
              <h1 className="text-4xl font-black mt-2" style={{ color: '#2c2419', letterSpacing: '-0.02em' }}>Performance Report</h1>
              <p className="text-sm mt-2" style={{ color: '#9ca3af' }}>Real-time campaign metrics and optimization insights</p>
            </div>

            {/* Section 2: Executive Summary */}
            <ExecutiveSummaryCards
              totalSpend={totalSpend}
              totalConversions={totalConversions}
              costPerLead={parseFloat(cpa)}
              conversionRate={conversionRate}
              momSpend={momSpend}
              momConversions={momConversions}
              momCpa={momCpa}
              momCtr={momCtr}
              periodLabel={`vs prev ${periodDays}d`}
            />

            {/* Section 3: Visual Trend Analysis */}
            <div className="mb-12">
              <SpendVsLeadsComboChart data={dailyData} height={350} />
            </div>

            {/* Section 3.5: Device Split */}
            {(totalMobileSessions > 0 || totalDesktopSessions > 0) && (
              <div style={{ marginBottom: '32px' }}>
                <p style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: '#5c5850',
                  margin: '0 0 16px 0'
                }}>
                  Device Split
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.9)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(44, 36, 25, 0.1)',
                    borderRadius: '16px',
                    padding: '20px',
                    boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)',
                    textAlign: 'center'
                  }}>
                    <p style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#5c5850', margin: '0 0 8px 0' }}>Mobile</p>
                    <p style={{ fontSize: '28px', fontWeight: '700', color: '#c4704f', margin: '0 0 4px 0', fontVariantNumeric: 'tabular-nums' }}>
                      {(totalMobileSessions + totalDesktopSessions) > 0 ? ((totalMobileSessions / (totalMobileSessions + totalDesktopSessions)) * 100).toFixed(1) : '0.0'}%
                    </p>
                    <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>{fmtNum(totalMobileSessions)} sessions</p>
                  </div>
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.9)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(44, 36, 25, 0.1)',
                    borderRadius: '16px',
                    padding: '20px',
                    boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)',
                    textAlign: 'center'
                  }}>
                    <p style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#5c5850', margin: '0 0 8px 0' }}>Desktop</p>
                    <p style={{ fontSize: '28px', fontWeight: '700', color: '#9db5a0', margin: '0 0 4px 0', fontVariantNumeric: 'tabular-nums' }}>
                      {(totalMobileSessions + totalDesktopSessions) > 0 ? ((totalDesktopSessions / (totalMobileSessions + totalDesktopSessions)) * 100).toFixed(1) : '0.0'}%
                    </p>
                    <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>{fmtNum(totalDesktopSessions)} sessions</p>
                  </div>
                </div>
              </div>
            )}

            {/* Section 4: Technical Deep-Dive (60/40 Layout) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '60% 40%',
              gap: '24px',
              marginBottom: '32px'
            }}>
              {/* Left Column: Top Converting Search Terms */}
              <TopConvertingSearchTerms data={convertingTerms} limit={20} />

              {/* Right Column: Conversion Breakdown + Metrics */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(44, 36, 25, 0.1)',
                borderRadius: '24px',
                padding: '24px',
                boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
              }}>
                {/* Header */}
                <div style={{ marginBottom: '24px' }}>
                  <p style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: '#5c5850',
                    margin: '0 0 8px 0'
                  }}>
                    📊 Performance Details
                  </p>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '700',
                    color: '#2c2419',
                    margin: '0 0 16px 0',
                    letterSpacing: '-0.02em'
                  }}>
                    Conversion Breakdown
                  </h3>
                  <p style={{
                    fontSize: '10px',
                    color: '#9ca3af',
                    margin: '0 0 16px 0'
                  }}>
                    From Google Ads API
                  </p>

                  {/* Summary Stats */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '12px',
                    marginTop: '12px'
                  }}>
                    {/* Cost Per Acquisition */}
                    <div style={{
                      background: 'rgba(16, 185, 129, 0.08)',
                      borderRadius: '8px',
                      padding: '12px',
                      borderLeft: '3px solid #10b981'
                    }}>
                      <p style={{
                        fontSize: '10px',
                        color: '#5c5850',
                        margin: '0 0 4px 0',
                        fontWeight: '600'
                      }}>
                        Cost Per Acquisition
                      </p>
                      <p style={{
                        fontSize: '18px',
                        fontWeight: '700',
                        color: '#10b981',
                        margin: 0
                      }}>
                        {fmtCurrency(parseFloat(cpa))}
                      </p>
                      <p style={{
                        fontSize: '10px',
                        color: '#5c5850',
                        margin: '4px 0 0 0',
                        fontWeight: '500'
                      }}>
                        {(totalClicks > 0 ? ((totalConversions / totalClicks) * 100) : 0).toFixed(1)}% conversion rate
                      </p>
                    </div>

                    {/* CPC - Cost Per Click */}
                    <div style={{
                      background: 'rgba(217, 168, 84, 0.08)',
                      borderRadius: '8px',
                      padding: '12px',
                      borderLeft: '3px solid #d9a854'
                    }}>
                      <p style={{
                        fontSize: '10px',
                        color: '#5c5850',
                        margin: '0 0 4px 0',
                        fontWeight: '600'
                      }}>
                        Cost Per Click
                      </p>
                      <p style={{
                        fontSize: '18px',
                        fontWeight: '700',
                        color: '#d9a854',
                        margin: 0
                      }}>
                        {fmtCurrency(parseFloat(cpc))}
                      </p>
                      <p style={{
                        fontSize: '10px',
                        color: '#5c5850',
                        margin: '4px 0 0 0',
                        fontWeight: '500'
                      }}>
                        {fmtNum(totalClicks)} clicks total
                      </p>
                    </div>

                    {/* CTR - Click Through Rate */}
                    <div style={{
                      background: 'rgba(157, 181, 160, 0.08)',
                      borderRadius: '8px',
                      padding: '12px',
                      borderLeft: '3px solid #9db5a0'
                    }}>
                      <p style={{
                        fontSize: '10px',
                        color: '#5c5850',
                        margin: '0 0 4px 0',
                        fontWeight: '600'
                      }}>
                        Click Through Rate
                      </p>
                      <p style={{
                        fontSize: '18px',
                        fontWeight: '700',
                        color: '#9db5a0',
                        margin: 0
                      }}>
                        {ctr}%
                      </p>
                      <p style={{
                        fontSize: '10px',
                        color: '#5c5850',
                        margin: '4px 0 0 0',
                        fontWeight: '500'
                      }}>
                        {fmtNum(totalImpressions)} impressions
                      </p>
                    </div>

                    {/* Impressions */}
                    <div style={{
                      background: 'rgba(196, 112, 79, 0.08)',
                      borderRadius: '8px',
                      padding: '12px',
                      borderLeft: '3px solid #c4704f'
                    }}>
                      <p style={{
                        fontSize: '10px',
                        color: '#5c5850',
                        margin: '0 0 4px 0',
                        fontWeight: '600'
                      }}>
                        Total Impressions
                      </p>
                      <p style={{
                        fontSize: '18px',
                        fontWeight: '700',
                        color: '#c4704f',
                        margin: 0
                      }}>
                        {fmtNum(totalImpressions)}
                      </p>
                      <p style={{
                        fontSize: '10px',
                        color: '#5c5850',
                        margin: '4px 0 0 0',
                        fontWeight: '500'
                      }}>
                        from {fmtNum(totalClicks)} clicks
                      </p>
                    </div>
                  </div>

                  {/* Conversion Type Breakdown */}
                  {conversionTypes.length > 0 && (
                    <div style={{ marginTop: '12px', borderTop: '1px solid rgba(196,112,79,0.15)', paddingTop: '12px' }}>
                      <div style={{ fontSize: '10px', fontWeight: '600', color: '#5c5850', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>Conversions by Type</div>
                      {conversionTypes.map(([name, count]) => (
                        <div key={name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                          <span style={{ color: '#5c5850' }}>{name}</span>
                          <span style={{ fontWeight: '600', color: '#2c2419' }}>{count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Summary */}
                <div style={{
                  padding: '12px',
                  background: 'rgba(44, 36, 25, 0.03)',
                  borderRadius: '8px',
                  borderLeft: '3px solid #2c2419'
                }}>
                  <p style={{
                    fontSize: '11px',
                    color: '#5c5850',
                    margin: 0,
                    lineHeight: '1.5'
                  }}>
                    {totalConversions > 0
                      ? `${fmtNum(totalConversions)} conversions from ${fmtNum(totalClicks)} clicks (${ctr}% CTR). Average cost per conversion: ${fmtCurrency(parseFloat(cpa))}.`
                      : 'No conversion data available for this period.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Section 5: Campaign Breakdown Table (collapsible) */}
            <div>
              <button
                onClick={() => setShowAdGroups(prev => !prev)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(44,36,25,0.15)',
                  borderRadius: '12px', padding: '10px 20px', cursor: 'pointer',
                  fontSize: '13px', fontWeight: '600', color: '#5c5850',
                  marginBottom: showAdGroups ? '16px' : '0'
                }}
              >
                <span>Campaign Details</span>
                <span style={{ fontSize: '10px' }}>{showAdGroups ? '▲' : '▼'}</span>
              </button>
              {showAdGroups && <AdGroupPerformanceTable data={adGroups} />}
            </div>
        </div>
      </div>
    </AdminLayout>
  );
}

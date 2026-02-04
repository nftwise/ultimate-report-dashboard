'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import DateRangePicker from '@/components/admin/DateRangePicker';
import ClientDetailsSidebar from '@/components/admin/ClientDetailsSidebar';
import ExecutiveSummaryCards from '@/components/admin/ExecutiveSummaryCards';
import SpendVsLeadsComboChart from '@/components/admin/SpendVsLeadsComboChart';
import TopConvertingSearchTerms from '@/components/admin/TopConvertingSearchTerms';
import AdGroupPerformanceTable from '@/components/admin/AdGroupPerformanceTable';
import { createClient } from '@supabase/supabase-js';

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

// Helper function: Aggregate campaigns
function aggregateCampaigns(data: any[]): Campaign[] {
  const campaignMap = new Map();

  data.forEach(row => {
    const campId = row.campaign_id;
    if (!campaignMap.has(campId)) {
      campaignMap.set(campId, {
        id: campId,
        name: row.ad_group_name,
        adGroups: new Set(),
        spend: 0,
        clicks: 0,
        conversions: 0
      });
    }
    const camp = campaignMap.get(campId);
    camp.adGroups.add(row.ad_group_name);
    camp.spend += row.cost || 0;
    camp.clicks += row.clicks || 0;
    camp.conversions += row.conversions || 0;
  });

  return Array.from(campaignMap.values()).map(camp => ({
    id: camp.id,
    name: camp.name,
    spend: camp.spend,
    conversions: camp.conversions,
    cpl: camp.conversions > 0 ? camp.spend / camp.conversions : 0,
    adGroupCount: camp.adGroups.size
  }));
}

// Helper function: Aggregate ad groups - SUM by ad_group_id across date range
function aggregateAdGroups(data: any[]): AdGroup[] {
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
    campaignName: entry.adGroupName?.split(' ')[0] || 'Campaign',
    adGroupId: entry.campaignId + '-' + entry.adGroupName, // unique key
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
  const router = useRouter();
  const params = useParams();
  const clientSlug = params?.clientSlug as string;

  const [client, setClient] = useState<ClientMetrics | null>(null);
  const [dailyData, setDailyData] = useState<DailyMetrics[]>([]);
  const [convertingTerms, setConvertingTerms] = useState<ConvertingSearchTerm[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [adGroups, setAdGroups] = useState<AdGroup[]>([]);
  const [formConversions, setFormConversions] = useState<number>(0);
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

  // Fetch daily metrics from ads_campaign_metrics (Google Ads API)
  useEffect(() => {
    const fetchMetrics = async () => {
      if (!client) return;

      try {
        const dateFromISO = dateRange.from.toISOString().split('T')[0];
        const dateToISO = dateRange.to.toISOString().split('T')[0];

        // Fetch campaign metrics data
        const { data: campaignMetricsData } = await supabase
          .from('ads_campaign_metrics')
          .select('date, impressions, clicks, cost')
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
        });

        const aggregated = Array.from(dateMap.values());

        // Calculate CTR for each day
        aggregated.forEach(d => {
          d.ads_ctr = d.ads_impressions > 0 ? (d.ads_clicks / d.ads_impressions) * 100 : 0;
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
        const dateFromISO = dateRange.from.toISOString().split('T')[0];
        const dateToISO = dateRange.to.toISOString().split('T')[0];

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

  // Fetch campaigns
  useEffect(() => {
    const fetchCampaigns = async () => {
      if (!client) return;

      try {
        const dateFromISO = dateRange.from.toISOString().split('T')[0];
        const dateToISO = dateRange.to.toISOString().split('T')[0];

        const { data } = await supabase
          .from('ads_ad_group_metrics')
          .select('campaign_id, ad_group_name, cost, conversions')
          .eq('client_id', client.id)
          .gte('date', dateFromISO)
          .lte('date', dateToISO);

        if (data) {
          const aggregated = aggregateCampaigns(data);
          setCampaigns(aggregated);
        }
      } catch (error) {
        console.error('Error fetching campaigns:', error);
        setCampaigns([]);
      }
    };

    fetchCampaigns();
  }, [client, dateRange]);

  // Fetch ad groups
  useEffect(() => {
    const fetchAdGroups = async () => {
      if (!client) return;

      try {
        const dateFromISO = dateRange.from.toISOString().split('T')[0];
        const dateToISO = dateRange.to.toISOString().split('T')[0];

        const { data } = await supabase
          .from('ads_ad_group_metrics')
          .select('campaign_id, ad_group_id, ad_group_name, impressions, clicks, cost, conversions')
          .eq('client_id', client.id)
          .gte('date', dateFromISO)
          .lte('date', dateToISO);

        if (data) {
          const aggregated = aggregateAdGroups(data);
          setAdGroups(aggregated);
        }
      } catch (error) {
        console.error('Error fetching ad groups:', error);
        setAdGroups([]);
      }
    };

    fetchAdGroups();
  }, [client, dateRange]);

  // Fetch ALL conversions from campaign_conversion_actions (Google Ads API)
  useEffect(() => {
    const fetchConversions = async () => {
      if (!client) return;

      try {
        const dateFromISO = dateRange.from.toISOString().split('T')[0];
        const dateToISO = dateRange.to.toISOString().split('T')[0];

        const { data } = await supabase
          .from('campaign_conversion_actions')
          .select('conversions, conversion_action_name')
          .eq('client_id', client.id)
          .gte('date', dateFromISO)
          .lte('date', dateToISO);

        if (data && data.length > 0) {
          // Total all conversions
          const totalConversions = data.reduce((sum: number, row: any) => sum + (row.conversions || 0), 0);
          setFormConversions(totalConversions);
        } else {
          setFormConversions(0);
        }
      } catch (error) {
        console.error('Error fetching conversions:', error);
        setFormConversions(0);
      }
    };

    fetchConversions();
  }, [client, dateRange]);

  if (loading || !client) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f5f1ed 0, #ede8e3 100%)' }}>
        <p style={{ color: '#2c2419' }}>Loading...</p>
      </div>
    );
  }

  // Calculate KPIs - ALL from Google Ads API data
  const totalSpend = dailyData.reduce((sum: number, d: any) => sum + (d.ad_spend || 0), 0);
  const totalImpressions = dailyData.reduce((sum: number, d: any) => sum + (d.ads_impressions || 0), 0);
  const totalClicks = dailyData.reduce((sum: number, d: any) => sum + (d.ads_clicks || 0), 0);
  const totalConversions = formConversions; // From campaign_conversion_actions (Google Ads API)

  const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00';
  const cpc = totalClicks > 0 ? (totalSpend / totalClicks).toFixed(2) : '0.00';
  const cpa = totalConversions > 0 ? (totalSpend / totalConversions).toFixed(2) : '0.00';

  // For display purposes, use totalConversions as the conversion rate
  const conversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;

  // Device data
  const totalMobileSessions = dailyData.reduce((sum: number, d: any) => sum + (d.sessions_mobile || 0), 0);
  const totalDesktopSessions = dailyData.reduce((sum: number, d: any) => sum + (d.sessions_desktop || 0), 0);

  return (
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(135deg, #f5f1ed 0, #ede8e3 100%)' }}>
      {/* Sidebar */}
      <ClientDetailsSidebar clientSlug={clientSlug} />

      {/* Main Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Header Navigation */}
        <nav className="sticky top-0 z-50 flex items-center gap-6 px-8 py-4" style={{
          background: 'rgba(245, 241, 237, 0.95)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(44, 36, 25, 0.1)'
        }}>
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 hover:opacity-70 transition"
            style={{ color: '#c4704f' }}
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>

          <div>
            <h1 className="text-2xl font-black" style={{ color: '#2c2419' }}>Google Ads</h1>
            <p className="text-sm" style={{ color: '#5c5850' }}>{client.name}</p>
          </div>

          <div className="ml-auto flex items-center gap-3">
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
        </nav>

        {/* Main Content Area */}
        <div className="p-8">
          <div className="max-w-7xl mx-auto">
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
            />

            {/* Section 3: Visual Trend Analysis */}
            <div className="mb-12">
              <SpendVsLeadsComboChart data={dailyData} height={350} />
            </div>

            {/* Section 4: Technical Deep-Dive (60/40 Layout) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '60% 40%',
              gap: '24px',
              marginBottom: '32px'
            }}>
              {/* Left Column: Top Converting Search Terms */}
              <TopConvertingSearchTerms data={convertingTerms} limit={20} />

              {/* Right Column: Google Ads Conversions - from campaign_conversion_actions */}
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
                    📊 Conversions
                  </p>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '700',
                    color: '#2c2419',
                    margin: '0 0 16px 0',
                    letterSpacing: '-0.02em'
                  }}>
                    Total Conversions
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
                    {/* Total Conversions */}
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
                        Total Conversions
                      </p>
                      <p style={{
                        fontSize: '18px',
                        fontWeight: '700',
                        color: '#c4704f',
                        margin: 0
                      }}>
                        {totalConversions}
                      </p>
                      <p style={{
                        fontSize: '10px',
                        color: '#5c5850',
                        margin: '4px 0 0 0',
                        fontWeight: '500'
                      }}>
                        from {totalClicks} clicks
                      </p>
                    </div>

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
                        ${cpa}
                      </p>
                      <p style={{
                        fontSize: '10px',
                        color: '#5c5850',
                        margin: '4px 0 0 0',
                        fontWeight: '500'
                      }}>
                        {totalConversions > 0 ? ((totalConversions / totalClicks) * 100).toFixed(1) : 0}% conversion rate
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
                        ${cpc}
                      </p>
                      <p style={{
                        fontSize: '10px',
                        color: '#5c5850',
                        margin: '4px 0 0 0',
                        fontWeight: '500'
                      }}>
                        {totalClicks} clicks total
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
                        {totalImpressions} impressions
                      </p>
                    </div>
                  </div>
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
                    💡 <strong>Overview:</strong> {totalConversions > 0
                      ? `${totalConversions} conversions from ${totalClicks} clicks (${ctr}% CTR). Average cost per conversion: $${cpa}.`
                      : 'No conversion data available for this period.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Section 5: Campaign Breakdown Table */}
            <AdGroupPerformanceTable data={adGroups} />
          </div>
        </div>
      </div>
    </div>
  );
}

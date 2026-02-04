'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import dynamic from 'next/dynamic';
import DateRangePicker from '@/components/admin/DateRangePicker';
import ClientDetailsSidebar from '@/components/admin/ClientDetailsSidebar';
import SpendVsLeadsComboChart from '@/components/admin/SpendVsLeadsComboChart';
import TopSearchTermsTable from '@/components/admin/TopSearchTermsTable';
import ActiveCampaignsTable from '@/components/admin/ActiveCampaignsTable';
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
}

interface SearchTerm {
  term: string;
  searches: number;
  clicks: number;
  impressions: number;
  ctr: number;
  trend?: 'up' | 'down' | 'stable';
  trendPercent?: number;
}

interface Campaign {
  id: string;
  name: string;
  adGroups: number;
  ads: number;
  status: 'active' | 'paused' | 'ended';
  spend: number;
  conversions: number;
  cpc: number;
  ctr: number;
  impressions: number;
  clicks: number;
}

// Helper function: Aggregate search terms from real data
function aggregateSearchTerms(data: any[]): SearchTerm[] {
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

  return Array.from(termMap.values()).map(entry => ({
    term: entry.term,
    searches: entry.clicks,
    clicks: entry.clicks,
    impressions: entry.impressions,
    ctr: entry.impressions > 0 ? (entry.clicks / entry.impressions) * 100 : 0,
    trend: 'stable' as const,
    trendPercent: 0
  }));
}

// Helper function: Aggregate campaigns from real data
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
        impressions: 0,
        conversions: 0
      });
    }
    const camp = campaignMap.get(campId);
    camp.adGroups.add(row.ad_group_name);
    camp.spend += row.cost || 0;
    camp.clicks += row.clicks || 0;
    camp.impressions += row.impressions || 0;
    camp.conversions += row.conversions || 0;
  });

  return Array.from(campaignMap.values()).map(camp => ({
    id: camp.id,
    name: camp.name,
    adGroups: camp.adGroups.size,
    ads: camp.adGroups.size * 4,
    status: 'active' as const,
    spend: camp.spend,
    conversions: camp.conversions,
    cpc: camp.clicks > 0 ? camp.spend / camp.clicks : 0,
    ctr: camp.impressions > 0 ? (camp.clicks / camp.impressions) * 100 : 0,
    impressions: camp.impressions,
    clicks: camp.clicks
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
  const [searchTerms, setSearchTerms] = useState<SearchTerm[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDays, setSelectedDays] = useState<7 | 30 | 90>(30);
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    return { from, to };
  });

  // Handle preset time period selection
  const handlePresetDays = (days: 7 | 30 | 90) => {
    setSelectedDays(days);
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    setDateRange({ from, to });
  };

  // Handle custom date range
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

  // Fetch Google Ads metrics
  useEffect(() => {
    const fetchMetrics = async () => {
      if (!client) return;

      try {
        const dateFromISO = dateRange.from.toISOString().split('T')[0];
        const dateToISO = dateRange.to.toISOString().split('T')[0];

        const { data: metricsData } = await supabase
          .from('client_metrics_summary')
          .select('date, ads_impressions, ads_clicks, ads_ctr, ad_spend, cpl, google_ads_conversions')
          .eq('client_id', client.id)
          .gte('date', dateFromISO)
          .lte('date', dateToISO)
          .order('date', { ascending: true });

        setDailyData((metricsData || []) as DailyMetrics[]);
      } catch (error) {
        console.error('Error fetching metrics:', error);
      }
    };

    fetchMetrics();
  }, [client, dateRange]);

  // Fetch search terms from campaign_search_terms
  useEffect(() => {
    const fetchSearchTerms = async () => {
      if (!client) return;

      try {
        const dateFromISO = dateRange.from.toISOString().split('T')[0];
        const dateToISO = dateRange.to.toISOString().split('T')[0];

        const { data, error } = await supabase
          .from('campaign_search_terms')
          .select('search_term, impressions, clicks, cost, conversions')
          .eq('client_id', client.id)
          .gte('date', dateFromISO)
          .lte('date', dateToISO);

        if (data) {
          const aggregated = aggregateSearchTerms(data);
          setSearchTerms(aggregated);
        }
      } catch (error) {
        console.error('Error fetching search terms:', error);
        setSearchTerms([]);
      }
    };

    fetchSearchTerms();
  }, [client, dateRange]);

  // Fetch campaigns from ads_ad_group_metrics
  useEffect(() => {
    const fetchCampaigns = async () => {
      if (!client) return;

      try {
        const dateFromISO = dateRange.from.toISOString().split('T')[0];
        const dateToISO = dateRange.to.toISOString().split('T')[0];

        const { data, error } = await supabase
          .from('ads_ad_group_metrics')
          .select('campaign_id, ad_group_name, impressions, clicks, cost, conversions')
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

  if (loading || !client) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f5f1ed 0, #ede8e3 100%)' }}>
        <p style={{ color: '#2c2419' }}>Loading...</p>
      </div>
    );
  }

  // Calculate metrics
  const totalSpend = dailyData.reduce((sum: number, d: any) => sum + (d.ad_spend || 0), 0);
  const totalImpressions = dailyData.reduce((sum: number, d: any) => sum + (d.ads_impressions || 0), 0);
  const totalClicks = dailyData.reduce((sum: number, d: any) => sum + (d.ads_clicks || 0), 0);
  const totalConversions = dailyData.reduce((sum: number, d: any) => sum + (d.google_ads_conversions || 0), 0);
  const avgCPC = totalClicks > 0 ? (totalSpend / totalClicks).toFixed(2) : '0.00';
  const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00';
  const cpl = totalConversions > 0 ? (totalSpend / totalConversions).toFixed(2) : '0.00';
  const conversionRate = totalClicks > 0 ? ((totalConversions / totalClicks) * 100).toFixed(2) : '0.00';

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
            {/* Section Header */}
            <div className="mb-12">
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#5c5850', letterSpacing: '0.15em' }}>GOOGLE ADS ANALYTICS</span>
              <h1 className="text-4xl font-black mt-2" style={{ color: '#2c2419', letterSpacing: '-0.02em' }}>Performance Report</h1>
              <p className="text-sm mt-2" style={{ color: '#9ca3af' }}>Real-time campaign metrics and optimization insights</p>
            </div>

            {/* GROUP 1: SPEND & REACH */}
            <div className="mb-12">
              <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: '#5c5850', letterSpacing: '0.1em' }}>💰 Spend & Reach</p>
              <div className="grid grid-cols-4 gap-6">
                {/* Total Spend */}
                <div className="rounded-2xl p-6" style={{
                  background: 'rgba(255, 255, 255, 0.9)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(44, 36, 25, 0.1)',
                  boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
                }}>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#5c5850', letterSpacing: '0.1em' }}>Total Spend</p>
                  <div className="text-3xl font-black" style={{ color: '#2c2419', marginBottom: '8px' }}>${totalSpend.toFixed(2)}</div>
                  <p className="text-xs" style={{ color: '#9ca3af' }}>Campaign budget spent</p>
                </div>

                {/* Impressions */}
                <div className="rounded-2xl p-6" style={{
                  background: 'rgba(255, 255, 255, 0.9)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(44, 36, 25, 0.1)',
                  boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
                }}>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#5c5850', letterSpacing: '0.1em' }}>Impressions</p>
                  <div className="text-3xl font-black" style={{ color: '#2c2419', marginBottom: '8px' }}>{totalImpressions.toLocaleString()}</div>
                  <p className="text-xs" style={{ color: '#9ca3af' }}>Ad impressions across all campaigns</p>
                </div>

                {/* Average CPC */}
                <div className="rounded-2xl p-6" style={{
                  background: 'rgba(255, 255, 255, 0.9)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(44, 36, 25, 0.1)',
                  boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
                }}>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#5c5850', letterSpacing: '0.1em' }}>Average CPC</p>
                  <div className="text-3xl font-black" style={{ color: '#2c2419', marginBottom: '8px' }}>${avgCPC}</div>
                  <p className="text-xs" style={{ color: '#9ca3af' }}>Cost per click</p>
                </div>

                {/* CTR */}
                <div className="rounded-2xl p-6" style={{
                  background: 'rgba(255, 255, 255, 0.9)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(44, 36, 25, 0.1)',
                  boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
                }}>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#5c5850', letterSpacing: '0.1em' }}>Click-Through Rate</p>
                  <div className="text-3xl font-black" style={{ color: '#2c2419', marginBottom: '8px' }}>{ctr}%</div>
                  <p className="text-xs" style={{ color: '#9ca3af' }}>Clicks relative to impressions</p>
                </div>
              </div>
            </div>

            {/* GROUP 2: CONVERSIONS */}
            <div className="mb-12">
              <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: '#5c5850', letterSpacing: '0.1em' }}>🎯 Conversion Performance</p>
              <div className="grid grid-cols-4 gap-6">
                {/* Total Conversions */}
                <div className="rounded-2xl p-6" style={{
                  background: 'rgba(255, 255, 255, 0.9)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(44, 36, 25, 0.1)',
                  boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
                }}>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#5c5850', letterSpacing: '0.1em' }}>Total Conversions</p>
                  <div className="text-3xl font-black" style={{ color: '#2c2419', marginBottom: '8px' }}>{totalConversions}</div>
                  <p className="text-xs" style={{ color: '#9ca3af' }}>Completed conversion actions</p>
                </div>

                {/* Cost Per Lead */}
                <div className="rounded-2xl p-6" style={{
                  background: 'rgba(255, 255, 255, 0.9)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(44, 36, 25, 0.1)',
                  boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
                }}>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#5c5850', letterSpacing: '0.1em' }}>Cost Per Lead</p>
                  <div className="text-3xl font-black" style={{ color: '#2c2419', marginBottom: '8px' }}>${cpl}</div>
                  <p className="text-xs" style={{ color: '#9ca3af' }}>Advertising cost per conversion</p>
                </div>

                {/* Total Clicks */}
                <div className="rounded-2xl p-6" style={{
                  background: 'rgba(255, 255, 255, 0.9)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(44, 36, 25, 0.1)',
                  boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
                }}>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#5c5850', letterSpacing: '0.1em' }}>Total Clicks</p>
                  <div className="text-3xl font-black" style={{ color: '#2c2419', marginBottom: '8px' }}>{totalClicks.toLocaleString()}</div>
                  <p className="text-xs" style={{ color: '#9ca3af' }}>All ad clicks generated</p>
                </div>

                {/* Conversion Rate */}
                <div className="rounded-2xl p-6" style={{
                  background: 'rgba(255, 255, 255, 0.9)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(44, 36, 25, 0.1)',
                  boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
                }}>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#5c5850', letterSpacing: '0.1em' }}>Conversion Rate</p>
                  <div className="text-3xl font-black" style={{ color: '#2c2419', marginBottom: '8px' }}>{conversionRate}%</div>
                  <p className="text-xs" style={{ color: '#9ca3af' }}>Clicks that converted to leads</p>
                </div>
              </div>
            </div>

            {/* COMBO CHART: SPEND VS LEADS */}
            <div className="mb-12">
              <SpendVsLeadsComboChart data={dailyData} height={350} />
            </div>

            {/* SEARCH TERMS TABLE */}
            <div className="mb-12">
              {searchTerms.length > 0 ? (
                <TopSearchTermsTable
                  data={searchTerms}
                  limit={5}
                />
              ) : (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.9)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(44, 36, 25, 0.1)',
                  borderRadius: '24px',
                  padding: '48px 24px',
                  textAlign: 'center',
                  boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
                }}>
                  <p style={{ color: '#5c5850', margin: 0 }}>No search term data available for this period</p>
                </div>
              )}
            </div>

            {/* GROUP 3: ACTIVE CAMPAIGNS */}
            <div className="mb-12">
              {campaigns.length > 0 ? (
                <ActiveCampaignsTable
                  data={campaigns}
                  limit={10}
                />
              ) : (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.9)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(44, 36, 25, 0.1)',
                  borderRadius: '24px',
                  padding: '48px 24px',
                  textAlign: 'center',
                  boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
                }}>
                  <p style={{ color: '#5c5850', margin: 0 }}>No campaign data available for this period</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

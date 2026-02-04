'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import DateRangePicker from '@/components/admin/DateRangePicker';
import ClientDetailsSidebar from '@/components/admin/ClientDetailsSidebar';
import ExecutiveSummaryCards from '@/components/admin/ExecutiveSummaryCards';
import SpendVsLeadsComboChart from '@/components/admin/SpendVsLeadsComboChart';
import TopConvertingSearchTerms from '@/components/admin/TopConvertingSearchTerms';
import CampaignPerformanceSummary from '@/components/admin/CampaignPerformanceSummary';
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
  efficiency: number;
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

// Helper function: Aggregate ad groups (flat)
function aggregateAdGroups(data: any[]): AdGroup[] {
  return (data || []).map((row, index) => ({
    campaignId: row.campaign_id,
    campaignName: row.ad_group_name?.split(' ')[0] || 'Campaign',
    adGroupId: row.ad_group_id,
    adGroupName: row.ad_group_name,
    status: row.conversions > 0 || row.clicks > 0 ? 'active' : 'paused',
    impressions: row.impressions || 0,
    clicks: row.clicks || 0,
    ctr: row.ctr || 0,
    cost: row.cost || 0,
    conversions: row.conversions || 0,
    cpl: row.conversions > 0 ? (row.cost || 0) / row.conversions : 0,
    efficiency: row.cost > 0 ? (row.conversions / row.cost) * 100 : 0
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

  // Fetch daily metrics
  useEffect(() => {
    const fetchMetrics = async () => {
      if (!client) return;

      try {
        const dateFromISO = dateRange.from.toISOString().split('T')[0];
        const dateToISO = dateRange.to.toISOString().split('T')[0];

        const { data: metricsData } = await supabase
          .from('client_metrics_summary')
          .select('date, ads_impressions, ads_clicks, ads_ctr, ad_spend, cpl, google_ads_conversions, sessions_mobile, sessions_desktop')
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
          .select('campaign_id, ad_group_id, ad_group_name, impressions, clicks, ctr, cost, conversions')
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

  if (loading || !client) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f5f1ed 0, #ede8e3 100%)' }}>
        <p style={{ color: '#2c2419' }}>Loading...</p>
      </div>
    );
  }

  // Calculate KPIs
  const totalSpend = dailyData.reduce((sum: number, d: any) => sum + (d.ad_spend || 0), 0);
  const totalImpressions = dailyData.reduce((sum: number, d: any) => sum + (d.ads_impressions || 0), 0);
  const totalClicks = dailyData.reduce((sum: number, d: any) => sum + (d.ads_clicks || 0), 0);
  const totalConversions = dailyData.reduce((sum: number, d: any) => sum + (d.google_ads_conversions || 0), 0);
  const cpl = totalConversions > 0 ? totalSpend / totalConversions : 0;
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
              costPerLead={cpl}
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
              <TopConvertingSearchTerms data={convertingTerms} limit={10} />

              {/* Right Column: Campaign Performance Summary */}
              <CampaignPerformanceSummary
                campaigns={campaigns}
                deviceData={{ mobileSessions: totalMobileSessions, desktopSessions: totalDesktopSessions }}
              />
            </div>

            {/* Section 5: Campaign Breakdown Table */}
            <AdGroupPerformanceTable data={adGroups} />
          </div>
        </div>
      </div>
    </div>
  );
}

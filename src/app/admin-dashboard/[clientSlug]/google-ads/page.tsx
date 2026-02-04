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
import CompetitiveAnalysisCards from '@/components/admin/CompetitiveAnalysisCards';
import DeviceLocationAnalysis from '@/components/admin/DeviceLocationAnalysis';
import { createClient } from '@supabase/supabase-js';

const DailyTrafficLineChart = dynamic(() => import('@/components/admin/DailyTrafficLineChart'), { ssr: false });

// Mock search terms generator
const generateMockSearchTerms = (dailyData: DailyMetrics[]) => {
  const totalClicks = dailyData.reduce((sum: number, d: any) => sum + (d.ads_clicks || 0), 0);
  const totalImpressions = dailyData.reduce((sum: number, d: any) => sum + (d.ads_impressions || 0), 0);

  const mockTerms = [
    { term: 'dental implants', base: 45, position: 1.2 },
    { term: 'dentist near me', base: 38, position: 1.5 },
    { term: 'cosmetic dentistry', base: 28, position: 2.1 },
    { term: 'teeth whitening', base: 22, position: 2.8 },
    { term: 'root canal treatment', base: 18, position: 3.2 }
  ];

  return mockTerms.map((term, i) => {
    const searches = Math.round(term.base * (totalClicks / 100 || 1));
    const clicks = Math.round(searches * 0.15);
    const impressions = Math.round(searches * 8);
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;

    const trends = ['up', 'down', 'stable'] as const;
    const trend = trends[i % 3];
    const trendPercent = trend === 'up' ? +(Math.random() * 25).toFixed(1) : trend === 'down' ? -(Math.random() * 15).toFixed(1) : 0;

    return {
      term: term.term,
      searches,
      clicks,
      impressions,
      ctr,
      position: term.position,
      trend,
      trendPercent: Number(trendPercent)
    };
  });
};

// Mock campaigns generator
const generateMockCampaigns = (dailyData: DailyMetrics[]) => {
  const totalSpend = dailyData.reduce((sum: number, d: any) => sum + (d.ad_spend || 0), 0);
  const totalClicks = dailyData.reduce((sum: number, d: any) => sum + (d.ads_clicks || 0), 0);
  const totalConversions = dailyData.reduce((sum: number, d: any) => sum + (d.google_ads_conversions || 0), 0);

  const campaigns = [
    { name: 'Brand - Dental Services', base: 0.35, adGroups: 12, ads: 48 },
    { name: 'Non-Brand - General Dentistry', base: 0.25, adGroups: 18, ads: 72 },
    { name: 'Procedures - Implants & Cosmetic', base: 0.20, adGroups: 14, ads: 56 },
    { name: 'Location - Local Area Targeting', base: 0.12, adGroups: 8, ads: 32 },
    { name: 'Remarketing - Website Visitors', base: 0.08, adGroups: 6, ads: 24 }
  ];

  return campaigns.map((camp, i) => {
    const spend = totalSpend * camp.base;
    const clicks = totalClicks * camp.base;
    const conversions = Math.round(totalConversions * camp.base);
    const cpc = clicks > 0 ? spend / clicks : 0;
    const impressions = clicks > 0 ? (clicks / (totalClicks / dailyData.reduce((sum: number, d: any) => sum + (d.ads_impressions || 0), 0))) : 0;
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;

    const statuses = ['active', 'active', 'active', 'active', 'paused'] as const;

    return {
      id: `campaign-${i}`,
      name: camp.name,
      adGroups: camp.adGroups,
      ads: camp.ads,
      status: statuses[i],
      spend,
      conversions,
      cpc,
      ctr,
      impressions: Math.round(impressions),
      clicks: Math.round(clicks)
    };
  });
};

// Mock competitive analysis data
const generateMockCompetitiveAnalysis = () => {
  return {
    searchImpressionShare: 42.5,
    searchImpressionShareTrend: 5.2,
    lostISBudget: 28.3,
    lostISBudgetTrend: -3.1,
    lostISRank: 18.7,
    lostISRankTrend: -2.4,
    overlappingKeywords: 156,
    topCompetitor: 'Bright Smile Dental'
  };
};

// Mock device & location data
const generateMockDeviceLocationData = (dailyData: DailyMetrics[]) => {
  const totalClicks = dailyData.reduce((sum: number, d: any) => sum + (d.ads_clicks || 0), 0);
  const totalImpressions = dailyData.reduce((sum: number, d: any) => sum + (d.ads_impressions || 0), 0);
  const totalSpend = dailyData.reduce((sum: number, d: any) => sum + (d.ad_spend || 0), 0);
  const totalConversions = dailyData.reduce((sum: number, d: any) => sum + (d.google_ads_conversions || 0), 0);

  const devices = [
    { type: 'mobile' as const, share: 0.55, ctr: 4.2, cpc: 1.45 },
    { type: 'desktop' as const, share: 0.30, ctr: 3.8, cpc: 1.65 },
    { type: 'tablet' as const, share: 0.15, ctr: 3.2, cpc: 1.52 }
  ];

  const deviceData = devices.map((device) => {
    const impressions = Math.round(totalImpressions * device.share);
    const clicks = Math.round(totalClicks * device.share);
    const conversions = Math.round(totalConversions * device.share);

    return {
      type: device.type,
      impressions,
      clicks,
      ctr: device.ctr,
      conversions,
      cpc: device.cpc
    };
  });

  const locations = [
    { location: 'New York, NY', share: 0.35, roi: 185 },
    { location: 'Los Angeles, CA', share: 0.22, roi: 156 },
    { location: 'Chicago, IL', share: 0.18, roi: 142 },
    { location: 'Houston, TX', share: 0.15, roi: 128 },
    { location: 'Phoenix, AZ', share: 0.10, roi: 98 }
  ];

  const locationData = locations.map((loc) => {
    const impressions = Math.round(totalImpressions * loc.share);
    const clicks = Math.round(totalClicks * loc.share);
    const conversions = Math.round(totalConversions * loc.share);
    const spend = totalSpend * loc.share;

    return {
      location: loc.location,
      impressions,
      clicks,
      conversions,
      spend,
      roi: loc.roi
    };
  });

  return { deviceData, locationData };
};

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
            <div className="mb-8">
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#5c5850', letterSpacing: '0.15em' }}>Google Ads Analytics</span>
              <h1 className="text-4xl font-black mt-2" style={{ color: '#2c2419', letterSpacing: '-0.02em' }}>Performance Report</h1>
            </div>

            {/* GROUP 1: SPEND & REACH */}
            <div className="mb-8">
              <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: '#5c5850', letterSpacing: '0.1em' }}>📊 Nhóm 1: Chi tiêu & Phủ</p>
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
                  <p className="text-xs" style={{ color: '#9ca3af' }}>Tổng chi phí</p>
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
                  <p className="text-xs" style={{ color: '#9ca3af' }}>Lượt hiển thị</p>
                </div>

                {/* Average CPC */}
                <div className="rounded-2xl p-6" style={{
                  background: 'rgba(255, 255, 255, 0.9)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(44, 36, 25, 0.1)',
                  boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
                }}>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#5c5850', letterSpacing: '0.1em' }}>Avg CPC</p>
                  <div className="text-3xl font-black" style={{ color: '#2c2419', marginBottom: '8px' }}>${avgCPC}</div>
                  <p className="text-xs" style={{ color: '#9ca3af' }}>Giá mỗi nhấp</p>
                </div>

                {/* CTR */}
                <div className="rounded-2xl p-6" style={{
                  background: 'rgba(255, 255, 255, 0.9)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(44, 36, 25, 0.1)',
                  boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
                }}>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#5c5850', letterSpacing: '0.1em' }}>CTR</p>
                  <div className="text-3xl font-black" style={{ color: '#2c2419', marginBottom: '8px' }}>{ctr}%</div>
                  <p className="text-xs" style={{ color: '#9ca3af' }}>Tỷ lệ nhấp</p>
                </div>
              </div>
            </div>

            {/* GROUP 2: CONVERSIONS */}
            <div className="mb-8">
              <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: '#5c5850', letterSpacing: '0.1em' }}>🎯 Nhóm 2: Hiệu suất Chuyển đổi</p>
              <div className="grid grid-cols-4 gap-6">
                {/* Total Conversions */}
                <div className="rounded-2xl p-6" style={{
                  background: 'rgba(255, 255, 255, 0.9)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(44, 36, 25, 0.1)',
                  boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
                }}>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#5c5850', letterSpacing: '0.1em' }}>Conversions</p>
                  <div className="text-3xl font-black" style={{ color: '#2c2419', marginBottom: '8px' }}>{totalConversions}</div>
                  <p className="text-xs" style={{ color: '#9ca3af' }}>Tổng chuyển đổi</p>
                </div>

                {/* CPL */}
                <div className="rounded-2xl p-6" style={{
                  background: 'rgba(255, 255, 255, 0.9)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(44, 36, 25, 0.1)',
                  boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
                }}>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#5c5850', letterSpacing: '0.1em' }}>CPL</p>
                  <div className="text-3xl font-black" style={{ color: '#2c2419', marginBottom: '8px' }}>${cpl}</div>
                  <p className="text-xs" style={{ color: '#9ca3af' }}>Chi phí mỗi lead</p>
                </div>

                {/* Total Clicks */}
                <div className="rounded-2xl p-6" style={{
                  background: 'rgba(255, 255, 255, 0.9)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(44, 36, 25, 0.1)',
                  boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
                }}>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#5c5850', letterSpacing: '0.1em' }}>Clicks</p>
                  <div className="text-3xl font-black" style={{ color: '#2c2419', marginBottom: '8px' }}>{totalClicks.toLocaleString()}</div>
                  <p className="text-xs" style={{ color: '#9ca3af' }}>Tổng lượt nhấp</p>
                </div>

                {/* Conversion Rate */}
                <div className="rounded-2xl p-6" style={{
                  background: 'rgba(255, 255, 255, 0.9)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(44, 36, 25, 0.1)',
                  boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
                }}>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#5c5850', letterSpacing: '0.1em' }}>Conv. Rate</p>
                  <div className="text-3xl font-black" style={{ color: '#2c2419', marginBottom: '8px' }}>{conversionRate}%</div>
                  <p className="text-xs" style={{ color: '#9ca3af' }}>Tỷ lệ chuyển</p>
                </div>
              </div>
            </div>

            {/* COMBO CHART: SPEND VS LEADS */}
            <div className="mb-8">
              <SpendVsLeadsComboChart data={dailyData} height={350} />
            </div>

            {/* SEARCH TERMS TABLE */}
            <div className="mb-8">
              <TopSearchTermsTable
                data={generateMockSearchTerms(dailyData)}
                limit={5}
              />
            </div>

            {/* GROUP 3: CAMPAIGNS */}
            <div className="mb-8">
              <ActiveCampaignsTable
                data={generateMockCampaigns(dailyData)}
                limit={10}
              />
            </div>

            {/* GROUP 4: COMPETITIVE ANALYSIS */}
            <div className="mb-8">
              <CompetitiveAnalysisCards
                data={generateMockCompetitiveAnalysis()}
              />
            </div>

            {/* GROUP 5: DEVICE & LOCATION */}
            <div>
              {(() => {
                const { deviceData, locationData } = generateMockDeviceLocationData(dailyData);
                return (
                  <DeviceLocationAnalysis
                    deviceData={deviceData}
                    locationData={locationData}
                  />
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

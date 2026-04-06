'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import ClientTabBar from '@/components/admin/ClientTabBar';
import { fmtNum, fmtCurrency } from '@/lib/format';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Line, ComposedChart,
  AreaChart, Area,
} from 'recharts';

interface FBLead {
  id: string;
  name: string;
  phone: string;
  email?: string;
  status: string;
  lead_source: string;
  created_at: string;
  last_contacted_at?: string;
}

interface SMSMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  body: string;
  sent_at: string;
}

interface Sequence {
  id: string;
  name: string;
  steps: Array<{ day: number; message: string }>;
  is_active: boolean;
}

interface FBCampaign {
  campaign_id: string;
  campaign_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  cpl: number;
}

interface AgeGenderRow {
  age: string;
  gender: string;
  spend: number;
  impressions: number;
  clicks: number;
  cpl: number;
}

interface PlacementRow {
  publisher_platform: string;
  placement: string;
  spend: number;
  impressions: number;
  clicks: number;
  cpl: number;
}

interface AdCreativeRow {
  campaign_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  ctr: number;
}

interface HourlyRow {
  hour: number;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
}

interface DetailedInsights {
  regions: Array<{ region: string; spend: number; impressions: number; clicks: number; leads: number; calls_placed: number; calls_60s: number }>;
  devices: Array<{ device: string; spend: number; impressions: number; clicks: number }>;
  summary: {
    spend: number; impressions: number; clicks: number; reach: number; frequency: number;
    leads: number; calls_placed: number; calls_confirmed: number; calls_20s: number; calls_60s: number;
    messages_started: number; messages_replied: number; messages_blocked: number;
    video_views: number; link_clicks: number; post_engagement: number; comments: number; post_saves: number;
    costPerAction: { cost_per_lead: number; cost_per_call: number; cost_per_message: number; cost_per_link_click: number };
  };
  daily: Array<{ date: string; spend: number; impressions: number; clicks: number; leads: number; calls_placed: number; calls_60s: number; messages_started: number; video_views: number }>;
}

const PIE_COLORS = ['#c4704f', '#d9a854', '#9db5a0', '#10b981', '#6366f1', '#ec4899'];

// Default date range: last 30 days
function getDefaultDates() {
  const now = new Date();
  const to = now.toISOString().split('T')[0];
  const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];
  return { from, to };
}

const sectionCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.9)',
  backdropFilter: 'blur(10px)',
  borderRadius: '16px',
  border: '1px solid rgba(255,255,255,0.6)',
  padding: '24px',
  marginBottom: '24px',
  boxShadow: '0 4px 24px rgba(44,36,25,0.08)',
};

const sectionHeader: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: 700,
  color: '#2c2419',
  marginBottom: '16px',
  margin: 0,
};

export default function FacebookPage() {
  const params = useParams();
  const clientSlug = (params?.clientSlug as string) ?? '';

  const { from: defaultFrom, to: defaultTo } = getDefaultDates();

  const [clientData, setClientData] = useState<any>(null);
  const [leads, setLeads] = useState<FBLead[]>([]);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [adsCampaigns, setAdsCampaigns] = useState<FBCampaign[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [ageGenderData, setAgeGenderData] = useState<AgeGenderRow[]>([]);
  const [placementData, setPlacementData] = useState<PlacementRow[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [loadingAds, setLoadingAds] = useState(false);
  const [loadingBreakdowns, setLoadingBreakdowns] = useState(false);
  const [adCreativeData, setAdCreativeData] = useState<AdCreativeRow[]>([]);
  const [hourlyData, setHourlyData] = useState<HourlyRow[]>([]);
  const [loadingCreative, setLoadingCreative] = useState(false);
  const [loadingHourly, setLoadingHourly] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showAddLead, setShowAddLead] = useState(false);
  const [showNewSequence, setShowNewSequence] = useState(false);
  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);
  const [detailedInsights, setDetailedInsights] = useState<DetailedInsights | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  // KPI calculations
  const totalLeads = leads.length;
  const contactedLeads = leads.filter(l => ['contacted', 'responded', 'converted'].includes(l.status)).length;
  const respondedLeads = leads.filter(l => ['responded', 'converted'].includes(l.status)).length;
  const convertedLeads = leads.filter(l => l.status === 'converted').length;
  const responseRate = contactedLeads > 0 ? ((respondedLeads / contactedLeads) * 100).toFixed(1) : '0';

  // Filtered leads
  const filteredLeads = selectedStatus === 'all'
    ? leads
    : leads.filter(l => l.status === selectedStatus);

  // Ad Performance KPIs
  const totalSpend = adsCampaigns.reduce((s, c) => s + c.spend, 0);
  const totalFBLeads = adsCampaigns.reduce((s, c) => s + c.leads, 0);
  const totalImpressions = adsCampaigns.reduce((s, c) => s + c.impressions, 0);
  const totalClicks = adsCampaigns.reduce((s, c) => s + c.clicks, 0);
  const cpl = totalFBLeads > 0 ? totalSpend / totalFBLeads : 0;
  const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) + '%' : '0.00%';

  useEffect(() => {
    const fetchClientData = async () => {
      try {
        const res = await fetch('/api/clients/list');
        if (!res.ok) {
          console.error('[FB Page] /api/clients/list returned', res.status);
          return;
        }
        const json = await res.json();
        const list = json.clients || json.data || [];
        const client = list.find((c: any) => c.slug === clientSlug);
        if (client) {
          setClientData(client);
        } else {
          console.error('[FB Page] Client not found for slug:', clientSlug, 'list length:', list.length);
        }
      } catch (err) {
        console.error('[FB Page] Failed to load client data:', err);
      }
    };
    fetchClientData();
  }, [clientSlug]);

  useEffect(() => {
    if (!clientData?.id) return;

    const fetchData = async () => {
      setLoadingLeads(true);
      setFetchError(null);
      try {
        // Fetch leads
        const leadsRes = await fetch(`/api/facebook/leads?clientId=${clientData.id}`);
        const leadsJson = await leadsRes.json();
        if (!leadsRes.ok) {
          console.error('[FB Page] Leads API error:', leadsJson);
          setFetchError(`Leads API error: ${leadsJson.error || leadsRes.status}`);
        } else {
          setLeads(leadsJson.data || []);
        }

        // Fetch sequences
        const seqRes = await fetch(`/api/facebook/sequences?clientId=${clientData.id}`);
        const seqJson = await seqRes.json();
        if (!seqRes.ok) {
          console.error('[FB Page] Sequences API error:', seqJson);
        } else {
          setSequences(seqJson.data || []);
        }
      } catch (error) {
        console.error('[FB Page] Error fetching data:', error);
        setFetchError(String(error));
      } finally {
        setLoadingLeads(false);
      }
    };

    fetchData();
  }, [clientData?.id]);

  // Fetch FB Ads campaign metrics + breakdowns whenever client or date range changes
  useEffect(() => {
    if (!clientData?.id) return;

    const fetchAdsMetrics = async () => {
      setLoadingAds(true);
      try {
        const res = await fetch(
          `/api/facebook/ads-metrics?clientId=${clientData.id}&dateFrom=${dateFrom}&dateTo=${dateTo}`
        );
        const json = await res.json();
        if (!res.ok) {
          console.error('[FB Page] Ads metrics API error:', json);
        } else {
          setAdsCampaigns(json.data || []);
        }
      } catch (err) {
        console.error('[FB Page] Error fetching ads metrics:', err);
      } finally {
        setLoadingAds(false);
      }
    };

    const fetchBreakdowns = async () => {
      setLoadingBreakdowns(true);
      try {
        const [ageRes, placementRes] = await Promise.all([
          fetch(`/api/facebook/age-gender-metrics?clientId=${clientData.id}&dateFrom=${dateFrom}&dateTo=${dateTo}`),
          fetch(`/api/facebook/placement-metrics?clientId=${clientData.id}&dateFrom=${dateFrom}&dateTo=${dateTo}`),
        ]);

        const ageJson = await ageRes.json();
        if (!ageRes.ok) {
          console.error('[FB Page] Age/gender metrics API error:', ageJson);
        } else {
          setAgeGenderData(ageJson.data || []);
        }

        const placementJson = await placementRes.json();
        if (!placementRes.ok) {
          console.error('[FB Page] Placement metrics API error:', placementJson);
        } else {
          setPlacementData(placementJson.data || []);
        }
      } catch (err) {
        console.error('[FB Page] Error fetching breakdown metrics:', err);
      } finally {
        setLoadingBreakdowns(false);
      }
    };

    const fetchCreativeMetrics = async () => {
      setLoadingCreative(true);
      try {
        const res = await fetch(
          `/api/facebook/ad-creative-metrics?clientId=${clientData.id}&dateFrom=${dateFrom}&dateTo=${dateTo}`
        );
        const json = await res.json();
        if (res.ok) {
          setAdCreativeData(json.data || []);
        } else {
          console.error('[FB Page] Ad creative metrics API error:', json);
        }
      } catch (err) {
        console.error('[FB Page] Error fetching ad creative metrics:', err);
      } finally {
        setLoadingCreative(false);
      }
    };

    const fetchHourlyMetrics = async () => {
      setLoadingHourly(true);
      try {
        const res = await fetch(
          `/api/facebook/hourly-metrics?clientId=${clientData.id}&dateFrom=${dateFrom}&dateTo=${dateTo}`
        );
        const json = await res.json();
        if (res.ok) {
          setHourlyData(json.data || []);
        } else {
          console.error('[FB Page] Hourly metrics API error:', json);
        }
      } catch (err) {
        console.error('[FB Page] Error fetching hourly metrics:', err);
      } finally {
        setLoadingHourly(false);
      }
    };

    const fetchDetailedInsights = async () => {
      setLoadingInsights(true);
      try {
        const res = await fetch(
          `/api/facebook/detailed-insights?clientId=${clientData.id}&dateFrom=${dateFrom}&dateTo=${dateTo}`
        );
        const json = await res.json();
        if (res.ok) {
          setDetailedInsights(json.data || null);
        } else {
          console.error('[FB Page] Detailed insights API error:', json);
        }
      } catch (err) {
        console.error('[FB Page] Error fetching detailed insights:', err);
      } finally {
        setLoadingInsights(false);
      }
    };

    fetchAdsMetrics();
    fetchBreakdowns();
    fetchCreativeMetrics();
    fetchHourlyMetrics();
    fetchDetailedInsights();
  }, [clientData?.id, dateFrom, dateTo]);

  const formatPlatform = (p: string) => {
    const map: Record<string, string> = {
      facebook: 'Facebook',
      instagram: 'Instagram',
      messenger: 'Messenger',
      audience_network: 'Audience Network',
    };
    return map[p?.toLowerCase()] ?? p;
  };

  const formatPlacement = (p: string) => {
    const map: Record<string, string> = {
      feed: 'Feed',
      facebook_reels: 'Reels',
      instagram_reels: 'Reels',
      stories: 'Stories',
      reels: 'Reels',
      right_hand_column: 'Right Column',
      search: 'Search',
      marketplace: 'Marketplace',
      video_feeds: 'Video Feeds',
      instream_video: 'In-Stream Video',
    };
    return map[p?.toLowerCase()] ?? p?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  if (!clientData) {
    return (
      <AdminLayout>
        <ClientTabBar clientSlug={clientSlug} activeTab="facebook" />
        <div style={{ padding: '24px' }}>
          <div>Loading...</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <ClientTabBar
        clientSlug={clientSlug}
        clientName={clientData.name}
        clientCity={clientData.city}
        activeTab="facebook"
      />

      <div style={{ padding: '24px' }}>
        {fetchError && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '16px',
            color: '#dc2626',
            fontSize: '13px',
          }}>
            Error loading data: {fetchError}
          </div>
        )}

        {/* ═══ SECTION 1: AD PERFORMANCE ═══ */}
        <div style={sectionCard}>
          {/* Section header + date range picker */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <h3 style={sectionHeader}>Ad Performance</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ color: '#6b7280', fontSize: '13px' }}>From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                style={{
                  border: '1px solid rgba(44,36,25,0.15)',
                  borderRadius: '8px',
                  padding: '6px 10px',
                  fontSize: '13px',
                  color: '#2c2419',
                  background: 'rgba(255,255,255,0.8)',
                }}
              />
              <label style={{ color: '#6b7280', fontSize: '13px' }}>To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                style={{
                  border: '1px solid rgba(44,36,25,0.15)',
                  borderRadius: '8px',
                  padding: '6px 10px',
                  fontSize: '13px',
                  color: '#2c2419',
                  background: 'rgba(255,255,255,0.8)',
                }}
              />
            </div>
          </div>

          {/* KPI row — 5 cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '16px',
            marginBottom: '24px',
          }}>
            {[
              { label: 'Total Spend', value: fmtCurrency(totalSpend) },
              { label: 'FB Leads', value: fmtNum(totalFBLeads) },
              { label: 'CPL', value: cpl > 0 ? fmtCurrency(cpl) : '—' },
              { label: 'CTR', value: ctr },
              { label: 'Impressions', value: fmtNum(totalImpressions) },
            ].map((kpi) => (
              <div
                key={kpi.label}
                style={{
                  background: 'rgba(255,255,255,0.7)',
                  borderRadius: '12px',
                  border: '1px solid rgba(44,36,25,0.08)',
                  padding: '16px 20px',
                }}
              >
                <div style={{ color: '#9ca3af', fontSize: '12px', marginBottom: '6px' }}>{kpi.label}</div>
                <div style={{ color: '#2c2419', fontSize: '24px', fontWeight: 700 }}>{kpi.value}</div>
              </div>
            ))}
          </div>

          {/* Campaigns table */}
          {loadingAds ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#9ca3af' }}>Loading ads data...</div>
          ) : adsCampaigns.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#9ca3af' }}>No campaign data found for this period.</div>
          ) : (
            <div style={{ overflowX: 'auto', marginBottom: '24px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(44,36,25,0.1)' }}>
                    {['Campaign', 'Spend', 'Impressions', 'Clicks', 'Leads', 'CPL'].map((col) => (
                      <th
                        key={col}
                        style={{
                          textAlign: col === 'Campaign' ? 'left' : 'right',
                          padding: '10px 12px',
                          color: '#6b7280',
                          fontSize: '12px',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {adsCampaigns.map((campaign, idx) => (
                    <tr
                      key={campaign.campaign_id}
                      style={{
                        background: idx % 2 === 0 ? 'transparent' : 'rgba(44,36,25,0.02)',
                        borderBottom: '1px solid rgba(44,36,25,0.05)',
                      }}
                    >
                      <td style={{ padding: '12px', color: '#2c2419', fontSize: '14px', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {campaign.campaign_name}
                      </td>
                      <td style={{ padding: '12px', color: '#2c2419', fontSize: '14px', textAlign: 'right', fontWeight: 500 }}>
                        {fmtCurrency(campaign.spend)}
                      </td>
                      <td style={{ padding: '12px', color: '#2c2419', fontSize: '14px', textAlign: 'right' }}>
                        {fmtNum(campaign.impressions)}
                      </td>
                      <td style={{ padding: '12px', color: '#2c2419', fontSize: '14px', textAlign: 'right' }}>
                        {fmtNum(campaign.clicks)}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        <span style={{
                          background: campaign.leads > 0 ? 'rgba(16,185,129,0.1)' : 'rgba(44,36,25,0.05)',
                          color: campaign.leads > 0 ? '#10b981' : '#9ca3af',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '13px',
                          fontWeight: 500,
                        }}>
                          {campaign.leads}
                        </span>
                      </td>
                      <td style={{ padding: '12px', color: campaign.cpl > 0 ? '#c4704f' : '#9ca3af', fontSize: '14px', textAlign: 'right', fontWeight: 500 }}>
                        {campaign.cpl > 0 ? fmtCurrency(campaign.cpl) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Bottom row: Age/Gender + Placement side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* Age & Gender breakdown */}
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#2c2419', marginBottom: '12px' }}>
                Age &amp; Gender Breakdown
              </h4>
              {loadingBreakdowns ? (
                <div style={{ textAlign: 'center', padding: '24px', color: '#9ca3af', fontSize: '13px' }}>Loading breakdown data...</div>
              ) : ageGenderData.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: '#9ca3af', fontSize: '13px' }}>No age/gender data found for this period.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(44,36,25,0.1)' }}>
                        {['Age Group', 'Gender', 'Spend', 'Impressions', 'Clicks', 'CPL'].map((col) => (
                          <th
                            key={col}
                            style={{
                              textAlign: col === 'Age Group' || col === 'Gender' ? 'left' : 'right',
                              padding: '8px 10px',
                              color: '#6b7280',
                              fontSize: '11px',
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ageGenderData.map((row, idx) => (
                        <tr
                          key={`${row.age}-${row.gender}-${idx}`}
                          style={{
                            background: idx % 2 === 0 ? 'transparent' : 'rgba(44,36,25,0.02)',
                            borderBottom: '1px solid rgba(44,36,25,0.05)',
                          }}
                        >
                          <td style={{ padding: '10px', color: '#2c2419', fontSize: '13px', fontWeight: 500 }}>
                            {row.age}
                          </td>
                          <td style={{ padding: '10px', fontSize: '13px' }}>
                            <span style={{
                              background: row.gender === 'female' ? 'rgba(236,72,153,0.1)' : 'rgba(59,130,246,0.1)',
                              color: row.gender === 'female' ? '#db2777' : '#3b82f6',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 500,
                              textTransform: 'capitalize',
                            }}>
                              {row.gender}
                            </span>
                          </td>
                          <td style={{ padding: '10px', color: '#2c2419', fontSize: '13px', textAlign: 'right', fontWeight: 500 }}>
                            {fmtCurrency(row.spend)}
                          </td>
                          <td style={{ padding: '10px', color: '#2c2419', fontSize: '13px', textAlign: 'right' }}>
                            {fmtNum(row.impressions)}
                          </td>
                          <td style={{ padding: '10px', color: '#2c2419', fontSize: '13px', textAlign: 'right' }}>
                            {fmtNum(row.clicks)}
                          </td>
                          <td style={{ padding: '10px', color: row.cpl > 0 ? '#c4704f' : '#9ca3af', fontSize: '13px', textAlign: 'right', fontWeight: 500 }}>
                            {row.cpl > 0 ? fmtCurrency(row.cpl) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Placement breakdown */}
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#2c2419', marginBottom: '12px' }}>
                Placement Breakdown
              </h4>
              {loadingBreakdowns ? (
                <div style={{ textAlign: 'center', padding: '24px', color: '#9ca3af', fontSize: '13px' }}>Loading breakdown data...</div>
              ) : placementData.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: '#9ca3af', fontSize: '13px' }}>No placement data found for this period.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(44,36,25,0.1)' }}>
                        {['Platform', 'Placement', 'Spend', 'Impressions', 'Clicks', 'CPL'].map((col) => (
                          <th
                            key={col}
                            style={{
                              textAlign: col === 'Platform' || col === 'Placement' ? 'left' : 'right',
                              padding: '8px 10px',
                              color: '#6b7280',
                              fontSize: '11px',
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {placementData.map((row, idx) => (
                        <tr
                          key={`${row.publisher_platform}-${row.placement}-${idx}`}
                          style={{
                            background: idx % 2 === 0 ? 'transparent' : 'rgba(44,36,25,0.02)',
                            borderBottom: '1px solid rgba(44,36,25,0.05)',
                          }}
                        >
                          <td style={{ padding: '10px', fontSize: '13px' }}>
                            <span style={{
                              background: row.publisher_platform?.toLowerCase() === 'instagram'
                                ? 'rgba(236,72,153,0.1)'
                                : 'rgba(59,130,246,0.1)',
                              color: row.publisher_platform?.toLowerCase() === 'instagram'
                                ? '#db2777'
                                : '#3b82f6',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 500,
                            }}>
                              {formatPlatform(row.publisher_platform)}
                            </span>
                          </td>
                          <td style={{ padding: '10px', color: '#2c2419', fontSize: '13px' }}>
                            {formatPlacement(row.placement)}
                          </td>
                          <td style={{ padding: '10px', color: '#2c2419', fontSize: '13px', textAlign: 'right', fontWeight: 500 }}>
                            {fmtCurrency(row.spend)}
                          </td>
                          <td style={{ padding: '10px', color: '#2c2419', fontSize: '13px', textAlign: 'right' }}>
                            {fmtNum(row.impressions)}
                          </td>
                          <td style={{ padding: '10px', color: '#2c2419', fontSize: '13px', textAlign: 'right' }}>
                            {fmtNum(row.clicks)}
                          </td>
                          <td style={{ padding: '10px', color: row.cpl > 0 ? '#c4704f' : '#9ca3af', fontSize: '13px', textAlign: 'right', fontWeight: 500 }}>
                            {row.cpl > 0 ? fmtCurrency(row.cpl) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* ── Ad Creative Performance + Performance by Hour ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '24px' }}>
            {/* Left: Ad Creative Performance (Pie Chart) */}
            <div style={{
              background: 'rgba(255,255,255,0.7)',
              borderRadius: '12px',
              border: '1px solid rgba(44,36,25,0.08)',
              padding: '20px',
            }}>
              <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#2c2419', marginBottom: '16px', margin: '0 0 16px 0' }}>
                Campaign Spend Distribution
              </h4>
              {loadingCreative ? (
                <div style={{ textAlign: 'center', padding: '24px', color: '#9ca3af', fontSize: '13px' }}>Loading creative data...</div>
              ) : adCreativeData.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: '#9ca3af', fontSize: '13px' }}>No campaign data found for this period.</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={adCreativeData}
                        dataKey="spend"
                        nameKey="campaign_name"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        innerRadius={45}
                        paddingAngle={2}
                        label={({ campaign_name, percent }: any) =>
                          `${(campaign_name || '').substring(0, 18)}${(campaign_name || '').length > 18 ? '...' : ''} ${(percent * 100).toFixed(0)}%`
                        }
                        labelLine={{ strokeWidth: 1 }}
                      >
                        {adCreativeData.map((_, idx) => (
                          <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => fmtCurrency(value)}
                        contentStyle={{
                          background: 'rgba(255,255,255,0.95)',
                          border: '1px solid rgba(44,36,25,0.1)',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Creative table */}
                  <div style={{ overflowX: 'auto', marginTop: '16px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(44,36,25,0.1)' }}>
                          {['Campaign', 'Spend', 'Impr.', 'Clicks', 'Leads', 'CTR'].map((col) => (
                            <th
                              key={col}
                              style={{
                                textAlign: col === 'Campaign' ? 'left' : 'right',
                                padding: '8px 8px',
                                color: '#6b7280',
                                fontSize: '11px',
                                fontWeight: 600,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {adCreativeData.map((row, idx) => (
                          <tr
                            key={row.campaign_name}
                            style={{
                              background: idx % 2 === 0 ? 'transparent' : 'rgba(44,36,25,0.02)',
                              borderBottom: '1px solid rgba(44,36,25,0.05)',
                            }}
                          >
                            <td style={{ padding: '8px', color: '#2c2419', fontSize: '12px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              <span style={{
                                display: 'inline-block',
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: PIE_COLORS[idx % PIE_COLORS.length],
                                marginRight: '6px',
                              }} />
                              {row.campaign_name}
                            </td>
                            <td style={{ padding: '8px', color: '#2c2419', fontSize: '12px', textAlign: 'right', fontWeight: 500 }}>
                              {fmtCurrency(row.spend)}
                            </td>
                            <td style={{ padding: '8px', color: '#2c2419', fontSize: '12px', textAlign: 'right' }}>
                              {fmtNum(row.impressions)}
                            </td>
                            <td style={{ padding: '8px', color: '#2c2419', fontSize: '12px', textAlign: 'right' }}>
                              {fmtNum(row.clicks)}
                            </td>
                            <td style={{ padding: '8px', textAlign: 'right' }}>
                              <span style={{
                                background: row.leads > 0 ? 'rgba(16,185,129,0.1)' : 'rgba(44,36,25,0.05)',
                                color: row.leads > 0 ? '#10b981' : '#9ca3af',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 500,
                              }}>
                                {row.leads}
                              </span>
                            </td>
                            <td style={{ padding: '8px', color: '#6b7280', fontSize: '12px', textAlign: 'right' }}>
                              {row.ctr.toFixed(2)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            {/* Right: Performance by Hour (Bar Chart) */}
            <div style={{
              background: 'rgba(255,255,255,0.7)',
              borderRadius: '12px',
              border: '1px solid rgba(44,36,25,0.08)',
              padding: '20px',
            }}>
              <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#2c2419', marginBottom: '16px', margin: '0 0 16px 0' }}>
                Performance by Hour
              </h4>
              {loadingHourly ? (
                <div style={{ textAlign: 'center', padding: '24px', color: '#9ca3af', fontSize: '13px' }}>Loading hourly data...</div>
              ) : hourlyData.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: '#9ca3af', fontSize: '13px' }}>No hourly data available.</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={250}>
                    <ComposedChart data={hourlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(44,36,25,0.1)" />
                      <XAxis
                        dataKey="hour"
                        tick={{ fontSize: 11 }}
                        tickFormatter={(h: number) => `${h}:00`}
                      />
                      <YAxis
                        yAxisId="left"
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v: number) => `$${v}`}
                        label={{ value: 'Spend ($)', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#9ca3af' } }}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={{ fontSize: 11 }}
                        label={{ value: 'Leads', angle: 90, position: 'insideRight', style: { fontSize: 11, fill: '#9ca3af' } }}
                      />
                      <Tooltip
                        contentStyle={{
                          background: 'rgba(255,255,255,0.95)',
                          border: '1px solid rgba(44,36,25,0.1)',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                        formatter={(value: number, name: string) => {
                          if (name === 'spend') return [fmtCurrency(value), 'Spend'];
                          if (name === 'leads') return [fmtNum(value), 'Leads'];
                          return [value, name];
                        }}
                        labelFormatter={(h: number) => `${h}:00 - ${h}:59`}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: '12px' }}
                        formatter={(value: string) => value === 'spend' ? 'Spend' : 'Leads'}
                      />
                      <Bar
                        yAxisId="left"
                        dataKey="spend"
                        fill="#c4704f"
                        radius={[3, 3, 0, 0]}
                        opacity={0.85}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="leads"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#10b981' }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>

                  {/* Hourly summary stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '16px' }}>
                    {(() => {
                      const peakSpendHour = hourlyData.reduce((best, h) => h.spend > best.spend ? h : best, hourlyData[0]);
                      const peakLeadsHour = hourlyData.reduce((best, h) => h.leads > best.leads ? h : best, hourlyData[0]);
                      const totalHourlyLeads = hourlyData.reduce((s, h) => s + h.leads, 0);
                      return [
                        { label: 'Peak Spend Hour', value: `${peakSpendHour.hour}:00`, sub: fmtCurrency(peakSpendHour.spend) },
                        { label: 'Peak Leads Hour', value: `${peakLeadsHour.hour}:00`, sub: `${peakLeadsHour.leads} leads` },
                        { label: 'Total Leads', value: fmtNum(totalHourlyLeads), sub: 'all hours' },
                      ];
                    })().map((stat) => (
                      <div
                        key={stat.label}
                        style={{
                          background: 'rgba(255,255,255,0.5)',
                          borderRadius: '8px',
                          border: '1px solid rgba(44,36,25,0.06)',
                          padding: '12px',
                          textAlign: 'center',
                        }}
                      >
                        <div style={{ color: '#9ca3af', fontSize: '11px', marginBottom: '4px' }}>{stat.label}</div>
                        <div style={{ color: '#2c2419', fontSize: '18px', fontWeight: 700 }}>{stat.value}</div>
                        <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '2px' }}>{stat.sub}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ═══ CALL & MESSAGING ANALYTICS ═══ */}
        <div style={sectionCard}>
          <h3 style={sectionHeader}>Call &amp; Messaging Analytics</h3>
          {loadingInsights ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#9ca3af' }}>Loading insights...</div>
          ) : !detailedInsights?.summary ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#9ca3af' }}>No detailed insights available for this period.</div>
          ) : (
            <>
              {/* 6 KPI cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                {[
                  { label: 'Calls Placed', value: fmtNum(detailedInsights.summary.calls_placed), color: '#2c2419' },
                  { label: 'Calls > 20s', value: fmtNum(detailedInsights.summary.calls_20s), color: '#2c2419' },
                  { label: 'Quality Calls > 60s', value: fmtNum(detailedInsights.summary.calls_60s), color: '#c4704f' },
                  { label: 'Messages Started', value: fmtNum(detailedInsights.summary.messages_started), color: '#6366f1' },
                  { label: 'Messages Replied', value: fmtNum(detailedInsights.summary.messages_replied), color: '#10b981' },
                  { label: 'Cost per Call', value: fmtCurrency(detailedInsights.summary.costPerAction?.cost_per_call), color: '#d9a854' },
                ].map((kpi) => (
                  <div key={kpi.label} style={{
                    background: 'rgba(255,255,255,0.7)',
                    borderRadius: '12px',
                    border: kpi.color === '#c4704f' ? '2px solid rgba(196,112,79,0.3)' : '1px solid rgba(44,36,25,0.08)',
                    padding: '16px 20px',
                  }}>
                    <div style={{ color: '#9ca3af', fontSize: '12px', marginBottom: '6px' }}>{kpi.label}</div>
                    <div style={{ color: kpi.color, fontSize: '24px', fontWeight: 700 }}>{kpi.value}</div>
                  </div>
                ))}
              </div>

              {/* Call Funnel Donut */}
              <div style={{
                background: 'rgba(255,255,255,0.7)',
                borderRadius: '12px',
                border: '1px solid rgba(44,36,25,0.08)',
                padding: '20px',
              }}>
                <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#2c2419', margin: '0 0 16px 0' }}>
                  Call Funnel
                </h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '32px', flexWrap: 'wrap' }}>
                  <ResponsiveContainer width="100%" height={250} style={{ maxWidth: 300 }}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Calls Placed', value: detailedInsights.summary.calls_placed },
                          { name: 'Confirmed', value: detailedInsights.summary.calls_confirmed },
                          { name: '> 20s', value: detailedInsights.summary.calls_20s },
                          { name: '> 60s', value: detailedInsights.summary.calls_60s },
                        ]}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        innerRadius={50}
                        paddingAngle={3}
                        label={({ name, value }: any) => `${name}: ${value}`}
                        labelLine={{ strokeWidth: 1 }}
                      >
                        {['#c4704f', '#d9a854', '#9db5a0', '#10b981'].map((color, idx) => (
                          <Cell key={idx} fill={color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: 'rgba(255,255,255,0.95)',
                          border: '1px solid rgba(44,36,25,0.1)',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[
                      { label: 'Calls Placed', value: detailedInsights.summary.calls_placed, color: '#c4704f' },
                      { label: 'Confirmed', value: detailedInsights.summary.calls_confirmed, color: '#d9a854' },
                      { label: '> 20s', value: detailedInsights.summary.calls_20s, color: '#9db5a0' },
                      { label: '> 60s (Quality)', value: detailedInsights.summary.calls_60s, color: '#10b981' },
                    ].map((item) => (
                      <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.color }} />
                        <span style={{ fontSize: '13px', color: '#2c2419' }}>{item.label}: <strong>{fmtNum(item.value)}</strong></span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Geographic Performance section removed */}

        {/* ═══ ENGAGEMENT & VIDEO ═══ */}
        <div style={sectionCard}>
          <h3 style={sectionHeader}>Engagement &amp; Video</h3>
          {loadingInsights ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#9ca3af' }}>Loading insights...</div>
          ) : !detailedInsights?.summary ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#9ca3af' }}>No detailed insights available for this period.</div>
          ) : (
            <>
              {/* 4 KPI cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                {[
                  { label: 'Video Views', value: fmtNum(detailedInsights.summary.video_views), color: '#6366f1' },
                  { label: 'Link Clicks', value: fmtNum(detailedInsights.summary.link_clicks), color: '#c4704f' },
                  { label: 'Comments', value: fmtNum(detailedInsights.summary.comments), color: '#d9a854' },
                  { label: 'Post Saves', value: fmtNum(detailedInsights.summary.post_saves), color: '#ec4899' },
                ].map((kpi) => (
                  <div key={kpi.label} style={{
                    background: 'rgba(255,255,255,0.7)',
                    borderRadius: '12px',
                    border: '1px solid rgba(44,36,25,0.08)',
                    padding: '16px 20px',
                  }}>
                    <div style={{ color: '#9ca3af', fontSize: '12px', marginBottom: '6px' }}>{kpi.label}</div>
                    <div style={{ color: kpi.color, fontSize: '24px', fontWeight: 700 }}>{kpi.value}</div>
                  </div>
                ))}
              </div>

              {/* Daily trend area chart */}
              <div style={{
                background: 'rgba(255,255,255,0.7)',
                borderRadius: '12px',
                border: '1px solid rgba(44,36,25,0.08)',
                padding: '20px',
              }}>
                <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#2c2419', margin: '0 0 16px 0' }}>
                  Daily Trend: Spend, Calls &amp; Messages
                </h4>
                {detailedInsights.daily.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px', color: '#9ca3af', fontSize: '13px' }}>No daily data available.</div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={detailedInsights.daily}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(44,36,25,0.1)" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11 }}
                        tickFormatter={(d: string) => {
                          const parts = d.split('-');
                          return `${parts[1]}/${parts[2]}`;
                        }}
                      />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          background: 'rgba(255,255,255,0.95)',
                          border: '1px solid rgba(44,36,25,0.1)',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                        formatter={(value: number, name: string) => {
                          if (name === 'spend') return [fmtCurrency(value), 'Spend'];
                          return [fmtNum(value), name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())];
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px' }} formatter={(v: string) => v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} />
                      <Area type="monotone" dataKey="spend" stroke="#c4704f" fill="rgba(196,112,79,0.15)" strokeWidth={2} />
                      <Area type="monotone" dataKey="calls_placed" stroke="#10b981" fill="rgba(16,185,129,0.1)" strokeWidth={2} />
                      <Area type="monotone" dataKey="messages_started" stroke="#6366f1" fill="rgba(99,102,241,0.1)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </>
          )}
        </div>

        {/* ═══ COST EFFICIENCY ═══ */}
        <div style={sectionCard}>
          <h3 style={sectionHeader}>Cost Efficiency</h3>
          {loadingInsights ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#9ca3af' }}>Loading insights...</div>
          ) : !detailedInsights?.summary ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#9ca3af' }}>No detailed insights available for this period.</div>
          ) : (
            <>
              {/* 4 cost cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                {[
                  { label: 'Cost per Lead', value: fmtCurrency(detailedInsights.summary.costPerAction?.cost_per_lead), color: '#c4704f' },
                  { label: 'Cost per Call', value: fmtCurrency(detailedInsights.summary.costPerAction?.cost_per_call), color: '#d9a854' },
                  { label: 'Cost per Message', value: fmtCurrency(detailedInsights.summary.costPerAction?.cost_per_message), color: '#6366f1' },
                  { label: 'Cost per Link Click', value: fmtCurrency(detailedInsights.summary.costPerAction?.cost_per_link_click), color: '#9db5a0' },
                ].map((kpi) => (
                  <div key={kpi.label} style={{
                    background: 'rgba(255,255,255,0.7)',
                    borderRadius: '12px',
                    border: '1px solid rgba(44,36,25,0.08)',
                    padding: '20px',
                    textAlign: 'center',
                  }}>
                    <div style={{ color: '#9ca3af', fontSize: '12px', marginBottom: '8px' }}>{kpi.label}</div>
                    <div style={{ color: kpi.color, fontSize: '28px', fontWeight: 700 }}>{kpi.value}</div>
                  </div>
                ))}
              </div>

              {/* Reach & Frequency */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{
                  background: 'rgba(255,255,255,0.7)',
                  borderRadius: '12px',
                  border: '1px solid rgba(44,36,25,0.08)',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}>
                  <div style={{ width: 40, height: 40, borderRadius: '10px', background: 'rgba(196,112,79,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                    👁
                  </div>
                  <div>
                    <div style={{ color: '#9ca3af', fontSize: '12px', marginBottom: '2px' }}>Reach</div>
                    <div style={{ color: '#2c2419', fontSize: '22px', fontWeight: 700 }}>{fmtNum(detailedInsights.summary.reach)}</div>
                  </div>
                </div>
                <div style={{
                  background: 'rgba(255,255,255,0.7)',
                  borderRadius: '12px',
                  border: '1px solid rgba(44,36,25,0.08)',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}>
                  <div style={{ width: 40, height: 40, borderRadius: '10px', background: 'rgba(217,168,84,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                    🔄
                  </div>
                  <div>
                    <div style={{ color: '#9ca3af', fontSize: '12px', marginBottom: '2px' }}>Frequency</div>
                    <div style={{ color: '#2c2419', fontSize: '22px', fontWeight: 700 }}>{fmtNum(detailedInsights.summary.frequency, 2)}</div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ═══ SECTION 2: LEAD CRM ═══ */}
        <div style={sectionCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={sectionHeader}>Lead Management</h3>
            <button
              onClick={() => setShowAddLead(true)}
              style={{
                background: '#c4704f',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500,
              }}
            >
              + Add Lead
            </button>
          </div>

          {/* KPI row — 4 cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '16px',
            marginBottom: '24px',
          }}>
            {[
              { label: 'Total Leads', value: fmtNum(totalLeads) },
              { label: 'Contacted', value: fmtNum(contactedLeads) },
              { label: 'Responded', value: fmtNum(respondedLeads) },
              { label: 'Response Rate', value: `${responseRate}%` },
            ].map((kpi) => (
              <div
                key={kpi.label}
                style={{
                  background: 'rgba(255,255,255,0.7)',
                  borderRadius: '12px',
                  border: '1px solid rgba(44,36,25,0.08)',
                  padding: '16px 20px',
                }}
              >
                <div style={{ color: '#9ca3af', fontSize: '12px', marginBottom: '6px' }}>{kpi.label}</div>
                <div style={{ color: '#2c2419', fontSize: '24px', fontWeight: 700 }}>{kpi.value}</div>
              </div>
            ))}
          </div>

          {/* Status filter tabs */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '1px solid rgba(44,36,25,0.1)', paddingBottom: '12px', flexWrap: 'wrap' }}>
            {['all', 'new', 'contacted', 'responded', 'converted', 'closed'].map((status) => (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                style={{
                  background: selectedStatus === status ? 'rgba(196,112,79,0.1)' : 'transparent',
                  color: selectedStatus === status ? '#c4704f' : '#6b7280',
                  border: 'none',
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  borderBottom: selectedStatus === status ? '2px solid #c4704f' : '2px solid transparent',
                  fontWeight: selectedStatus === status ? 600 : 400,
                  transition: 'all 0.15s',
                }}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>

          {/* Leads table */}
          {loadingLeads ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#9ca3af' }}>Loading leads...</div>
          ) : filteredLeads.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#9ca3af' }}>No leads found.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(44,36,25,0.1)' }}>
                    {['Name', 'Phone', 'Region', 'Source', 'Status', 'Notes', 'Created'].map((col) => (
                      <th key={col} style={{ textAlign: 'left', padding: '12px 0', color: '#6b7280', fontSize: '12px', fontWeight: 600 }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead) => (
                    <tr
                      key={lead.id}
                      style={{ borderBottom: '1px solid rgba(44,36,25,0.05)', cursor: 'pointer' }}
                    >
                      <td style={{ padding: '12px 0', color: '#2c2419' }}>{lead.name || 'N/A'}</td>
                      <td style={{ padding: '12px 0', color: '#2c2419' }}>{(lead as any).phone?.startsWith('+0') ? '—' : (lead as any).phone}</td>
                      <td style={{ padding: '12px 0' }}>
                        {(lead as any).phone_state && (
                          <span style={{
                            background: (lead as any).is_out_of_area ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                            color: (lead as any).is_out_of_area ? '#dc2626' : '#10b981',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 500,
                          }}>
                            {(lead as any).is_out_of_area ? '⚠️ ' : '✅ '}{(lead as any).phone_state}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 0' }}>
                        <span style={{
                          background: 'rgba(196,112,79,0.1)',
                          color: '#c4704f',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                        }}>
                          {lead.lead_source}
                        </span>
                      </td>
                      <td style={{ padding: '12px 0' }}>
                        <span style={{
                          background: lead.status === 'responded' ? 'rgba(16,185,129,0.1)' : 'rgba(59,130,246,0.1)',
                          color: lead.status === 'responded' ? '#10b981' : '#3b82f6',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                        }}>
                          {lead.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 0', color: '#6b7280', fontSize: '12px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {(lead as any).notes?.split('\n')[0]?.replace(/^phone_number:\s*/,'') || '—'}
                      </td>
                      <td style={{ padding: '12px 0', color: '#9ca3af', fontSize: '12px' }}>
                        {new Date(lead.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Follow-up Sequences section removed */}
      </div>
    </AdminLayout>
  );
}

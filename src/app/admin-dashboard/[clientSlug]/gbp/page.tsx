'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import DateRangePicker from '@/components/admin/DateRangePicker';
import ClientDetailsSidebar from '@/components/admin/ClientDetailsSidebar';
import { createClient } from '@supabase/supabase-js';

interface ClientMetrics {
  id: string;
  name: string;
  slug: string;
  city: string;
}

interface GBPDailyMetrics {
  date: string;
  views?: number;
  actions?: number;
  direction_requests?: number;
  phone_calls?: number;
  website_clicks?: number;
  total_reviews?: number;
  new_reviews_today?: number;
  average_rating?: number;
  business_photo_views?: number;
  customer_photo_count?: number;
  customer_photo_views?: number;
  posts_count?: number;
  posts_views?: number;
  posts_actions?: number;
}

interface GBPLocation {
  id: string;
  location_name: string;
  address?: string;
  phone?: string;
  website?: string;
  business_type?: string;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default function GBPPage() {
  const router = useRouter();
  const params = useParams();
  const clientSlug = params?.clientSlug as string;

  const [client, setClient] = useState<ClientMetrics | null>(null);
  const [dailyData, setDailyData] = useState<GBPDailyMetrics[]>([]);
  const [prevDailyData, setPrevDailyData] = useState<GBPDailyMetrics[]>([]);
  const [location, setLocation] = useState<GBPLocation | null>(null);
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

  // Fetch GBP location info
  useEffect(() => {
    const fetchLocation = async () => {
      if (!client) return;

      try {
        const { data: locData } = await supabase
          .from('gbp_locations')
          .select('id, location_name, address, phone, website, business_type')
          .eq('client_id', client.id)
          .single();

        if (locData) {
          setLocation(locData);
        }
      } catch (error) {
        console.error('Error fetching GBP location:', error);
      }
    };

    fetchLocation();
  }, [client]);

  // Fetch GBP daily metrics from BOTH tables and merge
  useEffect(() => {
    const fetchMetrics = async () => {
      if (!client) return;

      try {
        const dateFromISO = dateRange.from.toISOString().split('T')[0];
        const dateToISO = dateRange.to.toISOString().split('T')[0];

        // Fetch from gbp_location_daily_metrics (detailed GBP data)
        const { data: gbpDetailedData } = await supabase
          .from('gbp_location_daily_metrics')
          .select(`
            date,
            views,
            actions,
            direction_requests,
            phone_calls,
            website_clicks,
            total_reviews,
            new_reviews_today,
            average_rating,
            business_photo_views,
            customer_photo_count,
            customer_photo_views,
            posts_count,
            posts_views,
            posts_actions
          `)
          .eq('client_id', client.id)
          .gte('date', dateFromISO)
          .lte('date', dateToISO)
          .order('date', { ascending: true });

        // Fetch from client_metrics_summary (aggregated GBP data - different column names)
        const { data: summaryData } = await supabase
          .from('client_metrics_summary')
          .select(`
            date,
            gbp_calls,
            gbp_website_clicks,
            gbp_directions,
            gbp_profile_views,
            gbp_reviews_count,
            gbp_reviews_new,
            gbp_rating_avg,
            gbp_photos_count,
            gbp_posts_count,
            gbp_posts_views,
            gbp_posts_clicks
          `)
          .eq('client_id', client.id)
          .gte('date', dateFromISO)
          .lte('date', dateToISO)
          .order('date', { ascending: true });

        // Create maps for both data sources by date
        const detailedMap = new Map();
        (gbpDetailedData || []).forEach((row: any) => {
          detailedMap.set(row.date, row);
        });

        const summaryMap = new Map();
        (summaryData || []).forEach((row: any) => {
          summaryMap.set(row.date, row);
        });

        // Get all unique dates from both sources
        const allDates = new Set([
          ...(gbpDetailedData || []).map((r: any) => r.date),
          ...(summaryData || []).map((r: any) => r.date)
        ]);

        // Helper function: prefer non-zero value from either source
        const pickValue = (detailedVal: number | null | undefined, summaryVal: number | null | undefined): number => {
          // If detailed has a non-zero value, use it
          if (detailedVal !== null && detailedVal !== undefined && detailedVal > 0) return detailedVal;
          // Otherwise use summary value if it exists
          if (summaryVal !== null && summaryVal !== undefined && summaryVal > 0) return summaryVal;
          // Fall back to detailed value (even if 0) or 0
          return detailedVal ?? summaryVal ?? 0;
        };

        // Merge data from both sources for each date
        const mergedData: GBPDailyMetrics[] = Array.from(allDates).map(date => {
          const detailed = detailedMap.get(date);
          const summary = summaryMap.get(date);

          return {
            date,
            views: pickValue(detailed?.views, summary?.gbp_profile_views),
            actions: pickValue(detailed?.actions, null) ||
              ((summary?.gbp_calls || 0) + (summary?.gbp_website_clicks || 0) + (summary?.gbp_directions || 0)),
            direction_requests: pickValue(detailed?.direction_requests, summary?.gbp_directions),
            phone_calls: pickValue(detailed?.phone_calls, summary?.gbp_calls),
            website_clicks: pickValue(detailed?.website_clicks, summary?.gbp_website_clicks),
            total_reviews: pickValue(detailed?.total_reviews, summary?.gbp_reviews_count),
            new_reviews_today: pickValue(detailed?.new_reviews_today, summary?.gbp_reviews_new),
            average_rating: detailed?.average_rating ?? summary?.gbp_rating_avg ?? 0,
            business_photo_views: detailed?.business_photo_views || 0,
            customer_photo_count: pickValue(detailed?.customer_photo_count, summary?.gbp_photos_count),
            customer_photo_views: detailed?.customer_photo_views || 0,
            posts_count: pickValue(detailed?.posts_count, summary?.gbp_posts_count),
            posts_views: pickValue(detailed?.posts_views, summary?.gbp_posts_views),
            posts_actions: pickValue(detailed?.posts_actions, summary?.gbp_posts_clicks),
          };
        });

        // Sort by date
        mergedData.sort((a, b) => a.date.localeCompare(b.date));

        setDailyData(mergedData);

        // Fetch previous period data for MoM comparison
        const periodDays = Math.round((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
        const prevTo = new Date(dateRange.from);
        prevTo.setDate(prevTo.getDate() - 1);
        const prevFrom = new Date(prevTo);
        prevFrom.setDate(prevFrom.getDate() - periodDays);
        const prevFromISO = prevFrom.toISOString().split('T')[0];
        const prevToISO = prevTo.toISOString().split('T')[0];

        const [{ data: prevGbpData }, { data: prevSummaryData }] = await Promise.all([
          supabase
            .from('gbp_location_daily_metrics')
            .select('date, views, direction_requests, phone_calls, website_clicks')
            .eq('client_id', client.id)
            .gte('date', prevFromISO)
            .lte('date', prevToISO)
            .order('date', { ascending: true }),
          supabase
            .from('client_metrics_summary')
            .select('date, gbp_calls, gbp_website_clicks, gbp_directions, gbp_profile_views')
            .eq('client_id', client.id)
            .gte('date', prevFromISO)
            .lte('date', prevToISO)
            .order('date', { ascending: true })
        ]);

        const prevDetailedMap = new Map();
        (prevGbpData || []).forEach((row: any) => prevDetailedMap.set(row.date, row));
        const prevSummaryMap = new Map();
        (prevSummaryData || []).forEach((row: any) => prevSummaryMap.set(row.date, row));

        const prevAllDates = new Set([
          ...(prevGbpData || []).map((r: any) => r.date),
          ...(prevSummaryData || []).map((r: any) => r.date)
        ]);

        const prevMerged: GBPDailyMetrics[] = Array.from(prevAllDates).map(date => {
          const detailed = prevDetailedMap.get(date);
          const summary = prevSummaryMap.get(date);
          return {
            date,
            views: pickValue(detailed?.views, summary?.gbp_profile_views),
            direction_requests: pickValue(detailed?.direction_requests, summary?.gbp_directions),
            phone_calls: pickValue(detailed?.phone_calls, summary?.gbp_calls),
            website_clicks: pickValue(detailed?.website_clicks, summary?.gbp_website_clicks),
          };
        });

        prevMerged.sort((a, b) => a.date.localeCompare(b.date));
        setPrevDailyData(prevMerged);
      } catch (error) {
        console.error('Error fetching GBP metrics:', error);
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

  // Calculate KPIs
  const totalViews = dailyData.reduce((sum, d) => sum + (d.views || 0), 0);
  const totalActions = dailyData.reduce((sum, d) => sum + (d.actions || 0), 0);
  const totalPhoneCalls = dailyData.reduce((sum, d) => sum + (d.phone_calls || 0), 0);
  const totalWebsiteClicks = dailyData.reduce((sum, d) => sum + (d.website_clicks || 0), 0);
  const totalDirections = dailyData.reduce((sum, d) => sum + (d.direction_requests || 0), 0);
  const totalNewReviews = dailyData.reduce((sum, d) => sum + (d.new_reviews_today || 0), 0);
  const totalPostsViews = dailyData.reduce((sum, d) => sum + (d.posts_views || 0), 0);
  const totalPostsActions = dailyData.reduce((sum, d) => sum + (d.posts_actions || 0), 0);
  const totalBusinessPhotoViews = dailyData.reduce((sum, d) => sum + (d.business_photo_views || 0), 0);
  const totalCustomerPhotoViews = dailyData.reduce((sum, d) => sum + (d.customer_photo_views || 0), 0);

  // Previous period totals
  const prevViews = prevDailyData.reduce((sum, d) => sum + (d.views || 0), 0);
  const prevPhoneCalls = prevDailyData.reduce((sum, d) => sum + (d.phone_calls || 0), 0);
  const prevWebsiteClicks = prevDailyData.reduce((sum, d) => sum + (d.website_clicks || 0), 0);
  const prevDirections = prevDailyData.reduce((sum, d) => sum + (d.direction_requests || 0), 0);

  const periodDays = Math.round((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));

  const calcMoM = (current: number, prev: number, invert = false) => {
    if (prev === 0) return { pct: '—', type: 'neutral' as const };
    const val = ((current - prev) / prev * 100);
    const pct = val.toFixed(1);
    const isUp = val > 0;
    const isGood = invert ? !isUp : isUp;
    return { pct: isUp ? `+${pct}%` : `${pct}%`, type: (isGood ? 'up' : val === 0 ? 'neutral' : 'down') as 'up' | 'down' | 'neutral' };
  };

  const momViews = calcMoM(totalViews, prevViews);
  const momCalls = calcMoM(totalPhoneCalls, prevPhoneCalls);
  const momClicks = calcMoM(totalWebsiteClicks, prevWebsiteClicks);
  const momDirections = calcMoM(totalDirections, prevDirections);

  // Latest values for reviews/rating
  const latestReviews = dailyData.length > 0 ? dailyData[dailyData.length - 1].total_reviews || 0 : 0;
  const latestRating = dailyData.length > 0 ? dailyData[dailyData.length - 1].average_rating || 0 : 0;
  const latestPostsCount = dailyData.length > 0 ? dailyData[dailyData.length - 1].posts_count || 0 : 0;

  // Days since last review
  const lastReviewEntry = [...dailyData].reverse().find(d => (d.new_reviews_today || 0) > 0);
  const daysSinceReview = lastReviewEntry
    ? Math.floor((new Date().getTime() - new Date(lastReviewEntry.date).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  // Engagement rate (actions / views)
  const engagementRate = totalViews > 0 ? ((totalActions / totalViews) * 100).toFixed(2) : '0.00';

  // Call conversion rate (calls / views)
  const callConversionRate = totalViews > 0 ? ((totalPhoneCalls / totalViews) * 100).toFixed(2) : '0.00';

  // Direction vs Web clicks ratio
  const directionsPercent = totalActions > 0 ? ((totalDirections / totalActions) * 100).toFixed(1) : '0';
  const webClicksPercent = totalActions > 0 ? ((totalWebsiteClicks / totalActions) * 100).toFixed(1) : '0';
  const phoneCallsPercent = totalActions > 0 ? ((totalPhoneCalls / totalActions) * 100).toFixed(1) : '0';

  // Prepare chart data
  const chartData = dailyData.map(d => ({
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    views: d.views || 0,
    actions: d.actions || 0,
    calls: d.phone_calls || 0,
    directions: d.direction_requests || 0,
    webClicks: d.website_clicks || 0
  }));

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
            <h1 className="text-2xl font-black" style={{ color: '#2c2419' }}>Google Business Profile</h1>
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
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#5c5850', letterSpacing: '0.15em' }}>LOCAL SEO</span>
              <h1 className="text-4xl font-black mt-2" style={{ color: '#2c2419', letterSpacing: '-0.02em' }}>Google Business Profile Analytics</h1>
              <p className="text-sm mt-2" style={{ color: '#9ca3af' }}>
                {location ? location.location_name : 'Local visibility and customer engagement metrics'}
              </p>
            </div>

            {/* TIER 1: KPI Cards (4 cards) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '16px',
              marginBottom: '32px'
            }}>
              {/* Profile Views */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(44, 36, 25, 0.1)',
                borderRadius: '16px',
                padding: '20px',
                boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
              }}>
                <p style={{ fontSize: '11px', color: '#5c5850', fontWeight: '600', margin: '0 0 8px 0', textTransform: 'uppercase' }}>Profile Views</p>
                <p style={{ fontSize: '32px', fontWeight: '700', color: '#2c2419', margin: '0 0 4px 0' }}>{totalViews.toLocaleString()}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: momViews.type === 'up' ? '#10b981' : momViews.type === 'down' ? '#ef4444' : '#9ca3af' }}>
                    {momViews.type === 'up' ? '\u25B2' : momViews.type === 'down' ? '\u25BC' : ''} {momViews.pct}
                  </span>
                  <span style={{ fontSize: '10px', color: '#9ca3af' }}>vs prev {periodDays}d</span>
                </div>
              </div>

              {/* Phone Calls */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(44, 36, 25, 0.1)',
                borderRadius: '16px',
                padding: '20px',
                boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
              }}>
                <p style={{ fontSize: '11px', color: '#5c5850', fontWeight: '600', margin: '0 0 8px 0', textTransform: 'uppercase' }}>Phone Calls</p>
                <p style={{ fontSize: '32px', fontWeight: '700', color: '#10b981', margin: '0 0 4px 0' }}>{totalPhoneCalls.toLocaleString()}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: momCalls.type === 'up' ? '#10b981' : momCalls.type === 'down' ? '#ef4444' : '#9ca3af' }}>
                    {momCalls.type === 'up' ? '\u25B2' : momCalls.type === 'down' ? '\u25BC' : ''} {momCalls.pct}
                  </span>
                  <span style={{ fontSize: '10px', color: '#9ca3af' }}>vs prev {periodDays}d</span>
                </div>
              </div>

              {/* Website Clicks */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(44, 36, 25, 0.1)',
                borderRadius: '16px',
                padding: '20px',
                boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
              }}>
                <p style={{ fontSize: '11px', color: '#5c5850', fontWeight: '600', margin: '0 0 8px 0', textTransform: 'uppercase' }}>Website Clicks</p>
                <p style={{ fontSize: '32px', fontWeight: '700', color: '#d9a854', margin: '0 0 4px 0' }}>{totalWebsiteClicks.toLocaleString()}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: momClicks.type === 'up' ? '#10b981' : momClicks.type === 'down' ? '#ef4444' : '#9ca3af' }}>
                    {momClicks.type === 'up' ? '\u25B2' : momClicks.type === 'down' ? '\u25BC' : ''} {momClicks.pct}
                  </span>
                  <span style={{ fontSize: '10px', color: '#9ca3af' }}>vs prev {periodDays}d</span>
                </div>
              </div>

              {/* Direction Requests */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(44, 36, 25, 0.1)',
                borderRadius: '16px',
                padding: '20px',
                boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
              }}>
                <p style={{ fontSize: '11px', color: '#5c5850', fontWeight: '600', margin: '0 0 8px 0', textTransform: 'uppercase' }}>Directions</p>
                <p style={{ fontSize: '32px', fontWeight: '700', color: '#c4704f', margin: '0 0 4px 0' }}>{totalDirections.toLocaleString()}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: momDirections.type === 'up' ? '#10b981' : momDirections.type === 'down' ? '#ef4444' : '#9ca3af' }}>
                    {momDirections.type === 'up' ? '\u25B2' : momDirections.type === 'down' ? '\u25BC' : ''} {momDirections.pct}
                  </span>
                  <span style={{ fontSize: '10px', color: '#9ca3af' }}>vs prev {periodDays}d</span>
                </div>
              </div>
            </div>

            {/* TIER 2: Trend Chart + Action Summary */}
            <div className="mb-12" style={{
              background: 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(44, 36, 25, 0.1)',
              borderRadius: '24px',
              padding: '24px',
              boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '24px' }}>
                <div>
                  <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#5c5850', margin: '0 0 8px 0' }}>
                    Daily Performance Trend
                  </p>
                  <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#2c2419', margin: '0', letterSpacing: '-0.02em' }}>
                    Views & Engagement Over Time
                  </h3>
                </div>
              </div>

              {/* Line Chart */}
              <div style={{ height: '350px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(44, 36, 25, 0.1)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#5c5850' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#5c5850' }} />
                    <Tooltip
                      contentStyle={{
                        background: 'rgba(255, 255, 255, 0.95)',
                        border: '1px solid rgba(44, 36, 25, 0.1)',
                        borderRadius: '8px',
                        fontSize: '11px'
                      }}
                    />
                    <Line type="monotone" dataKey="views" stroke="#9db5a0" strokeWidth={2} dot={false} name="Views" />
                    <Line type="monotone" dataKey="calls" stroke="#10b981" strokeWidth={2} dot={false} name="Calls" />
                    <Line type="monotone" dataKey="webClicks" stroke="#d9a854" strokeWidth={2} dot={false} name="Web Clicks" />
                    <Line type="monotone" dataKey="directions" stroke="#c4704f" strokeWidth={2} dot={false} name="Directions" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Summary Stats Below Chart */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginTop: '24px' }}>
                <div style={{ background: 'rgba(157, 181, 160, 0.08)', borderRadius: '8px', padding: '16px', borderLeft: '3px solid #9db5a0', textAlign: 'center' }}>
                  <p style={{ fontSize: '10px', color: '#5c5850', margin: '0 0 8px 0', fontWeight: '600' }}>Total Actions</p>
                  <p style={{ fontSize: '24px', fontWeight: '700', color: '#9db5a0', margin: '0 0 4px 0' }}>{totalActions.toLocaleString()}</p>
                  <p style={{ fontSize: '9px', color: '#9ca3af', margin: '0' }}>All interactions</p>
                </div>

                <div style={{ background: 'rgba(16, 185, 129, 0.08)', borderRadius: '8px', padding: '16px', borderLeft: '3px solid #10b981', textAlign: 'center' }}>
                  <p style={{ fontSize: '10px', color: '#5c5850', margin: '0 0 8px 0', fontWeight: '600' }}>Engagement Rate</p>
                  <p style={{ fontSize: '24px', fontWeight: '700', color: '#10b981', margin: '0 0 4px 0' }}>{engagementRate}%</p>
                  <p style={{ fontSize: '9px', margin: '0', fontWeight: '600', color: parseFloat(engagementRate) >= 8 ? '#d9a854' : parseFloat(engagementRate) >= 3 ? '#10b981' : '#ef4444' }}>
                    {parseFloat(engagementRate) >= 8 ? 'Excellent' : parseFloat(engagementRate) >= 3 ? 'Good' : 'Below avg'}
                  </p>
                </div>

                <div style={{ background: 'rgba(217, 168, 84, 0.08)', borderRadius: '8px', padding: '16px', borderLeft: '3px solid #d9a854', textAlign: 'center' }}>
                  <p style={{ fontSize: '10px', color: '#5c5850', margin: '0 0 8px 0', fontWeight: '600' }}>Call Conversion</p>
                  <p style={{ fontSize: '24px', fontWeight: '700', color: '#d9a854', margin: '0 0 4px 0' }}>{callConversionRate}%</p>
                  <p style={{ fontSize: '9px', color: '#9ca3af', margin: '0' }}>Calls / Views</p>
                </div>

                <div style={{ background: 'rgba(196, 112, 79, 0.08)', borderRadius: '8px', padding: '16px', borderLeft: '3px solid #c4704f', textAlign: 'center' }}>
                  <p style={{ fontSize: '10px', color: '#5c5850', margin: '0 0 8px 0', fontWeight: '600' }}>Avg Daily Views</p>
                  <p style={{ fontSize: '24px', fontWeight: '700', color: '#c4704f', margin: '0 0 4px 0' }}>
                    {dailyData.length > 0 ? Math.round(totalViews / dailyData.length) : 0}
                  </p>
                  <p style={{ fontSize: '9px', color: '#9ca3af', margin: '0' }}>Per day average</p>
                </div>
              </div>
            </div>

            {/* TIER 3: Analysis Columns (2-column @ 50/50) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
              {/* Column 1: Customer Actions Breakdown */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(44, 36, 25, 0.1)',
                borderRadius: '24px',
                padding: '24px',
                boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
              }}>
                <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#5c5850', margin: '0 0 8px 0' }}>
                  Customer Actions
                </p>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#2c2419', margin: '0 0 20px 0', letterSpacing: '-0.02em' }}>
                  How Customers Interact
                </h3>

                {/* Action Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                  <div style={{ background: 'rgba(16, 185, 129, 0.08)', borderRadius: '12px', padding: '16px', textAlign: 'center', borderTop: '3px solid #10b981' }}>
                    <p style={{ fontSize: '10px', color: '#5c5850', margin: '0 0 4px 0', fontWeight: '600' }}>Phone Calls</p>
                    <p style={{ fontSize: '24px', fontWeight: '700', color: '#10b981', margin: 0 }}>{totalPhoneCalls}</p>
                  </div>
                  <div style={{ background: 'rgba(217, 168, 84, 0.08)', borderRadius: '12px', padding: '16px', textAlign: 'center', borderTop: '3px solid #d9a854' }}>
                    <p style={{ fontSize: '10px', color: '#5c5850', margin: '0 0 4px 0', fontWeight: '600' }}>Web Clicks</p>
                    <p style={{ fontSize: '24px', fontWeight: '700', color: '#d9a854', margin: 0 }}>{totalWebsiteClicks}</p>
                  </div>
                  <div style={{ background: 'rgba(196, 112, 79, 0.08)', borderRadius: '12px', padding: '16px', textAlign: 'center', borderTop: '3px solid #c4704f' }}>
                    <p style={{ fontSize: '10px', color: '#5c5850', margin: '0 0 4px 0', fontWeight: '600' }}>Directions</p>
                    <p style={{ fontSize: '24px', fontWeight: '700', color: '#c4704f', margin: 0 }}>{totalDirections}</p>
                  </div>
                </div>

                {/* Progress Bars: Action Distribution */}
                <div style={{ marginTop: '20px' }}>
                  <p style={{ fontSize: '10px', fontWeight: '600', color: '#5c5850', margin: '0 0 8px 0', textTransform: 'uppercase' }}>Action Distribution</p>

                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', color: '#5c5850' }}>Phone Calls</span>
                      <span style={{ fontSize: '11px', fontWeight: '600', color: '#10b981' }}>{phoneCallsPercent}%</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'rgba(44, 36, 25, 0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${phoneCallsPercent}%`, height: '100%', background: '#10b981', transition: 'width 0.3s ease' }}></div>
                    </div>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', color: '#5c5850' }}>Website Clicks</span>
                      <span style={{ fontSize: '11px', fontWeight: '600', color: '#d9a854' }}>{webClicksPercent}%</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'rgba(44, 36, 25, 0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${webClicksPercent}%`, height: '100%', background: '#d9a854', transition: 'width 0.3s ease' }}></div>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', color: '#5c5850' }}>Direction Requests</span>
                      <span style={{ fontSize: '11px', fontWeight: '600', color: '#c4704f' }}>{directionsPercent}%</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'rgba(44, 36, 25, 0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${directionsPercent}%`, height: '100%', background: '#c4704f', transition: 'width 0.3s ease' }}></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Column 2: Reviews & Reputation */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(44, 36, 25, 0.1)',
                borderRadius: '24px',
                padding: '24px',
                boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
              }}>
                <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#5c5850', margin: '0 0 8px 0' }}>
                  Reviews & Reputation
                </p>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#2c2419', margin: '0 0 20px 0', letterSpacing: '-0.02em' }}>
                  Customer Feedback
                </h3>

                {/* Rating Display */}
                <div style={{
                  background: 'linear-gradient(135deg, rgba(217, 168, 84, 0.15), rgba(196, 112, 79, 0.15))',
                  borderRadius: '16px',
                  padding: '24px',
                  textAlign: 'center',
                  marginBottom: '20px'
                }}>
                  <p style={{ fontSize: '10px', fontWeight: '600', color: '#5c5850', margin: '0 0 8px 0', textTransform: 'uppercase' }}>Average Rating</p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '48px', fontWeight: '700', color: '#d9a854' }}>{latestRating.toFixed(1)}</span>
                    <span style={{ fontSize: '24px', color: '#d9a854' }}>/ 5</span>
                  </div>
                  <div style={{ marginTop: '8px' }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span key={star} style={{ fontSize: '20px', color: star <= Math.round(latestRating) ? '#d9a854' : '#e5e5e5' }}>
                        ★
                      </span>
                    ))}
                  </div>
                </div>

                {/* Review Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div style={{ background: 'rgba(16, 185, 129, 0.08)', borderRadius: '12px', padding: '16px', borderLeft: '3px solid #10b981' }}>
                    <p style={{ fontSize: '10px', color: '#5c5850', margin: '0 0 4px 0', fontWeight: '600' }}>Total Reviews</p>
                    <p style={{ fontSize: '24px', fontWeight: '700', color: '#10b981', margin: 0 }}>{latestReviews}</p>
                  </div>
                  <div style={{ background: 'rgba(157, 181, 160, 0.08)', borderRadius: '12px', padding: '16px', borderLeft: '3px solid #9db5a0' }}>
                    <p style={{ fontSize: '10px', color: '#5c5850', margin: '0 0 4px 0', fontWeight: '600' }}>New Reviews</p>
                    <p style={{ fontSize: '24px', fontWeight: '700', color: '#9db5a0', margin: 0 }}>{totalNewReviews}</p>
                    <p style={{ fontSize: '9px', color: '#9ca3af', margin: '4px 0 0 0' }}>This period</p>
                  </div>
                  <div style={{ background: daysSinceReview !== null && daysSinceReview > 30 ? 'rgba(239, 68, 68, 0.08)' : 'rgba(217, 168, 84, 0.08)', borderRadius: '12px', padding: '16px', borderLeft: `3px solid ${daysSinceReview !== null && daysSinceReview > 30 ? '#ef4444' : '#d9a854'}` }}>
                    <p style={{ fontSize: '10px', color: '#5c5850', margin: '0 0 4px 0', fontWeight: '600' }}>Days Since Review</p>
                    <p style={{ fontSize: '24px', fontWeight: '700', color: daysSinceReview !== null && daysSinceReview > 30 ? '#ef4444' : '#d9a854', margin: 0 }}>
                      {daysSinceReview !== null ? daysSinceReview : '—'}
                    </p>
                    <p style={{ fontSize: '9px', color: '#9ca3af', margin: '4px 0 0 0' }}>
                      {daysSinceReview !== null && daysSinceReview > 30 ? 'Needs attention' : 'Last review'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* TIER 4: Granular Data (2x2 grid) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px', marginBottom: '32px' }}>
              {/* Column 1: Photo Performance */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(44, 36, 25, 0.1)',
                borderRadius: '24px',
                padding: '24px',
                boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
              }}>
                <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#5c5850', margin: '0 0 8px 0' }}>
                  Photo Performance
                </p>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#2c2419', margin: '0 0 16px 0', letterSpacing: '-0.02em' }}>
                  Visual Content Engagement
                </h3>

                <div style={{ background: 'rgba(157, 181, 160, 0.08)', borderRadius: '12px', padding: '16px', borderLeft: '3px solid #9db5a0' }}>
                  <p style={{ fontSize: '10px', color: '#5c5850', margin: '0 0 4px 0', fontWeight: '600' }}>Photo Views</p>
                  <p style={{ fontSize: '22px', fontWeight: '700', color: '#9db5a0', margin: 0 }}>
                    {(totalBusinessPhotoViews + (totalCustomerPhotoViews || 0)).toLocaleString()}
                  </p>
                  <p style={{ fontSize: '9px', color: '#9ca3af', margin: '4px 0 0 0' }}>Total photo views</p>
                </div>
              </div>

              {/* Column 2: Posts Performance */}
              {(latestPostsCount > 0 || totalPostsViews > 0) && (
              <div style={{
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(44, 36, 25, 0.1)',
                borderRadius: '24px',
                padding: '24px',
                boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
              }}>
                <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#5c5850', margin: '0 0 8px 0' }}>
                  Posts Performance
                </p>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#2c2419', margin: '0 0 16px 0', letterSpacing: '-0.02em' }}>
                  GBP Posts Engagement
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  <div style={{ background: 'rgba(217, 168, 84, 0.1)', borderRadius: '12px', padding: '12px', textAlign: 'center', borderTop: '3px solid #d9a854' }}>
                    <p style={{ fontSize: '9px', fontWeight: '600', color: '#5c5850', margin: '0 0 4px 0', textTransform: 'uppercase' }}>Active Posts</p>
                    <p style={{ fontSize: '22px', fontWeight: '700', color: '#d9a854', margin: 0 }}>{latestPostsCount}</p>
                  </div>
                  <div style={{ background: 'rgba(157, 181, 160, 0.1)', borderRadius: '12px', padding: '12px', textAlign: 'center', borderTop: '3px solid #9db5a0' }}>
                    <p style={{ fontSize: '9px', fontWeight: '600', color: '#5c5850', margin: '0 0 4px 0', textTransform: 'uppercase' }}>Post Views</p>
                    <p style={{ fontSize: '22px', fontWeight: '700', color: '#9db5a0', margin: 0 }}>{totalPostsViews.toLocaleString()}</p>
                  </div>
                  <div style={{ background: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px', padding: '12px', textAlign: 'center', borderTop: '3px solid #10b981' }}>
                    <p style={{ fontSize: '9px', fontWeight: '600', color: '#5c5850', margin: '0 0 4px 0', textTransform: 'uppercase' }}>Post Actions</p>
                    <p style={{ fontSize: '22px', fontWeight: '700', color: '#10b981', margin: 0 }}>{totalPostsActions.toLocaleString()}</p>
                  </div>
                </div>

                {/* Posts Engagement Rate */}
                <div style={{
                  background: 'linear-gradient(135deg, rgba(157, 181, 160, 0.15), rgba(16, 185, 129, 0.15))',
                  borderRadius: '12px',
                  padding: '16px',
                  borderLeft: '4px solid #9db5a0',
                  marginTop: '16px'
                }}>
                  <p style={{ fontSize: '10px', fontWeight: '600', color: '#5c5850', margin: '0 0 8px 0', textTransform: 'uppercase' }}>
                    Posts Engagement Rate
                  </p>
                  <p style={{ fontSize: '28px', fontWeight: '700', color: '#9db5a0', margin: '0 0 4px 0' }}>
                    {totalPostsViews > 0 ? ((totalPostsActions / totalPostsViews) * 100).toFixed(2) : '0.00'}%
                  </p>
                  <p style={{ fontSize: '10px', color: '#5c5850', margin: 0 }}>Actions / Views</p>
                </div>
              </div>
              )}

              {/* Column 3: Daily Calls Trend */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(44, 36, 25, 0.1)',
                borderRadius: '24px',
                padding: '24px',
                boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
              }}>
                <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#5c5850', margin: '0 0 8px 0' }}>
                  Call Trend
                </p>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#2c2419', margin: '0 0 16px 0', letterSpacing: '-0.02em' }}>
                  Daily Phone Calls
                </h3>

                <div style={{ height: '200px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(44, 36, 25, 0.1)" />
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#5c5850' }} />
                      <YAxis tick={{ fontSize: 9, fill: '#5c5850' }} />
                      <Tooltip
                        contentStyle={{
                          background: 'rgba(255, 255, 255, 0.95)',
                          border: '1px solid rgba(44, 36, 25, 0.1)',
                          borderRadius: '8px',
                          fontSize: '10px'
                        }}
                      />
                      <Bar dataKey="calls" fill="#10b981" radius={[4, 4, 0, 0]} name="Calls" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>

            {/* Section 5: Key Insights Summary */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(44, 36, 25, 0.1)',
              borderRadius: '24px',
              padding: '24px',
              boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)',
              marginBottom: '32px'
            }}>
              <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#5c5850', margin: '0 0 12px 0' }}>
                GBP Key Insights
              </p>
              <p style={{ fontSize: '11px', color: '#5c5850', margin: 0, lineHeight: '1.5' }}>
                Your Google Business Profile received <strong>{totalViews.toLocaleString()} views</strong> with an engagement rate of <strong>{engagementRate}%</strong>.
                Customers took <strong>{totalActions} actions</strong> including <strong>{totalPhoneCalls} phone calls</strong>, <strong>{totalWebsiteClicks} website clicks</strong>, and <strong>{totalDirections} direction requests</strong>.
                {latestRating > 0 && ` Your business maintains a <strong>${latestRating.toFixed(1)}-star rating</strong> with <strong>${latestReviews} total reviews</strong>.`}
                {totalNewReviews > 0 && ` You received <strong>${totalNewReviews} new reviews</strong> during this period.`}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

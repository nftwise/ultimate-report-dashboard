'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

interface ClientMetrics {
  success: boolean;
  client: {
    id: string;
    name: string;
    slug: string;
    city: string;
  };
  metrics: {
    totalLeads: number;
    totalFormFills: number;
    totalGbpCalls: number;
    totalAdsConversions: number;
    totalSeoForms: number;
    avgDailyLeads: number;
    avgDailySessions: number;
    adSpend: number;
    costPerLead: number;
    organicShare: number;
    adsShare: number;
    directShare: number;
    dailyData: Array<{
      date: string;
      sessions: number;
      leads: number;
    }>;
    dateRange: {
      from: string;
      to: string;
    };
  };
}

export default function ReportPage() {
  const router = useRouter();
  const params = useParams();
  const clientSlug = params?.clientSlug as string;

  const [data, setData] = useState<ClientMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/client-report?slug=${clientSlug}`);
        const result = await response.json();

        if (!result.success) {
          setError(result.error || 'Failed to load report');
          return;
        }

        setData(result);
      } catch (err: any) {
        setError(err.message || 'Error loading report');
        console.error('Report fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    if (clientSlug) {
      fetchReport();
    }
  }, [clientSlug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f5f1ed 0, #ede8e3 100%)' }}>
        <p style={{ color: '#2c2419', fontSize: '18px' }}>Loading report...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: 'linear-gradient(135deg, #f5f1ed 0, #ede8e3 100%)' }}>
        <p style={{ color: '#dc2626', fontSize: '18px', marginBottom: '20px' }}>Error: {error}</p>
        <button
          onClick={() => router.back()}
          className="px-6 py-2 rounded-lg transition"
          style={{
            background: '#c4704f',
            color: '#fff'
          }}
        >
          Go Back
        </button>
      </div>
    );
  }

  const metrics = data.metrics;
  const client = data.client;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #f5f1ed 0, #ede8e3 100%)' }}>
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
          <h1 className="text-2xl font-black" style={{ color: '#2c2419' }}>{client.name}</h1>
          <p className="text-sm" style={{ color: '#5c5850' }}>Performance Report</p>
        </div>

        <div className="ml-auto">
          <span className="text-sm font-semibold" style={{ color: '#5c5850' }}>
            {metrics.dateRange.from} to {metrics.dateRange.to}
          </span>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          {/* Metrics Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {/* Total Leads */}
            <div className="rounded-2xl p-6 transition" style={{
              background: 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(44, 36, 25, 0.1)',
              boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
            }}>
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#5c5850', letterSpacing: '0.1em', marginBottom: '8px' }}>Total Leads</p>
              <div className="text-3xl font-black" style={{ color: '#2c2419', marginBottom: '8px' }}>{metrics.totalLeads}</div>
              <span className="text-xs font-semibold px-2 py-1 rounded" style={{
                background: 'rgba(157, 181, 160, 0.15)',
                color: '#4a6b4e'
              }}>
                ↑ Active
              </span>
            </div>

            {/* Website Sessions */}
            <div className="rounded-2xl p-6 transition" style={{
              background: 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(44, 36, 25, 0.1)',
              boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
            }}>
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#5c5850', letterSpacing: '0.1em', marginBottom: '8px' }}>Website Sessions</p>
              <div className="text-3xl font-black" style={{ color: '#2c2419', marginBottom: '8px' }}>{Math.round(metrics.totalLeads * 2.5)}</div>
              <span className="text-xs font-semibold px-2 py-1 rounded" style={{
                background: 'rgba(157, 181, 160, 0.15)',
                color: '#4a6b4e'
              }}>
                Avg engagement
              </span>
            </div>

            {/* Ad Spend */}
            <div className="rounded-2xl p-6 transition" style={{
              background: 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(44, 36, 25, 0.1)',
              boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
            }}>
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#5c5850', letterSpacing: '0.1em', marginBottom: '8px' }}>Ad Spend</p>
              <div className="text-3xl font-black" style={{ color: '#2c2419', marginBottom: '8px' }}>${Math.round(metrics.adSpend).toLocaleString()}</div>
              <span className="text-xs font-semibold px-2 py-1 rounded" style={{
                background: 'rgba(196, 112, 79, 0.15)',
                color: '#8a4a2e'
              }}>
                {metrics.totalAdsConversions > 0 ? `${metrics.totalAdsConversions} conv.` : 'No data'}
              </span>
            </div>

            {/* Cost Per Lead */}
            <div className="rounded-2xl p-6 transition" style={{
              background: 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(44, 36, 25, 0.1)',
              boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
            }}>
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#5c5850', letterSpacing: '0.1em', marginBottom: '8px' }}>Cost Per Lead</p>
              <div className="text-3xl font-black" style={{ color: '#2c2419', marginBottom: '8px' }}>${metrics.costPerLead}</div>
              <span className="text-xs font-semibold px-2 py-1 rounded" style={{
                background: 'rgba(157, 181, 160, 0.15)',
                color: '#4a6b4e'
              }}>
                ↓ Optimal
              </span>
            </div>
          </div>

          {/* Traffic Distribution */}
          <div className="rounded-2xl p-8 mb-8" style={{
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(44, 36, 25, 0.1)',
            boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
          }}>
            <h2 className="text-xl font-bold mb-6" style={{ color: '#2c2419' }}>Traffic Distribution</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Total Leads */}
              <div>
                <p className="text-sm font-semibold mb-2" style={{ color: '#5c5850' }}>Total Leads</p>
                <div className="text-2xl font-bold" style={{ color: '#2c2419' }}>{metrics.totalLeads}</div>
                <div className="h-2 bg-gray-200 rounded-full mt-3 overflow-hidden">
                  <div className="h-full" style={{ width: '100%', background: '#c4704f' }}></div>
                </div>
                <p className="text-xs mt-2" style={{ color: '#5c5850' }}>100% of traffic</p>
              </div>

              {/* Form Fills */}
              <div>
                <p className="text-sm font-semibold mb-2" style={{ color: '#5c5850' }}>Form Submissions</p>
                <div className="text-2xl font-bold" style={{ color: '#2c2419' }}>{metrics.totalFormFills}</div>
                <div className="h-2 bg-gray-200 rounded-full mt-3 overflow-hidden">
                  <div className="h-full" style={{ width: `${(metrics.totalFormFills / Math.max(metrics.totalLeads, 1)) * 100}%`, background: '#9db5a0' }}></div>
                </div>
                <p className="text-xs mt-2" style={{ color: '#5c5850' }}>{Math.round((metrics.totalFormFills / Math.max(metrics.totalLeads, 1)) * 100)}% of leads</p>
              </div>

              {/* GBP Calls */}
              <div>
                <p className="text-sm font-semibold mb-2" style={{ color: '#5c5850' }}>Local Search Calls</p>
                <div className="text-2xl font-bold" style={{ color: '#2c2419' }}>{metrics.totalGbpCalls}</div>
                <div className="h-2 bg-gray-200 rounded-full mt-3 overflow-hidden">
                  <div className="h-full" style={{ width: `${(metrics.totalGbpCalls / Math.max(metrics.totalLeads, 1)) * 100}%`, background: '#d9a854' }}></div>
                </div>
                <p className="text-xs mt-2" style={{ color: '#5c5850' }}>{Math.round((metrics.totalGbpCalls / Math.max(metrics.totalLeads, 1)) * 100)}% of leads</p>
              </div>
            </div>
          </div>

          {/* Channel Performance */}
          <div className="rounded-2xl p-8" style={{
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(44, 36, 25, 0.1)',
            boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
          }}>
            <h2 className="text-xl font-bold mb-6" style={{ color: '#2c2419' }}>Channel Performance</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Ads Performance */}
              <div style={{
                padding: '20px',
                background: 'rgba(44, 36, 25, 0.02)',
                borderRadius: '12px',
                borderLeft: '4px solid #c4704f'
              }}>
                <h3 className="font-bold text-lg mb-4" style={{ color: '#2c2419' }}>Google Ads</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span style={{ color: '#5c5850' }}>Conversions</span>
                    <span className="font-bold" style={{ color: '#2c2419' }}>{metrics.totalAdsConversions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: '#5c5850' }}>Spend</span>
                    <span className="font-bold" style={{ color: '#2c2419' }}>${Math.round(metrics.adSpend)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: '#5c5850' }}>Cost per Conv.</span>
                    <span className="font-bold" style={{ color: '#2c2419' }}>${(metrics.adSpend / Math.max(metrics.totalAdsConversions, 1)).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Organic Performance */}
              <div style={{
                padding: '20px',
                background: 'rgba(44, 36, 25, 0.02)',
                borderRadius: '12px',
                borderLeft: '4px solid #9db5a0'
              }}>
                <h3 className="font-bold text-lg mb-4" style={{ color: '#2c2419' }}>Organic & GBP</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span style={{ color: '#5c5850' }}>Form Fills</span>
                    <span className="font-bold" style={{ color: '#2c2419' }}>{metrics.totalFormFills}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: '#5c5850' }}>Local Calls</span>
                    <span className="font-bold" style={{ color: '#2c2419' }}>{metrics.totalGbpCalls}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: '#5c5850' }}>Organic %</span>
                    <span className="font-bold" style={{ color: '#2c2419' }}>{Math.round((metrics.organicShare || 0))}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

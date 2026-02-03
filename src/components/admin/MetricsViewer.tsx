'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

interface MetricsData {
  teamMembers: any[];
  employeeProfiles: any[];
  clientTeamAssignments: any[];
  employeePerformance: any[];
  clientCredentials: any[];
  clientCampaigns: any[];
  accountIntelligence: any[];
  adsAccountHealth: any[];
}

export default function MetricsViewer() {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('team');

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
          throw new Error('Missing Supabase credentials');
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // Fetch all metrics in parallel
        const [
          { data: teamMembers },
          { data: employeeProfiles },
          { data: clientTeamAssignments },
          { data: employeePerformance },
          { data: clientCredentials },
          { data: clientCampaigns },
          { data: accountIntelligence },
          { data: adsAccountHealth },
        ] = await Promise.all([
          supabase.from('team_members').select('*').limit(100),
          supabase.from('employee_profiles').select('*').limit(100),
          supabase.from('client_team_assignments').select('*').limit(100),
          supabase.from('employee_performance').select('*').limit(100),
          supabase.from('client_credentials').select('client_id, created_at').limit(100),
          supabase.from('client_campaigns').select('*').limit(100),
          supabase.from('account_intelligence').select('*').limit(100),
          supabase.from('ads_account_health').select('*').limit(100),
        ]);

        const data: MetricsData = {
          teamMembers: teamMembers || [],
          employeeProfiles: employeeProfiles || [],
          clientTeamAssignments: clientTeamAssignments || [],
          employeePerformance: employeePerformance || [],
          clientCredentials: clientCredentials || [],
          clientCampaigns: clientCampaigns || [],
          accountIntelligence: accountIntelligence || [],
          adsAccountHealth: adsAccountHealth || [],
        };

        setMetrics(data);
        console.log('[MetricsViewer] Fetched all metrics:', data);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMsg);
        console.error('[MetricsViewer] Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, []);

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#5c5850' }}>Loading metrics...</div>;
  }

  if (error) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444' }}>Error: {error}</div>;
  }

  if (!metrics) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#5c5850' }}>No data available</div>;
  }

  const renderTable = (data: any[], title: string) => {
    if (!data || data.length === 0) {
      return <p style={{ color: '#9ca3af' }}>No data</p>;
    }

    const columns = Object.keys(data[0]).slice(0, 8);

    return (
      <div style={{ marginBottom: '40px' }}>
        <h3 style={{ color: '#2c2419', marginBottom: '12px', fontSize: '16px', fontWeight: '600' }}>
          {title} ({data.length} records)
        </h3>
        <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: '#f3f4f6' }}>
                {columns.map((col) => (
                  <th
                    key={col}
                    style={{
                      padding: '8px 12px',
                      textAlign: 'left',
                      fontWeight: '600',
                      color: '#2c2419',
                      borderBottom: '1px solid #e5e7eb',
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 10).map((row, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  {columns.map((col) => (
                    <td
                      key={`${idx}-${col}`}
                      style={{
                        padding: '8px 12px',
                        color: '#5c5850',
                        wordBreak: 'break-all',
                        maxWidth: '200px',
                      }}
                    >
                      {typeof row[col] === 'object' ? JSON.stringify(row[col]).slice(0, 50) : String(row[col]).slice(0, 50)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '20px', background: '#f5f1ed', minHeight: '100vh' }}>
      <div
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '1400px',
          margin: '0 auto',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}
      >
        <h1 style={{ color: '#2c2419', marginBottom: '24px', fontSize: '24px', fontWeight: '700' }}>
          📊 Metrics Viewer - All Tables
        </h1>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid #e5e7eb', flexWrap: 'wrap' }}>
          {[
            { id: 'team', label: '👥 Team', count: metrics.teamMembers.length },
            { id: 'employee', label: '💼 Employee', count: metrics.employeeProfiles.length },
            { id: 'assignments', label: '🎯 Assignments', count: metrics.clientTeamAssignments.length },
            { id: 'performance', label: '📈 Performance', count: metrics.employeePerformance.length },
            { id: 'credentials', label: '🔐 Credentials', count: metrics.clientCredentials.length },
            { id: 'campaigns', label: '📢 Campaigns', count: metrics.clientCampaigns.length },
            { id: 'intelligence', label: '🧠 Intelligence', count: metrics.accountIntelligence.length },
            { id: 'health', label: '❤️ Health', count: metrics.adsAccountHealth.length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 12px',
                background: activeTab === tab.id ? '#c4704f' : 'transparent',
                color: activeTab === tab.id ? '#fff' : '#5c5850',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500',
                fontSize: '13px',
              }}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Content */}
        <div>
          {activeTab === 'team' && renderTable(metrics.teamMembers, 'Team Members')}
          {activeTab === 'employee' && renderTable(metrics.employeeProfiles, 'Employee Profiles')}
          {activeTab === 'assignments' && renderTable(metrics.clientTeamAssignments, 'Client Team Assignments')}
          {activeTab === 'performance' && renderTable(metrics.employeePerformance, 'Employee Performance')}
          {activeTab === 'credentials' && renderTable(metrics.clientCredentials, 'Client Credentials')}
          {activeTab === 'campaigns' && renderTable(metrics.clientCampaigns, 'Client Campaigns')}
          {activeTab === 'intelligence' && renderTable(metrics.accountIntelligence, 'Account Intelligence')}
          {activeTab === 'health' && renderTable(metrics.adsAccountHealth, 'Ads Account Health')}
        </div>

        {/* Summary */}
        <div style={{ marginTop: '40px', padding: '16px', background: '#f9f7f4', borderRadius: '8px' }}>
          <h3 style={{ color: '#2c2419', marginBottom: '12px', fontWeight: '600' }}>📊 Summary</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <div style={{ background: '#fff', padding: '12px', borderRadius: '6px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#c4704f' }}>{metrics.teamMembers.length}</div>
              <div style={{ fontSize: '12px', color: '#5c5850' }}>Team Members</div>
            </div>
            <div style={{ background: '#fff', padding: '12px', borderRadius: '6px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#c4704f' }}>{metrics.clientTeamAssignments.length}</div>
              <div style={{ fontSize: '12px', color: '#5c5850' }}>Assignments</div>
            </div>
            <div style={{ background: '#fff', padding: '12px', borderRadius: '6px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#c4704f' }}>{metrics.clientCampaigns.length}</div>
              <div style={{ fontSize: '12px', color: '#5c5850' }}>Campaigns</div>
            </div>
            <div style={{ background: '#fff', padding: '12px', borderRadius: '6px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#c4704f' }}>{metrics.adsAccountHealth.length}</div>
              <div style={{ fontSize: '12px', color: '#5c5850' }}>Health Records</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

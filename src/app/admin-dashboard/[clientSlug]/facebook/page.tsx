'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import ClientTabBar from '@/components/admin/ClientTabBar';
import { createClient } from '@supabase/supabase-js';

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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default function FacebookPage() {
  const params = useParams();
  const clientSlug = (params?.clientSlug as string) ?? '';

  const [clientData, setClientData] = useState<any>(null);
  const [leads, setLeads] = useState<FBLead[]>([]);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [showAddLead, setShowAddLead] = useState(false);
  const [showNewSequence, setShowNewSequence] = useState(false);

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

  useEffect(() => {
    const fetchClientData = async () => {
      const res = await fetch(`/api/clients/list?slug=${clientSlug}`);
      const { data } = await res.json();
      if (data?.length > 0) {
        setClientData(data[0]);
      }
    };
    fetchClientData();
  }, [clientSlug]);

  useEffect(() => {
    if (!clientData?.id) return;

    const fetchData = async () => {
      setLoadingLeads(true);
      try {
        // Fetch leads
        const leadsRes = await fetch(`/api/facebook/leads?clientId=${clientData.id}`);
        const { data: leadsData } = await leadsRes.json();
        setLeads(leadsData || []);

        // Fetch sequences
        const seqRes = await fetch(`/api/facebook/sequences?clientId=${clientData.id}`);
        const { data: seqData } = await seqRes.json();
        setSequences(seqData || []);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoadingLeads(false);
      }
    };

    fetchData();
  }, [clientData?.id]);

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

  const serviceConfig = clientData.service_configs?.[0];
  const hasFBConfig = serviceConfig?.fb_page_id || serviceConfig?.fb_sheet_id || serviceConfig?.fb_ad_account_id;

  return (
    <AdminLayout>
      <ClientTabBar
        clientSlug={clientSlug}
        clientName={clientData.name}
        clientCity={clientData.city}
        activeTab="facebook"
      />

      <div style={{ padding: '24px' }}>
        {!hasFBConfig ? (
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(10px)',
              borderRadius: '16px',
              border: '1px solid rgba(255,255,255,0.6)',
              padding: '48px 24px',
              textAlign: 'center',
            }}
          >
            <h3 style={{ color: '#2c2419', marginBottom: '8px' }}>
              Facebook Not Configured
            </h3>
            <p style={{ color: '#6b7280' }}>
              Please configure Facebook Ad Account ID in client settings to use this feature.
            </p>
          </div>
        ) : (
          <>
            {/* KPI Row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
                marginBottom: '32px',
              }}
            >
              {[
                { label: 'Total Leads', value: totalLeads },
                { label: 'Contacted', value: contactedLeads },
                { label: 'Responded', value: respondedLeads },
                { label: 'Response Rate', value: `${responseRate}%` },
              ].map((kpi) => (
                <div
                  key={kpi.label}
                  style={{
                    background: 'rgba(255, 255, 255, 0.9)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: '16px',
                    border: '1px solid rgba(255,255,255,0.6)',
                    padding: '20px',
                    boxShadow: '0 4px 24px rgba(44,36,25,0.08)',
                  }}
                >
                  <div style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '8px' }}>
                    {kpi.label}
                  </div>
                  <div
                    style={{
                      color: '#2c2419',
                      fontSize: '32px',
                      fontWeight: '600',
                    }}
                  >
                    {kpi.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Lead Management Section */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(10px)',
                borderRadius: '16px',
                border: '1px solid rgba(255,255,255,0.6)',
                padding: '24px',
                marginBottom: '32px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ color: '#2c2419', margin: 0 }}>Lead Management</h3>
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
                  }}
                >
                  + Add Lead
                </button>
              </div>

              {/* Status Tabs */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', borderBottom: '1px solid rgba(44,36,25,0.1)', paddingBottom: '12px' }}>
                {['all', 'new', 'contacted', 'responded', 'converted', 'closed'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setSelectedStatus(status)}
                    style={{
                      background: selectedStatus === status ? 'rgba(196, 112, 79, 0.1)' : 'transparent',
                      color: selectedStatus === status ? '#c4704f' : '#6b7280',
                      border: 'none',
                      padding: '8px 12px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      borderBottom: selectedStatus === status ? '2px solid #c4704f' : 'none',
                    }}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>

              {/* Leads Table */}
              {loadingLeads ? (
                <div style={{ textAlign: 'center', padding: '24px', color: '#9ca3af' }}>
                  Loading leads...
                </div>
              ) : filteredLeads.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: '#9ca3af' }}>
                  No leads found.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(44,36,25,0.1)' }}>
                        <th style={{ textAlign: 'left', padding: '12px 0', color: '#6b7280', fontSize: '12px', fontWeight: '600' }}>Name</th>
                        <th style={{ textAlign: 'left', padding: '12px 0', color: '#6b7280', fontSize: '12px', fontWeight: '600' }}>Phone</th>
                        <th style={{ textAlign: 'left', padding: '12px 0', color: '#6b7280', fontSize: '12px', fontWeight: '600' }}>Source</th>
                        <th style={{ textAlign: 'left', padding: '12px 0', color: '#6b7280', fontSize: '12px', fontWeight: '600' }}>Status</th>
                        <th style={{ textAlign: 'left', padding: '12px 0', color: '#6b7280', fontSize: '12px', fontWeight: '600' }}>Created</th>
                        <th style={{ textAlign: 'left', padding: '12px 0', color: '#6b7280', fontSize: '12px', fontWeight: '600' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLeads.map((lead) => (
                        <tr
                          key={lead.id}
                          style={{
                            borderBottom: '1px solid rgba(44,36,25,0.05)',
                            cursor: 'pointer',
                          }}
                        >
                          <td style={{ padding: '12px 0', color: '#2c2419' }}>{lead.name || 'N/A'}</td>
                          <td style={{ padding: '12px 0', color: '#2c2419' }}>{lead.phone}</td>
                          <td style={{ padding: '12px 0' }}>
                            <span style={{
                              background: 'rgba(196, 112, 79, 0.1)',
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
                              background: lead.status === 'responded' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                              color: lead.status === 'responded' ? '#10b981' : '#3b82f6',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '12px',
                            }}>
                              {lead.status}
                            </span>
                          </td>
                          <td style={{ padding: '12px 0', color: '#9ca3af', fontSize: '12px' }}>
                            {new Date(lead.created_at).toLocaleDateString()}
                          </td>
                          <td style={{ padding: '12px 0' }}>
                            <button
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#c4704f',
                                fontSize: '14px',
                              }}
                            >
                              💬 SMS
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Sequences Section */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(10px)',
                borderRadius: '16px',
                border: '1px solid rgba(255,255,255,0.6)',
                padding: '24px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ color: '#2c2419', margin: 0 }}>Follow-up Sequences</h3>
                <button
                  onClick={() => setShowNewSequence(true)}
                  style={{
                    background: '#c4704f',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  + New Sequence
                </button>
              </div>

              {sequences.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: '#9ca3af' }}>
                  No sequences created yet.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' }}>
                  {sequences.map((seq) => (
                    <div
                      key={seq.id}
                      style={{
                        background: 'rgba(255, 255, 255, 0.5)',
                        border: '1px solid rgba(196, 112, 79, 0.2)',
                        borderRadius: '12px',
                        padding: '16px',
                      }}
                    >
                      <h4 style={{ color: '#2c2419', margin: '0 0 8px 0' }}>{seq.name}</h4>
                      <div style={{ color: '#9ca3af', fontSize: '12px', marginBottom: '8px' }}>
                        {seq.steps.length} steps
                      </div>
                      {seq.steps.map((step, idx) => (
                        <div key={idx} style={{ color: '#6b7280', fontSize: '12px', marginBottom: '4px' }}>
                          Day {step.day}: {step.message.substring(0, 40)}...
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}

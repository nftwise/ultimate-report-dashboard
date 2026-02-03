'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Search, ChevronDown, ChevronUp } from 'lucide-react';

interface Client {
  id: string;
  name: string;
  contact_email: string;
  slug: string;
  city: string;
  is_active: boolean;
  created_at: string;
  contract_start_date?: string;
  contract_end_date?: string;
  plan_type?: string;
  username?: string;
  password?: string;
  service_configs?: {
    ga_property_id?: string;
    gads_customer_id?: string;
    gbp_location_id?: string;
    gsc_site_url?: string;
  }[];
}

interface ClientStats {
  total: number;
  active: number;
  inactive: number;
  seoOnly: number;
  adsOnly: number;
  both: number;
  churnRate: number;
  expiringIn30Days: number;
  expiringIn90Days: number;
}

export default function ClientManagement() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
  const [stats, setStats] = useState<ClientStats>({
    total: 0,
    active: 0,
    inactive: 0,
    seoOnly: 0,
    adsOnly: 0,
    both: 0,
    churnRate: 0,
    expiringIn30Days: 0,
    expiringIn90Days: 0,
  });

  useEffect(() => {
    fetchClientData();
  }, []);

  const fetchClientData = async () => {
    try {
      setLoading(true);
      setError(null);

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase credentials');
      }

      const supabase = createClient(supabaseUrl, supabaseKey);

      // Fetch all clients with service configs
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select(`
          id,
          name,
          contact_email,
          slug,
          city,
          is_active,
          created_at,
          contract_start_date,
          contract_end_date,
          plan_type,
          username,
          password,
          service_configs (
            ga_property_id,
            gads_customer_id,
            gbp_location_id,
            gsc_site_url
          )
        `)
        .order('name', { ascending: true });

      if (clientsError) {
        throw new Error(`Failed to fetch clients: ${clientsError.message}`);
      }

      const typedClients = (clientsData || []) as Client[];
      setClients(typedClients);

      // Calculate stats
      calculateStats(typedClients);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      console.error('[ClientManagement] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (clientsList: Client[]) => {
    const total = clientsList.length;
    const active = clientsList.filter(c => c.is_active).length;
    const inactive = total - active;

    // Service detection
    let seoOnly = 0;
    let adsOnly = 0;
    let both = 0;

    clientsList.forEach(client => {
      const hasServices = client.service_configs && client.service_configs.length > 0;
      if (!hasServices || !client.service_configs) return;

      const config = client.service_configs[0];
      const hasSeo = !!config?.gsc_site_url;
      const hasAds = !!config?.gads_customer_id;
      const hasGa = !!config?.ga_property_id;

      if (hasSeo && !hasAds) seoOnly++;
      else if (hasAds && !hasSeo) adsOnly++;
      else if (hasSeo && hasAds) both++;
    });

    // Contract analysis
    const now = new Date();
    const thirtyDaysLater = new Date(now);
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
    const ninetyDaysLater = new Date(now);
    ninetyDaysLater.setDate(ninetyDaysLater.getDate() + 90);

    const expiringIn30Days = clientsList.filter(c => {
      if (!c.contract_end_date) return false;
      const endDate = new Date(c.contract_end_date);
      return endDate > now && endDate <= thirtyDaysLater;
    }).length;

    const expiringIn90Days = clientsList.filter(c => {
      if (!c.contract_end_date) return false;
      const endDate = new Date(c.contract_end_date);
      return endDate > thirtyDaysLater && endDate <= ninetyDaysLater;
    }).length;

    // Simple churn rate calculation (churned in last 30 days)
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const churned = clientsList.filter(c => {
      if (!c.is_active || !c.contract_end_date) return false;
      const endDate = new Date(c.contract_end_date);
      return endDate > thirtyDaysAgo && endDate <= now;
    }).length;

    const churnRate = total > 0 ? Math.round((churned / total) * 100) : 0;

    setStats({
      total,
      active,
      inactive,
      seoOnly,
      adsOnly,
      both,
      churnRate,
      expiringIn30Days,
      expiringIn90Days,
    });
  };

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.contact_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getServiceStatus = (client: Client) => {
    if (!client.service_configs || client.service_configs.length === 0) {
      return { seo: false, ads: false, gbp: false };
    }
    const config = client.service_configs[0];
    return {
      seo: !!config.gsc_site_url,
      ads: !!config.gads_customer_id,
      gbp: !!config.gbp_location_id,
    };
  };

  const getContractStatus = (client: Client) => {
    if (!client.contract_end_date) return 'No contract';
    const endDate = new Date(client.contract_end_date);
    const now = new Date();
    const daysLeft = Math.floor((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) return `Expired ${Math.abs(daysLeft)}d ago`;
    if (daysLeft < 30) return `⚠️ Expires in ${daysLeft}d`;
    if (daysLeft < 90) return `Expires in ${daysLeft}d`;
    return `Expires in ${daysLeft}d`;
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#5c5850' }}>
        Loading client data...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444' }}>
        Error: {error}
      </div>
    );
  }

  return (
    <div>
      {/* Quick Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-6 gap-3 mb-8">
        {[
          { label: 'Total', value: stats.total, color: '#2c2419' },
          { label: 'Active', value: stats.active, color: '#10b981' },
          { label: 'Inactive', value: stats.inactive, color: '#ef4444' },
          { label: 'SEO+ADS', value: stats.both, color: '#c4704f' },
          { label: 'SEO Only', value: stats.seoOnly, color: '#b45309' },
          { label: 'ADS Only', value: stats.adsOnly, color: '#2563eb' },
        ].map((stat, i) => (
          <div
            key={i}
            className="rounded-lg p-4"
            style={{
              background: 'rgba(255, 255, 255, 0.9)',
              border: '1px solid rgba(44, 36, 25, 0.1)',
              textAlign: 'center'
            }}
          >
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: stat.color }}>
              {stat.value}
            </div>
            <div style={{ fontSize: '12px', color: '#5c5850', marginTop: '4px' }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Search Bar */}
      <div className="mb-8">
        <div className="relative">
          <Search className="absolute left-4 top-3.5 w-5 h-5" style={{ color: '#9ca3af' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search clients by name, email, or slug..."
            className="w-full pl-12 pr-4 py-3 border-2 rounded-full focus:outline-none"
            style={{
              background: '#f5f1ed',
              borderColor: 'transparent',
              color: '#2c2419',
              fontSize: '0.95rem',
            }}
            onFocus={(e) => {
              e.currentTarget.style.background = '#ffffff';
              e.currentTarget.style.borderColor = '#c4704f';
            }}
            onBlur={(e) => {
              e.currentTarget.style.background = '#f5f1ed';
              e.currentTarget.style.borderColor = 'transparent';
            }}
          />
        </div>
      </div>

      {/* Clients Table */}
      <div className="rounded-2xl overflow-hidden" style={{
        background: 'rgba(255, 255, 255, 0.95)',
        border: '1px solid rgba(44, 36, 25, 0.1)',
        boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
      }}>
        <div className="overflow-x-auto">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f5f1ed', borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '16px', textAlign: 'left', color: '#2c2419', fontWeight: '600', fontSize: '13px' }}>ID</th>
                <th style={{ padding: '16px', textAlign: 'left', color: '#2c2419', fontWeight: '600', fontSize: '13px' }}>Client Name</th>
                <th style={{ padding: '16px', textAlign: 'left', color: '#2c2419', fontWeight: '600', fontSize: '13px' }}>Email</th>
                <th style={{ padding: '16px', textAlign: 'left', color: '#2c2419', fontWeight: '600', fontSize: '13px' }}>City</th>
                <th style={{ padding: '16px', textAlign: 'left', color: '#2c2419', fontWeight: '600', fontSize: '13px' }}>Services</th>
                <th style={{ padding: '16px', textAlign: 'left', color: '#2c2419', fontWeight: '600', fontSize: '13px' }}>Status</th>
                <th style={{ padding: '16px', textAlign: 'left', color: '#2c2419', fontWeight: '600', fontSize: '13px' }}>Contract</th>
                <th style={{ padding: '16px', textAlign: 'center', color: '#2c2419', fontWeight: '600', fontSize: '13px' }}>GA</th>
                <th style={{ padding: '16px', textAlign: 'center', color: '#2c2419', fontWeight: '600', fontSize: '13px' }}>GSC</th>
                <th style={{ padding: '16px', textAlign: 'center', color: '#2c2419', fontWeight: '600', fontSize: '13px' }}>GBP</th>
                <th style={{ padding: '16px', textAlign: 'center', color: '#2c2419', fontWeight: '600', fontSize: '13px' }}>ADS</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client) => {
                const services = getServiceStatus(client);
                const isExpanded = expandedClientId === client.id;

                return (
                  <React.Fragment key={client.id}>
                    <tr
                      style={{
                        borderBottom: '1px solid #e5e7eb',
                        background: isExpanded ? '#f9f7f4' : 'transparent',
                        cursor: 'pointer',
                        transition: 'background 200ms ease'
                      }}
                      onMouseEnter={(e) => {
                        if (!isExpanded) (e.currentTarget as HTMLTableRowElement).style.background = '#fafaf8';
                      }}
                      onMouseLeave={(e) => {
                        if (!isExpanded) (e.currentTarget as HTMLTableRowElement).style.background = 'transparent';
                      }}
                      onClick={() => setExpandedClientId(isExpanded ? null : client.id)}
                    >
                      <td style={{ padding: '14px 16px', color: '#5c5850', fontSize: '12px', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {client.id.substring(0, 8)}...
                      </td>
                      <td style={{ padding: '14px 16px', color: '#2c2419', fontSize: '13px', fontWeight: '500' }}>
                        {client.name}
                      </td>
                      <td style={{ padding: '14px 16px', color: '#5c5850', fontSize: '12px' }}>
                        {client.contact_email}
                      </td>
                      <td style={{ padding: '14px 16px', color: '#5c5850', fontSize: '12px' }}>
                        {client.city || '-'}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {services.seo && (
                            <span style={{ background: '#fff8e1', color: '#b45309', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '500' }}>
                              SEO
                            </span>
                          )}
                          {services.ads && (
                            <span style={{ background: '#e0e7ff', color: '#2563eb', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '500' }}>
                              ADS
                            </span>
                          )}
                          {services.gbp && (
                            <span style={{ background: '#ecfdf5', color: '#047857', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '500' }}>
                              GBP
                            </span>
                          )}
                          {!services.seo && !services.ads && !services.gbp && (
                            <span style={{ color: '#9ca3af', fontSize: '11px' }}>None</span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span
                          style={{
                            background: client.is_active ? '#e6f4ea' : '#f3f4f6',
                            color: client.is_active ? '#10b981' : '#6b7280',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '500',
                            display: 'inline-block'
                          }}
                        >
                          {client.is_active ? '✓ Active' : '○ Inactive'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', color: '#5c5850', fontSize: '12px' }}>
                        {getContractStatus(client)}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        {client.service_configs?.[0]?.ga_property_id ? (
                          <span style={{ color: '#10b981', fontSize: '16px' }}>✓</span>
                        ) : (
                          <span style={{ color: '#d1d5db', fontSize: '16px' }}>✗</span>
                        )}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        {client.service_configs?.[0]?.gsc_site_url ? (
                          <span style={{ color: '#10b981', fontSize: '16px' }}>✓</span>
                        ) : (
                          <span style={{ color: '#d1d5db', fontSize: '16px' }}>✗</span>
                        )}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        {client.service_configs?.[0]?.gbp_location_id ? (
                          <span style={{ color: '#10b981', fontSize: '16px' }}>✓</span>
                        ) : (
                          <span style={{ color: '#d1d5db', fontSize: '16px' }}>✗</span>
                        )}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        {client.service_configs?.[0]?.gads_customer_id ? (
                          <span style={{ color: '#10b981', fontSize: '16px' }}>✓</span>
                        ) : (
                          <span style={{ color: '#d1d5db', fontSize: '16px' }}>✗</span>
                        )}
                      </td>
                    </tr>

                    {/* Expandable Detail Row */}
                    {isExpanded && (
                      <tr style={{ background: '#f9f7f4', borderBottom: '2px solid #e5e7eb' }}>
                        <td colSpan={11} style={{ padding: '20px' }}>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Left Column */}
                            <div>
                              <h4 style={{ color: '#2c2419', fontWeight: '600', marginBottom: '12px', fontSize: '13px', textTransform: 'uppercase' }}>
                                Account Details
                              </h4>
                              <div style={{ display: 'grid', gap: '8px', fontSize: '12px' }}>
                                <div>
                                  <span style={{ color: '#5c5850' }}>Email:</span>{' '}
                                  <span style={{ color: '#2c2419', fontWeight: '500' }}>{client.contact_email}</span>
                                </div>
                                <div>
                                  <span style={{ color: '#5c5850' }}>Username:</span>{' '}
                                  <span style={{ color: '#2c2419', fontWeight: '500' }}>{client.username || 'N/A'}</span>
                                </div>
                                <div>
                                  <span style={{ color: '#5c5850' }}>Password:</span>{' '}
                                  <span style={{ color: '#2c2419', fontWeight: '500' }}>{'*'.repeat(8)}</span>
                                </div>
                                <div>
                                  <span style={{ color: '#5c5850' }}>Plan:</span>{' '}
                                  <span style={{ color: '#2c2419', fontWeight: '500' }}>{client.plan_type || 'Standard'}</span>
                                </div>
                              </div>
                            </div>

                            {/* Right Column */}
                            <div>
                              <h4 style={{ color: '#2c2419', fontWeight: '600', marginBottom: '12px', fontSize: '13px', textTransform: 'uppercase' }}>
                                Contract Info
                              </h4>
                              <div style={{ display: 'grid', gap: '8px', fontSize: '12px' }}>
                                <div>
                                  <span style={{ color: '#5c5850' }}>Start Date:</span>{' '}
                                  <span style={{ color: '#2c2419', fontWeight: '500' }}>
                                    {client.contract_start_date ? new Date(client.contract_start_date).toLocaleDateString() : 'N/A'}
                                  </span>
                                </div>
                                <div>
                                  <span style={{ color: '#5c5850' }}>End Date:</span>{' '}
                                  <span style={{ color: '#2c2419', fontWeight: '500' }}>
                                    {client.contract_end_date ? new Date(client.contract_end_date).toLocaleDateString() : 'N/A'}
                                  </span>
                                </div>
                                <div>
                                  <span style={{ color: '#5c5850' }}>Duration:</span>{' '}
                                  <span style={{ color: '#2c2419', fontWeight: '500' }}>
                                    {client.contract_start_date && client.contract_end_date
                                      ? `${Math.round(
                                          (new Date(client.contract_end_date).getTime() -
                                            new Date(client.contract_start_date).getTime()) /
                                            (1000 * 60 * 60 * 24 * 30)
                                        )} months`
                                      : 'N/A'}
                                  </span>
                                </div>
                                <div>
                                  <span style={{ color: '#5c5850' }}>Status:</span>{' '}
                                  <span style={{ color: '#2c2419', fontWeight: '500' }}>
                                    {getContractStatus(client)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Backfill IDs Section */}
                          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
                            <h4 style={{ color: '#2c2419', fontWeight: '600', marginBottom: '12px', fontSize: '13px', textTransform: 'uppercase' }}>
                              Backfill IDs
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label style={{ display: 'block', fontSize: '11px', color: '#5c5850', textTransform: 'uppercase', fontWeight: '600', marginBottom: '4px' }}>
                                  GA Property ID
                                </label>
                                <input
                                  type="text"
                                  value={client.service_configs?.[0]?.ga_property_id || ''}
                                  readOnly
                                  style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    background: '#f5f1ed',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    color: '#2c2419',
                                    fontFamily: 'monospace'
                                  }}
                                />
                              </div>
                              <div>
                                <label style={{ display: 'block', fontSize: '11px', color: '#5c5850', textTransform: 'uppercase', fontWeight: '600', marginBottom: '4px' }}>
                                  Google Ads Customer ID
                                </label>
                                <input
                                  type="text"
                                  value={client.service_configs?.[0]?.gads_customer_id || ''}
                                  readOnly
                                  style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    background: '#f5f1ed',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    color: '#2c2419',
                                    fontFamily: 'monospace'
                                  }}
                                />
                              </div>
                              <div>
                                <label style={{ display: 'block', fontSize: '11px', color: '#5c5850', textTransform: 'uppercase', fontWeight: '600', marginBottom: '4px' }}>
                                  GSC Site URL
                                </label>
                                <input
                                  type="text"
                                  value={client.service_configs?.[0]?.gsc_site_url || ''}
                                  readOnly
                                  style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    background: '#f5f1ed',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    color: '#2c2419',
                                    fontFamily: 'monospace'
                                  }}
                                />
                              </div>
                              <div>
                                <label style={{ display: 'block', fontSize: '11px', color: '#5c5850', textTransform: 'uppercase', fontWeight: '600', marginBottom: '4px' }}>
                                  GBP Location ID
                                </label>
                                <input
                                  type="text"
                                  value={client.service_configs?.[0]?.gbp_location_id || ''}
                                  readOnly
                                  style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    background: '#f5f1ed',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    color: '#2c2419',
                                    fontFamily: 'monospace'
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredClients.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#5c5850' }}>
            No clients found
          </div>
        )}
      </div>

      {/* Bottom Insights Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
        {/* Churn Analysis */}
        <div className="rounded-2xl p-6" style={{
          background: 'rgba(255, 255, 255, 0.95)',
          border: '1px solid rgba(44, 36, 25, 0.1)',
          boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
        }}>
          <h3 style={{ color: '#2c2419', fontWeight: '600', marginBottom: '16px', fontSize: '14px', textTransform: 'uppercase' }}>
            📉 Churn Analysis
          </h3>
          <div style={{ display: 'grid', gap: '12px' }}>
            <div>
              <div style={{ color: '#5c5850', fontSize: '12px', marginBottom: '4px' }}>Churn Rate (30d)</div>
              <div style={{ color: stats.churnRate > 10 ? '#ef4444' : stats.churnRate > 5 ? '#d97706' : '#10b981', fontSize: '28px', fontWeight: '700' }}>
                {stats.churnRate}%
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
              <div>
                <div style={{ color: '#5c5850', fontSize: '11px' }}>At Risk</div>
                <div style={{ color: '#ef4444', fontSize: '18px', fontWeight: '600' }}>{stats.expiringIn30Days}</div>
              </div>
              <div>
                <div style={{ color: '#5c5850', fontSize: '11px' }}>Watch List</div>
                <div style={{ color: '#d97706', fontSize: '18px', fontWeight: '600' }}>{stats.expiringIn90Days}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Service Distribution */}
        <div className="rounded-2xl p-6" style={{
          background: 'rgba(255, 255, 255, 0.95)',
          border: '1px solid rgba(44, 36, 25, 0.1)',
          boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
        }}>
          <h3 style={{ color: '#2c2419', fontWeight: '600', marginBottom: '16px', fontSize: '14px', textTransform: 'uppercase' }}>
            📊 Service Distribution
          </h3>
          <div style={{ display: 'grid', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#5c5850', fontSize: '12px' }}>Both (SEO+ADS)</span>
                <span style={{ color: '#c4704f', fontWeight: '600', fontSize: '12px' }}>{stats.both}</span>
              </div>
              <div style={{ background: '#f3f4f6', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    background: '#c4704f',
                    height: '100%',
                    width: `${stats.total > 0 ? (stats.both / stats.total) * 100 : 0}%`,
                    transition: 'width 400ms ease'
                  }}
                />
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#5c5850', fontSize: '12px' }}>SEO Only</span>
                <span style={{ color: '#b45309', fontWeight: '600', fontSize: '12px' }}>{stats.seoOnly}</span>
              </div>
              <div style={{ background: '#f3f4f6', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    background: '#b45309',
                    height: '100%',
                    width: `${stats.total > 0 ? (stats.seoOnly / stats.total) * 100 : 0}%`,
                    transition: 'width 400ms ease'
                  }}
                />
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#5c5850', fontSize: '12px' }}>ADS Only</span>
                <span style={{ color: '#2563eb', fontWeight: '600', fontSize: '12px' }}>{stats.adsOnly}</span>
              </div>
              <div style={{ background: '#f3f4f6', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    background: '#2563eb',
                    height: '100%',
                    width: `${stats.total > 0 ? (stats.adsOnly / stats.total) * 100 : 0}%`,
                    transition: 'width 400ms ease'
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Upsell Opportunities */}
        <div className="rounded-2xl p-6" style={{
          background: 'rgba(255, 255, 255, 0.95)',
          border: '1px solid rgba(44, 36, 25, 0.1)',
          boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
        }}>
          <h3 style={{ color: '#2c2419', fontWeight: '600', marginBottom: '16px', fontSize: '14px', textTransform: 'uppercase' }}>
            🚀 Upsell Opportunities
          </h3>
          <div style={{ display: 'grid', gap: '12px' }}>
            <div>
              <div style={{ color: '#5c5850', fontSize: '12px', marginBottom: '4px' }}>SEO Only → Add ADS</div>
              <div style={{ color: '#2563eb', fontSize: '24px', fontWeight: '700' }}>{stats.seoOnly}</div>
            </div>
            <div>
              <div style={{ color: '#5c5850', fontSize: '12px', marginBottom: '4px' }}>ADS Only → Add SEO</div>
              <div style={{ color: '#b45309', fontSize: '24px', fontWeight: '700' }}>{stats.adsOnly}</div>
            </div>
          </div>
        </div>

        {/* Contract Timeline */}
        <div className="rounded-2xl p-6" style={{
          background: 'rgba(255, 255, 255, 0.95)',
          border: '1px solid rgba(44, 36, 25, 0.1)',
          boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
        }}>
          <h3 style={{ color: '#2c2419', fontWeight: '600', marginBottom: '16px', fontSize: '14px', textTransform: 'uppercase' }}>
            📅 Contract Timeline
          </h3>
          <div style={{ display: 'grid', gap: '12px' }}>
            <div>
              <div style={{ color: '#5c5850', fontSize: '12px', marginBottom: '4px' }}>Expiring in 30d (URGENT)</div>
              <div style={{ color: '#ef4444', fontSize: '24px', fontWeight: '700' }}>{stats.expiringIn30Days}</div>
            </div>
            <div>
              <div style={{ color: '#5c5850', fontSize: '12px', marginBottom: '4px' }}>Expiring in 90d</div>
              <div style={{ color: '#d97706', fontSize: '24px', fontWeight: '700' }}>{stats.expiringIn90Days}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

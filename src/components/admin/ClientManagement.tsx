'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Search, ChevronRight, MapPin, Phone, Globe, BarChart3, Zap, Settings } from 'lucide-react';

interface Client {
  id: string;
  name: string;
  contact_email: string;
  slug: string;
  city: string;
  owner?: string;
  is_active: boolean;
  service_configs?: {
    ga_property_id?: string;
    gads_customer_id?: string;
    gbp_location_id?: string;
    gsc_site_url?: string;
  }[];
}

interface GBPLocation {
  id: string;
  client_id: string;
  name: string;
  address: string;
  phone: string;
  website: string;
}

interface ClientStats {
  total: number;
  active: number;
  inactive: number;
  seoOnly: number;
  adsOnly: number;
  both: number;
}

export default function ClientManagement() {
  const [clients, setClients] = useState<Client[]>([]);
  const [gbpLocations, setGbpLocations] = useState<Map<string, GBPLocation>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [stats, setStats] = useState<ClientStats>({
    total: 0,
    active: 0,
    inactive: 0,
    seoOnly: 0,
    adsOnly: 0,
    both: 0,
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
          owner,
          is_active,
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

      // Fetch GBP locations for websites and phone numbers
      const { data: gbpData, error: gbpError } = await supabase
        .from('gbp_locations')
        .select('id, client_id, name, address, phone, website');

      if (!gbpError && gbpData) {
        const gbpMap = new Map<string, GBPLocation>();
        (gbpData as GBPLocation[]).forEach(location => {
          gbpMap.set(location.client_id, location);
        });
        setGbpLocations(gbpMap);
      }

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

      if (hasSeo && !hasAds) seoOnly++;
      else if (hasAds && !hasSeo) adsOnly++;
      else if (hasSeo && hasAds) both++;
    });

    setStats({
      total,
      active,
      inactive,
      seoOnly,
      adsOnly,
      both,
    });
  };

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.contact_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedClient = selectedClientId ? clients.find(c => c.id === selectedClientId) : null;
  const selectedGbp = selectedClientId ? gbpLocations.get(selectedClientId) : null;

  const getServiceType = (client: Client) => {
    if (!client.service_configs || client.service_configs.length === 0) return 'None';
    const config = client.service_configs[0];
    const hasSeo = !!config?.gsc_site_url;
    const hasAds = !!config?.gads_customer_id;
    if (hasSeo && hasAds) return 'SEO + ADS';
    if (hasSeo) return 'SEO';
    if (hasAds) return 'ADS';
    return 'None';
  };

  const getServiceColor = (type: string) => {
    switch (type) {
      case 'SEO + ADS': return { bg: '#fff8e1', text: '#b45309' };
      case 'SEO': return { bg: '#fef3c7', text: '#d97706' };
      case 'ADS': return { bg: '#e0e7ff', text: '#2563eb' };
      default: return { bg: '#f3f4f6', text: '#6b7280' };
    }
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
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '0', minHeight: 'calc(100vh - 200px)' }}>
      {/* LEFT SIDEBAR */}
      <div style={{
        background: 'linear-gradient(135deg, #f9f7f4 0%, #f5f1ed 100%)',
        borderRight: '1px solid rgba(44, 36, 25, 0.1)',
        padding: '24px 0',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Search Bar */}
        <div style={{ padding: '0 16px', marginBottom: '24px' }}>
          <div style={{ position: 'relative' }}>
            <Search style={{ position: 'absolute', left: '12px', top: '10px', width: '16px', height: '16px', color: '#9ca3af' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search clients..."
              style={{
                width: '100%',
                paddingLeft: '36px',
                paddingRight: '12px',
                paddingTop: '8px',
                paddingBottom: '8px',
                border: '1px solid rgba(44, 36, 25, 0.1)',
                borderRadius: '8px',
                fontSize: '13px',
                color: '#2c2419',
                background: 'rgba(255, 255, 255, 0.7)'
              }}
            />
          </div>
        </div>

        {/* Quick Stats */}
        <div style={{ padding: '0 16px', marginBottom: '24px' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#5c5850', fontWeight: '600', marginBottom: '8px' }}>Stats</div>
          <div style={{ display: 'grid', gap: '6px', fontSize: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#5c5850' }}>Total</span>
              <span style={{ fontWeight: '600', color: '#2c2419' }}>{stats.total}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#5c5850' }}>Active</span>
              <span style={{ fontWeight: '600', color: '#10b981' }}>{stats.active}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#5c5850' }}>SEO+ADS</span>
              <span style={{ fontWeight: '600', color: '#b45309' }}>{stats.both}</span>
            </div>
          </div>
        </div>

        {/* Clients List */}
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '16px' }}>
          {filteredClients.map((client) => {
            const serviceType = getServiceType(client);
            const isSelected = selectedClientId === client.id;
            const colors = getServiceColor(serviceType);

            return (
              <div
                key={client.id}
                onClick={() => setSelectedClientId(client.id)}
                style={{
                  padding: '12px 16px',
                  marginLeft: '8px',
                  marginRight: '8px',
                  marginBottom: '4px',
                  cursor: 'pointer',
                  borderLeft: isSelected ? '4px solid #c4704f' : '4px solid transparent',
                  background: isSelected ? 'rgba(196, 112, 79, 0.1)' : 'transparent',
                  transition: 'all 200ms ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: '#2c2419', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {client.name}
                    </div>
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                      {client.city || 'No city'}
                    </div>
                  </div>
                  {isSelected && <ChevronRight style={{ width: '16px', height: '16px', color: '#c4704f', flexShrink: 0, marginLeft: '8px' }} />}
                </div>
                <div style={{
                  background: colors.bg,
                  color: colors.text,
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: '600',
                  marginTop: '6px',
                  textAlign: 'center',
                  display: 'inline-block'
                }}>
                  {serviceType}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT CONTENT AREA */}
      <div style={{ padding: '24px', overflowY: 'auto', background: '#ffffff' }}>
        {selectedClient ? (
          <div>
            {/* Header */}
            <div style={{ marginBottom: '32px', paddingBottom: '24px', borderBottom: '2px solid rgba(44, 36, 25, 0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div>
                  <h1 style={{ fontSize: '32px', fontWeight: '700', color: '#2c2419', margin: '0 0 8px 0' }}>
                    {selectedClient.name}
                  </h1>
                  <p style={{ fontSize: '14px', color: '#5c5850', margin: 0 }}>
                    {selectedClient.owner ? `Owner: ${selectedClient.owner}` : 'Client'}
                  </p>
                </div>
                <div style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: '600',
                  background: selectedClient.is_active ? '#ecfdf5' : '#fee2e2',
                  color: selectedClient.is_active ? '#059669' : '#dc2626'
                }}>
                  {selectedClient.is_active ? '✓ Active' : '○ Inactive'}
                </div>
              </div>
            </div>

            {/* Contact & Location Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Basic Info */}
              <div style={{
                background: '#f9f7f4',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid rgba(44, 36, 25, 0.08)'
              }}>
                <h3 style={{ fontSize: '12px', textTransform: 'uppercase', fontWeight: '600', color: '#5c5850', marginBottom: '12px', margin: 0 }}>
                  📧 Contact Information
                </h3>
                <div style={{ display: 'grid', gap: '12px', marginTop: '12px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#5c5850', textTransform: 'uppercase', fontWeight: '600', marginBottom: '4px' }}>Email</div>
                    <a href={`mailto:${selectedClient.contact_email}`} style={{ fontSize: '13px', color: '#c4704f', textDecoration: 'none', wordBreak: 'break-all' }}>
                      {selectedClient.contact_email}
                    </a>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#5c5850', textTransform: 'uppercase', fontWeight: '600', marginBottom: '4px' }}>Location</div>
                    <div style={{ fontSize: '13px', color: '#2c2419', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MapPin style={{ width: '14px', height: '14px' }} />
                      {selectedClient.city || 'Not specified'}
                    </div>
                  </div>
                </div>
              </div>

              {/* GBP Location Info */}
              {selectedGbp && (
                <div style={{
                  background: '#f0fdf4',
                  padding: '16px',
                  borderRadius: '12px',
                  border: '1px solid rgba(16, 185, 129, 0.1)'
                }}>
                  <h3 style={{ fontSize: '12px', textTransform: 'uppercase', fontWeight: '600', color: '#047857', marginBottom: '12px', margin: 0 }}>
                    📍 Google Business Profile
                  </h3>
                  <div style={{ display: 'grid', gap: '12px', marginTop: '12px' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: '#047857', textTransform: 'uppercase', fontWeight: '600', marginBottom: '4px' }}>Location</div>
                      <div style={{ fontSize: '13px', color: '#2c2419' }}>{selectedGbp.name}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#047857', textTransform: 'uppercase', fontWeight: '600', marginBottom: '4px' }}>Address</div>
                      <div style={{ fontSize: '13px', color: '#2c2419' }}>{selectedGbp.address}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#047857', textTransform: 'uppercase', fontWeight: '600', marginBottom: '4px' }}>Phone</div>
                      <a href={`tel:${selectedGbp.phone}`} style={{ fontSize: '13px', color: '#047857', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Phone style={{ width: '14px', height: '14px' }} />
                        {selectedGbp.phone}
                      </a>
                    </div>
                    {selectedGbp.website && (
                      <div>
                        <div style={{ fontSize: '11px', color: '#047857', textTransform: 'uppercase', fontWeight: '600', marginBottom: '4px' }}>Website</div>
                        <a href={selectedGbp.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px', color: '#047857', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', wordBreak: 'break-all' }}>
                          <Globe style={{ width: '14px', height: '14px' }} />
                          {selectedGbp.website}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Service Details */}
            <div style={{
              background: '#f9f7f4',
              padding: '24px',
              borderRadius: '12px',
              border: '1px solid rgba(44, 36, 25, 0.08)'
            }}>
              <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#2c2419', marginBottom: '16px', marginTop: 0 }}>
                🔧 Service Configuration
              </h2>

              {selectedClient.service_configs && selectedClient.service_configs.length > 0 ? (
                <div>
                  {(() => {
                    const config = selectedClient.service_configs[0];
                    const hasSeo = !!config?.gsc_site_url;
                    const hasAds = !!config?.gads_customer_id;

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* SEO Services */}
                        {hasSeo && (
                          <div style={{
                            background: '#fef3c7',
                            padding: '16px',
                            borderRadius: '8px',
                            border: '1px solid #fde68a'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                              <BarChart3 style={{ width: '18px', height: '18px', color: '#b45309' }} />
                              <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#b45309', margin: 0, textTransform: 'uppercase' }}>
                                SEO Services
                              </h3>
                            </div>
                            <div style={{ display: 'grid', gap: '8px', fontSize: '12px' }}>
                              <div>
                                <div style={{ color: '#92400e', fontWeight: '600', marginBottom: '2px' }}>Google Search Console</div>
                                <div style={{ color: '#b45309', fontFamily: 'monospace', wordBreak: 'break-all' }}>{config.gsc_site_url}</div>
                              </div>
                              {config.ga_property_id && (
                                <div>
                                  <div style={{ color: '#92400e', fontWeight: '600', marginBottom: '2px' }}>GA Property ID</div>
                                  <div style={{ color: '#b45309', fontFamily: 'monospace' }}>{config.ga_property_id}</div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* ADS Services */}
                        {hasAds && (
                          <div style={{
                            background: '#e0e7ff',
                            padding: '16px',
                            borderRadius: '8px',
                            border: '1px solid #c7d2fe'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                              <Zap style={{ width: '18px', height: '18px', color: '#2563eb' }} />
                              <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#2563eb', margin: 0, textTransform: 'uppercase' }}>
                                Google Ads
                              </h3>
                            </div>
                            <div style={{ display: 'grid', gap: '8px', fontSize: '12px' }}>
                              <div>
                                <div style={{ color: '#1e40af', fontWeight: '600', marginBottom: '2px' }}>Customer ID</div>
                                <div style={{ color: '#2563eb', fontFamily: 'monospace' }}>{config.gads_customer_id}</div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* GBP Services */}
                        {config.gbp_location_id && (
                          <div style={{
                            background: '#ecfdf5',
                            padding: '16px',
                            borderRadius: '8px',
                            border: '1px solid #d1fae5'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                              <MapPin style={{ width: '18px', height: '18px', color: '#047857' }} />
                              <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#047857', margin: 0, textTransform: 'uppercase' }}>
                                Google Business Profile
                              </h3>
                            </div>
                            <div style={{ display: 'grid', gap: '8px', fontSize: '12px' }}>
                              <div>
                                <div style={{ color: '#065f46', fontWeight: '600', marginBottom: '2px' }}>Location ID</div>
                                <div style={{ color: '#047857', fontFamily: 'monospace' }}>{config.gbp_location_id}</div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div style={{ color: '#9ca3af', fontSize: '13px', fontStyle: 'italic' }}>
                  No services configured
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <div style={{ textAlign: 'center', color: '#5c5850' }}>
              <Settings style={{ width: '48px', height: '48px', margin: '0 auto 16px', opacity: 0.3 }} />
              <p>Select a client to view details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

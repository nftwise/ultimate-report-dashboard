'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Search } from 'lucide-react';

interface Client {
  id: string;
  name: string;
  contact_email: string;
  slug: string;
  city: string;
  is_active: boolean;
  service_configs?: {
    ga_property_id?: string;
    gads_customer_id?: string;
    gsc_site_url?: string;
  }[];
}

interface User {
  client_id: string;
  email: string;
  role: string;
}

interface ClientWithUser extends Client {
  user?: User;
}

export default function ClientManagement() {
  const [clients, setClients] = useState<ClientWithUser[]>([]);
  const [gbpClientSet, setGbpClientSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

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

      // Fetch all clients with service configs and GBP locations in parallel
      const [{ data: clientsData, error: clientsError }, { data: gbpRows }] = await Promise.all([
        supabase
          .from('clients')
          .select(`
            id,
            name,
            contact_email,
            slug,
            city,
            is_active,
            service_configs (
              ga_property_id,
              gads_customer_id,
              gsc_site_url
            )
          `)
          .order('name', { ascending: true }),
        supabase
          .from('gbp_locations')
          .select('client_id')
          .eq('is_active', true),
      ]);

      if (clientsError) {
        throw new Error(`Failed to fetch clients: ${clientsError.message}`);
      }

      setGbpClientSet(new Set<string>((gbpRows || []).map((r: any) => r.client_id)));

      const typedClients = (clientsData || []) as Client[];

      // Fetch users to get login credentials
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('client_id, email, role');

      if (!usersError && usersData) {
        const userMap = new Map();
        (usersData as User[]).forEach(user => {
          userMap.set(user.client_id, user);
        });

        // Merge users with clients
        const clientsWithUsers = typedClients.map(client => ({
          ...client,
          user: userMap.get(client.id)
        }));
        setClients(clientsWithUsers);
      } else {
        setClients(typedClients);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      console.error('[ClientManagement] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.contact_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.user?.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getServiceStatus = (client: ClientWithUser) => {
    if (!client.service_configs || client.service_configs.length === 0) {
      return 'None';
    }
    const config = client.service_configs[0];
    const hasSeo = !!config?.gsc_site_url;
    const hasAds = !!config?.gads_customer_id;
    if (hasSeo && hasAds) return 'Both';
    if (hasSeo) return 'SEO';
    if (hasAds) return 'ADS';
    return 'None';
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
    <div style={{ padding: '24px' }}>
      {/* Search Bar */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ position: 'relative' }}>
          <Search style={{ position: 'absolute', left: '16px', top: '12px', width: '18px', height: '18px', color: '#9ca3af' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search clients by name, email, username..."
            style={{
              width: '100%',
              paddingLeft: '48px',
              paddingRight: '16px',
              paddingTop: '12px',
              paddingBottom: '12px',
              border: '1px solid rgba(44, 36, 25, 0.1)',
              borderRadius: '8px',
              fontSize: '14px',
              color: '#2c2419',
              background: '#f5f1ed'
            }}
          />
        </div>
      </div>

      {/* Table */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.95)',
        border: '1px solid rgba(44, 36, 25, 0.1)',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f5f1ed', borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '16px', textAlign: 'left', color: '#2c2419', fontWeight: '600', fontSize: '13px' }}>Client Name</th>
                <th style={{ padding: '16px', textAlign: 'left', color: '#2c2419', fontWeight: '600', fontSize: '13px' }}>Email</th>
                <th style={{ padding: '16px', textAlign: 'left', color: '#2c2419', fontWeight: '600', fontSize: '13px' }}>Username</th>
                <th style={{ padding: '16px', textAlign: 'left', color: '#2c2419', fontWeight: '600', fontSize: '13px' }}>Role</th>
                <th style={{ padding: '16px', textAlign: 'left', color: '#2c2419', fontWeight: '600', fontSize: '13px' }}>City</th>
                <th style={{ padding: '16px', textAlign: 'left', color: '#2c2419', fontWeight: '600', fontSize: '13px' }}>Services</th>
                <th style={{ padding: '16px', textAlign: 'center', color: '#2c2419', fontWeight: '600', fontSize: '13px' }}>GA</th>
                <th style={{ padding: '16px', textAlign: 'center', color: '#2c2419', fontWeight: '600', fontSize: '13px' }}>GSC</th>
                <th style={{ padding: '16px', textAlign: 'center', color: '#2c2419', fontWeight: '600', fontSize: '13px' }}>GBP</th>
                <th style={{ padding: '16px', textAlign: 'center', color: '#2c2419', fontWeight: '600', fontSize: '13px' }}>ADS</th>
                <th style={{ padding: '16px', textAlign: 'center', color: '#2c2419', fontWeight: '600', fontSize: '13px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client) => (
                <tr
                  key={client.id}
                  style={{
                    borderBottom: '1px solid #e5e7eb',
                    transition: 'background 200ms ease'
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLTableRowElement).style.background = '#fafaf8';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLTableRowElement).style.background = 'transparent';
                  }}
                >
                  <td style={{ padding: '14px 16px', color: '#2c2419', fontSize: '13px', fontWeight: '500' }}>
                    {client.name}
                  </td>
                  <td style={{ padding: '14px 16px', color: '#5c5850', fontSize: '12px' }}>
                    {client.contact_email}
                  </td>
                  <td style={{ padding: '14px 16px', color: '#2c2419', fontSize: '12px', fontFamily: 'monospace' }}>
                    {client.user?.email || '-'}
                  </td>
                  <td style={{ padding: '14px 16px', color: '#5c5850', fontSize: '12px', textTransform: 'capitalize' }}>
                    {client.user?.role || '-'}
                  </td>
                  <td style={{ padding: '14px 16px', color: '#5c5850', fontSize: '12px' }}>
                    {client.city || '-'}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{
                      background: getServiceStatus(client) !== 'None' ? '#fff8e1' : '#f3f4f6',
                      color: getServiceStatus(client) !== 'None' ? '#b45309' : '#6b7280',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: '500',
                      display: 'inline-block'
                    }}>
                      {getServiceStatus(client)}
                    </span>
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
                    {gbpClientSet.has(client.id) ? (
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
                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                    <span style={{
                      background: client.is_active ? '#e6f4ea' : '#f3f4f6',
                      color: client.is_active ? '#059669' : '#6b7280',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: '500'
                    }}>
                      {client.is_active ? '✓ Active' : '○ Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredClients.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#5c5850' }}>
            No clients found
          </div>
        )}
      </div>
    </div>
  );
}

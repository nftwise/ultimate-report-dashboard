rep'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import AdminLayout from '@/components/admin/AdminLayout';
import { Facebook, Trash2, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

interface ClientOption {
  id: string;
  name: string;
  city: string;
}

interface ConnectedClient {
  id: string;
  name: string;
  city: string;
  fb_ad_account_id: string;
}

export default function OnboardFBPage() {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [connectedClients, setConnectedClients] = useState<ConnectedClient[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [adAccountId, setAdAccountId] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all clients
      const { data: allClients } = await supabase
        .from('clients')
        .select('id, name, city')
        .eq('is_active', true)
        .order('name', { ascending: true });

      setClients(allClients || []);

      // Fetch connected clients (those with fb_ad_account_id set)
      const { data: configData } = await supabase
        .from('clients')
        .select('id, name, city, service_configs(fb_ad_account_id)')
        .eq('is_active', true)
        .order('name', { ascending: true });

      const connected: ConnectedClient[] = [];
      (configData || []).forEach((c: any) => {
        const cfg = Array.isArray(c.service_configs) ? c.service_configs[0] : c.service_configs;
        if (cfg?.fb_ad_account_id) {
          connected.push({
            id: c.id,
            name: c.name,
            city: c.city || '',
            fb_ad_account_id: cfg.fb_ad_account_id,
          });
        }
      });

      setConnectedClients(connected);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!selectedClientId || !adAccountId.trim()) {
      setResult({ type: 'error', message: 'Please select a client and enter an Ad Account ID.' });
      return;
    }

    setSubmitting(true);
    setResult(null);

    try {
      const resp = await fetch('/api/admin/onboard-fb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: selectedClientId, adAccountId: adAccountId.trim() }),
      });

      const data = await resp.json();

      if (data.success) {
        setResult({
          type: 'success',
          message: `Connected ${data.clientName} (act_${data.adAccountId}). Backfilled ${data.daysBackfilled} days.${data.errors ? ` ${data.errors.length} day(s) had errors.` : ''}`,
        });
        setAdAccountId('');
        setSelectedClientId('');
        fetchData(); // refresh connected list
      } else {
        setResult({ type: 'error', message: data.error || 'Unknown error' });
      }
    } catch (err: any) {
      setResult({ type: 'error', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisconnect = async (clientId: string) => {
    if (!confirm('Are you sure you want to disconnect this client from Facebook Ads?')) return;

    setDisconnecting(clientId);
    try {
      const resp = await fetch('/api/admin/onboard-fb', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      });

      const data = await resp.json();
      if (data.success) {
        fetchData();
      } else {
        alert(`Failed to disconnect: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setDisconnecting(null);
    }
  };

  const cardStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.9)',
    backdropFilter: 'blur(10px)',
    borderRadius: 12,
    padding: '24px 28px',
    border: '1px solid rgba(44,36,25,0.08)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  };

  const thStyle: React.CSSProperties = {
    padding: '10px 14px',
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#9ca3af',
    textAlign: 'left',
    whiteSpace: 'nowrap',
    background: 'rgba(249,247,244,0.8)',
    borderBottom: '1px solid rgba(44,36,25,0.08)',
  };

  const tdStyle: React.CSSProperties = {
    padding: '11px 14px',
    fontSize: '13px',
    color: '#2c2419',
    borderBottom: '1px solid rgba(44,36,25,0.05)',
    whiteSpace: 'nowrap',
  };

  if (loading) {
    return (
      <AdminLayout>
        <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 40, height: 40, border: '3px solid #f3f3f3', borderTop: '3px solid #c4704f', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
            <p style={{ color: '#2c2419', opacity: 0.6 }}>Loading...</p>
          </div>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
      </AdminLayout>
    );
  }

  // Filter out already-connected clients from dropdown
  const connectedIds = new Set(connectedClients.map(c => c.id));
  const availableClients = clients.filter(c => !connectedIds.has(c.id));

  return (
    <AdminLayout>
      <div style={{ padding: '28px 32px', maxWidth: 900, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <span style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'rgba(59,89,152,0.1)', color: '#3b5998',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Facebook size={20} />
          </span>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#2c2419', margin: 0, letterSpacing: '-0.02em' }}>
              Facebook Onboarding
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#9ca3af' }}>
              Connect client ad accounts for Facebook Ads tracking
            </p>
          </div>
        </div>

        {/* ── Top Section: Connect Form ── */}
        <div style={{ ...cardStyle, marginBottom: 24 }}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#2c2419', margin: '0 0 18px', letterSpacing: '-0.01em' }}>
            Connect New Client
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Client dropdown */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#5c5850', marginBottom: 6 }}>
                Client
              </label>
              <select
                value={selectedClientId}
                onChange={e => setSelectedClientId(e.target.value)}
                disabled={submitting}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(44,36,25,0.15)',
                  background: '#fff',
                  fontSize: '14px',
                  color: '#2c2419',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="">Select a client...</option>
                {availableClients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.city ? ` (${c.city})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Ad Account ID input */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#5c5850', marginBottom: 6 }}>
                Ad Account ID
              </label>
              <input
                type="text"
                value={adAccountId}
                onChange={e => setAdAccountId(e.target.value)}
                disabled={submitting}
                placeholder="act_XXXXXXXXX or just the numbers"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(44,36,25,0.15)',
                  background: '#fff',
                  fontSize: '14px',
                  color: '#2c2419',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Connect button */}
            <button
              onClick={handleConnect}
              disabled={submitting || !selectedClientId || !adAccountId.trim()}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '11px 20px',
                borderRadius: 8,
                border: 'none',
                background: submitting ? '#9ca3af' : '#c4704f',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 600,
                cursor: submitting ? 'not-allowed' : 'pointer',
                transition: 'all 150ms ease',
                alignSelf: 'flex-start',
                opacity: (!selectedClientId || !adAccountId.trim()) ? 0.5 : 1,
              }}
            >
              {submitting ? (
                <>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  Connecting & Backfilling...
                </>
              ) : (
                'Connect & Backfill 30 Days'
              )}
            </button>

            {/* Result message */}
            {result && (
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '12px 16px',
                borderRadius: 8,
                background: result.type === 'success' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                border: `1px solid ${result.type === 'success' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
              }}>
                {result.type === 'success' ? (
                  <CheckCircle size={18} style={{ color: '#10b981', flexShrink: 0, marginTop: 1 }} />
                ) : (
                  <AlertCircle size={18} style={{ color: '#ef4444', flexShrink: 0, marginTop: 1 }} />
                )}
                <span style={{
                  fontSize: '13px',
                  color: result.type === 'success' ? '#065f46' : '#991b1b',
                  lineHeight: 1.5,
                }}>
                  {result.message}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Bottom Section: Connected Clients ── */}
        <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(44,36,25,0.08)' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#2c2419', margin: 0 }}>
              Connected Clients
            </h2>
            <p style={{ fontSize: '12px', color: '#9ca3af', margin: '3px 0 0' }}>
              {connectedClients.length} client{connectedClients.length !== 1 ? 's' : ''} with Facebook Ads configured
            </p>
          </div>

          {connectedClients.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: '14px', color: '#9ca3af' }}>No clients connected yet.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Client Name</th>
                    <th style={thStyle}>City</th>
                    <th style={thStyle}>Ad Account ID</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {connectedClients.map((c, idx) => (
                    <tr key={c.id} style={{ background: idx % 2 === 0 ? 'transparent' : 'rgba(249,247,244,0.5)' }}>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{c.name}</td>
                      <td style={{ ...tdStyle, color: '#6b7280', fontSize: '12px' }}>{c.city || '—'}</td>
                      <td style={tdStyle}>
                        <code style={{
                          fontSize: '12px',
                          background: 'rgba(44,36,25,0.05)',
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontFamily: 'monospace',
                        }}>
                          act_{c.fb_ad_account_id}
                        </code>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <button
                          onClick={() => handleDisconnect(c.id)}
                          disabled={disconnecting === c.id}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '5px 12px',
                            borderRadius: 6,
                            border: '1px solid rgba(239,68,68,0.2)',
                            background: 'transparent',
                            color: '#ef4444',
                            fontSize: '12px',
                            fontWeight: 500,
                            cursor: disconnecting === c.id ? 'not-allowed' : 'pointer',
                            transition: 'all 150ms ease',
                            opacity: disconnecting === c.id ? 0.5 : 1,
                          }}
                        >
                          {disconnecting === c.id ? (
                            <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                          ) : (
                            <Trash2 size={12} />
                          )}
                          Disconnect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    </AdminLayout>
  );
}

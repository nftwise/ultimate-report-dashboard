'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Database } from 'lucide-react';

const inputStyle = {
  width: '100%',
  padding: '10px 14px',
  border: '1px solid rgba(44, 36, 25, 0.2)',
  borderRadius: '8px',
  fontSize: '14px',
  background: '#faf8f6',
  color: '#2c2419',
  outline: 'none',
  boxSizing: 'border-box' as const,
};

const readonlyInputStyle = {
  ...inputStyle,
  background: '#f0ece5',
  color: '#9ca3af',
  cursor: 'not-allowed',
};

const labelStyle = {
  display: 'block',
  fontSize: '12px',
  fontWeight: '600' as const,
  color: '#5c5850',
  marginBottom: '6px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
};

const sectionStyle = {
  background: 'rgba(255, 255, 255, 0.9)',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(44, 36, 25, 0.1)',
  borderRadius: '16px',
  padding: '24px',
  boxShadow: '0 4px 20px rgba(44, 36, 25, 0.06)',
  marginBottom: '20px',
};

interface EditClientParams {
  params: Promise<{ id: string }>;
}

export default function EditClientPage({ params }: EditClientParams) {
  const router = useRouter();
  const [clientId, setClientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [hasGbp, setHasGbp] = useState(false);

  const [backfillDays, setBackfillDays] = useState(90);
  const [backfill, setBackfill] = useState<{
    running: boolean; currentDay: number; totalDays: number;
    currentService: string; done: boolean; errors: string[];
  }>({ running: false, currentDay: 0, totalDays: 0, currentService: '', done: false, errors: [] });

  const [form, setForm] = useState({
    name: '',
    slug: '',
    city: '',
    contact_email: '',
    owner: '',
    website_url: '',
    ads_budget_month: '',
    notes: '',
    status: 'Working',
    is_active: true,
    has_seo: false,
    has_ads: false,
    ga4_property_id: '',
    google_ads_customer_id: '',
    gsc_site_url: '',
    gbp_location_id: '',
  });

  useEffect(() => {
    params.then(p => {
      setClientId(p.id);
      fetchClient(p.id);
    });
  }, []);

  async function fetchClient(id: string) {
    try {
      const res = await fetch(`/api/admin/client-detail?id=${encodeURIComponent(id)}`);
      const payload = await res.json();
      if (!payload?.success || !payload.client) {
        setError(payload?.error || 'Client not found');
        setLoading(false);
        return;
      }

      const client = payload.client;
      const config = payload.config || {};
      const gbpRow = payload.gbp;
      setHasGbp(!!gbpRow);

      setForm({
        name: client.name || '',
        slug: client.slug || '',
        city: client.city || '',
        contact_email: client.contact_email || '',
        owner: client.owner || '',
        website_url: client.website_url || '',
        ads_budget_month: client.ads_budget_month != null ? String(client.ads_budget_month) : '',
        notes: client.notes || '',
        status: client.status || 'Working',
        is_active: client.is_active !== false,
        has_seo: client.has_seo || false,
        has_ads: client.has_ads || false,
        ga4_property_id: config.ga_property_id || '',
        google_ads_customer_id: config.gads_customer_id || '',
        gsc_site_url: config.gsc_site_url || '',
        gbp_location_id: gbpRow?.gbp_location_id?.replace('locations/', '') || '',
      });
      setLoading(false);
    } catch {
      setError('Failed to load client');
      setLoading(false);
    }
  }

  async function runBackfill() {
    if (!clientId) return;
    const services = [
      { endpoint: '/api/cron/sync-ga4', label: 'GA4', enabled: form.has_seo },
      { endpoint: '/api/cron/sync-gsc', label: 'GSC', enabled: form.has_seo },
      { endpoint: '/api/cron/sync-ads', label: 'Google Ads', enabled: form.has_ads },
      { endpoint: '/api/cron/sync-gbp', label: 'GBP', enabled: hasGbp },
    ].filter(s => s.enabled);
    if (services.length === 0) return;

    const dates: string[] = [];
    const now = new Date();
    for (let i = 1; i <= backfillDays; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }

    setBackfill({ running: true, currentDay: 0, totalDays: dates.length, currentService: '', done: false, errors: [] });
    const errors: string[] = [];

    for (let i = 0; i < dates.length; i++) {
      const date = dates[i];
      for (const service of services) {
        setBackfill(prev => ({ ...prev, currentDay: i + 1, currentService: service.label }));
        try {
          await fetch('/api/admin/trigger-cron', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: service.endpoint, params: { date, clientId } }),
          });
        } catch { errors.push(`${date} ${service.label}`); }
      }
      setBackfill(prev => ({ ...prev, currentService: 'Rollup' }));
      try {
        await fetch('/api/admin/trigger-cron', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: '/api/admin/run-rollup', method: 'POST', params: { date, clientId } }),
        });
      } catch { errors.push(`${date} rollup`); }
    }

    setBackfill(prev => ({ ...prev, running: false, done: true, errors }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError('Client name is required.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // clients table fields
          name: form.name.trim(),
          city: form.city.trim() || null,
          contact_email: form.contact_email.trim() || null,
          owner: form.owner.trim() || null,
          website_url: form.website_url.trim() || null,
          ads_budget_month: form.ads_budget_month ? Number(form.ads_budget_month) : null,
          notes: form.notes.trim() || null,
          status: form.status,
          is_active: form.is_active,
          has_seo: form.has_seo,
          has_ads: form.has_ads,
          // service_configs table fields (correct DB field names)
          ga_property_id: form.ga4_property_id.trim() || null,
          gads_customer_id: form.google_ads_customer_id.trim() || null,
          gsc_site_url: form.gsc_site_url.trim() || null,
          gbp_location_id: form.gbp_location_id.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update client');

      setSuccess(true);
      setTimeout(() => router.push('/admin-dashboard/clients'), 800);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f5f1ed 0, #ede8e3 100%)' }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#c4704f' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #f5f1ed 0, #ede8e3 100%)' }}>
      {/* Header */}
      <nav className="sticky top-14 md:top-0 z-30 flex items-center gap-4 px-8 py-4" style={{
        background: 'rgba(245, 241, 237, 0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(44, 36, 25, 0.1)',
      }}>
        <button
          onClick={() => router.push('/admin-dashboard/clients')}
          className="flex items-center gap-2 hover:opacity-70 transition"
          style={{ color: '#c4704f', fontWeight: 600, fontSize: '14px' }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <span style={{ color: 'rgba(44,36,25,0.3)' }}>|</span>
        <span style={{ fontSize: '14px', fontWeight: '600', color: '#2c2419' }}>Edit Client</span>
      </nav>

      {/* Form */}
      <div style={{ maxWidth: '680px', margin: '40px auto', padding: '0 24px 60px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#2c2419', marginBottom: '8px', letterSpacing: '-0.02em' }}>
          Edit Client
        </h1>
        <p style={{ fontSize: '14px', color: '#8a7f74', marginBottom: '32px' }}>
          Update client details and service configuration.
        </p>

        <form onSubmit={handleSubmit}>
          {/* Section 1: Basic Info */}
          <div style={sectionStyle}>
            <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#c4704f', marginBottom: '20px' }}>
              Basic Info
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Client Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  style={inputStyle}
                  required
                />
              </div>

              <div>
                <label style={labelStyle}>Slug <span style={{ fontWeight: 400, textTransform: 'none', color: '#aaa' }}>(read-only)</span></label>
                <input
                  type="text"
                  value={form.slug}
                  readOnly
                  style={readonlyInputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>City</label>
                <input
                  type="text"
                  value={form.city}
                  onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Contact Email</label>
                <input
                  type="email"
                  value={form.contact_email}
                  onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Account Owner</label>
                <input
                  type="text"
                  value={form.owner}
                  onChange={e => setForm(f => ({ ...f, owner: e.target.value }))}
                  style={inputStyle}
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Website URL</label>
                <input
                  type="text"
                  value={form.website_url}
                  onChange={e => setForm(f => ({ ...f, website_url: e.target.value }))}
                  placeholder="https://example.com"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Ads Budget (Monthly)</label>
                <input
                  type="number"
                  value={form.ads_budget_month}
                  onChange={e => setForm(f => ({ ...f, ads_budget_month: e.target.value }))}
                  placeholder="e.g. 5000"
                  style={inputStyle}
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical' as const }}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Status */}
          <div style={sectionStyle}>
            <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#c4704f', marginBottom: '20px' }}>
              Status
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' as const }}>
              {/* Active toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                  style={{
                    position: 'relative',
                    width: '56px',
                    height: '30px',
                    borderRadius: '15px',
                    border: 'none',
                    cursor: 'pointer',
                    background: form.is_active ? '#10b981' : '#ef4444',
                    transition: 'background 0.3s ease',
                  }}
                >
                  <div style={{
                    position: 'absolute',
                    top: '3px',
                    left: form.is_active ? '29px' : '3px',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: '#fff',
                    transition: 'left 0.3s ease',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }} />
                </button>
                <span style={{ fontSize: '14px', fontWeight: '600', color: form.is_active ? '#10b981' : '#ef4444' }}>
                  {form.is_active ? 'Active' : 'Archived'}
                </span>
              </div>

              {/* Onboarding status */}
              <div>
                <label style={{ ...labelStyle, marginBottom: '4px' }}>Onboarding Status</label>
                <select
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  style={{ ...inputStyle, width: 'auto', paddingRight: '32px' }}
                >
                  {['Onboarding', 'Working', 'Cancel', 'Cancelled'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Services */}
          <div style={sectionStyle}>
            <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#c4704f', marginBottom: '20px' }}>
              Services Enabled
            </p>
            <div style={{ display: 'flex', gap: '24px' }}>
              {[
                { key: 'has_seo' as const, label: 'SEO' },
                { key: 'has_ads' as const, label: 'Google Ads' },
              ].map(({ key, label }) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: '#2c2419', fontWeight: 500 }}>
                  <input
                    type="checkbox"
                    checked={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))}
                    style={{ width: '16px', height: '16px', accentColor: '#c4704f', cursor: 'pointer' }}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* Section 4: Integration IDs — always visible */}
          <div style={sectionStyle}>
            <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#c4704f', marginBottom: '4px' }}>
              Integration IDs
            </p>
            <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '20px' }}>Connect to Google APIs. Leave blank if not applicable.</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>GA4 Property ID</label>
                <input
                  type="text"
                  value={form.ga4_property_id}
                  onChange={e => setForm(f => ({ ...f, ga4_property_id: e.target.value }))}
                  placeholder="123456789"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Google Ads Customer ID</label>
                <input
                  type="text"
                  value={form.google_ads_customer_id}
                  onChange={e => setForm(f => ({ ...f, google_ads_customer_id: e.target.value }))}
                  placeholder="123-456-7890"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>GSC Site URL</label>
                <input
                  type="text"
                  value={form.gsc_site_url}
                  onChange={e => setForm(f => ({ ...f, gsc_site_url: e.target.value }))}
                  placeholder="https://example.com/"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>GBP Location ID</label>
                <input
                  type="text"
                  value={form.gbp_location_id}
                  onChange={e => setForm(f => ({ ...f, gbp_location_id: e.target.value }))}
                  placeholder="1234567890"
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#dc2626' }}>
              {error}
            </div>
          )}

          {/* Success */}
          {success && (
            <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#059669' }}>
              Client updated successfully! Redirecting...
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || success}
            style={{
              width: '100%',
              padding: '14px',
              background: success ? '#10b981' : submitting ? '#d9a854' : '#c4704f',
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              fontSize: '15px',
              fontWeight: '700',
              cursor: submitting || success ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'background 0.2s',
            }}
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {success ? 'Saved!' : submitting ? 'Saving...' : 'Save Changes'}
          </button>
        </form>

        {/* Backfill Section */}
        <div style={{ ...sectionStyle, marginTop: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Database style={{ width: 14, height: 14, color: '#c4704f' }} />
            <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#c4704f', margin: 0 }}>
              Backfill Historical Data
            </p>
          </div>
          <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '16px' }}>
            Run after adding new Integration IDs to populate historical data. Keep this tab open while running.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <label style={{ fontSize: '12px', color: '#5c5850', fontWeight: 600 }}>Days:</label>
            {[30, 60, 90].map(d => (
              <button key={d} type="button" onClick={() => setBackfillDays(d)}
                style={{ padding: '4px 12px', borderRadius: '6px', border: '1px solid', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  background: backfillDays === d ? '#c4704f' : 'transparent',
                  color: backfillDays === d ? '#fff' : '#5c5850',
                  borderColor: backfillDays === d ? '#c4704f' : 'rgba(44,36,25,0.2)',
                }}>
                {d}d
              </button>
            ))}
          </div>

          {backfill.running ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#5c5850', marginBottom: '6px' }}>
                <span>Day {backfill.currentDay} / {backfill.totalDays} — {backfill.currentService}</span>
                <span>{backfill.totalDays > 0 ? Math.round((backfill.currentDay / backfill.totalDays) * 100) : 0}%</span>
              </div>
              <div style={{ height: '6px', background: 'rgba(44,36,25,0.1)', borderRadius: '99px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${backfill.totalDays > 0 ? Math.round((backfill.currentDay / backfill.totalDays) * 100) : 0}%`, background: '#c4704f', borderRadius: '99px', transition: 'width 0.3s' }} />
              </div>
            </div>
          ) : backfill.done ? (
            <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#059669' }}>
              Backfill complete — {backfill.errors.length > 0 ? `${backfill.errors.length} errors` : 'all data synced'}
            </div>
          ) : (
            <button type="button" onClick={runBackfill}
              style={{ width: '100%', padding: '10px', background: 'rgba(196,112,79,0.08)', border: '1px solid rgba(196,112,79,0.3)', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: '#c4704f', cursor: 'pointer' }}>
              Backfill {backfillDays} Days
            </button>
          )}
        </div>

        {/* Danger Zone */}
        <div style={{ ...sectionStyle, marginTop: '32px', borderColor: 'rgba(239,68,68,0.2)' }}>
          <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#dc2626', marginBottom: '8px' }}>
            Danger Zone
          </p>
          <p style={{ fontSize: '13px', color: '#9ca3af' }}>
            To delete this client, please contact the system administrator.
          </p>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

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

  const [form, setForm] = useState({
    name: '',
    slug: '',
    city: '',
    contact_email: '',
    owner: '',
    website_url: '',
    ads_budget_month: '',
    notes: '',
    is_active: true,
    has_seo: false,
    has_ads: false,
    has_gbp: false,
    ga4_property_id: '',
    google_ads_customer_id: '',
  });

  useEffect(() => {
    params.then(p => {
      setClientId(p.id);
      fetchClient(p.id);
    });
  }, []);

  async function fetchClient(id: string) {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
      );

      const { data: client, error: fetchError } = await supabase
        .from('clients')
        .select('*, service_configs(ga_property_id, gads_customer_id, gbp_location_id, gsc_site_url)')
        .eq('id', id)
        .single();

      if (fetchError || !client) {
        setError('Client not found');
        setLoading(false);
        return;
      }

      const config = Array.isArray(client.service_configs) ? client.service_configs[0] : client.service_configs || {};

      setForm({
        name: client.name || '',
        slug: client.slug || '',
        city: client.city || '',
        contact_email: client.contact_email || '',
        owner: client.owner || '',
        website_url: client.website_url || '',
        ads_budget_month: client.ads_budget_month != null ? String(client.ads_budget_month) : '',
        notes: client.notes || '',
        is_active: client.is_active !== false,
        has_seo: client.has_seo || false,
        has_ads: client.has_ads || false,
        has_gbp: client.has_gbp || false,
        ga4_property_id: config.ga_property_id || '',
        google_ads_customer_id: config.gads_customer_id || '',
      });
      setLoading(false);
    } catch {
      setError('Failed to load client');
      setLoading(false);
    }
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
          name: form.name.trim(),
          city: form.city.trim() || null,
          contact_email: form.contact_email.trim() || null,
          owner: form.owner.trim() || null,
          website_url: form.website_url.trim() || null,
          ads_budget_month: form.ads_budget_month ? Number(form.ads_budget_month) : null,
          notes: form.notes.trim() || null,
          is_active: form.is_active,
          has_seo: form.has_seo,
          has_ads: form.has_ads,
          has_gbp: form.has_gbp,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update client');

      setSuccess(true);
      setTimeout(() => router.push('/admin-dashboard'), 800);
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
      <nav className="sticky top-0 z-50 flex items-center gap-4 px-8 py-4" style={{
        background: 'rgba(245, 241, 237, 0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(44, 36, 25, 0.1)',
      }}>
        <button
          onClick={() => router.push('/admin-dashboard')}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
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
              <span style={{
                fontSize: '14px',
                fontWeight: '600',
                color: form.is_active ? '#10b981' : '#ef4444',
              }}>
                {form.is_active ? 'Active' : 'Archived'}
              </span>
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
                { key: 'has_gbp' as const, label: 'Google Business' },
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

          {/* Section 4: Integration IDs (conditional) */}
          {(form.has_seo || form.has_ads) && (
            <div style={sectionStyle}>
              <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#c4704f', marginBottom: '4px' }}>
                Integration IDs
              </p>
              <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '20px' }}>These IDs connect to Google APIs</p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {form.has_seo && (
                  <div>
                    <label style={labelStyle}>GA4 Property ID</label>
                    <input
                      type="text"
                      value={form.ga4_property_id}
                      onChange={e => setForm(f => ({ ...f, ga4_property_id: e.target.value }))}
                      placeholder="properties/123456789"
                      style={inputStyle}
                    />
                  </div>
                )}
                {form.has_ads && (
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
                )}
              </div>
            </div>
          )}

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

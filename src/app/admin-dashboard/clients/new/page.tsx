'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';

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

function autoSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function NewClientPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    name: '',
    slug: '',
    city: '',
    contactEmail: '',
    owner: '',
    has_seo: false,
    has_ads: false,
    has_gbp: false,
    gaPropertyId: '',
    gscSiteUrl: '',
    gadsCustomerId: '',
    gbpLocationId: '',
  });

  const [slugManual, setSlugManual] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleNameChange(value: string) {
    setForm(f => ({
      ...f,
      name: value,
      slug: slugManual ? f.slug : autoSlug(value),
    }));
  }

  function handleSlugChange(value: string) {
    setSlugManual(true);
    setForm(f => ({ ...f, slug: value }));
  }

  function handleCheck(field: 'has_seo' | 'has_ads' | 'has_gbp', checked: boolean) {
    setForm(f => ({ ...f, [field]: checked }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.name.trim() || !form.slug.trim() || !form.city.trim() || !form.contactEmail.trim()) {
      setError('Name, slug, city, and contact email are required.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/create-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          slug: form.slug.trim(),
          city: form.city.trim(),
          contactEmail: form.contactEmail.trim(),
          owner: form.owner.trim() || undefined,
          gaPropertyId: form.has_seo && form.gaPropertyId ? form.gaPropertyId.trim() : undefined,
          gscSiteUrl: form.has_seo && form.gscSiteUrl ? form.gscSiteUrl.trim() : undefined,
          gadsCustomerId: form.has_ads && form.gadsCustomerId ? form.gadsCustomerId.trim() : undefined,
          gbpLocationId: form.has_gbp && form.gbpLocationId ? form.gbpLocationId.trim() : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create client');

      router.push(`/admin-dashboard/${data.client.slug}`);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
      setSubmitting(false);
    }
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
        <span style={{ fontSize: '14px', fontWeight: '600', color: '#2c2419' }}>Add New Client</span>
      </nav>

      {/* Form */}
      <div style={{ maxWidth: '680px', margin: '40px auto', padding: '0 24px 60px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#2c2419', marginBottom: '8px', letterSpacing: '-0.02em' }}>
          New Client
        </h1>
        <p style={{ fontSize: '14px', color: '#8a7f74', marginBottom: '32px' }}>
          Fill in the details below. Integration IDs can be added later.
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
                  onChange={e => handleNameChange(e.target.value)}
                  placeholder="e.g. Smith Chiropractic"
                  style={inputStyle}
                  required
                />
              </div>

              <div>
                <label style={labelStyle}>Slug * <span style={{ fontWeight: 400, textTransform: 'none', color: '#aaa' }}>(URL identifier)</span></label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={e => handleSlugChange(e.target.value)}
                  placeholder="smith-chiropractic"
                  style={inputStyle}
                  required
                />
              </div>

              <div>
                <label style={labelStyle}>City *</label>
                <input
                  type="text"
                  value={form.city}
                  onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                  placeholder="e.g. Los Angeles, CA"
                  style={inputStyle}
                  required
                />
              </div>

              <div>
                <label style={labelStyle}>Contact Email *</label>
                <input
                  type="email"
                  value={form.contactEmail}
                  onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))}
                  placeholder="doctor@clinic.com"
                  style={inputStyle}
                  required
                />
              </div>

              <div>
                <label style={labelStyle}>Account Owner</label>
                <input
                  type="text"
                  value={form.owner}
                  onChange={e => setForm(f => ({ ...f, owner: e.target.value }))}
                  placeholder="e.g. John"
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Services */}
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
                    onChange={e => handleCheck(key, e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: '#c4704f', cursor: 'pointer' }}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* Section 3: Integration IDs (conditional) */}
          {(form.has_seo || form.has_ads || form.has_gbp) && (
            <div style={sectionStyle}>
              <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#c4704f', marginBottom: '4px' }}>
                Integration IDs
              </p>
              <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '20px' }}>Optional — can be added later</p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {form.has_seo && (
                  <>
                    <div>
                      <label style={labelStyle}>GA4 Property ID</label>
                      <input
                        type="text"
                        value={form.gaPropertyId}
                        onChange={e => setForm(f => ({ ...f, gaPropertyId: e.target.value }))}
                        placeholder="properties/123456789"
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>GSC Site URL</label>
                      <input
                        type="text"
                        value={form.gscSiteUrl}
                        onChange={e => setForm(f => ({ ...f, gscSiteUrl: e.target.value }))}
                        placeholder="https://example.com/"
                        style={inputStyle}
                      />
                    </div>
                  </>
                )}
                {form.has_ads && (
                  <div>
                    <label style={labelStyle}>Google Ads Customer ID</label>
                    <input
                      type="text"
                      value={form.gadsCustomerId}
                      onChange={e => setForm(f => ({ ...f, gadsCustomerId: e.target.value }))}
                      placeholder="123-456-7890"
                      style={inputStyle}
                    />
                  </div>
                )}
                {form.has_gbp && (
                  <div>
                    <label style={labelStyle}>GBP Location ID</label>
                    <input
                      type="text"
                      value={form.gbpLocationId}
                      onChange={e => setForm(f => ({ ...f, gbpLocationId: e.target.value }))}
                      placeholder="locations/1234567890"
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

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%',
              padding: '14px',
              background: submitting ? '#d9a854' : '#c4704f',
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              fontSize: '15px',
              fontWeight: '700',
              cursor: submitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'background 0.2s',
            }}
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? 'Creating...' : 'Create Client'}
          </button>
        </form>
      </div>
    </div>
  );
}

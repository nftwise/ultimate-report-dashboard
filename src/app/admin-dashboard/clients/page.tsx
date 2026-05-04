'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Plus, Edit2, XCircle, CheckCircle, Search, X, TrendingDown, Database, Loader2, ChevronDown, ExternalLink, RefreshCw } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { useSession } from 'next-auth/react';

interface Client {
  id: string;
  name: string;
  slug: string;
  city: string;
  contact_name: string | null;
  contact_email: string | null;
  website_url: string | null;
  is_active: boolean;
  has_seo: boolean;
  has_ads: boolean;
  has_gbp: boolean;
  notes: string | null;
  ads_budget_month: number | null;
  status: string | null;
  industry: string | null;
  owner: string | null;
}

type ModalMode = 'edit' | null;

interface FormData {
  name: string;
  slug: string;
  city: string;
  contact_name: string;
  contact_email: string;
  website_url: string;
  has_seo: boolean;
  has_ads: boolean;
  notes: string;
  ads_budget_month: string;
  status: string;
}

const emptyForm: FormData = {
  name: '', slug: '', city: '', contact_name: '', contact_email: '',
  website_url: '', has_seo: false, has_ads: false, notes: '',
  ads_budget_month: '', status: 'Working',
};


export default function ClientsManagementPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === 'admin';

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCancelled, setShowCancelled] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const [confirmReactivate, setConfirmReactivate] = useState<string | null>(null);

  // Last sync dates per client
  const [lastSync, setLastSync] = useState<Record<string, string>>({});

  // Expanded rows (Notes + Form Fills accordion)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) => setExpandedRows(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  // Notes inline editing
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [notesSavingId, setNotesSavingId] = useState<string | null>(null);

  // Manual form fills (clientId → year_month → value)
  const [fillsMap, setFillsMap] = useState<Record<string, Record<string, string>>>({});
  const [fillsSavingKey, setFillsSavingKey] = useState<string | null>(null);

  // Month range picker for form fills table
  const defaultFromYM = (() => { const d = new Date(); d.setMonth(d.getMonth() - 5); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; })();
  const defaultToYM = (() => { const d = new Date(); d.setMonth(d.getMonth() + 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; })();
  const [fillsFromYM, setFillsFromYM] = useState(defaultFromYM);
  const [fillsToYM, setFillsToYM] = useState(defaultToYM);

  // Build month list from range (oldest → newest)
  const monthsInRange = (() => {
    const months: { ym: string; label: string }[] = [];
    const [fy, fm] = fillsFromYM.split('-').map(Number);
    const [ty, tm] = fillsToYM.split('-').map(Number);
    let y = fy, m = fm;
    while (y < ty || (y === ty && m <= tm)) {
      const d = new Date(y, m - 1, 1);
      months.push({ ym: `${y}-${String(m).padStart(2, '0')}`, label: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) });
      m++; if (m > 12) { m = 1; y++; }
      if (months.length > 36) break; // safety cap
    }
    return months.reverse(); // newest first
  })();

  // Backfill modal
  const [backfillClient, setBackfillClient] = useState<Client | null>(null);
  const [backfillDays, setBackfillDays] = useState(90);
  type ModalStep = 'idle' | 'testing' | 'ready' | 'running' | 'done';
  const [modalStep, setModalStep] = useState<ModalStep>('idle');
  const [testResults, setTestResults] = useState<{ label: string; ok: boolean; message: string }[]>([]);
  const [backfill, setBackfill] = useState<{
    currentDay: number; totalDays: number; currentService: string; errors: string[]; _enabledServiceCount?: number;
  }>({ currentDay: 0, totalDays: 0, currentService: '', errors: [] });

  function openBackfillModal(client: Client) {
    setBackfillClient(client);
    setBackfillDays(90);
    setModalStep('idle');
    setTestResults([]);
    setBackfill({ currentDay: 0, totalDays: 0, currentService: '', errors: [] });
  }

  function getYesterday() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  async function testConnections() {
    if (!backfillClient) return;
    setModalStep('testing');
    const yesterday = getYesterday();
    const services = [
      { endpoint: '/api/cron/sync-ga4', label: 'GA4 (Analytics)', enabled: backfillClient.has_seo },
      { endpoint: '/api/cron/sync-gsc', label: 'GSC (Search Console)', enabled: backfillClient.has_seo },
      { endpoint: '/api/cron/sync-ads', label: 'Google Ads', enabled: backfillClient.has_ads },
      { endpoint: '/api/cron/sync-gbp', label: 'GBP', enabled: !!backfillClient.has_gbp },
    ];
    const results = [];
    for (const svc of services) {
      if (!svc.enabled) {
        results.push({ label: svc.label, ok: false, message: 'Not enabled' });
        continue;
      }
      try {
        const res = await fetch('/api/admin/trigger-cron', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: svc.endpoint, params: { date: yesterday, clientId: backfillClient.id } }),
        });
        const data = await res.json();
        if (res.ok && data.success !== false) {
          results.push({ label: svc.label, ok: true, message: `${data.total ?? data.synced ?? '✓'} records` });
        } else {
          results.push({ label: svc.label, ok: false, message: data.error || 'No data returned' });
        }
      } catch (e: any) {
        results.push({ label: svc.label, ok: false, message: e.message || 'Network error' });
      }
    }
    setTestResults(results);
    setModalStep('ready');
  }

  async function runBackfill() {
    if (!backfillClient) return;
    const services = [
      { endpoint: '/api/cron/sync-ga4', label: 'GA4', enabled: backfillClient.has_seo },
      { endpoint: '/api/cron/sync-gsc', label: 'GSC', enabled: backfillClient.has_seo },
      { endpoint: '/api/cron/sync-ads', label: 'Google Ads', enabled: backfillClient.has_ads },
      { endpoint: '/api/cron/sync-gbp', label: 'GBP', enabled: !!backfillClient.has_gbp },
    ].filter(s => s.enabled);

    const dates: string[] = [];
    const now = new Date();
    for (let i = 1; i <= backfillDays; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }

    setModalStep('running');
    setBackfill({ currentDay: 0, totalDays: dates.length, currentService: '', errors: [] });
    const errors: string[] = [];

    for (let i = 0; i < dates.length; i++) {
      const date = dates[i];
      for (const service of services) {
        setBackfill(prev => ({ ...prev, currentDay: i + 1, currentService: service.label }));
        try {
          const res = await fetch('/api/admin/trigger-cron', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: service.endpoint, params: { date, clientId: backfillClient.id } }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            errors.push(`${date} ${service.label}: ${(err as any).error || 'HTTP ' + res.status}`);
          }
        } catch (e: any) { errors.push(`${date} ${service.label}: ${e.message}`); }
      }
      setBackfill(prev => ({ ...prev, currentService: 'Rollup' }));
      try {
        const res = await fetch('/api/admin/trigger-cron', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: '/api/admin/run-rollup', method: 'POST', params: { date, clientId: backfillClient.id } }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          errors.push(`${date} rollup: ${(err as any).error || 'HTTP ' + res.status}`);
        }
      } catch (e: any) { errors.push(`${date} rollup: ${e.message}`); }
    }

    setBackfill(prev => ({ ...prev, errors, _enabledServiceCount: services.length }));
    setModalStep('done');
  }

  useEffect(() => { fetchClients(); }, []);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/clients-management');
      const payload = await res.json();
      if (!payload?.success) throw new Error(payload?.error || 'Failed to load clients');

      setClients(payload.clients || []);
      setLastSync(payload.lastSync || {});
      setFillsMap(payload.fillsMap || {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name || '', slug: client.slug || '', city: client.city || '',
      contact_name: client.contact_name || '', contact_email: client.contact_email || '',
      website_url: client.website_url || '', has_seo: client.has_seo ?? false,
      has_ads: client.has_ads ?? false, notes: client.notes || '',
      ads_budget_month: client.ads_budget_month ? String(client.ads_budget_month) : '',
      status: client.status || 'Working',
    });
    setModalMode('edit'); setError(null);
  };
  const closeModal = () => { setModalMode(null); setEditingClient(null); setFormData(emptyForm); setError(null); };
  const handleNameChange = (value: string) => {
    setFormData(prev => ({ ...prev, name: value }));
  };

  const handleSave = async () => {
    setSaving(true); setError(null);
    try {
      if (modalMode === 'edit' && editingClient) {
        const res = await fetch(`/api/admin/clients/${editingClient.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: formData.name, city: formData.city, contact_name: formData.contact_name || null, contact_email: formData.contact_email || null, website_url: formData.website_url || null, has_seo: formData.has_seo, has_ads: formData.has_ads, notes: formData.notes || null, ads_budget_month: formData.ads_budget_month ? Number(formData.ads_budget_month) : null, status: formData.status || null }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Failed to update client');
      }
      closeModal(); await fetchClients();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally { setSaving(false); }
  };

  const handleToggleActive = (client: Client) => {
    if (client.is_active) { setConfirmCancel(client.id); return; }
    setConfirmReactivate(client.id);
  };

  const confirmReactivateClient = async () => {
    if (!confirmReactivate) return;
    const targetId = confirmReactivate;
    setConfirmReactivate(null);
    setClients(prev => prev.map(c => c.id === targetId ? { ...c, is_active: true, status: 'Working' } : c));
    try {
      const res = await fetch(`/api/admin/clients/${targetId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: true, status: 'Working' }) });
      if (!res.ok) { const result = await res.json(); setClients(prev => prev.map(c => c.id === targetId ? { ...c, is_active: false } : c)); throw new Error(result.error || 'Failed to reactivate'); }
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to reactivate client'); }
  };

  const confirmCancelContract = async () => {
    if (!confirmCancel) return;
    const targetId = confirmCancel;
    setClients(prev => prev.map(c => c.id === targetId ? { ...c, is_active: false, status: 'Cancelled' } : c));
    setConfirmCancel(null);
    try {
      const res = await fetch(`/api/admin/clients/${targetId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: false, status: 'Cancelled' }) });
      if (!res.ok) { const result = await res.json(); setClients(prev => prev.map(c => c.id === targetId ? { ...c, is_active: true, status: 'Working' } : c)); throw new Error(result.error || 'Failed to cancel contract'); }
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to cancel contract'); }
  };

  const saveNotes = async (clientId: string, value: string) => {
    setNotesSavingId(clientId);
    try {
      await fetch(`/api/admin/clients/${clientId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: value || null }),
      });
      setClients(prev => prev.map(c => c.id === clientId ? { ...c, notes: value || null } : c));
    } finally {
      setNotesSavingId(null);
      setEditingNotesId(null);
    }
  };

  const saveFill = async (clientId: string, ym: string) => {
    const val = parseInt(fillsMap[clientId]?.[ym] || '0', 10);
    if (isNaN(val) || val < 0) return;
    const key = `${clientId}:${ym}`;
    setFillsSavingKey(key);
    try {
      const res = await fetch('/api/admin/form-fills', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, year_month: ym, form_fills: val }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError((err as any).error || 'Failed to save form fills');
      }
    } finally {
      setFillsSavingKey(null);
    }
  };

  // Derived stats
  const activeClients = clients.filter(c => c.is_active);
  const cancelledClients = clients.filter(c => !c.is_active);
  const churnRate = clients.length > 0
    ? Math.round((cancelledClients.length / clients.length) * 100)
    : 0;
  const adsClients = clients.filter(c => c.has_ads && c.is_active).length;
  const seoClients = clients.filter(c => c.has_seo && c.is_active).length;

  // Sort: active first (alphabetical), cancelled last (alphabetical)
  const sortedAndFiltered = (() => {
    const lq = searchQuery.toLowerCase();
    const matches = (c: Client) =>
      c.name.toLowerCase().includes(lq) ||
      c.slug.toLowerCase().includes(lq) ||
      (c.city || '').toLowerCase().includes(lq) ||
      (c.contact_name || '').toLowerCase().includes(lq) ||
      (c.contact_email || '').toLowerCase().includes(lq);

    const active = activeClients.filter(matches).sort((a, b) => a.name.localeCompare(b.name));
    const cancelled = cancelledClients.filter(matches).sort((a, b) => a.name.localeCompare(b.name));
    return showCancelled ? [...active, ...cancelled] : active;
  })();

  function syncAge(clientId: string): { days: number; stale: boolean } | null {
    const d = lastSync[clientId];
    if (!d) return null;
    const diff = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
    return { days: diff, stale: diff > 2 };
  }

  const statusColor = (s: string | null) => {
    if (s === 'Cancelled') return { bg: '#fef2f2', color: '#dc2626' };
    if (s === 'Paused') return { bg: '#fefce8', color: '#b45309' };
    if (s === 'Onboarding') return { bg: '#eff6ff', color: '#1d4ed8' };
    return { bg: '#f0fdf4', color: '#059669' };
  };

  function calcHealthScore(client: Client): { grade: string; score: number; bg: string } {
    if (!client.is_active) return { grade: 'Inactive', score: 0, bg: '#6b7280' };

    let score = 100;
    if (!client.has_gbp) score -= 20;
    const sync = syncAge(client.id);
    if (!sync || sync.days > 3) score -= 15;
    if (client.has_ads && !client.ads_budget_month) score -= 10;
    if (client.status === 'Onboarding') score -= 5;

    let grade: string;
    let bg: string;
    if (score >= 90) { grade = 'A'; bg = '#10b981'; }
    else if (score >= 75) { grade = 'B'; bg = '#3b82f6'; }
    else if (score >= 60) { grade = 'C'; bg = '#d9a854'; }
    else if (score >= 40) { grade = 'D'; bg = '#f97316'; }
    else { grade = 'F'; bg = '#ef4444'; }

    return { grade, score, bg };
  }

  return (
    <AdminLayout>
      {/* Sticky header */}
      <div className="sticky top-14 md:top-0 z-30 px-6 py-3" style={{
        background: 'rgba(245,241,237,0.98)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(44,36,25,0.08)',
        display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={16} style={{ color: '#c4704f' }} />
          <span style={{ fontSize: '15px', fontWeight: 700, color: '#2c2419' }}>Client Management</span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Month range for form fills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#9ca3af' }}>
            <span style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '10px' }}>Fills:</span>
            <input type="month" value={fillsFromYM} onChange={e => setFillsFromYM(e.target.value)}
              style={{ padding: '4px 8px', border: '1px solid rgba(44,36,25,0.15)', borderRadius: '7px', fontSize: '12px', color: '#2c2419', background: '#faf8f6', outline: 'none', cursor: 'pointer' }} />
            <span style={{ fontSize: '10px', color: '#d1d5db' }}>→</span>
            <input type="month" value={fillsToYM} onChange={e => setFillsToYM(e.target.value)}
              style={{ padding: '4px 8px', border: '1px solid rgba(44,36,25,0.15)', borderRadius: '7px', fontSize: '12px', color: '#2c2419', background: '#faf8f6', outline: 'none', cursor: 'pointer' }} />
          </div>
          {isAdmin && (
            <button onClick={() => router.push('/admin-dashboard/clients/new')}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#c4704f', color: '#fff', border: 'none', borderRadius: '8px', padding: '7px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              <Plus size={14} /> Add Client
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>

        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '24px' }}>
          {[
            { label: 'Total Clients', value: clients.length, color: '#2c2419', border: '#2c2419' },
            { label: 'Active', value: activeClients.length, color: '#059669', border: '#10b981' },
            { label: 'Cancelled', value: cancelledClients.length, color: '#dc2626', border: '#ef4444' },
            { label: 'Churn Rate', value: churnRate + '%', color: '#d97706', border: '#f59e0b' },
            { label: 'Running Ads', value: adsClients, color: '#c2410c', border: '#f97316' },
            { label: 'SEO Active', value: seoClients, color: '#166534', border: '#22c55e' },
          ].map(s => (
            <div key={s.label} style={{
              background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(44,36,25,0.08)',
              borderLeft: `3px solid ${s.border}`,
              borderRadius: '14px', padding: '16px 18px',
              boxShadow: '0 2px 12px rgba(44,36,25,0.06)',
            }}>
              <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9ca3af', marginBottom: '6px' }}>{s.label}</div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: s.color, letterSpacing: '-0.02em', lineHeight: 1 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Churn trend note */}
        {cancelledClients.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', padding: '10px 14px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '10px' }}>
            <TrendingDown size={14} style={{ color: '#dc2626', flexShrink: 0 }} />
            <span style={{ fontSize: '12px', color: '#7f1d1d' }}>
              <strong>{cancelledClients.length} cancelled client{cancelledClients.length > 1 ? 's' : ''}</strong>
              {' '}· Churn rate: <strong>{churnRate}%</strong>
              {' '}· {cancelledClients.map(c => c.name).join(', ')}
            </span>
          </div>
        )}

        {/* Client Table card */}
        <div style={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(44,36,25,0.08)', borderRadius: '20px', padding: '24px', boxShadow: '0 4px 24px rgba(44,36,25,0.08)' }}>

          {/* Table toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#2c2419', margin: '0 0 2px 0' }}>All Clients</h2>
              <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>{sortedAndFiltered.length} shown · {activeClients.length} active</p>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', color: '#5c5850', fontWeight: 500 }}>
              <input type="checkbox" checked={showCancelled} onChange={e => setShowCancelled(e.target.checked)}
                style={{ width: '13px', height: '13px', accentColor: '#c4704f', cursor: 'pointer' }} />
              Show Cancelled ({cancelledClients.length})
            </label>
          </div>

          {/* Search */}
          <div style={{ position: 'relative', marginBottom: '16px' }}>
            <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', width: '15px', height: '15px' }} />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by name, slug, city, contact..."
              style={{ width: '100%', paddingLeft: '36px', paddingRight: '16px', paddingTop: '9px', paddingBottom: '9px', border: '1.5px solid transparent', borderRadius: '10px', background: '#f5f1ed', color: '#2c2419', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
              onFocus={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#c4704f'; }}
              onBlur={e => { e.currentTarget.style.background = '#f5f1ed'; e.currentTarget.style.borderColor = 'transparent'; }}
            />
          </div>

          {/* Error */}
          {error && !modalMode && (
            <div style={{ marginBottom: '14px', padding: '10px 14px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: '13px' }}>
              <span>{error}</span>
              <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}><X size={14} /></button>
            </div>
          )}

          <style>{`
            .clients-table { table-layout: fixed; width: 100%; border-collapse: separate; border-spacing: 0; }
            .clients-table th { padding: 9px 12px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #9ca3af; border-bottom: 1.5px solid rgba(44,36,25,0.1); }
            .clients-table td { padding: 13px 12px; font-size: 13px; border-bottom: 1px solid rgba(44,36,25,0.05); vertical-align: middle; }
            .clients-table tbody tr:last-child td { border-bottom: none; }
            .clients-table tbody tr { cursor: pointer; transition: background 140ms; }
            .clients-table tbody tr:hover td { background: rgba(196,112,79,0.04); }
            .clients-table .col-name  { width: 23%; }
            .clients-table .col-city  { width: 12%; }
            .clients-table .col-svc   { width: 10%; }
            .clients-table .col-status{ width: 11%; }
            .clients-table .col-health{ width: 9%; }
            .clients-table .col-email { width: 16%; }
            .clients-table .col-acts  { width: 19%; }
            .sep { border-right: 1px solid rgba(44,36,25,0.07); }
          `}</style>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px', color: '#5c5850' }}>Loading...</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="clients-table">
                <thead>
                  <tr>
                    <th className="col-name" style={{ textAlign: 'left' }}>Client</th>
                    <th className="col-city sep" style={{ textAlign: 'left' }}>City</th>
                    <th className="col-svc sep" style={{ textAlign: 'center' }}>Services</th>
                    <th className="col-status sep" style={{ textAlign: 'center' }}>Status</th>
                    <th className="col-health sep" style={{ textAlign: 'center' }}>Health</th>
                    <th className="col-email sep" style={{ textAlign: 'left' }}>Contact</th>
                    <th className="col-acts" style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAndFiltered.map((client, idx) => {
                    // Divider row before cancelled section
                    const prevClient = sortedAndFiltered[idx - 1];
                    const isCancelledStart = !client.is_active && (!prevClient || prevClient.is_active);

                    return (
                      <React.Fragment key={client.id}>
                        {isCancelledStart && (
                          <tr style={{ pointerEvents: 'none' }}>
                            <td colSpan={isAdmin ? 7 : 6} style={{ padding: '6px 12px', background: '#faf7f4', borderBottom: '1px solid rgba(44,36,25,0.08)' }}>
                              <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9ca3af' }}>
                                — Cancelled / Inactive —
                              </span>
                            </td>
                          </tr>
                        )}
                        <tr
                          onClick={() => router.push(`/admin-dashboard/${client.slug}`)}
                          style={{ opacity: client.is_active ? 1 : 0.6, background: !client.is_active ? 'rgba(239,68,68,0.04)' : undefined }}
                        >
                          <td className="col-name">
                            <div style={{ fontWeight: 600, color: '#2c2419', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{client.name}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                              {client.owner && <span style={{ fontSize: '11px', color: '#8a7f74' }}>{client.owner}</span>}
                              {(() => {
                                const sync = syncAge(client.id);
                                if (!sync) return client.is_active ? <span style={{ fontSize: '10px', color: '#ef4444', fontWeight: 600 }}>No data</span> : null;
                                if (sync.stale) return <span style={{ fontSize: '10px', color: '#d97706', fontWeight: 600 }}>{sync.days}d ago ⚠</span>;
                                return <span style={{ fontSize: '10px', color: '#9ca3af' }}>{sync.days}d ago</span>;
                              })()}
                            </div>
                          </td>
                          <td className="col-city sep" style={{ color: '#5c5850' }}>{client.city || '—'}</td>
                          <td className="col-svc sep" style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '3px', justifyContent: 'center' }}>
                              {client.has_ads && <span style={{ background: '#fff7ed', color: '#c2410c', padding: '2px 7px', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>Ads</span>}
                              {client.has_seo && <span style={{ background: '#f0fdf4', color: '#166534', padding: '2px 7px', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>SEO</span>}
                              {!client.has_ads && !client.has_seo && <span style={{ color: '#d1d5db', fontSize: '11px' }}>—</span>}
                            </div>
                          </td>
                          <td className="col-status sep" style={{ textAlign: 'center' }}>
                            {(() => {
                              const displayStatus = client.status || (client.is_active ? 'Working' : 'Inactive');
                              const sc = statusColor(client.is_active ? displayStatus : 'Cancelled');
                              return (
                                <span style={{ background: sc.bg, color: sc.color, padding: '3px 9px', borderRadius: '5px', fontSize: '11px', fontWeight: 700 }}>
                                  {client.is_active ? displayStatus : 'Cancelled'}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="col-health sep" style={{ textAlign: 'center' }}>
                            {(() => {
                              const h = calcHealthScore(client);
                              return (
                                <span
                                  title={h.grade === 'Inactive' ? 'Inactive client' : `Health score: ${h.score}/100`}
                                  style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '99px', color: '#fff', background: h.bg, display: 'inline-block', letterSpacing: '0.02em' }}>
                                  {h.grade}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="col-email sep" style={{ color: '#5c5850', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {client.contact_email || <span style={{ color: '#d1d5db' }}>—</span>}
                          </td>
                          <td className="col-acts" style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                              {/* View dashboard */}
                              <button onClick={() => router.push(`/admin-dashboard/${client.slug}`)}
                                title="View dashboard"
                                style={{ padding: '5px', borderRadius: '6px', color: '#5c5850', background: 'rgba(44,36,25,0.06)', border: 'none', cursor: 'pointer' }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(196,112,79,0.15)'; (e.currentTarget as HTMLElement).style.color = '#c4704f'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(44,36,25,0.06)'; (e.currentTarget as HTMLElement).style.color = '#5c5850'; }}>
                                <ExternalLink size={13} />
                              </button>
                              {/* Expand notes/fills */}
                              <button onClick={() => toggleExpand(client.id)}
                                title={expandedRows.has(client.id) ? 'Collapse' : 'Notes & Fills'}
                                style={{ padding: '5px', borderRadius: '6px', border: 'none', cursor: 'pointer', color: expandedRows.has(client.id) ? '#c4704f' : client.notes ? '#2c2419' : '#9ca3af', background: expandedRows.has(client.id) ? 'rgba(196,112,79,0.1)' : 'rgba(44,36,25,0.05)', transition: 'all 150ms', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: 600 }}>
                                {client.notes && !expandedRows.has(client.id) && <span style={{ fontSize: '9px', lineHeight: 1 }}>📝</span>}
                                <ChevronDown size={12} style={{ transform: expandedRows.has(client.id) ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }} />
                              </button>
                              {isAdmin && (<>
                                <button onClick={() => router.push(`/admin-dashboard/clients/${client.id}/edit`)}
                                  style={{ padding: '5px 7px', borderRadius: '6px', color: client.is_active ? '#5c5850' : '#9ca3af', background: client.is_active ? 'rgba(44,36,25,0.06)' : 'rgba(44,36,25,0.04)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: 600 }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(196,112,79,0.15)'; (e.currentTarget as HTMLElement).style.color = '#c4704f'; }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = client.is_active ? 'rgba(44,36,25,0.06)' : 'rgba(44,36,25,0.04)'; (e.currentTarget as HTMLElement).style.color = client.is_active ? '#5c5850' : '#9ca3af'; }}
                                  title={client.is_active ? 'Edit client' : 'CANCELLED — read only'}>
                                  <Edit2 size={13} />
                                  {!client.is_active && <span>View</span>}
                                </button>
                                <button onClick={() => openBackfillModal(client)}
                                  style={{ padding: '5px', borderRadius: '6px', color: '#5c5850', background: 'rgba(44,36,25,0.06)', border: 'none', cursor: 'pointer' }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(217,168,84,0.15)'; (e.currentTarget as HTMLElement).style.color = '#b45309'; }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(44,36,25,0.06)'; (e.currentTarget as HTMLElement).style.color = '#5c5850'; }}
                                  title="Backfill data">
                                  <RefreshCw size={13} />
                                </button>
                                <button onClick={() => handleToggleActive(client)}
                                  style={{ padding: '5px', borderRadius: '6px', border: 'none', cursor: 'pointer', color: client.is_active ? '#dc2626' : '#059669', background: client.is_active ? 'rgba(220,38,38,0.06)' : 'rgba(5,150,105,0.06)' }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.75'; }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                                  title={client.is_active ? 'Cancel contract' : 'Reactivate'}>
                                  {client.is_active ? <XCircle size={13} /> : <CheckCircle size={13} />}
                                </button>
                              </>)}
                            </div>
                          </td>
                        </tr>
                        {/* Accordion: Notes + Form Fills */}
                        {expandedRows.has(client.id) && (
                          <tr style={{ background: 'rgba(196,112,79,0.02)' }}>
                            <td colSpan={7} style={{ padding: '12px 16px 16px 16px', borderBottom: '2px solid rgba(196,112,79,0.15)' }} onClick={e => e.stopPropagation()}>
                              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                                {/* Notes */}
                                <div style={{ flex: '1 1 220px' }}>
                                  <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9ca3af', marginBottom: '6px' }}>Notes</div>
                                  {editingNotesId === client.id ? (
                                    <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                                      <textarea autoFocus rows={3} value={notesDraft}
                                        onChange={e => setNotesDraft(e.target.value)}
                                        onBlur={() => saveNotes(client.id, notesDraft)}
                                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveNotes(client.id, notesDraft); } if (e.key === 'Escape') setEditingNotesId(null); }}
                                        style={{ flex: 1, padding: '8px 10px', border: '1.5px solid #c4704f', borderRadius: '8px', fontSize: '12px', color: '#2c2419', background: '#fff', resize: 'vertical', outline: 'none', fontFamily: 'inherit', minWidth: '180px' }} />
                                      {notesSavingId === client.id && <span style={{ fontSize: '11px', color: '#9ca3af', alignSelf: 'center' }}>…</span>}
                                    </div>
                                  ) : (
                                    <div
                                      onClick={() => { setEditingNotesId(client.id); setNotesDraft(client.notes || ''); }}
                                      style={{ fontSize: '12px', color: client.notes ? '#2c2419' : '#c4c0ba', cursor: 'pointer', padding: '8px 10px', borderRadius: '8px', minHeight: '36px', background: '#faf8f6', border: '1px dashed rgba(44,36,25,0.15)', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}
                                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#c4704f'; (e.currentTarget as HTMLElement).style.background = '#fff'; }}
                                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(44,36,25,0.15)'; (e.currentTarget as HTMLElement).style.background = '#faf8f6'; }}>
                                      {client.notes || 'Click to add notes…'}
                                    </div>
                                  )}
                                </div>
                                {/* Form Fills */}
                                <div style={{ flex: '0 0 auto' }}>
                                  <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9ca3af', marginBottom: '6px' }}>Form Fills by Month</div>
                                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    {monthsInRange.map(m => (
                                      <div key={m.ym} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                        <span style={{ fontSize: '10px', color: '#9ca3af', fontWeight: 600, whiteSpace: 'nowrap' }}>{m.label}</span>
                                        <input type="number" min={0}
                                          value={fillsMap[client.id]?.[m.ym] ?? ''}
                                          onChange={e => setFillsMap(prev => ({ ...prev, [client.id]: { ...prev[client.id], [m.ym]: e.target.value } }))}
                                          onKeyDown={e => e.key === 'Enter' && saveFill(client.id, m.ym)}
                                          placeholder="—"
                                          style={{ width: '52px', padding: '5px 6px', border: '1px solid rgba(44,36,25,0.15)', borderRadius: '7px', fontSize: '13px', fontWeight: 600, color: '#2c2419', textAlign: 'center', background: '#faf8f6', outline: 'none', opacity: fillsSavingKey === `${client.id}:${m.ym}` ? 0.5 : 1 }}
                                          onFocus={e => { e.currentTarget.style.borderColor = '#c4704f'; e.currentTarget.style.background = '#fff'; }}
                                          onBlur={e => { e.currentTarget.style.borderColor = 'rgba(44,36,25,0.15)'; e.currentTarget.style.background = '#faf8f6'; saveFill(client.id, m.ym); }} />
                                      </div>
                                    ))}
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
              {sortedAndFiltered.length === 0 && (
                <div style={{ textAlign: 'center', padding: '48px', color: '#9ca3af', fontSize: '13px' }}>
                  {searchQuery ? 'No clients match your search' : 'No clients found'}
                  {!searchQuery && !showCancelled && cancelledClients.length > 0 && (
                    <p style={{ fontSize: 13, marginTop: 8, opacity: 0.7 }}>
                      {cancelledClients.length} cancelled client{cancelledClients.length !== 1 ? 's' : ''} hidden — toggle "Show Cancelled" to view
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Reactivate Confirmation */}
      {confirmReactivate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: 'rgba(44,36,25,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={() => setConfirmReactivate(null)}>
          <div className="rounded-2xl p-8 w-full max-w-md mx-4"
            style={{ background: '#fff', boxShadow: '0 20px 60px rgba(44,36,25,0.3)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-full" style={{ background: '#f0fdf4' }}><CheckCircle size={22} style={{ color: '#059669' }} /></div>
              <h3 className="text-lg font-bold" style={{ color: '#2c2419' }}>Reactivate Client</h3>
            </div>
            <p className="text-sm mb-6" style={{ color: '#5c5850' }}>
              Reactivate this client? Daily syncs will resume and the client will appear as active.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmReactivate(null)} style={{ padding: '9px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, background: 'rgba(44,36,25,0.05)', color: '#5c5850', border: 'none', cursor: 'pointer' }}>Cancel</button>
              <button onClick={confirmReactivateClient} style={{ padding: '9px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, background: '#059669', color: '#fff', border: 'none', cursor: 'pointer' }}>Reactivate</button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation */}
      {confirmCancel && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: 'rgba(44,36,25,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={() => setConfirmCancel(null)}>
          <div className="rounded-2xl p-8 w-full max-w-md mx-4"
            style={{ background: '#fff', boxShadow: '0 20px 60px rgba(44,36,25,0.3)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-full" style={{ background: '#fef2f2' }}><XCircle size={22} style={{ color: '#dc2626' }} /></div>
              <h3 className="text-lg font-bold" style={{ color: '#2c2419' }}>Cancel Contract</h3>
            </div>
            <p className="text-sm mb-6" style={{ color: '#5c5850' }}>
              Client will be marked as Cancelled. All active services will be noted as discontinued. You can reactivate at any time.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmCancel(null)} style={{ padding: '9px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, background: 'rgba(44,36,25,0.05)', color: '#5c5850', border: 'none', cursor: 'pointer' }}>Keep Active</button>
              <button onClick={confirmCancelContract} style={{ padding: '9px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, background: '#dc2626', color: '#fff', border: 'none', cursor: 'pointer' }}>Cancel Contract</button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: 'rgba(44,36,25,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={closeModal}>
          <div className="rounded-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
            style={{ background: '#fff', boxShadow: '0 20px 60px rgba(44,36,25,0.3)' }}
            onClick={e => e.stopPropagation()}>

            <div className="flex items-center justify-between p-6 pb-4" style={{ borderBottom: '1px solid rgba(44,36,25,0.08)' }}>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full" style={{ background: 'rgba(196,112,79,0.1)' }}>
                  <Edit2 size={18} style={{ color: '#c4704f' }} />
                </div>
                <h3 className="text-lg font-bold" style={{ color: '#2c2419' }}>
                  Edit {editingClient?.name}
                </h3>
              </div>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X size={18} /></button>
            </div>

            <div className="p-6 space-y-4">
              {error && <div className="p-3 rounded-xl text-sm" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>{error}</div>}

              {[
                { key: 'name', label: 'Name', required: true, placeholder: 'Client business name', onChange: (v: string) => handleNameChange(v) },
                { key: 'city', label: 'City', required: true, placeholder: 'City, State', onChange: (v: string) => setFormData(p => ({ ...p, city: v })) },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#5c5850' }}>
                    {f.label}{f.required && <span style={{ color: '#dc2626' }}> *</span>}
                  </label>
                  <input type="text" value={(formData as any)[f.key]} onChange={e => f.onChange(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border-2 focus:outline-none text-sm"
                    style={{ borderColor: 'rgba(44,36,25,0.1)', color: '#2c2419' }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#c4704f'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'rgba(44,36,25,0.1)'; }}
                    placeholder={f.placeholder} />
                </div>
              ))}

              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: 'contact_name', label: 'Contact Name', type: 'text', placeholder: 'John Doe' },
                  { key: 'contact_email', label: 'Contact Email', type: 'email', placeholder: 'email@example.com' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#5c5850' }}>{f.label}</label>
                    <input type={f.type} value={(formData as any)[f.key]} onChange={e => setFormData(p => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl border-2 focus:outline-none text-sm"
                      style={{ borderColor: 'rgba(44,36,25,0.1)', color: '#2c2419' }}
                      onFocus={e => { e.currentTarget.style.borderColor = '#c4704f'; }}
                      onBlur={e => { e.currentTarget.style.borderColor = 'rgba(44,36,25,0.1)'; }}
                      placeholder={f.placeholder} />
                  </div>
                ))}
              </div>

              {modalMode === 'edit' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#5c5850' }}>Website URL</label>
                  <input type="url" value={formData.website_url} onChange={e => setFormData(p => ({ ...p, website_url: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border-2 focus:outline-none text-sm"
                    style={{ borderColor: 'rgba(44,36,25,0.1)', color: '#2c2419' }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#c4704f'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'rgba(44,36,25,0.1)'; }}
                    placeholder="https://example.com" />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#5c5850' }}>Services</label>
                <div className="flex gap-3">
                  {[
                    { key: 'has_seo' as const, label: 'SEO', ac: '#166534', ab: '#f0fdf4' },
                    { key: 'has_ads' as const, label: 'Ads', ac: '#c2410c', ab: '#fff7ed' },
                  ].map(({ key, label, ac, ab }) => (
                    <button key={key} type="button" onClick={() => setFormData(p => ({ ...p, [key]: !p[key] }))}
                      style={{ padding: '7px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: formData[key] ? ab : 'rgba(44,36,25,0.05)', color: formData[key] ? ac : '#9ca3af', border: `1.5px solid ${formData[key] ? ac + '40' : 'transparent'}`, transition: 'all 150ms' }}>
                      {formData[key] && <CheckCircle size={12} style={{ display: 'inline', marginRight: 5, verticalAlign: 'text-bottom' }} />}
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {modalMode === 'edit' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#5c5850' }}>Status</label>
                      <select value={formData.status} onChange={e => setFormData(p => ({ ...p, status: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl border-2 focus:outline-none text-sm"
                        style={{ borderColor: 'rgba(44,36,25,0.1)', color: '#2c2419', background: '#fff' }}>
                        <option value="Working">Working</option>
                        <option value="Onboarding">Onboarding</option>
                        <option value="Paused">Paused</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#5c5850' }}>Ads Budget/mo ($)</label>
                      <input type="number" min="0" value={formData.ads_budget_month} onChange={e => setFormData(p => ({ ...p, ads_budget_month: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl border-2 focus:outline-none text-sm"
                        style={{ borderColor: 'rgba(44,36,25,0.1)', color: '#2c2419' }}
                        onFocus={e => { e.currentTarget.style.borderColor = '#c4704f'; }}
                        onBlur={e => { e.currentTarget.style.borderColor = 'rgba(44,36,25,0.1)'; }}
                        placeholder="0" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#5c5850' }}>Notes</label>
                    <textarea value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} rows={3}
                      className="w-full px-4 py-2.5 rounded-xl border-2 focus:outline-none text-sm resize-none"
                      style={{ borderColor: 'rgba(44,36,25,0.1)', color: '#2c2419' }}
                      onFocus={e => { e.currentTarget.style.borderColor = '#c4704f'; }}
                      onBlur={e => { e.currentTarget.style.borderColor = 'rgba(44,36,25,0.1)'; }}
                      placeholder="Internal notes..." />
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-3 justify-end p-6 pt-4" style={{ borderTop: '1px solid rgba(44,36,25,0.08)' }}>
              <button onClick={closeModal} style={{ padding: '9px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, background: 'rgba(44,36,25,0.05)', color: '#5c5850', border: 'none', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSave} disabled={saving}
                style={{ padding: '9px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, background: saving ? '#d4a68a' : '#c4704f', color: '#fff', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.8 : 1 }}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Backfill Modal */}
      {backfillClient && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: 'rgba(44,36,25,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={() => modalStep !== 'running' && modalStep !== 'testing' && setBackfillClient(null)}>
          <div className="rounded-2xl w-full max-w-md mx-4"
            style={{ background: '#fff', boxShadow: '0 20px 60px rgba(44,36,25,0.3)' }}
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between p-6 pb-4" style={{ borderBottom: '1px solid rgba(44,36,25,0.08)' }}>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full" style={{ background: 'rgba(217,168,84,0.12)' }}>
                  <Database size={18} style={{ color: '#d9a854' }} />
                </div>
                <div>
                  <h3 className="text-base font-bold" style={{ color: '#2c2419', margin: 0 }}>Backfill Data</h3>
                  <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>{backfillClient.name}</p>
                </div>
              </div>
              {modalStep !== 'running' && modalStep !== 'testing' && (
                <button onClick={() => setBackfillClient(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X size={18} /></button>
              )}
            </div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* STEP: idle — pick days */}
              {modalStep === 'idle' && (
                <>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {backfillClient.has_seo && <span style={{ background: '#f0fdf4', color: '#166534', padding: '3px 10px', borderRadius: '5px', fontSize: '11px', fontWeight: 700 }}>SEO</span>}
                    {backfillClient.has_ads && <span style={{ background: '#fff7ed', color: '#c2410c', padding: '3px 10px', borderRadius: '5px', fontSize: '11px', fontWeight: 700 }}>Google Ads</span>}
                    <span style={{ background: '#f5f3ff', color: '#6d28d9', padding: '3px 10px', borderRadius: '5px', fontSize: '11px', fontWeight: 700 }}>GBP (if configured)</span>
                  </div>
                  <div>
                    <p style={{ fontSize: '12px', color: '#5c5850', marginBottom: '8px', fontWeight: 600 }}>Date range to backfill</p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {[30, 60, 90].map(d => (
                        <button key={d} type="button" onClick={() => setBackfillDays(d)}
                          style={{ flex: 1, padding: '8px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, border: '1.5px solid', cursor: 'pointer',
                            borderColor: backfillDays === d ? '#d9a854' : 'rgba(44,36,25,0.12)',
                            background: backfillDays === d ? 'rgba(217,168,84,0.1)' : 'transparent',
                            color: backfillDays === d ? '#b45309' : '#5c5850' }}>
                          {d} days
                        </button>
                      ))}
                    </div>
                  </div>
                  <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>First, we'll test each connection before running the full backfill.</p>
                </>
              )}

              {/* STEP: testing */}
              {modalStep === 'testing' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#5c5850' }}>
                    <Loader2 size={14} className="animate-spin" style={{ color: '#d9a854' }} />
                    Testing connections for yesterday's data...
                  </div>
                </div>
              )}

              {/* STEP: ready — show test results */}
              {modalStep === 'ready' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <p style={{ fontSize: '12px', fontWeight: 600, color: '#5c5850', margin: 0 }}>Connection Test Results</p>
                  {testResults.map(r => (
                    <div key={r.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '8px',
                      background: r.ok ? 'rgba(16,185,129,0.05)' : r.message === 'Not enabled' ? 'rgba(44,36,25,0.03)' : 'rgba(239,68,68,0.05)',
                      border: `1px solid ${r.ok ? 'rgba(16,185,129,0.15)' : r.message === 'Not enabled' ? 'rgba(44,36,25,0.08)' : 'rgba(239,68,68,0.15)'}` }}>
                      <span style={{ fontSize: '13px', color: '#2c2419', fontWeight: 500 }}>{r.label}</span>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: r.ok ? '#059669' : r.message === 'Not enabled' ? '#9ca3af' : '#dc2626' }}>
                        {r.ok ? `✓ ${r.message}` : r.message === 'Not enabled' ? '— disabled' : `✗ ${r.message}`}
                      </span>
                    </div>
                  ))}
                  {testResults.every(r => !r.ok || r.message === 'Not enabled') && (
                    <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', fontSize: '12px', color: '#dc2626' }}>
                      All connections failed. Check service IDs in Edit Client before backfilling.
                    </div>
                  )}
                </div>
              )}

              {/* STEP: running */}
              {modalStep === 'running' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#5c5850', marginBottom: '6px' }}>
                    <span>Day {backfill.currentDay} / {backfill.totalDays} — {backfill.currentService}</span>
                    <span style={{ fontWeight: 700 }}>{backfill.totalDays > 0 ? Math.round((backfill.currentDay / backfill.totalDays) * 100) : 0}%</span>
                  </div>
                  <div style={{ height: '8px', background: 'rgba(44,36,25,0.08)', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${backfill.totalDays > 0 ? Math.round((backfill.currentDay / backfill.totalDays) * 100) : 0}%`,
                      background: 'linear-gradient(90deg, #d9a854, #c4704f)', borderRadius: '99px', transition: 'width 0.4s ease' }} />
                  </div>
                  <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '8px' }}>Keep this tab open while running...</p>
                </div>
              )}

              {/* STEP: done */}
              {modalStep === 'done' && (
                <div style={{ background: backfill.errors.length > 0 ? 'rgba(245,158,11,0.06)' : 'rgba(16,185,129,0.06)',
                  border: `1px solid ${backfill.errors.length > 0 ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)'}`,
                  borderRadius: '10px', padding: '14px 16px', fontSize: '13px',
                  color: backfill.errors.length > 0 ? '#b45309' : '#059669' }}>
                  {backfill.errors.length > 0
                    ? `Done with ${backfill.errors.length} error${backfill.errors.length > 1 ? 's' : ''} — data may be partially synced`
                    : `Backfill complete · all ${backfill.totalDays * (backfill._enabledServiceCount ?? 1)} sync jobs succeeded`}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 justify-end p-6 pt-2" style={{ borderTop: '1px solid rgba(44,36,25,0.08)' }}>
              {modalStep === 'idle' && (
                <>
                  <button onClick={() => setBackfillClient(null)}
                    style={{ padding: '9px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, background: 'rgba(44,36,25,0.05)', color: '#5c5850', border: 'none', cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button onClick={testConnections}
                    style={{ padding: '9px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, background: '#d9a854', color: '#fff', border: 'none', cursor: 'pointer' }}>
                    Test Connection →
                  </button>
                </>
              )}
              {modalStep === 'testing' && (
                <div style={{ fontSize: '13px', color: '#9ca3af', padding: '9px 0' }}>Testing...</div>
              )}
              {modalStep === 'ready' && (
                <>
                  <button onClick={() => setModalStep('idle')}
                    style={{ padding: '9px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, background: 'rgba(44,36,25,0.05)', color: '#5c5850', border: 'none', cursor: 'pointer' }}>
                    Back
                  </button>
                  <button onClick={runBackfill}
                    disabled={testResults.every(r => !r.ok || r.message === 'Not enabled')}
                    style={{ padding: '9px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, border: 'none', cursor: 'pointer',
                      background: testResults.every(r => !r.ok || r.message === 'Not enabled') ? '#d1d5db' : '#c4704f', color: '#fff' }}>
                    Start Backfill ({backfillDays}d)
                  </button>
                </>
              )}
              {modalStep === 'running' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#5c5850', padding: '9px 0' }}>
                  <Loader2 size={14} className="animate-spin" />Running...
                </div>
              )}
              {modalStep === 'done' && (
                <>
                  <button onClick={() => setBackfillClient(null)}
                    style={{ padding: '9px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, background: 'rgba(44,36,25,0.05)', color: '#5c5850', border: 'none', cursor: 'pointer' }}>
                    Close
                  </button>
                  <button onClick={() => { setModalStep('idle'); setTestResults([]); }}
                    style={{ padding: '9px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, background: '#d9a854', color: '#fff', border: 'none', cursor: 'pointer' }}>
                    Re-run
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

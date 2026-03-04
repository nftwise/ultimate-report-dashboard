'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { Users, Plus, Edit2, XCircle, CheckCircle, Search, X, TrendingDown } from 'lucide-react';
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

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  );

  useEffect(() => { fetchClients(); }, []);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('clients')
        .select('id, name, slug, city, contact_name, contact_email, website_url, is_active, has_seo, has_ads, notes, ads_budget_month, status, industry, owner')
        .order('name', { ascending: true });
      if (fetchError) throw new Error(fetchError.message);
      setClients(data || []);
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

  const handleToggleActive = async (client: Client) => {
    if (client.is_active) { setConfirmCancel(client.id); return; }
    setClients(prev => prev.map(c => c.id === client.id ? { ...c, is_active: true, status: 'Working' } : c));
    try {
      const res = await fetch(`/api/admin/clients/${client.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: true, status: 'Working' }) });
      if (!res.ok) { const result = await res.json(); setClients(prev => prev.map(c => c.id === client.id ? { ...c, is_active: false } : c)); throw new Error(result.error || 'Failed to reactivate'); }
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
      (c.city || '').toLowerCase().includes(lq);

    const active = activeClients.filter(matches).sort((a, b) => a.name.localeCompare(b.name));
    const cancelled = cancelledClients.filter(matches).sort((a, b) => a.name.localeCompare(b.name));
    return showCancelled ? [...active, ...cancelled] : active;
  })();

  const statusColor = (s: string | null) => {
    if (s === 'Cancelled') return { bg: '#fef2f2', color: '#dc2626' };
    if (s === 'Paused') return { bg: '#fefce8', color: '#b45309' };
    if (s === 'Onboarding') return { bg: '#eff6ff', color: '#1d4ed8' };
    return { bg: '#f0fdf4', color: '#059669' };
  };

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
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
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
              placeholder="Search by name, slug or city..."
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
            .clients-table .col-name  { width: 28%; }
            .clients-table .col-city  { width: 14%; }
            .clients-table .col-svc   { width: 13%; }
            .clients-table .col-status{ width: 14%; }
            .clients-table .col-email { width: 20%; }
            .clients-table .col-acts  { width: 11%; }
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
                    <th className="col-email sep" style={{ textAlign: 'left' }}>Contact</th>
                    {isAdmin && <th className="col-acts" style={{ textAlign: 'center' }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {sortedAndFiltered.map((client, idx) => {
                    // Divider row before cancelled section
                    const prevClient = sortedAndFiltered[idx - 1];
                    const isCancelledStart = !client.is_active && (!prevClient || prevClient.is_active);

                    return (
                      <>
                        {isCancelledStart && (
                          <tr key={`divider-${client.id}`} style={{ pointerEvents: 'none' }}>
                            <td colSpan={isAdmin ? 6 : 5} style={{ padding: '6px 12px', background: '#faf7f4', borderBottom: '1px solid rgba(44,36,25,0.08)' }}>
                              <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9ca3af' }}>
                                — Cancelled / Inactive —
                              </span>
                            </td>
                          </tr>
                        )}
                        <tr key={client.id}
                          onClick={() => router.push(`/admin-dashboard/${client.slug}`)}
                          style={{ opacity: client.is_active ? 1 : 0.6 }}
                        >
                          <td className="col-name">
                            <div style={{ fontWeight: 600, color: '#2c2419', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{client.name}</div>
                            {client.owner && <div style={{ fontSize: '11px', color: '#8a7f74', marginTop: '1px' }}>{client.owner}</div>}
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
                            {(() => { const sc = statusColor(client.is_active ? client.status : 'Cancelled'); return (
                              <span style={{ background: sc.bg, color: sc.color, padding: '3px 9px', borderRadius: '5px', fontSize: '11px', fontWeight: 700 }}>
                                {client.is_active ? (client.status || 'Working') : 'Cancelled'}
                              </span>
                            ); })()}
                          </td>
                          <td className="col-email sep" style={{ color: '#5c5850', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {client.contact_email || <span style={{ color: '#d1d5db' }}>—</span>}
                          </td>
                          {isAdmin && (
                            <td className="col-acts" style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                <button onClick={() => openEditModal(client)}
                                  style={{ padding: '5px', borderRadius: '6px', color: '#5c5850', background: 'rgba(44,36,25,0.06)', border: 'none', cursor: 'pointer' }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(196,112,79,0.15)'; (e.currentTarget as HTMLElement).style.color = '#c4704f'; }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(44,36,25,0.06)'; (e.currentTarget as HTMLElement).style.color = '#5c5850'; }}
                                  title="Edit">
                                  <Edit2 size={13} />
                                </button>
                                <button onClick={() => handleToggleActive(client)}
                                  style={{ padding: '5px', borderRadius: '6px', border: 'none', cursor: 'pointer', color: client.is_active ? '#dc2626' : '#059669', background: client.is_active ? 'rgba(220,38,38,0.06)' : 'rgba(5,150,105,0.06)' }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.75'; }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                                  title={client.is_active ? 'Cancel contract' : 'Reactivate'}>
                                  {client.is_active ? <XCircle size={13} /> : <CheckCircle size={13} />}
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      </>
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
                      <input type="number" value={formData.ads_budget_month} onChange={e => setFormData(p => ({ ...p, ads_budget_month: e.target.value }))}
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
    </AdminLayout>
  );
}

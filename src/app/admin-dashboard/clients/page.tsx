'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { Users, Plus, Edit2, XCircle, CheckCircle, Search, X } from 'lucide-react';

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

type ModalMode = 'add' | 'edit' | null;

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
  name: '',
  slug: '',
  city: '',
  contact_name: '',
  contact_email: '',
  website_url: '',
  has_seo: false,
  has_ads: false,
  notes: '',
  ads_budget_month: '',
  status: 'Working',
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .substring(0, 40);
}

export default function ClientsManagementPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
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

  useEffect(() => {
    fetchClients();
  }, []);

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

  const openAddModal = () => {
    setFormData(emptyForm);
    setEditingClient(null);
    setModalMode('add');
    setError(null);
  };

  const openEditModal = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name || '',
      slug: client.slug || '',
      city: client.city || '',
      contact_name: client.contact_name || '',
      contact_email: client.contact_email || '',
      website_url: client.website_url || '',
      has_seo: client.has_seo ?? false,
      has_ads: client.has_ads ?? false,
      notes: client.notes || '',
      ads_budget_month: client.ads_budget_month ? String(client.ads_budget_month) : '',
      status: client.status || 'Working',
    });
    setModalMode('edit');
    setError(null);
  };

  const closeModal = () => {
    setModalMode(null);
    setEditingClient(null);
    setFormData(emptyForm);
    setError(null);
  };

  const handleNameChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      name: value,
      ...(modalMode === 'add' ? { slug: slugify(value) } : {}),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      if (modalMode === 'add') {
        if (!formData.name || !formData.slug || !formData.city) {
          setError('Name, slug, and city are required');
          setSaving(false);
          return;
        }
        const res = await fetch('/api/admin/clients/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            slug: formData.slug,
            city: formData.city,
            contact_name: formData.contact_name || null,
            contact_email: formData.contact_email || null,
            has_seo: formData.has_seo,
            has_ads: formData.has_ads,
          }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Failed to create client');
      } else if (modalMode === 'edit' && editingClient) {
        const res = await fetch(`/api/admin/clients/${editingClient.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            city: formData.city,
            contact_name: formData.contact_name || null,
            contact_email: formData.contact_email || null,
            website_url: formData.website_url || null,
            has_seo: formData.has_seo,
            has_ads: formData.has_ads,
            notes: formData.notes || null,
            ads_budget_month: formData.ads_budget_month ? Number(formData.ads_budget_month) : null,
            status: formData.status || null,
          }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Failed to update client');
      }
      closeModal();
      await fetchClients();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (client: Client) => {
    if (client.is_active) {
      setConfirmCancel(client.id);
      return;
    }
    // Reactivate directly — optimistic update first
    setClients(prev => prev.map(c => c.id === client.id ? { ...c, is_active: true, status: 'Working' } : c));
    try {
      const res = await fetch(`/api/admin/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: true, status: 'Working' }),
      });
      if (!res.ok) {
        const result = await res.json();
        // Rollback on failure
        setClients(prev => prev.map(c => c.id === client.id ? { ...c, is_active: false } : c));
        throw new Error(result.error || 'Failed to reactivate');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reactivate client');
    }
  };

  const confirmCancelContract = async () => {
    if (!confirmCancel) return;
    const targetId = confirmCancel;
    // Optimistic update — change UI immediately
    setClients(prev => prev.map(c => c.id === targetId ? { ...c, is_active: false, status: 'Cancelled' } : c));
    setConfirmCancel(null);
    try {
      const res = await fetch(`/api/admin/clients/${targetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: false, status: 'Cancelled' }),
      });
      if (!res.ok) {
        const result = await res.json();
        // Rollback on failure
        setClients(prev => prev.map(c => c.id === targetId ? { ...c, is_active: true, status: 'Working' } : c));
        throw new Error(result.error || 'Failed to cancel contract');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel contract');
    }
  };

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.city && c.city.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const activeCount = clients.filter(c => c.is_active).length;
  const inactiveCount = clients.filter(c => !c.is_active).length;

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #f5f1ed 0%, #ede8e3 100%)' }}>
      {/* Header */}
      <nav className="sticky top-0 z-50 px-4 md:px-8 py-4" style={{
        background: 'rgba(245, 241, 237, 0.98)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(44, 36, 25, 0.08)',
        boxShadow: '0 4px 20px rgba(44, 36, 25, 0.05)'
      }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/admin-dashboard')}
              className="text-sm font-medium px-3 py-1.5 rounded-lg"
              style={{ color: '#5c5850', background: 'rgba(44,36,25,0.05)' }}
            >
              Back
            </button>
            <h1 className="text-2xl font-black" style={{ color: '#2c2419' }}>Client Management</h1>
          </div>
          <div className="text-right hidden sm:block">
            <div className="text-xs font-bold" style={{ color: '#2c2419' }}>Administrator</div>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: '#5c5850' }}>Clients</div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Total Clients', value: clients.length, color: '#2c2419' },
            { label: 'Active', value: activeCount, color: '#10b981' },
            { label: 'Inactive', value: inactiveCount, color: '#ef4444' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl p-6" style={{
              background: 'rgba(255,255,255,0.95)',
              border: '1px solid rgba(44,36,25,0.08)',
              boxShadow: '0 4px 20px rgba(44,36,25,0.08)'
            }}>
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#5c5850' }}>{stat.label}</p>
              <p className="text-3xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-3.5 w-5 h-5" style={{ color: '#9ca3af' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search clients by name, slug, or city..."
              className="w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:outline-none"
              style={{ background: '#fff', borderColor: 'rgba(44,36,25,0.1)', color: '#2c2419', fontSize: '0.95rem' }}
              onFocus={e => { e.currentTarget.style.borderColor = '#c4704f'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(44,36,25,0.1)'; }}
            />
          </div>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm"
            style={{
              background: '#c4704f',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 200ms ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#b5613f'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#c4704f'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <Plus size={18} />
            Add Client
          </button>
        </div>

        {/* Error Banner */}
        {error && !modalMode && (
          <div className="mb-6 p-4 rounded-xl flex items-center justify-between" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>
            <span className="text-sm">{error}</span>
            <button onClick={() => setError(null)}><X size={16} /></button>
          </div>
        )}

        {/* Client Table */}
        <div className="rounded-2xl overflow-hidden" style={{
          background: 'rgba(255,255,255,0.95)',
          border: '1px solid rgba(44,36,25,0.08)',
          boxShadow: '0 4px 20px rgba(44,36,25,0.08)'
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#5c5850' }}>Loading clients...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full" style={{ minWidth: '900px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid rgba(44,36,25,0.1)' }}>
                    <th className="text-left text-xs font-bold uppercase tracking-wider py-4 px-6" style={{ color: '#5c5850' }}>Client</th>
                    <th className="text-left text-xs font-bold uppercase tracking-wider py-4 px-4" style={{ color: '#5c5850' }}>City</th>
                    <th className="text-center text-xs font-bold uppercase tracking-wider py-4 px-4" style={{ color: '#5c5850' }}>Status</th>
                    <th className="text-center text-xs font-bold uppercase tracking-wider py-4 px-4" style={{ color: '#5c5850' }}>Services</th>
                    <th className="text-left text-xs font-bold uppercase tracking-wider py-4 px-4" style={{ color: '#5c5850' }}>Contact</th>
                    <th className="text-center text-xs font-bold uppercase tracking-wider py-4 px-4" style={{ color: '#5c5850' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map((client) => (
                    <tr
                      key={client.id}
                      style={{
                        borderBottom: '1px solid rgba(44,36,25,0.05)',
                        opacity: client.is_active ? 1 : 0.6,
                        background: client.is_active ? 'transparent' : '#faf7f4',
                        transition: 'all 200ms ease',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = client.is_active ? 'rgba(196,112,79,0.04)' : '#f5f0ea'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = client.is_active ? 'transparent' : '#faf7f4'; }}
                    >
                      <td className="py-4 px-6">
                        <div className="font-bold text-sm" style={{ color: '#2c2419' }}>{client.name}</div>
                        <div className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>@{client.slug}</div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm" style={{ color: '#5c5850' }}>{client.city || '---'}</span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs font-bold px-3 py-1 rounded-full" style={{
                            background: client.is_active ? '#ecfdf5' : '#fee2e2',
                            color: client.is_active ? '#059669' : '#dc2626',
                            border: `1px solid ${client.is_active ? '#d1fae5' : '#fecaca'}`
                          }}>
                            {client.is_active ? 'Active' : 'Inactive'}
                          </span>
                          {client.status && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{
                              background: client.status === 'Cancelled' ? '#fef2f2' : client.status === 'Paused' ? '#fefce8' : client.status === 'Onboarding' ? '#eff6ff' : '#f9fafb',
                              color: client.status === 'Cancelled' ? '#dc2626' : client.status === 'Paused' ? '#b45309' : client.status === 'Onboarding' ? '#1d4ed8' : '#6b7280',
                            }}>
                              {client.status}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          {client.has_seo && <span className="px-2 py-0.5 rounded-md text-xs font-semibold" style={{ background: '#f0fdf4', color: '#166534' }}>SEO</span>}
                          {client.has_ads && <span className="px-2 py-0.5 rounded-md text-xs font-semibold" style={{ background: '#fff7ed', color: '#c2410c' }}>Ads</span>}
                          {!client.has_seo && !client.has_ads && <span className="text-xs" style={{ color: '#9ca3af' }}>None</span>}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm" style={{ color: '#5c5850' }}>{client.contact_email || '---'}</span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); openEditModal(client); }}
                            className="p-2 rounded-lg"
                            style={{ color: '#5c5850', background: 'rgba(44,36,25,0.05)', cursor: 'pointer', transition: 'all 150ms ease' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(196,112,79,0.15)'; e.currentTarget.style.color = '#c4704f'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(44,36,25,0.05)'; e.currentTarget.style.color = '#5c5850'; }}
                            title="Edit client"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleToggleActive(client); }}
                            className="p-2 rounded-lg"
                            style={{
                              color: client.is_active ? '#dc2626' : '#10b981',
                              background: client.is_active ? 'rgba(220,38,38,0.05)' : 'rgba(16,185,129,0.05)',
                              cursor: 'pointer',
                              transition: 'all 150ms ease'
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.background = client.is_active ? 'rgba(220,38,38,0.15)' : 'rgba(16,185,129,0.15)';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.background = client.is_active ? 'rgba(220,38,38,0.05)' : 'rgba(16,185,129,0.05)';
                            }}
                            title={client.is_active ? 'Cancel contract' : 'Reactivate'}
                          >
                            {client.is_active ? <XCircle size={15} /> : <CheckCircle size={15} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredClients.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px', color: '#5c5850' }}>
                  {searchQuery ? 'No clients match your search' : 'No clients found'}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Cancel Confirmation Dialog */}
      {confirmCancel && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: 'rgba(44,36,25,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={() => setConfirmCancel(null)}
        >
          <div
            className="rounded-2xl p-8 w-full max-w-md mx-4"
            style={{ background: '#fff', boxShadow: '0 20px 60px rgba(44,36,25,0.3)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-full" style={{ background: '#fef2f2' }}>
                <XCircle size={24} style={{ color: '#dc2626' }} />
              </div>
              <h3 className="text-lg font-bold" style={{ color: '#2c2419' }}>Cancel Contract</h3>
            </div>
            <p className="text-sm mb-6" style={{ color: '#5c5850' }}>
              Are you sure you want to cancel this client&#39;s contract? They will be marked as inactive and no longer appear in active dashboards.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmCancel(null)}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(44,36,25,0.05)', color: '#5c5850', cursor: 'pointer' }}
              >
                Keep Active
              </button>
              <button
                onClick={confirmCancelContract}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: '#dc2626', color: '#fff', cursor: 'pointer' }}
              >
                Cancel Contract
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {modalMode && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: 'rgba(44,36,25,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={closeModal}
        >
          <div
            className="rounded-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
            style={{ background: '#fff', boxShadow: '0 20px 60px rgba(44,36,25,0.3)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 pb-4" style={{ borderBottom: '1px solid rgba(44,36,25,0.08)' }}>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full" style={{ background: 'rgba(196,112,79,0.1)' }}>
                  {modalMode === 'add' ? <Plus size={20} style={{ color: '#c4704f' }} /> : <Edit2 size={20} style={{ color: '#c4704f' }} />}
                </div>
                <h3 className="text-lg font-bold" style={{ color: '#2c2419' }}>
                  {modalMode === 'add' ? 'Add New Client' : `Edit ${editingClient?.name}`}
                </h3>
              </div>
              <button onClick={closeModal} className="p-2 rounded-lg" style={{ color: '#5c5850', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {error && (
                <div className="p-3 rounded-xl text-sm" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>
                  {error}
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#5c5850' }}>
                  Name <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border-2 focus:outline-none text-sm"
                  style={{ borderColor: 'rgba(44,36,25,0.1)', color: '#2c2419' }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#c4704f'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(44,36,25,0.1)'; }}
                  placeholder="Client business name"
                />
              </div>

              {/* Slug (only for add) */}
              {modalMode === 'add' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#5c5850' }}>
                    Slug <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border-2 focus:outline-none text-sm"
                    style={{ borderColor: 'rgba(44,36,25,0.1)', color: '#2c2419' }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#c4704f'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'rgba(44,36,25,0.1)'; }}
                    placeholder="auto-generated-slug"
                  />
                </div>
              )}

              {/* City */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#5c5850' }}>
                  City <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border-2 focus:outline-none text-sm"
                  style={{ borderColor: 'rgba(44,36,25,0.1)', color: '#2c2419' }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#c4704f'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(44,36,25,0.1)'; }}
                  placeholder="City, State"
                />
              </div>

              {/* Contact Name + Email (row) */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#5c5850' }}>Contact Name</label>
                  <input
                    type="text"
                    value={formData.contact_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, contact_name: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border-2 focus:outline-none text-sm"
                    style={{ borderColor: 'rgba(44,36,25,0.1)', color: '#2c2419' }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#c4704f'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'rgba(44,36,25,0.1)'; }}
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#5c5850' }}>Contact Email</label>
                  <input
                    type="email"
                    value={formData.contact_email}
                    onChange={(e) => setFormData(prev => ({ ...prev, contact_email: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border-2 focus:outline-none text-sm"
                    style={{ borderColor: 'rgba(44,36,25,0.1)', color: '#2c2419' }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#c4704f'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'rgba(44,36,25,0.1)'; }}
                    placeholder="email@example.com"
                  />
                </div>
              </div>

              {/* Website URL (edit only) */}
              {modalMode === 'edit' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#5c5850' }}>Website URL</label>
                  <input
                    type="url"
                    value={formData.website_url}
                    onChange={(e) => setFormData(prev => ({ ...prev, website_url: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border-2 focus:outline-none text-sm"
                    style={{ borderColor: 'rgba(44,36,25,0.1)', color: '#2c2419' }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#c4704f'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'rgba(44,36,25,0.1)'; }}
                    placeholder="https://example.com"
                  />
                </div>
              )}

              {/* Services */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#5c5850' }}>Services</label>
                <div className="flex gap-3">
                  {[
                    { key: 'has_seo' as const, label: 'SEO', activeColor: '#166534', activeBg: '#f0fdf4' },
                    { key: 'has_ads' as const, label: 'Ads', activeColor: '#c2410c', activeBg: '#fff7ed' },
                  ].map(({ key, label, activeColor, activeBg }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, [key]: !prev[key] }))}
                      className="px-4 py-2 rounded-xl text-sm font-semibold"
                      style={{
                        background: formData[key] ? activeBg : 'rgba(44,36,25,0.05)',
                        color: formData[key] ? activeColor : '#9ca3af',
                        border: `2px solid ${formData[key] ? activeColor + '40' : 'transparent'}`,
                        cursor: 'pointer',
                        transition: 'all 150ms ease',
                      }}
                    >
                      {formData[key] ? <CheckCircle size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'text-bottom' }} /> : null}
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Edit-only fields */}
              {modalMode === 'edit' && (
                <>
                  {/* Status + Budget */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#5c5850' }}>Status</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl border-2 focus:outline-none text-sm"
                        style={{ borderColor: 'rgba(44,36,25,0.1)', color: '#2c2419', background: '#fff' }}
                      >
                        <option value="Working">Working</option>
                        <option value="Onboarding">Onboarding</option>
                        <option value="Paused">Paused</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#5c5850' }}>Ads Budget/Month ($)</label>
                      <input
                        type="number"
                        value={formData.ads_budget_month}
                        onChange={(e) => setFormData(prev => ({ ...prev, ads_budget_month: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl border-2 focus:outline-none text-sm"
                        style={{ borderColor: 'rgba(44,36,25,0.1)', color: '#2c2419' }}
                        onFocus={e => { e.currentTarget.style.borderColor = '#c4704f'; }}
                        onBlur={e => { e.currentTarget.style.borderColor = 'rgba(44,36,25,0.1)'; }}
                        placeholder="0"
                      />
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#5c5850' }}>Notes</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      rows={3}
                      className="w-full px-4 py-2.5 rounded-xl border-2 focus:outline-none text-sm resize-none"
                      style={{ borderColor: 'rgba(44,36,25,0.1)', color: '#2c2419' }}
                      onFocus={e => { e.currentTarget.style.borderColor = '#c4704f'; }}
                      onBlur={e => { e.currentTarget.style.borderColor = 'rgba(44,36,25,0.1)'; }}
                      placeholder="Internal notes about this client..."
                    />
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex gap-3 justify-end p-6 pt-4" style={{ borderTop: '1px solid rgba(44,36,25,0.08)' }}>
              <button
                onClick={closeModal}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(44,36,25,0.05)', color: '#5c5850', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold"
                style={{
                  background: saving ? '#d4a68a' : '#c4704f',
                  color: '#fff',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? 'Saving...' : modalMode === 'add' ? 'Create Client' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

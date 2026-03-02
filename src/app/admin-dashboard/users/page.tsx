'use client';

import { useEffect, useState } from 'react';
import { UserPlus, Loader2, ToggleLeft, ToggleRight, Users } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { useSession } from 'next-auth/react';
import { createClient } from '@supabase/supabase-js';

interface User {
  id: string;
  email: string;
  role: string;
  client_id: string | null;
  is_active: boolean;
  created_at: string;
  last_login: string | null;
}

interface Client {
  id: string;
  name: string;
  slug: string;
}

const ROLE_STYLE: Record<string, { bg: string; color: string }> = {
  admin:  { bg: 'rgba(196,112,79,0.12)',  color: '#c4704f' },
  team:   { bg: 'rgba(107,114,128,0.10)', color: '#374151' },
  client: { bg: 'rgba(16,185,129,0.10)',  color: '#059669' },
};

export default function UsersPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === 'admin';

  const [users, setUsers]     = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState({
    email: '',
    password: '',
    role: 'client' as 'client' | 'admin' | 'team',
    clientId: '',
  });

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [usersRes, { data: clientsData }] = await Promise.all([
        fetch('/api/admin/add-user'),
        createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL || '',
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
        ).from('clients').select('id, name, slug').eq('is_active', true).order('name'),
      ]);
      const usersData = await usersRes.json();
      if (usersData.success) setUsers(usersData.users || []);
      setClients(clientsData || []);
    } catch {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setSuccess(null);
    if (!form.email || !form.password) { setError('Email and password are required'); return; }
    if (form.role === 'client' && !form.clientId) { setError('Please select a client for this user'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/add-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email.trim(), password: form.password, role: form.role, clientId: form.role === 'client' ? form.clientId : null }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to create user');
      setSuccess(`User ${form.email} created`);
      setForm({ email: '', password: '', role: 'client', clientId: '' });
      await fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(user: User) {
    try {
      const res = await fetch('/api/admin/add-user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id, is_active: !user.is_active }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: !u.is_active } : u));
    } catch (err: any) {
      setError(err.message);
    }
  }

  const getClientName = (clientId: string | null) =>
    clientId ? (clients.find(c => c.id === clientId)?.name || clientId.slice(0, 8) + '…') : '—';

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : 'Never';

  // Derived stats
  const activeCount   = users.filter(u => u.is_active).length;
  const adminCount    = users.filter(u => u.role === 'admin').length;
  const teamCount     = users.filter(u => u.role === 'team').length;
  const clientCount   = users.filter(u => u.role === 'client').length;

  return (
    <AdminLayout>
      {/* Sticky header — same pattern as all other pages */}
      <div className="sticky top-14 md:top-0 z-30 px-6 py-3" style={{
        background: 'rgba(245,241,237,0.98)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(44,36,25,0.08)',
        display: 'flex', alignItems: 'center', gap: '12px',
      }}>
        <Users size={16} style={{ color: '#c4704f' }} />
        <span style={{ fontSize: '15px', fontWeight: 700, color: '#2c2419' }}>User Accounts</span>
        <span style={{ fontSize: '12px', color: '#9ca3af' }}>{users.length} total · {activeCount} active</span>
      </div>

      {/* Content — same maxWidth / padding as all other pages */}
      <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '24px' }}>
          {[
            { label: 'Total Users',   value: users.length,  color: '#2c2419', border: '#2c2419' },
            { label: 'Active',        value: activeCount,   color: '#059669', border: '#10b981' },
            { label: 'Admin',         value: adminCount,    color: '#c4704f', border: '#c4704f' },
            { label: 'Team',          value: teamCount,     color: '#374151', border: '#6b7280' },
            { label: 'Client Logins', value: clientCount,   color: '#166534', border: '#22c55e' },
          ].map(s => (
            <div key={s.label} style={{
              background: 'rgba(255,255,255,0.95)',
              border: '1px solid rgba(44,36,25,0.08)',
              borderLeft: `3px solid ${s.border}`,
              borderRadius: '14px', padding: '16px 18px',
              boxShadow: '0 2px 12px rgba(44,36,25,0.06)',
            }}>
              <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9ca3af', marginBottom: '6px' }}>{s.label}</div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: s.color, letterSpacing: '-0.02em', lineHeight: 1 }}>
                {loading ? '—' : s.value}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isAdmin ? '360px 1fr' : '1fr', gap: '20px', alignItems: 'start' }}>

          {/* ── Create User Form ── */}
          {isAdmin && (
            <div style={{
              background: 'rgba(255,255,255,0.95)',
              border: '1px solid rgba(44,36,25,0.08)',
              borderRadius: '20px', padding: '24px',
              boxShadow: '0 4px 20px rgba(44,36,25,0.06)',
              position: 'sticky', top: '64px',
            }}>
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#c4704f', marginBottom: '18px' }}>
                Create New User
              </div>

              <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {[
                  { key: 'email',    label: 'Email',    type: 'email',    placeholder: 'dr@example.com' },
                  { key: 'password', label: 'Password', type: 'password', placeholder: 'Min 8 characters' },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: '#5c5850', marginBottom: '6px' }}>
                      {f.label} <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type={f.type}
                      value={(form as any)[f.key]}
                      onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      style={{ width: '100%', padding: '9px 12px', border: '1.5px solid rgba(44,36,25,0.15)', borderRadius: '9px', fontSize: '13px', background: '#faf8f6', color: '#2c2419', outline: 'none', boxSizing: 'border-box' as const }}
                      onFocus={e => { e.currentTarget.style.borderColor = '#c4704f'; e.currentTarget.style.background = '#fff'; }}
                      onBlur={e => { e.currentTarget.style.borderColor = 'rgba(44,36,25,0.15)'; e.currentTarget.style.background = '#faf8f6'; }}
                      required
                    />
                  </div>
                ))}

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: '#5c5850', marginBottom: '6px' }}>Role</label>
                  <select
                    value={form.role}
                    onChange={e => setForm(p => ({ ...p, role: e.target.value as any, clientId: '' }))}
                    style={{ width: '100%', padding: '9px 12px', border: '1.5px solid rgba(44,36,25,0.15)', borderRadius: '9px', fontSize: '13px', background: '#fff', color: '#2c2419', outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="client">Client</option>
                    <option value="team">Team</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                {form.role === 'client' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: '#5c5850', marginBottom: '6px' }}>
                      Assign to Client <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <select
                      value={form.clientId}
                      onChange={e => setForm(p => ({ ...p, clientId: e.target.value }))}
                      style={{ width: '100%', padding: '9px 12px', border: '1.5px solid rgba(44,36,25,0.15)', borderRadius: '9px', fontSize: '13px', background: '#fff', color: '#2c2419', outline: 'none', cursor: 'pointer' }}
                    >
                      <option value="">— Select client —</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}

                {error && (
                  <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px', padding: '9px 12px', fontSize: '12px', color: '#dc2626' }}>
                    {error}
                  </div>
                )}
                {success && (
                  <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '8px', padding: '9px 12px', fontSize: '12px', color: '#059669' }}>
                    {success}
                  </div>
                )}

                <button type="submit" disabled={submitting} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                  padding: '10px 20px', background: submitting ? '#d4a68a' : '#c4704f',
                  color: '#fff', border: 'none', borderRadius: '10px',
                  fontSize: '13px', fontWeight: 600,
                  cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.8 : 1,
                }}>
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                  {submitting ? 'Creating…' : 'Create User'}
                </button>
              </form>
            </div>
          )}

          {/* ── Users Table ── */}
          <div style={{
            background: 'rgba(255,255,255,0.95)',
            border: '1px solid rgba(44,36,25,0.08)',
            borderRadius: '20px', padding: '24px',
            boxShadow: '0 4px 20px rgba(44,36,25,0.06)',
          }}>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#2c2419' }}>All Users</div>
              <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>{users.length} accounts</div>
            </div>

            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
                <Loader2 size={24} className="animate-spin" style={{ color: '#c4704f' }} />
              </div>
            ) : (
              <>
                <style>{`
                  .users-table { table-layout: fixed; width: 100%; border-collapse: separate; border-spacing: 0; }
                  .users-table th { padding: 9px 12px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #9ca3af; border-bottom: 1.5px solid rgba(44,36,25,0.1); text-align: left; }
                  .users-table td { padding: 13px 12px; font-size: 13px; border-bottom: 1px solid rgba(44,36,25,0.05); vertical-align: middle; }
                  .users-table tbody tr:last-child td { border-bottom: none; }
                  .users-table tbody tr:hover td { background: rgba(196,112,79,0.03); }
                `}</style>
                <div style={{ overflowX: 'auto' }}>
                  <table className="users-table">
                    <thead>
                      <tr>
                        <th style={{ width: '34%' }}>Email</th>
                        <th style={{ width: '12%' }}>Role</th>
                        <th style={{ width: '24%' }}>Client</th>
                        <th style={{ width: '14%' }}>Last Login</th>
                        <th style={{ width: isAdmin ? '10%' : '16%' }}>Status</th>
                        {isAdmin && <th style={{ width: '6%', textAlign: 'center' }}></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(user => {
                        const rs = ROLE_STYLE[user.role] || ROLE_STYLE.client;
                        return (
                          <tr key={user.id} style={{ opacity: user.is_active ? 1 : 0.55 }}>
                            <td style={{ fontWeight: 500, color: '#2c2419', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {user.email}
                            </td>
                            <td>
                              <span style={{ padding: '3px 8px', borderRadius: '5px', fontSize: '11px', fontWeight: 700, background: rs.bg, color: rs.color }}>
                                {user.role}
                              </span>
                            </td>
                            <td style={{ color: '#5c5850', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {getClientName(user.client_id)}
                            </td>
                            <td style={{ color: '#9ca3af', fontSize: '12px' }}>
                              {fmtDate(user.last_login)}
                            </td>
                            <td>
                              <span style={{
                                padding: '3px 8px', borderRadius: '5px', fontSize: '11px', fontWeight: 700,
                                background: user.is_active ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.08)',
                                color: user.is_active ? '#059669' : '#dc2626',
                              }}>
                                {user.is_active ? 'Active' : 'Off'}
                              </span>
                            </td>
                            {isAdmin && (
                              <td style={{ textAlign: 'center' }}>
                                <button onClick={() => toggleActive(user)} title={user.is_active ? 'Deactivate' : 'Activate'}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: user.is_active ? '#10b981' : '#9ca3af', display: 'inline-flex', alignItems: 'center' }}>
                                  {user.is_active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                      {users.length === 0 && (
                        <tr>
                          <td colSpan={isAdmin ? 6 : 5} style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>No users found</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

        </div>
      </div>
    </AdminLayout>
  );
}

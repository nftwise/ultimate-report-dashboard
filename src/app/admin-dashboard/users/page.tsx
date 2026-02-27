'use client';

import { useEffect, useState } from 'react';
import { UserPlus, Loader2, ToggleLeft, ToggleRight } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
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

const labelStyle = {
  display: 'block',
  fontSize: '12px',
  fontWeight: '600' as const,
  color: '#5c5850',
  marginBottom: '6px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
};

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

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState({
    email: '',
    password: '',
    role: 'client' as 'client' | 'admin' | 'team',
    clientId: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [usersRes, clientsRes] = await Promise.all([
        fetch('/api/admin/add-user'),
        Promise.resolve(
          createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL || '',
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
          )
            .from('clients')
            .select('id, name, slug')
            .eq('is_active', true)
            .order('name')
        ),
      ]);

      const usersData = await usersRes.json();
      if (usersData.success) setUsers(usersData.users || []);

      const { data: clientsData } = await clientsRes;
      setClients(clientsData || []);
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!form.email || !form.password) {
      setError('Email and password are required');
      return;
    }
    if (form.role === 'client' && !form.clientId) {
      setError('Please select a client for this user');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/add-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.trim(),
          password: form.password,
          role: form.role,
          clientId: form.role === 'client' ? form.clientId : null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to create user');

      setSuccess(`User ${form.email} created successfully`);
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

  const getClientName = (clientId: string | null) => {
    if (!clientId) return '—';
    return clients.find(c => c.id === clientId)?.name || clientId.slice(0, 8) + '...';
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#c4704f' }} />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 24px 60px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#2c2419', marginBottom: '8px', letterSpacing: '-0.02em' }}>
          User Accounts
        </h1>
        <p style={{ fontSize: '14px', color: '#8a7f74', marginBottom: '32px' }}>
          Create login accounts for clients and manage access.
        </p>

        {/* Create User Form */}
        <div style={{
          background: 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(44,36,25,0.1)',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 4px 20px rgba(44,36,25,0.06)',
          marginBottom: '24px',
        }}>
          <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#c4704f', marginBottom: '20px' }}>
            Create New User
          </p>

          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={labelStyle}>Email *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="dr@example.com"
                  style={inputStyle}
                  required
                />
              </div>
              <div>
                <label style={labelStyle}>Password *</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Min 8 characters"
                  style={inputStyle}
                  required
                />
              </div>
              <div>
                <label style={labelStyle}>Role</label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value as 'client' | 'admin' | 'team', clientId: '' }))}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  <option value="client">Client</option>
                  <option value="admin">Admin</option>
                  <option value="team">Team</option>
                </select>
              </div>
              {form.role === 'client' && (
                <div>
                  <label style={labelStyle}>Assign to Client *</label>
                  <select
                    value={form.clientId}
                    onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    <option value="">— Select client —</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {error && (
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 14px', marginBottom: '12px', fontSize: '13px', color: '#dc2626' }}>
                {error}
              </div>
            )}
            {success && (
              <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', padding: '10px 14px', marginBottom: '12px', fontSize: '13px', color: '#059669' }}>
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                background: '#c4704f',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              {submitting ? 'Creating...' : 'Create User'}
            </button>
          </form>
        </div>

        {/* Users List */}
        <div style={{
          background: 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(44,36,25,0.1)',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(44,36,25,0.06)',
        }}>
          <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(44,36,25,0.08)' }}>
            <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#c4704f' }}>
              All Users ({users.length})
            </p>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(44,36,25,0.03)' }}>
                {['Email', 'Role', 'Client', 'Last Login', 'Status', ''].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#8a7f74', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((user, i) => (
                <tr key={user.id} style={{ borderTop: i === 0 ? 'none' : '1px solid rgba(44,36,25,0.06)' }}>
                  <td style={{ padding: '14px 16px', fontSize: '14px', color: '#2c2419', fontWeight: 500 }}>{user.email}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      background: user.role === 'admin' ? 'rgba(196,112,79,0.12)' : 'rgba(16,185,129,0.1)',
                      color: user.role === 'admin' ? '#c4704f' : '#059669',
                    }}>
                      {user.role}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '13px', color: '#5c5850' }}>{getClientName(user.client_id)}</td>
                  <td style={{ padding: '14px 16px', fontSize: '12px', color: '#9ca3af' }}>
                    {user.last_login ? new Date(user.last_login).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : 'Never'}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      background: user.is_active ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.08)',
                      color: user.is_active ? '#059669' : '#dc2626',
                    }}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <button
                      onClick={() => toggleActive(user)}
                      title={user.is_active ? 'Deactivate' : 'Activate'}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: user.is_active ? '#10b981' : '#9ca3af',
                        display: 'inline-flex',
                        alignItems: 'center',
                      }}
                    >
                      {user.is_active
                        ? <ToggleRight className="w-5 h-5" />
                        : <ToggleLeft className="w-5 h-5" />
                      }
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#9ca3af', fontSize: '14px' }}>
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}

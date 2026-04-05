'use client';

import { useEffect, useState, useCallback } from 'react';
import { UserPlus, Loader2, ToggleLeft, ToggleRight, Users, ChevronDown, ChevronUp } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { useSession } from 'next-auth/react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

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

// Heatmap colors — warm neutral → sage green scale
const HEAT_COLOR = (n: number) =>
  n === 0 ? 'rgba(44,36,25,0.07)' :
  n === 1 ? '#c8ddd1' :
  n === 2 ? '#9db5a0' :
  n <= 4  ? '#5a9b76' : '#2d7a52';

function buildGrid(activityByDay: Record<string, number>, weeks = 26) {
  const today = new Date();
  // Align start to Monday
  const dow = today.getDay(); // 0=Sun
  const daysBack = (dow === 0 ? 6 : dow - 1) + (weeks - 1) * 7 + 6;
  const start = new Date(today);
  start.setDate(today.getDate() - daysBack);
  start.setHours(0, 0, 0, 0);

  const grid: Array<Array<{ date: string; count: number; future: boolean }>> = [];
  for (let w = 0; w < weeks; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const dt = new Date(start);
      dt.setDate(start.getDate() + w * 7 + d);
      // Use local date (not toISOString which converts to UTC → off-by-1 for UTC+ timezones)
      const pad = (n: number) => String(n).padStart(2, '0');
      const dateStr = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
      week.push({ date: dateStr, count: activityByDay[dateStr] || 0, future: dt > today });
    }
    grid.push(week);
  }
  return grid;
}

function fmtDateShort(d: string | null) {
  if (!d) return 'Never';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}
function fmtDateTime(d: string) {
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_LABELS   = ['M','T','W','T','F','S','S'];

function LoginHeatmap({ activityByDay, recentLogins }: {
  activityByDay: Record<string, number>;
  recentLogins: Array<{ logged_at: string }>;
}) {
  const grid = buildGrid(activityByDay, 26);
  const totalLogins = Object.values(activityByDay).reduce((s, n) => s + n, 0);
  const activeDays = Object.values(activityByDay).filter(n => n > 0).length;

  // Month labels — find first week of each month
  const monthMarkers: Array<{ weekIdx: number; label: string }> = [];
  let lastMonth = -1;
  grid.forEach((week, wi) => {
    const m = new Date(week[0].date + 'T12:00:00').getMonth();
    if (m !== lastMonth) { monthMarkers.push({ weekIdx: wi, label: MONTH_LABELS[m] }); lastMonth = m; }
  });

  return (
    <div style={{ padding: '20px 24px 24px' }}>
      {/* Stats row — golden ratio font scale 10/16/26 */}
      <div style={{ display: 'flex', gap: '28px', marginBottom: '18px', alignItems: 'baseline' }}>
        <div>
          <span style={{ fontSize: '26px', fontWeight: 800, color: '#2c2419', letterSpacing: '-0.02em' }}>{totalLogins}</span>
          <span style={{ fontSize: '12px', color: '#9ca3af', marginLeft: '6px' }}>total logins</span>
        </div>
        <div>
          <span style={{ fontSize: '26px', fontWeight: 800, color: '#5a9b76', letterSpacing: '-0.02em' }}>{activeDays}</span>
          <span style={{ fontSize: '12px', color: '#9ca3af', marginLeft: '6px' }}>active days</span>
        </div>
        {recentLogins[0] && (
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9ca3af' }}>Last login</div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#2c2419' }}>{fmtDateTime(recentLogins[0].logged_at)}</div>
          </div>
        )}
      </div>

      {/* Heatmap */}
      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'inline-block', minWidth: 'max-content' }}>
          {/* Month labels */}
          <div style={{ display: 'flex', paddingLeft: '24px', marginBottom: '4px', gap: '3px' }}>
            {grid.map((week, wi) => {
              const marker = monthMarkers.find(m => m.weekIdx === wi);
              return (
                <div key={wi} style={{ width: 12, fontSize: '9px', color: '#9ca3af', fontWeight: 600, letterSpacing: '0.04em', overflow: 'visible', whiteSpace: 'nowrap' }}>
                  {marker ? marker.label : ''}
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: '3px' }}>
            {/* Day labels */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginRight: '4px', justifyContent: 'space-between' }}>
              {DAY_LABELS.map((l, i) => (
                <div key={i} style={{ height: 12, fontSize: '9px', color: '#9ca3af', fontWeight: 600, display: 'flex', alignItems: 'center', width: 8 }}>
                  {i % 2 === 0 ? l : ''}
                </div>
              ))}
            </div>

            {/* Grid */}
            {grid.map((week, wi) => (
              <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {week.map((cell, di) => (
                  <div
                    key={di}
                    title={cell.future ? '' : `${cell.date}${cell.count > 0 ? `: ${cell.count} login${cell.count !== 1 ? 's' : ''}` : ': no login'}`}
                    style={{
                      width: 12, height: 12, borderRadius: 3,
                      background: cell.future ? 'transparent' : HEAT_COLOR(cell.count),
                      cursor: cell.count > 0 ? 'default' : 'default',
                      transition: 'transform 80ms',
                      flexShrink: 0,
                    }}
                    onMouseEnter={e => { if (!cell.future) (e.currentTarget as HTMLElement).style.transform = 'scale(1.4)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '10px', paddingLeft: '24px' }}>
            <span style={{ fontSize: '10px', color: '#9ca3af' }}>Less</span>
            {[0, 1, 2, 3, 5].map(n => (
              <div key={n} style={{ width: 12, height: 12, borderRadius: 3, background: HEAT_COLOR(n) }} />
            ))}
            <span style={{ fontSize: '10px', color: '#9ca3af' }}>More</span>
          </div>
        </div>
      </div>

      {/* Recent logins list */}
      {recentLogins.length > 0 && (
        <div style={{ marginTop: '20px', borderTop: '1px solid rgba(44,36,25,0.06)', paddingTop: '16px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9ca3af', marginBottom: '10px' }}>
            Recent Sessions
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {recentLogins.slice(0, 5).map((l, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: i === 0 ? '#5a9b76' : 'rgba(44,36,25,0.12)', flexShrink: 0 }} />
                <span style={{ fontSize: '12px', color: i === 0 ? '#2c2419' : '#5c5850', fontWeight: i === 0 ? 600 : 400 }}>
                  {fmtDateTime(l.logged_at)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function UsersPage() {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role;
  const isAdmin = userRole === 'admin' || userRole === 'team';

  const [users, setUsers]         = useState<User[]>([]);
  const [clients, setClients]     = useState<Client[]>([]);
  const [loading, setLoading]     = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [success, setSuccess]     = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // login_logs: { userId → { dateStr → count } }
  const [activityMap, setActivityMap] = useState<Record<string, Record<string, number>>>({});
  // recent logins: { userId → Array<{logged_at}> }
  const [recentMap, setRecentMap] = useState<Record<string, Array<{ logged_at: string }>>>({});

  const [form, setForm] = useState({
    email: '', password: '',
    role: 'client' as 'client' | 'admin' | 'team',
    clientId: '',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, { data: clientsData }] = await Promise.all([
        fetch('/api/admin/add-user'),
        supabase.from('clients').select('id, name, slug').eq('is_active', true).order('name'),
      ]);

      const usersData = await usersRes.json();
      if (usersData.success) setUsers(usersData.users || []);
      setClients(clientsData || []);

      // login_logs returned by same API (uses service role key — anon key blocked by RLS)
      const logsData: Array<{ user_id: string; logged_at: string }> = usersData.loginLogs || [];
      const activity: Record<string, Record<string, number>> = {};
      const recent: Record<string, Array<{ logged_at: string }>> = {};
      const localDateStr = (iso: string) => {
        const d = new Date(iso);
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      };
      for (const log of logsData) {
        const day = localDateStr(log.logged_at);
        if (!activity[log.user_id]) activity[log.user_id] = {};
        activity[log.user_id][day] = (activity[log.user_id][day] || 0) + 1;
        if (!recent[log.user_id]) recent[log.user_id] = [];
        if (recent[log.user_id].length < 5) recent[log.user_id].push({ logged_at: log.logged_at });
      }
      setActivityMap(activity);
      setRecentMap(recent);
    } catch {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setSuccess(null);
    if (!form.email || !form.password) { setError('Email and password are required'); return; }
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return; }
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

  const activeCount = users.filter(u => u.is_active).length;
  const adminCount  = users.filter(u => u.role === 'admin').length;
  const teamCount   = users.filter(u => u.role === 'team').length;
  const clientCount = users.filter(u => u.role === 'client').length;

  return (
    <AdminLayout>
      <div className="sticky top-14 md:top-0 z-30 px-6 py-3" style={{
        background: 'rgba(245,241,237,0.98)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(44,36,25,0.08)',
        display: 'flex', alignItems: 'center', gap: '12px',
      }}>
        <Users size={16} style={{ color: '#c4704f' }} />
        <span style={{ fontSize: '15px', fontWeight: 700, color: '#2c2419' }}>User Accounts</span>
        <span style={{ fontSize: '12px', color: '#9ca3af' }}>{users.length} total · {activeCount} active</span>
      </div>

      <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>

        {/* Stats — golden ratio grid minmax(160px → ~38.2% of 420px min-width) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '24px' }}>
          {[
            { label: 'Total Users',   value: users.length, color: '#2c2419', border: '#2c2419' },
            { label: 'Active',        value: activeCount,  color: '#059669', border: '#10b981' },
            { label: 'Admin',         value: adminCount,   color: '#c4704f', border: '#c4704f' },
            { label: 'Team',          value: teamCount,    color: '#374151', border: '#6b7280' },
            { label: 'Client Logins', value: clientCount,  color: '#166534', border: '#22c55e' },
          ].map(s => (
            <div key={s.label} style={{
              background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(44,36,25,0.08)',
              borderLeft: `3px solid ${s.border}`, borderRadius: '14px', padding: '16px 18px',
              boxShadow: '0 2px 12px rgba(44,36,25,0.06)',
            }}>
              <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9ca3af', marginBottom: '6px' }}>{s.label}</div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: s.color, letterSpacing: '-0.02em', lineHeight: 1 }}>
                {loading ? '—' : s.value}
              </div>
            </div>
          ))}
        </div>

        {/* Golden ratio layout: form 38.2% / table 61.8% */}
        <div className={isAdmin ? 'grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5 items-start' : 'grid grid-cols-1 gap-5 items-start'}>

          {/* Create User Form */}
          {isAdmin && (
            <div style={{
              background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(44,36,25,0.08)',
              borderRadius: '20px', padding: '24px',
              boxShadow: '0 4px 20px rgba(44,36,25,0.06)',
              position: 'sticky', top: '56px',
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
                      type={f.type} value={(form as any)[f.key]}
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
                  <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value as any, clientId: '' }))}
                    style={{ width: '100%', padding: '9px 12px', border: '1.5px solid rgba(44,36,25,0.15)', borderRadius: '9px', fontSize: '13px', background: '#fff', color: '#2c2419', outline: 'none', cursor: 'pointer' }}>
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
                    <select value={form.clientId} onChange={e => setForm(p => ({ ...p, clientId: e.target.value }))}
                      style={{ width: '100%', padding: '9px 12px', border: '1.5px solid rgba(44,36,25,0.15)', borderRadius: '9px', fontSize: '13px', background: '#fff', color: '#2c2419', outline: 'none', cursor: 'pointer' }}>
                      <option value="">— Select client —</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}
                {error && <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px', padding: '9px 12px', fontSize: '12px', color: '#dc2626' }}>{error}</div>}
                {success && <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '8px', padding: '9px 12px', fontSize: '12px', color: '#059669' }}>{success}</div>}
                <button type="submit" disabled={submitting} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                  padding: '10px 20px', background: submitting ? '#d4a68a' : '#c4704f',
                  color: '#fff', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
                  cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.8 : 1,
                }}>
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                  {submitting ? 'Creating…' : 'Create User'}
                </button>
              </form>
            </div>
          )}

          {/* Users Table + Activity */}
          <div style={{
            background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(44,36,25,0.08)',
            borderRadius: '20px', overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(44,36,25,0.06)',
          }}>
            <div style={{ padding: '24px 24px 16px' }}>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#2c2419' }}>All Users</div>
              <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>Click a row to view login activity</div>
            </div>

            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
                <Loader2 size={24} className="animate-spin" style={{ color: '#c4704f' }} />
              </div>
            ) : (
              <>
                <style>{`
                  .users-table { table-layout: fixed; width: 100%; border-collapse: separate; border-spacing: 0; }
                  .users-table th { padding: 9px 16px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #9ca3af; border-bottom: 1.5px solid rgba(44,36,25,0.08); text-align: left; }
                  .users-table td { padding: 13px 16px; font-size: 13px; border-bottom: 1px solid rgba(44,36,25,0.05); vertical-align: middle; }
                  .users-table tbody tr:last-child td { border-bottom: none; }
                  .users-row:hover td { background: rgba(196,112,79,0.03); cursor: pointer; }
                  .users-row.expanded td { background: rgba(90,155,118,0.04); border-bottom: none !important; }
                `}</style>
                <div style={{ overflowX: 'auto' }}>
                  <table className="users-table">
                    <thead>
                      <tr>
                        <th style={{ width: '34%' }}>Email</th>
                        <th style={{ width: '11%' }}>Role</th>
                        <th style={{ width: '22%' }}>Client</th>
                        <th style={{ width: '15%' }}>Last Login</th>
                        <th style={{ width: '10%' }}>Status</th>
                        {isAdmin && <th style={{ width: '5%', textAlign: 'center' }}></th>}
                        <th style={{ width: '3%' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(user => {
                        const rs = ROLE_STYLE[user.role] || ROLE_STYLE.client;
                        const isExpanded = expandedId === user.id;
                        const hasActivity = !!activityMap[user.id];
                        const totalLogins = hasActivity ? Object.values(activityMap[user.id]).reduce((s, n) => s + n, 0) : 0;

                        return (
                          <>
                            <tr
                              key={user.id}
                              className={`users-row${isExpanded ? ' expanded' : ''}`}
                              onClick={() => setExpandedId(isExpanded ? null : user.id)}
                              style={{ opacity: user.is_active ? 1 : 0.55 }}
                            >
                              <td style={{ fontWeight: 500, color: '#2c2419', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  {/* Activity dot */}
                                  <div style={{
                                    width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                                    background: totalLogins > 10 ? '#2d7a52' : totalLogins > 3 ? '#5a9b76' : totalLogins > 0 ? '#9db5a0' : 'rgba(44,36,25,0.12)',
                                  }} title={`${totalLogins} logins in last 6 months`} />
                                  {user.email}
                                </div>
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
                                {fmtDateShort(user.last_login)}
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
                                <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                                  <button onClick={() => toggleActive(user)} title={user.is_active ? 'Deactivate' : 'Activate'}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: user.is_active ? '#10b981' : '#9ca3af', display: 'inline-flex', alignItems: 'center' }}>
                                    {user.is_active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                                  </button>
                                </td>
                              )}
                              <td style={{ textAlign: 'center', color: '#9ca3af' }}>
                                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </td>
                            </tr>

                            {/* Expanded heatmap row */}
                            {isExpanded && (
                              <tr key={`${user.id}-activity`}>
                                <td colSpan={isAdmin ? 7 : 6} style={{
                                  padding: 0,
                                  background: 'rgba(90,155,118,0.03)',
                                  borderBottom: '1.5px solid rgba(44,36,25,0.08)',
                                }}>
                                  <div style={{ borderTop: '1px solid rgba(90,155,118,0.15)' }}>
                                    <div style={{ padding: '14px 24px 10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <div style={{ width: 4, height: 16, borderRadius: 2, background: '#5a9b76' }} />
                                      <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#5a9b76' }}>
                                        Login Activity — Last 6 Months
                                      </span>
                                    </div>
                                    {hasActivity ? (
                                      <LoginHeatmap
                                        activityByDay={activityMap[user.id]}
                                        recentLogins={recentMap[user.id] || []}
                                      />
                                    ) : (
                                      <div style={{ padding: '20px 24px 24px', color: '#9ca3af', fontSize: '13px' }}>
                                        No login history recorded yet. Activity will appear after the next login.
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })}
                      {users.length === 0 && (
                        <tr>
                          <td colSpan={isAdmin ? 7 : 6} style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>No users found</td>
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

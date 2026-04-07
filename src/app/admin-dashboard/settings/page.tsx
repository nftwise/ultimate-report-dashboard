'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Lock, User, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrator',
  team: 'Team Member',
  client: 'Client',
};

const ROLE_COLOR: Record<string, string> = {
  admin: '#c4704f',
  team: '#374151',
  client: '#059669',
};

export default function SettingsPage() {
  const { data: session } = useSession();
  const user = session?.user as any;

  const [oldPassword, setOldPassword]     = useState('');
  const [newPassword, setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading]             = useState(false);
  const [success, setSuccess]             = useState(false);
  const [error, setError]                 = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to change password');
      } else {
        setSuccess(true);
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '32px 24px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#2c2419', marginBottom: 8 }}>
          Account Settings
        </h1>
        <p style={{ color: '#6b7280', marginBottom: 32, fontSize: 14 }}>
          Manage your account information and security settings.
        </p>

        {/* Profile info card */}
        <div style={{
          background: 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(44,36,25,0.1)',
          borderRadius: 12,
          padding: 24,
          marginBottom: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <User size={18} color="#c4704f" />
            <h2 style={{ fontSize: 16, fontWeight: 600, color: '#2c2419' }}>Profile</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#6b7280' }}>Email</span>
              <span style={{ fontSize: 14, color: '#2c2419', fontWeight: 500 }}>{user?.email || '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#6b7280' }}>Role</span>
              <span style={{
                fontSize: 12,
                fontWeight: 600,
                padding: '3px 10px',
                borderRadius: 20,
                background: `${ROLE_COLOR[user?.role] || '#374151'}18`,
                color: ROLE_COLOR[user?.role] || '#374151',
              }}>
                {ROLE_LABEL[user?.role] || user?.role || '—'}
              </span>
            </div>
            {user?.clientName && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#6b7280' }}>Client</span>
                <span style={{ fontSize: 14, color: '#2c2419', fontWeight: 500 }}>{user.clientName}</span>
              </div>
            )}
          </div>
        </div>

        {/* Change password card */}
        <div style={{
          background: 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(44,36,25,0.1)',
          borderRadius: 12,
          padding: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <Lock size={18} color="#c4704f" />
            <h2 style={{ fontSize: 16, fontWeight: 600, color: '#2c2419' }}>Change Password</h2>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, color: '#374151', marginBottom: 6, fontWeight: 500 }}>
                Current Password
              </label>
              <input
                type="password"
                value={oldPassword}
                onChange={e => setOldPassword(e.target.value)}
                required
                placeholder="Enter current password"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(44,36,25,0.15)',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.8)',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, color: '#374151', marginBottom: 6, fontWeight: 500 }}>
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
                placeholder="Min 8 characters"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(44,36,25,0.15)',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.8)',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, color: '#374151', marginBottom: 6, fontWeight: 500 }}>
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                placeholder="Repeat new password"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(44,36,25,0.15)',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.8)',
                }}
              />
            </div>

            {error && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 14px',
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 8,
                color: '#dc2626',
                fontSize: 13,
              }}>
                <AlertCircle size={15} />
                {error}
              </div>
            )}

            {success && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 14px',
                background: 'rgba(16,185,129,0.08)',
                border: '1px solid rgba(16,185,129,0.2)',
                borderRadius: 8,
                color: '#059669',
                fontSize: 13,
              }}>
                <CheckCircle size={15} />
                Password updated successfully!
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '10px 20px',
                background: loading ? 'rgba(196,112,79,0.5)' : '#c4704f',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s',
                alignSelf: 'flex-start',
              }}
            >
              {loading ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Lock size={15} />}
              {loading ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        input:focus { border-color: #c4704f !important; box-shadow: 0 0 0 3px rgba(196,112,79,0.12); }
      `}</style>
    </AdminLayout>
  );
}

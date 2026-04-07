'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Lock, User, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';

export default function ClientSettingsPage() {
  const { data: session } = useSession();
  const user = session?.user as any;

  const [oldPassword, setOldPassword]         = useState('');
  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading]                 = useState(false);
  const [success, setSuccess]                 = useState(false);
  const [error, setError]                     = useState('');

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
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '32px 24px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#2c2419', marginBottom: 8 }}>
          Account Settings
        </h1>
        <p style={{ color: '#6b7280', marginBottom: 28, fontSize: 14 }}>
          Update your login password below.
        </p>

        {/* Profile info */}
        <div style={{
          background: 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(44,36,25,0.1)',
          borderRadius: 12,
          padding: 20,
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: '50%',
            background: 'rgba(196,112,79,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <User size={18} color="#c4704f" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#2c2419' }}>{user?.email || '—'}</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>Client Account</div>
          </div>
        </div>

        {/* Change password */}
        <div style={{
          background: 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(44,36,25,0.1)',
          borderRadius: 12,
          padding: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <Lock size={16} color="#c4704f" />
            <h2 style={{ fontSize: 15, fontWeight: 600, color: '#2c2419' }}>Change Password</h2>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {(['Current Password', 'New Password', 'Confirm New Password'] as const).map((label, i) => {
              const value = i === 0 ? oldPassword : i === 1 ? newPassword : confirmPassword;
              const setter = i === 0 ? setOldPassword : i === 1 ? setNewPassword : setConfirmPassword;
              return (
                <div key={label}>
                  <label style={{ display: 'block', fontSize: 13, color: '#374151', marginBottom: 5, fontWeight: 500 }}>
                    {label}
                  </label>
                  <input
                    type="password"
                    value={value}
                    onChange={e => setter(e.target.value)}
                    required
                    placeholder={i === 1 ? 'Min 8 characters' : ''}
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: 8,
                      border: '1px solid rgba(44,36,25,0.15)', fontSize: 14,
                      outline: 'none', boxSizing: 'border-box',
                      background: 'rgba(255,255,255,0.8)',
                    }}
                  />
                </div>
              );
            })}

            {error && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 14px',
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 8, color: '#dc2626', fontSize: 13,
              }}>
                <AlertCircle size={14} /> {error}
              </div>
            )}

            {success && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 14px',
                background: 'rgba(16,185,129,0.08)',
                border: '1px solid rgba(16,185,129,0.2)',
                borderRadius: 8, color: '#059669', fontSize: 13,
              }}>
                <CheckCircle size={14} /> Password updated successfully!
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '10px 20px',
                background: loading ? 'rgba(196,112,79,0.5)' : '#c4704f',
                color: '#fff', border: 'none', borderRadius: 8,
                fontSize: 14, fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                alignSelf: 'flex-start',
              }}
            >
              {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Lock size={14} />}
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

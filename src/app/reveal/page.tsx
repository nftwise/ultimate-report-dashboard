import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { decryptPassword } from '@/lib/telegram-bot';

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function RevealPage({ searchParams }: Props) {
  const { token } = await searchParams;

  // 1. Must be logged in
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect(`/login?callbackUrl=/reveal?token=${token}`);
  }

  // Only admin/team can use this page
  const role = (session.user as any)?.role;
  if (role === 'client') {
    return <ErrorPage message="Access denied." />;
  }

  if (!token) {
    return <ErrorPage message="Invalid link — no token provided." />;
  }

  // 2. Validate token
  const { data: tokenRow, error } = await supabaseAdmin
    .from('password_reveal_tokens')
    .select('token, client_id, expires_at, used_at')
    .eq('token', token)
    .single();

  if (error || !tokenRow) {
    return <ErrorPage message="Invalid or expired link." />;
  }

  if (tokenRow.used_at) {
    return <ErrorPage message="This link has already been used." />;
  }

  if (new Date(tokenRow.expires_at) < new Date()) {
    return <ErrorPage message="This link has expired (5 minute limit)." />;
  }

  // 3. Mark token as used
  await supabaseAdmin
    .from('password_reveal_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('token', token);

  // 4. Fetch credentials
  const { data: client } = await supabaseAdmin
    .from('clients')
    .select('name')
    .eq('id', tokenRow.client_id)
    .single();

  const { data: creds } = await supabaseAdmin
    .from('bot_credentials')
    .select('label, username, password_encrypted, url, notes')
    .eq('client_id', tokenRow.client_id);

  if (!creds?.length) {
    return <ErrorPage message="No credentials found for this client." />;
  }

  // 5. Decrypt and display
  const decrypted = creds.map((c: any) => ({
    label: c.label || 'Login',
    username: c.username || '—',
    password: (() => {
      try { return decryptPassword(c.password_encrypted); }
      catch (e: any) { return `(error: ${e?.message || e})`; }
    })(),
    url: c.url,
    note: c.notes,
  }));

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f5f1ed',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.95)',
        borderRadius: '16px',
        padding: '40px',
        maxWidth: '480px',
        width: '100%',
        boxShadow: '0 4px 24px rgba(44,36,25,0.12)',
      }}>
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>🔐</div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#2c2419', margin: 0 }}>
            {client?.name || 'Client'} — Credentials
          </h1>
          <p style={{ fontSize: '13px', color: '#9ca3af', margin: '4px 0 0' }}>
            This page is one-time use and has now expired.
          </p>
        </div>

        {/* Credentials */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {decrypted.map((cred, i) => (
            <div key={i} style={{
              background: '#f9f7f5',
              border: '1px solid rgba(44,36,25,0.1)',
              borderRadius: '10px',
              padding: '16px',
            }}>
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#c4704f', marginBottom: '10px' }}>
                {cred.label}
              </div>
              {cred.url && <Field label="Login URL" value={cred.url} />}
              <Field label="Username / Email" value={cred.username} />
              <Field label="Password" value={cred.password} isPassword />
              {cred.note && (
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#5c5850' }}>
                  📝 {cred.note}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Warning */}
        <div style={{
          marginTop: '24px',
          padding: '12px',
          background: '#fef3cd',
          borderRadius: '8px',
          fontSize: '12px',
          color: '#7c5c00',
        }}>
          ⚠️ Do not share this page. Close after copying credentials.
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, isPassword }: { label: string; value: string; isPassword?: boolean }) {
  return (
    <div style={{ marginBottom: '8px' }}>
      <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '2px' }}>{label}</div>
      <div style={{
        fontSize: '14px',
        fontWeight: 600,
        color: '#2c2419',
        fontFamily: isPassword ? 'monospace' : 'inherit',
        background: isPassword ? 'rgba(196,112,79,0.08)' : 'transparent',
        padding: isPassword ? '4px 8px' : '0',
        borderRadius: isPassword ? '4px' : '0',
        wordBreak: 'break-all',
      }}>
        {value}
      </div>
    </div>
  );
}

function ErrorPage({ message }: { message: string }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#f5f1ed',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.95)',
        borderRadius: '16px',
        padding: '40px',
        textAlign: 'center',
        maxWidth: '400px',
      }}>
        <div style={{ fontSize: '32px', marginBottom: '16px' }}>🔒</div>
        <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#2c2419', margin: '0 0 8px' }}>Access Denied</h1>
        <p style={{ fontSize: '14px', color: '#5c5850', margin: 0 }}>{message}</p>
      </div>
    </div>
  );
}

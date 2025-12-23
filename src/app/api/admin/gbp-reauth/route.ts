import { NextRequest, NextResponse } from 'next/server';
import { GBPTokenManager } from '@/lib/gbp-token-manager';

/**
 * GET /api/admin/gbp-reauth
 * Simple OAuth for agency GBP - stores token in Supabase (works on Vercel)
 */
export async function GET(request: NextRequest) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const redirectUri = `${baseUrl}/api/admin/gbp-reauth`;
    const code = request.nextUrl.searchParams.get('code');

    // Handle OAuth callback
    if (code) {
      const token = await GBPTokenManager.exchangeCode(code, redirectUri);

      return new NextResponse(`
        <!DOCTYPE html><html><head><title>GBP Connected</title>
        <style>body{font-family:system-ui;max-width:500px;margin:50px auto;padding:20px;text-align:center}
        .success{background:#d4edda;border:1px solid #28a745;padding:20px;border-radius:8px;margin:20px 0}
        a{color:#4285f4}</style></head>
        <body>
          <h1>✅ GBP Connected!</h1>
          <div class="success">
            <p><strong>Account:</strong> ${token.email}</p>
            <p><strong>Token stored in:</strong> Supabase (works on Vercel)</p>
          </div>
          <p><a href="/admin">← Back to Admin</a></p>
        </body></html>
      `, { headers: { 'Content-Type': 'text/html' } });
    }

    // Show status page
    const status = await GBPTokenManager.getStatus();
    const authUrl = GBPTokenManager.getAuthUrl(redirectUri);

    return new NextResponse(`
      <!DOCTYPE html><html><head><title>GBP OAuth</title>
      <style>body{font-family:system-ui;max-width:500px;margin:50px auto;padding:20px}
      .btn{display:inline-block;background:#4285f4;color:white;padding:15px 30px;text-decoration:none;border-radius:5px}
      .status{background:#f5f5f5;padding:15px;border-radius:8px;margin:20px 0}
      .ok{color:#28a745}.err{color:#dc3545}</style></head>
      <body>
        <h1>🔄 GBP OAuth</h1>
        <div class="status">
          <p><strong>Token:</strong> <span class="${status.valid ? 'ok' : 'err'}">${status.exists ? (status.valid ? 'Valid ✓' : 'Expired ✗') : 'Not found'}</span></p>
          ${status.email ? `<p><strong>Account:</strong> ${status.email}</p>` : ''}
          ${status.expiresAt ? `<p><strong>Expires:</strong> ${new Date(status.expiresAt).toLocaleString()}</p>` : ''}
        </div>
        <p><a href="${authUrl}" class="btn">🔐 ${status.exists ? 'Re-authenticate' : 'Connect Google'}</a></p>
        <p style="margin-top:20px"><a href="/admin">← Back to Admin</a></p>
      </body></html>
    `, { headers: { 'Content-Type': 'text/html' } });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

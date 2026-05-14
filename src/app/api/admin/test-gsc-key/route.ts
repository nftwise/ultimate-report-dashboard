import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { JWT } from 'google-auth-library';

export const dynamic = 'force-dynamic';

/** GET /api/admin/test-gsc-key — admin only, diagnose GSC key on Vercel */
export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (!session || (role !== 'admin' && role !== 'team')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rawKey = process.env.GOOGLE_PRIVATE_KEY || '';
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || '';

  // Detect format
  let privateKey: string;
  let keyFormat: string;
  try {
    const decoded = Buffer.from(rawKey, 'base64').toString('utf-8');
    if (decoded.includes('-----BEGIN')) {
      privateKey = decoded;
      keyFormat = 'base64';
    } else {
      privateKey = rawKey.replace(/\\n/g, '\n');
      keyFormat = 'raw_escaped';
    }
  } catch {
    privateKey = rawKey.replace(/\\n/g, '\n');
    keyFormat = 'raw_fallback';
  }

  const hasKey = !!privateKey && privateKey.includes('-----BEGIN');
  const keyPreview = privateKey.slice(0, 50);

  let tokenOk = false;
  let tokenError = '';
  let gscStatus = 0;
  let gscError = '';
  let rowCount = 0;

  if (hasKey && clientEmail) {
    try {
      const auth = new JWT({
        email: clientEmail,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
      });
      const { token } = await auth.getAccessToken();
      tokenOk = !!token;

      if (token) {
        // Test with a known site
        const testSite = 'sc-domain:mychiropractice.com';
        const res = await fetch(
          `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(testSite)}/searchAnalytics/query`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ startDate: '2026-05-01', endDate: '2026-05-10', dimensions: ['query'], rowLimit: 5 }),
            signal: AbortSignal.timeout(10000),
          }
        );
        gscStatus = res.status;
        if (res.ok) {
          const json = await res.json();
          rowCount = json.rows?.length ?? 0;
        } else {
          gscError = (await res.text()).slice(0, 200);
        }
      }
    } catch (e: any) {
      tokenError = e?.message || String(e);
    }
  }

  return NextResponse.json({
    keyFormat,
    hasKey,
    keyPreview,
    hasEmail: !!clientEmail,
    email: clientEmail,
    tokenOk,
    tokenError,
    gscStatus,
    gscError,
    rowCount,
  });
}

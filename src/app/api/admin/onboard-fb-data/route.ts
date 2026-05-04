import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdminTeam, PortalAuthError } from '@/lib/portal-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/onboard-fb-data
 * Returns active clients + the subset already connected to a Facebook Ad Account.
 */
export async function GET(_request: NextRequest) {
  try {
    await requireAdminTeam();

    const { data: rows, error } = await supabaseAdmin
      .from('clients')
      .select('id, name, city, service_configs(fb_ad_account_id)')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const clients: Array<{ id: string; name: string; city: string }> = [];
    const connected: Array<{ id: string; name: string; city: string; fb_ad_account_id: string }> = [];

    for (const row of (rows || []) as any[]) {
      clients.push({ id: row.id, name: row.name, city: row.city || '' });
      const cfg = Array.isArray(row.service_configs) ? row.service_configs[0] : row.service_configs;
      if (cfg?.fb_ad_account_id) {
        connected.push({
          id: row.id,
          name: row.name,
          city: row.city || '',
          fb_ad_account_id: cfg.fb_ad_account_id,
        });
      }
    }

    return NextResponse.json({ success: true, clients, connected });
  } catch (err: any) {
    if (err instanceof PortalAuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}

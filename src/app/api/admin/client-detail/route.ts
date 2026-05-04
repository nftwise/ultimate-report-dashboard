import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdminTeam, PortalAuthError } from '@/lib/portal-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/client-detail?id=X
 * Returns a single client + service_configs + GBP location info for the edit page.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdminTeam();
    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });
    }

    const [{ data: client, error: cErr }, { data: gbpRow }] = await Promise.all([
      supabaseAdmin
        .from('clients')
        .select('*, service_configs(ga_property_id, gads_customer_id, gsc_site_url)')
        .eq('id', id)
        .maybeSingle(),
      supabaseAdmin
        .from('gbp_locations')
        .select('id, gbp_location_id')
        .eq('client_id', id)
        .eq('is_active', true)
        .maybeSingle(),
    ]);

    if (cErr) {
      return NextResponse.json({ success: false, error: cErr.message }, { status: 500 });
    }
    if (!client) {
      return NextResponse.json({ success: false, error: 'Client not found' }, { status: 404 });
    }

    const config = Array.isArray((client as any).service_configs)
      ? (client as any).service_configs[0]
      : (client as any).service_configs || {};

    return NextResponse.json({
      success: true,
      client,
      config: config || {},
      gbp: gbpRow || null,
    });
  } catch (err: any) {
    if (err instanceof PortalAuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}

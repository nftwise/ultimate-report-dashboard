import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdminTeam, PortalAuthError } from '@/lib/portal-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/users-data
 * Returns the active client list (id, name, slug) for the users management page.
 */
export async function GET(_request: NextRequest) {
  try {
    await requireAdminTeam();
    const { data, error } = await supabaseAdmin
      .from('clients')
      .select('id, name, slug')
      .eq('is_active', true)
      .order('name', { ascending: true });
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, clients: data || [] });
  } catch (err: any) {
    if (err instanceof PortalAuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}

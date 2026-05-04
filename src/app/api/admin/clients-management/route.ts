import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdminTeam, PortalAuthError } from '@/lib/portal-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/clients-management
 * Returns full clients list + last sync date + has_gbp + manual form fills map
 * for the /admin-dashboard/clients management page.
 */
export async function GET(_request: NextRequest) {
  try {
    await requireAdminTeam();

    // Last 60 days for sync recency
    const since = new Date();
    since.setDate(since.getDate() - 60);
    const sinceStr = `${since.getFullYear()}-${String(since.getMonth() + 1).padStart(2, '0')}-${String(since.getDate()).padStart(2, '0')}`;

    const [
      { data: clients, error: clientsErr },
      { data: syncRows },
      { data: gbpLocs },
      { data: fillsRows },
    ] = await Promise.all([
      supabaseAdmin
        .from('clients')
        .select('id, name, slug, city, contact_name, contact_email, website_url, is_active, has_seo, has_ads, notes, ads_budget_month, status, industry, owner')
        .order('name', { ascending: true }),
      supabaseAdmin
        .from('client_metrics_summary')
        .select('client_id, date')
        .eq('period_type', 'daily')
        .gte('date', sinceStr)
        .order('date', { ascending: false }),
      supabaseAdmin
        .from('gbp_locations')
        .select('client_id')
        .eq('is_active', true),
      supabaseAdmin
        .from('manual_form_fills')
        .select('client_id, year_month, form_fills'),
    ]);

    if (clientsErr) {
      return NextResponse.json({ success: false, error: clientsErr.message }, { status: 500 });
    }

    const lastSync: Record<string, string> = {};
    for (const row of (syncRows || []) as any[]) {
      if (!lastSync[row.client_id]) lastSync[row.client_id] = row.date;
    }

    const gbpSet = new Set((gbpLocs || []).map((r: any) => r.client_id));
    const enrichedClients = (clients || []).map((c: any) => ({
      ...c,
      has_gbp: gbpSet.has(c.id),
    }));

    const fillsMap: Record<string, Record<string, string>> = {};
    for (const row of (fillsRows || []) as any[]) {
      if (!fillsMap[row.client_id]) fillsMap[row.client_id] = {};
      fillsMap[row.client_id][row.year_month] = String(row.form_fills);
    }

    return NextResponse.json({
      success: true,
      clients: enrichedClients,
      lastSync,
      fillsMap,
    });
  } catch (err: any) {
    if (err instanceof PortalAuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}

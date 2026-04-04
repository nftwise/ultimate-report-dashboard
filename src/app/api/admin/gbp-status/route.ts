import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    // Master token status
    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .select('value, updated_at')
      .eq('key', 'gbp_agency_master')
      .single();

    let master = { connected: false } as any;
    if (!error && data) {
      const token = JSON.parse(data.value);
      master = {
        connected: true,
        email: token.email || null,
        hasRefreshToken: !!token.refresh_token,
        expiresAt: token.expiry_date ? new Date(token.expiry_date).toISOString() : null,
        updatedAt: data.updated_at,
      };
    }

    // Per-client GBP data status: get latest date per client
    // Filter to last 45 days (GBP API lag can be up to 45 days) to avoid missing recent data
    // when a client has many rows and we'd hit the 200-row limit before reaching recent dates.
    const dateFilter = new Date();
    dateFilter.setDate(dateFilter.getDate() - 45);
    const dateFilterStr = dateFilter.toISOString().split('T')[0];

    const { data: gbpData } = await supabaseAdmin
      .from('gbp_location_daily_metrics')
      .select('client_id, date')
      .gte('date', dateFilterStr)
      .order('date', { ascending: false })
      .limit(200);

    const clientLatest: Record<string, string> = {};
    gbpData?.forEach((r: any) => {
      if (!clientLatest[r.client_id]) clientLatest[r.client_id] = r.date;
    });

    return NextResponse.json({
      ...master,
      clientStatus: clientLatest,
    });
  } catch {
    return NextResponse.json({ connected: false, clientStatus: {} });
  }
}

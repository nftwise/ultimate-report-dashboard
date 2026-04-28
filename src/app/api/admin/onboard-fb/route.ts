import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/onboard-fb
 * Connect a client's FB Ad Account and trigger 30-day backfill.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientId, adAccountId } = body;

    if (!clientId || !adAccountId) {
      return NextResponse.json(
        { success: false, error: 'clientId and adAccountId are required' },
        { status: 400 }
      );
    }

    // Clean the ad account ID: remove "act_" prefix if present, trim whitespace
    const cleanId = adAccountId.toString().trim().replace(/^act_/, '');

    if (!/^\d+$/.test(cleanId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid ad account ID. Must be numeric (with optional act_ prefix).' },
        { status: 400 }
      );
    }

    // Verify client exists
    const { data: client, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('id, name')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json(
        { success: false, error: 'Client not found' },
        { status: 404 }
      );
    }

    // Update service_configs with the FB ad account ID
    const { error: updateError } = await supabaseAdmin
      .from('service_configs')
      .update({ fb_ad_account_id: cleanId })
      .eq('client_id', clientId);

    if (updateError) {
      // If no row exists in service_configs, try insert
      const { error: insertError } = await supabaseAdmin
        .from('service_configs')
        .upsert(
          { client_id: clientId, fb_ad_account_id: cleanId },
          { onConflict: 'client_id' }
        );

      if (insertError) {
        return NextResponse.json(
          { success: false, error: `Failed to save config: ${insertError.message}` },
          { status: 500 }
        );
      }
    }

    // Trigger 30-day backfill by calling sync-fb-ads for each day
    let daysBackfilled = 0;
    const errors: string[] = [];

    // Build the base URL from the request
    const baseUrl = request.nextUrl.origin;

    for (let i = 30; i >= 1; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      try {
        const syncUrl = `${baseUrl}/api/cron/sync-fb-ads?date=${dateStr}&clientId=${clientId}`;
        const cronSecret = process.env.CRON_SECRET;
        const headers: Record<string, string> = {};
        if (cronSecret) {
          headers['Authorization'] = `Bearer ${cronSecret}`;
        }

        const resp = await fetch(syncUrl, { headers });
        const result = await resp.json();

        if (result.success) {
          daysBackfilled++;
        } else {
          errors.push(`${dateStr}: ${result.error || 'unknown error'}`);
        }
      } catch (err: any) {
        errors.push(`${dateStr}: ${err.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      clientName: client.name,
      adAccountId: cleanId,
      daysBackfilled,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    console.error('[onboard-fb] POST error:', err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/onboard-fb
 * Disconnect a client's FB Ad Account.
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientId } = body;

    if (!clientId) {
      return NextResponse.json(
        { success: false, error: 'clientId is required' },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from('service_configs')
      .update({ fb_ad_account_id: null })
      .eq('client_id', clientId);

    if (error) {
      return NextResponse.json(
        { success: false, error: `Failed to disconnect: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[onboard-fb] DELETE error:', err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

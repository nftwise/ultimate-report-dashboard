import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { ensureWorksheet, initializeHeaders, parseGoogleServiceKey } from '@/lib/google-sheets';

export const dynamic = 'force-dynamic'

export const maxDuration = 60;

/**
 * POST /api/facebook/sheets/setup
 * Link an existing Google Sheet to a client.
 *
 * User creates the sheet manually, shares it with the service account,
 * then calls this endpoint with the Sheet ID.
 *
 * Body: { clientId, sheetId }
 *
 * Service account email to share with:
 * analysis-api@uplifted-triode-432610-r7.iam.gserviceaccount.com
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientId, sheetId } = body;

    if (!clientId || !sheetId) {
      return NextResponse.json(
        { error: 'Missing required fields: clientId, sheetId' },
        { status: 400 }
      );
    }

    const googleServiceKey = parseGoogleServiceKey();
    if (!googleServiceKey) {
      return NextResponse.json(
        { error: 'Google service account not configured' },
        { status: 500 }
      );
    }

    // Get client info
    const { data: client, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('id, name')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Verify we can access the sheet + initialize headers
    const worksheetTitle = 'Leads';
    await ensureWorksheet(sheetId, worksheetTitle, googleServiceKey);
    await initializeHeaders(sheetId, worksheetTitle, googleServiceKey);

    // Save Sheet ID to service_configs
    const { error: updateError } = await supabaseAdmin
      .from('service_configs')
      .update({ fb_sheet_id: sheetId })
      .eq('client_id', clientId);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to save Sheet ID', detail: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      client: client.name,
      sheetId,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${sheetId}`,
      message: 'Sheet linked successfully. Leads will auto-sync here.',
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

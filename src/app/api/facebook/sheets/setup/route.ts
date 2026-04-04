import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createClientSheet, parseGoogleServiceKey } from '@/lib/google-sheets';

export const maxDuration = 60;

/**
 * POST /api/facebook/sheets/setup
 * Create a Google Sheet for a client and save Sheet ID
 * Body: { clientId }
 */
export async function POST(request: NextRequest) {
  try {
    // Check Bearer token auth (for cron/automated calls)
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const expectedToken = process.env.CRON_SECRET;
      if (!expectedToken || token !== expectedToken) {
        return NextResponse.json(
          { error: 'Invalid authorization token' },
          { status: 401 }
        );
      }
      // Token is valid, continue
    }
    // If no Bearer token, NextAuth should handle auth for UI calls

    const body = await request.json();
    const { clientId } = body;

    if (!clientId) {
      return NextResponse.json(
        { error: 'Missing clientId' },
        { status: 400 }
      );
    }

    // Check if Google Service Key is configured
    const googleServiceKey = parseGoogleServiceKey();

    if (!googleServiceKey) {
      return NextResponse.json(
        { error: 'Google Sheets not configured - missing GOOGLE_SHEETS_SERVICE_KEY env var' },
        { status: 500 }
      );
    }

    // Get client info
    const { data: client, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('id, name, service_configs')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    // Create Google Sheet
    const googleSheetId = await createClientSheet(client.name, googleServiceKey);

    // Update service_configs with Sheet ID
    const config = client.service_configs?.[0];
    const { error: updateError } = await supabaseAdmin
      .from('service_configs')
      .update({
        fb_sheet_id: googleSheetId,
      })
      .eq('client_id', clientId);

    if (updateError) {
      console.error('[sheets setup] Update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to save Sheet ID' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      sheetId: googleSheetId,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${googleSheetId}`,
    });
  } catch (error) {
    console.error('[sheets setup] Exception:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

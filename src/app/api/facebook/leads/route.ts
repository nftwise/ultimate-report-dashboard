import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { appendLead, ensureWorksheet, initializeHeaders } from '@/lib/google-sheets';

export const maxDuration = 60;

/**
 * GET /api/facebook/leads
 * List all leads for a client, optionally filtered by status
 */
export async function GET(request: NextRequest) {
  try {
    const clientId = request.nextUrl.searchParams.get('clientId');
    const status = request.nextUrl.searchParams.get('status');

    if (!clientId) {
      return NextResponse.json(
        { error: 'Missing clientId parameter' },
        { status: 400 }
      );
    }

    let query = supabaseAdmin
      .from('fb_leads')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[fb_leads GET]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('[fb_leads GET] Exception:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/facebook/leads
 * Add a new lead (manual entry or webhook from FB Lead Ads)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      clientId,
      leadSource, // 'fb_lead_ad' | 'messenger' | 'website_form' | 'manual'
      fbLeadId,
      name,
      phone,
      email,
      adName,
      campaignName,
    } = body;

    // Validate required fields
    if (!clientId || !leadSource || !phone) {
      return NextResponse.json(
        { error: 'Missing required fields: clientId, leadSource, phone' },
        { status: 400 }
      );
    }

    // Check if lead with same phone already exists
    const { data: existing } = await supabaseAdmin
      .from('fb_leads')
      .select('id')
      .eq('client_id', clientId)
      .eq('phone', phone)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Lead with this phone already exists for this client' },
        { status: 409 }
      );
    }

    // Insert new lead
    const { data, error } = await supabaseAdmin
      .from('fb_leads')
      .insert({
        client_id: clientId,
        lead_source: leadSource,
        fb_lead_id: fbLeadId || null,
        name: name || null,
        phone,
        email: email || null,
        ad_name: adName || null,
        campaign_name: campaignName || null,
        status: 'new',
      })
      .select()
      .single();

    if (error) {
      console.error('[fb_leads POST]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Auto-sync to Google Sheets (non-blocking)
    // Note: SMS + Telegram handled by Supabase DB webhook → /api/facebook/auto-notify
    try {
      const { data: client } = await supabaseAdmin
        .from('clients')
        .select('name, service_configs')
        .eq('id', clientId)
        .single();

      if (client) {
        const config = client.service_configs?.[0];
        const googleSheetId = config?.fb_sheet_id;
        const googleServiceKey = process.env.GOOGLE_SHEETS_SERVICE_KEY
          ? JSON.parse(process.env.GOOGLE_SHEETS_SERVICE_KEY)
          : null;

        if (googleSheetId && googleServiceKey) {
          const worksheetTitle = 'Leads';

          // Ensure worksheet exists
          await ensureWorksheet(googleSheetId, worksheetTitle, googleServiceKey);

          // Initialize headers if needed
          await initializeHeaders(googleSheetId, worksheetTitle, googleServiceKey);

          // Append lead to sheet
          await appendLead(
            googleSheetId,
            worksheetTitle,
            {
              name: data.name,
              phone: data.phone,
              email: data.email,
              lead_source: data.lead_source,
              ad_name: data.ad_name,
              campaign_name: data.campaign_name,
              status: data.status,
              created_at: data.created_at,
              notes: data.notes,
            },
            googleServiceKey
          );

          console.log(`[fb_leads POST] Synced to Google Sheets: ${googleSheetId}`);
        }
      }
    } catch (sheetError) {
      console.warn('[fb_leads POST] Google Sheets sync failed (non-blocking):', sheetError);
      // Don't fail the request if Google Sheets sync fails
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('[fb_leads POST] Exception:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

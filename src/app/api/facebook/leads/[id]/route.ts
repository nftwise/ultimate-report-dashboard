import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { updateLeadByPhone, parseGoogleServiceKey } from '@/lib/google-sheets';

export const maxDuration = 60;

/**
 * PATCH /api/facebook/leads/[id]
 * Update lead status, notes, or other fields
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const { status, notes, name, email } = body;

    // Build update object with only provided fields
    const updates: Record<string, any> = {};

    if (status !== undefined) {
      updates.status = status;
    }
    if (notes !== undefined) {
      updates.notes = notes;
    }
    if (name !== undefined) {
      updates.name = name;
    }
    if (email !== undefined) {
      updates.email = email;
    }

    // Track when lead was contacted (if status changed to contacted/responded)
    if (status === 'contacted' || status === 'responded') {
      if (!updates.last_contacted_at) {
        updates.last_contacted_at = new Date().toISOString();
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('fb_leads')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
      }
      console.error('[fb_leads PATCH]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Auto-sync to Google Sheets (non-blocking)
    try {
      if (status !== undefined || notes !== undefined) {
        const { data: client } = await supabaseAdmin
          .from('clients')
          .select('service_configs')
          .eq('id', data.client_id)
          .single();

        if (client) {
          const config = client.service_configs?.[0];
          const googleSheetId = config?.fb_sheet_id;
          const googleServiceKey = parseGoogleServiceKey();

          if (googleSheetId && googleServiceKey) {
            const lastContactDate = data.last_contacted_at
              ? new Date(data.last_contacted_at).toLocaleDateString()
              : '';

            await updateLeadByPhone(
              googleSheetId,
              'Leads',
              data.phone,
              {
                status: status,
                notes: notes,
                lastContact: lastContactDate,
              },
              googleServiceKey
            );

            console.log(`[fb_leads PATCH] Synced to Google Sheets: ${googleSheetId}`);
          }
        }
      }
    } catch (sheetError) {
      console.warn('[fb_leads PATCH] Google Sheets sync failed (non-blocking):', sheetError);
      // Don't fail the request if Google Sheets sync fails
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('[fb_leads PATCH] Exception:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/facebook/leads/[id]
 * Remove a lead
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { error } = await supabaseAdmin
      .from('fb_leads')
      .delete()
      .eq('id', id);

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
      }
      console.error('[fb_leads DELETE]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[fb_leads DELETE] Exception:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

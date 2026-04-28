import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendSMS } from '@/lib/twilio';

export const dynamic = 'force-dynamic'

export const maxDuration = 60;

/**
 * POST /api/facebook/sms
 * Send SMS to a lead
 * Body: { leadId, clientId, message }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { leadId, clientId, message } = body;

    if (!leadId || !clientId || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: leadId, clientId, message' },
        { status: 400 }
      );
    }

    // Get lead details
    const { data: lead, error: leadError } = await supabaseAdmin
      .from('fb_leads')
      .select('id, phone, status')
      .eq('id', leadId)
      .eq('client_id', clientId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      );
    }

    // Send SMS via Twilio
    let twilioSid: string;
    try {
      twilioSid = await sendSMS(lead.phone, message);
    } catch (smsError) {
      console.error('[sms POST] Twilio error:', smsError);
      return NextResponse.json(
        { error: `Failed to send SMS: ${(smsError as Error).message}` },
        { status: 500 }
      );
    }

    // Record message in DB
    const { data: msgData, error: msgError } = await supabaseAdmin
      .from('sms_messages')
      .insert({
        lead_id: leadId,
        client_id: clientId,
        direction: 'outbound',
        body: message,
        twilio_sid: twilioSid,
        status: 'sent',
      })
      .select()
      .single();

    if (msgError) {
      console.error('[sms POST] Insert error:', msgError);
      return NextResponse.json(
        { error: 'Failed to record message' },
        { status: 500 }
      );
    }

    // Update lead status to 'contacted' if it was 'new'
    if (lead.status === 'new') {
      await supabaseAdmin
        .from('fb_leads')
        .update({
          status: 'contacted',
          last_contacted_at: new Date().toISOString(),
        })
        .eq('id', leadId);
    } else if (lead.status === 'contacted') {
      // Just update last_contacted_at
      await supabaseAdmin
        .from('fb_leads')
        .update({
          last_contacted_at: new Date().toISOString(),
        })
        .eq('id', leadId);
    }

    return NextResponse.json(
      { data: msgData, twilioSid },
      { status: 201 }
    );
  } catch (error) {
    console.error('[sms POST] Exception:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

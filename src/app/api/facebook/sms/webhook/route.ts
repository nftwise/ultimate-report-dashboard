import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { parseTwilioWebhook, generateTwiMLResponse, normalizePhoneNumber } from '@/lib/twilio';

export const maxDuration = 60;

/**
 * POST /api/facebook/sms/webhook
 * Receive inbound SMS from Twilio
 * Twilio sends FormData with From, Body, etc.
 */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let body: string;

    if (contentType.includes('application/x-www-form-urlencoded')) {
      body = await request.text();
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const params = new URLSearchParams();
      for (const [key, value] of formData) {
        if (typeof value === 'string') {
          params.append(key, value);
        }
      }
      body = params.toString();
    } else {
      return NextResponse.json(
        { error: 'Unsupported content type' },
        { status: 400 }
      );
    }

    // Parse webhook
    const signature = request.headers.get('X-Twilio-Signature') || '';
    const parsed = await parseTwilioWebhook(body, signature, request.url);

    if (!parsed) {
      return new NextResponse(generateTwiMLResponse(), {
        headers: { 'Content-Type': 'application/xml' },
      });
    }

    const { from, body: messageBody } = parsed;
    const normalizedPhone = normalizePhoneNumber(from);

    // Find lead by phone
    const { data: lead, error: leadError } = await supabaseAdmin
      .from('fb_leads')
      .select('id, client_id, status')
      .eq('phone', normalizedPhone)
      .single();

    if (leadError || !lead) {
      console.warn(
        `[sms webhook] No lead found for phone: ${normalizedPhone}`
      );
      // Still return 200 to Twilio so it doesn't retry
      return new NextResponse(generateTwiMLResponse(), {
        headers: { 'Content-Type': 'application/xml' },
      });
    }

    // Insert inbound message
    const { error: msgError } = await supabaseAdmin
      .from('sms_messages')
      .insert({
        lead_id: lead.id,
        client_id: lead.client_id,
        direction: 'inbound',
        body: messageBody,
        status: 'received',
      });

    if (msgError) {
      console.error('[sms webhook] Insert error:', msgError);
    }

    // Update lead status to 'responded' if they were 'contacted'
    if (lead.status === 'contacted' || lead.status === 'new') {
      const { error: updateError } = await supabaseAdmin
        .from('fb_leads')
        .update({
          status: 'responded',
          last_contacted_at: new Date().toISOString(),
        })
        .eq('id', lead.id);

      if (updateError) {
        console.error('[sms webhook] Update error:', updateError);
      }
    }

    // Return TwiML response (no message, just acknowledgment)
    return new NextResponse(generateTwiMLResponse(), {
      headers: { 'Content-Type': 'application/xml' },
    });
  } catch (error) {
    console.error('[sms webhook] Exception:', error);
    // Return 500 but with TwiML (Twilio expects XML)
    return new NextResponse(generateTwiMLResponse(), {
      status: 500,
      headers: { 'Content-Type': 'application/xml' },
    });
  }
}

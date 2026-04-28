import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendSMS, normalizePhoneNumber } from '@/lib/twilio';
import { sendTelegramMessage } from '@/lib/telegram';

export const dynamic = 'force-dynamic'

export const maxDuration = 60;

/**
 * POST /api/facebook/voice/status
 *
 * Twilio Voice Status Callback — fires AFTER call ends.
 * This is where we decide: real call or spam?
 *
 * Twilio setup:
 *   Phone Number → Voice → Status Callback URL:
 *   https://<domain>/api/facebook/voice/status
 *
 * Filter rules:
 *   < 5 seconds → ignore (accidental click)
 *   5-15 seconds → log only (no SMS)
 *   > 15 seconds → create lead + SMS + Telegram
 *   Duplicate phone → skip (already a lead)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const params = new URLSearchParams(body);

    const callerPhone = normalizePhoneNumber(params.get('From') || '');
    const callStatus = params.get('CallStatus') || '';
    const callDuration = parseInt(params.get('CallDuration') || '0', 10);
    const twilioTo = params.get('To') || '';

    console.log(`[voice status] ${callerPhone} | status:${callStatus} | duration:${callDuration}s`);

    // Skip if no caller phone
    if (!callerPhone || callerPhone.length < 7) {
      return NextResponse.json({ skipped: true, reason: 'no phone' });
    }

    // FILTER: < 5 seconds = accidental/spam
    if (callDuration < 5) {
      console.log(`[voice status] Skipped ${callerPhone} — only ${callDuration}s (spam/accidental)`);
      return NextResponse.json({ skipped: true, reason: 'too_short', duration: callDuration });
    }

    // Find client by Twilio number
    let clientId: string | null = null;
    let clientName = 'Our Team';

    if (twilioTo) {
      const { data: configs } = await supabaseAdmin
        .from('service_configs')
        .select('client_id, clients(name)')
        .eq('twilio_phone_number', twilioTo)
        .single();
      if (configs) {
        clientId = configs.client_id;
        clientName = (configs.clients as any)?.name || clientName;
      }
    }

    // Fallback: check if caller is existing lead
    const { data: existingLead } = await supabaseAdmin
      .from('fb_leads')
      .select('id, client_id, name, status')
      .eq('phone', callerPhone)
      .single();

    if (existingLead) {
      clientId = clientId || existingLead.client_id;
      const { data: client } = await supabaseAdmin
        .from('clients').select('name').eq('id', clientId!).single();
      clientName = client?.name || clientName;

      // Known lead calling back — just alert team
      await sendTelegramMessage(
        `📞 <b>Return Call — ${clientName}</b>\n\n` +
        `👤 ${existingLead.name || 'Unknown'}\n` +
        `📞 ${callerPhone}\n` +
        `⏱️ Duration: ${callDuration}s\n` +
        `📊 Status: ${existingLead.status}`
      ).catch(() => {});

      return NextResponse.json({ action: 'existing_lead', duration: callDuration });
    }

    // FILTER: 5-15 seconds = maybe interested, log but no SMS
    if (callDuration < 15) {
      await sendTelegramMessage(
        `📞 <b>Short Call — ${clientName}</b>\n\n` +
        `📞 ${callerPhone}\n` +
        `⏱️ Duration: ${callDuration}s (too short for auto-SMS)\n` +
        `ℹ️ Not creating lead — might be accidental`
      ).catch(() => {});

      return NextResponse.json({ skipped: true, reason: 'short_call', duration: callDuration });
    }

    // > 15 seconds = REAL CALL → create lead + SMS
    if (!clientId) {
      return NextResponse.json({ skipped: true, reason: 'no_client_mapped' });
    }

    // Create new lead
    const { data: newLead } = await supabaseAdmin
      .from('fb_leads')
      .insert({
        client_id: clientId,
        phone: callerPhone,
        lead_source: 'missed_call',
        status: 'new',
        notes: `Inbound call ${callDuration}s — ${callStatus}`,
      })
      .select('id')
      .single();

    // SMS back
    if (newLead) {
      try {
        const smsBody = `Hi! Thanks for calling ${clientName}. We'll get back to you shortly! Reply STOP to opt out.`;
        await sendSMS(callerPhone, smsBody);
        await supabaseAdmin.from('sms_messages').insert({
          lead_id: newLead.id,
          client_id: clientId,
          direction: 'outbound',
          body: smsBody,
          status: 'sent',
        });
      } catch (err: any) {
        console.error('[voice status] SMS failed:', err.message);
      }
    }

    // Telegram alert
    await sendTelegramMessage(
      `📞 <b>New Call Lead — ${clientName}</b>\n\n` +
      `📞 ${callerPhone}\n` +
      `⏱️ Duration: ${callDuration}s\n` +
      `✅ Lead created + SMS sent`
    ).catch(() => {});

    return NextResponse.json({ action: 'lead_created', duration: callDuration, leadId: newLead?.id });

  } catch (err: any) {
    console.error('[voice status]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendSMS, normalizePhoneNumber } from '@/lib/twilio';
import { sendTelegramMessage } from '@/lib/telegram';

export const maxDuration = 60;

/**
 * POST /api/facebook/voice/webhook
 *
 * Twilio Voice webhook — fires when someone calls the Twilio number.
 *
 * Actions (all automatic):
 *  1. Play a voice message: "We'll text you shortly"
 *  2. Send SMS to caller immediately
 *  3. Send Telegram alert to team
 *  4. Create lead in fb_leads if not already exists (triggers auto-notify DB webhook)
 *
 * Twilio setup:
 *   Phone Number → Voice → Webhook URL:
 *   https://<domain>/api/facebook/voice/webhook
 *   Method: HTTP POST
 */
export async function POST(request: NextRequest) {
  // Parse Twilio FormData
  let callerPhone = '';
  let twilioTo = '';

  try {
    const body = await request.text();
    const params = new URLSearchParams(body);
    callerPhone = normalizePhoneNumber(params.get('From') || '');
    twilioTo = params.get('To') || '';
  } catch {
    // ignore parse error, still return TwiML
  }

  // Background: SMS + Telegram + create lead (non-blocking, doesn't delay TwiML response)
  void (async () => {
    if (!callerPhone) return;

    try {
      // Find existing lead and client
      const { data: lead } = await supabaseAdmin
        .from('fb_leads')
        .select('id, client_id, name, status')
        .eq('phone', callerPhone)
        .single();

      // Try to find client by Twilio number in service_configs
      let clientId = lead?.client_id || null;
      let clientName = 'Our Team';

      if (!clientId && twilioTo) {
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

      if (clientId) {
        const { data: client } = await supabaseAdmin
          .from('clients')
          .select('name')
          .eq('id', clientId)
          .single();
        clientName = client?.name || clientName;
      }

      // Create lead if doesn't exist (missed call = new lead)
      let leadId = lead?.id;
      let isNewLead = false;
      if (!lead && clientId) {
        const { data: newLead } = await supabaseAdmin
          .from('fb_leads')
          .insert({
            client_id: clientId,
            phone: callerPhone,
            lead_source: 'missed_call',
            status: 'new',
          })
          .select('id')
          .single();
        leadId = newLead?.id;
        isNewLead = true;
        // DB webhook will fire → auto-notify → SMS + sequence enrollment
      }

      // Send immediate SMS to caller (only if lead already existed, new leads get SMS from auto-notify)
      if (!isNewLead && leadId && clientId) {
        const firstName = lead?.name?.split(' ')[0] || 'there';
        const smsBody = `Hi ${firstName}! We missed your call. We'll reach out to you shortly! – ${clientName}`;
        try {
          const sid = await sendSMS(callerPhone, smsBody);
          await supabaseAdmin.from('sms_messages').insert({
            lead_id: leadId,
            client_id: clientId,
            direction: 'outbound',
            body: smsBody,
            twilio_sid: sid,
            status: 'sent',
          });
        } catch (smsErr: any) {
          console.error('[voice webhook] SMS failed:', smsErr.message);
        }
      }

      // Telegram alert
      await sendTelegramMessage(
        `📵 <b>Missed Call — ${clientName}</b>\n\n` +
        `📞 From: ${callerPhone}\n` +
        (lead?.name
          ? `👤 Known lead: ${lead.name} (${lead.status})\n`
          : `❓ New caller → lead created\n`) +
        `✅ Auto-SMS sent`
      );

    } catch (err: any) {
      console.error('[voice webhook] background error:', err.message);
    }
  })();

  // Return TwiML immediately — play message then hang up
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna" language="en-US">
    Thanks for calling! We just sent you a text message and will follow up with you very shortly. Have a great day!
  </Say>
</Response>`;

  return new NextResponse(twiml, {
    headers: { 'Content-Type': 'application/xml' },
  });
}

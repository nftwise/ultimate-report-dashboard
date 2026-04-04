import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendSMS } from '@/lib/twilio';
import { sendTelegramMessage } from '@/lib/telegram';

export const maxDuration = 60;

const SOURCE_LABEL: Record<string, string> = {
  fb_lead_ad: '📘 Facebook Lead Ad',
  messenger: '💬 Messenger',
  website_form: '🌐 Website Form',
  missed_call: '📵 Missed Call',
  manual: '✏️ Manual',
};

/**
 * POST /api/facebook/auto-notify
 *
 * Called by Supabase DB Webhook on INSERT to fb_leads.
 * Fires for EVERY lead regardless of source.
 *
 * Actions (all automatic):
 *  1. Send immediate SMS to the lead
 *  2. Send Telegram alert to team
 *  3. Enroll lead in client's default follow-up sequence
 *
 * Supabase webhook setup:
 *   Table: fb_leads | Event: INSERT
 *   URL: https://<domain>/api/facebook/auto-notify
 *   Headers: x-webhook-secret: <SUPABASE_WEBHOOK_SECRET>
 */
export async function POST(request: NextRequest) {
  try {
    // Validate webhook secret
    const secret = request.headers.get('x-webhook-secret');
    if (process.env.SUPABASE_WEBHOOK_SECRET && secret !== process.env.SUPABASE_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await request.json();

    // Only handle INSERT on fb_leads
    if (payload.type !== 'INSERT' || payload.table !== 'fb_leads') {
      return NextResponse.json({ skipped: true });
    }

    const lead = payload.record;

    if (!lead?.phone || !lead?.client_id) {
      return NextResponse.json({ skipped: true, reason: 'missing phone or client_id' });
    }

    // Get client info
    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('name')
      .eq('id', lead.client_id)
      .single();

    const clientName = client?.name || 'Our Team';
    const firstName = lead.name?.split(' ')[0] || 'there';

    // ── 1. Send immediate SMS to lead ─────────────────────────
    let smsSent = false;
    try {
      const smsBody = `Hi ${firstName}! Thanks for reaching out to ${clientName}. We'll be in touch with you shortly!`;
      const sid = await sendSMS(lead.phone, smsBody);

      await supabaseAdmin.from('sms_messages').insert({
        lead_id: lead.id,
        client_id: lead.client_id,
        direction: 'outbound',
        body: smsBody,
        twilio_sid: sid,
        status: 'sent',
      });

      await supabaseAdmin
        .from('fb_leads')
        .update({ status: 'contacted', last_contacted_at: new Date().toISOString() })
        .eq('id', lead.id);

      smsSent = true;
      console.log(`[auto-notify] SMS sent to ${lead.phone} (lead ${lead.id})`);
    } catch (smsErr: any) {
      console.error('[auto-notify] SMS failed:', smsErr.message);
    }

    // ── 2. Telegram alert to team ──────────────────────────────
    await sendTelegramMessage(
      `🆕 <b>New Lead — ${clientName}</b>\n\n` +
      `👤 Name: ${lead.name || 'Unknown'}\n` +
      `📞 Phone: ${lead.phone}\n` +
      (lead.email ? `📧 Email: ${lead.email}\n` : '') +
      `📢 Source: ${SOURCE_LABEL[lead.lead_source] || lead.lead_source}\n` +
      (lead.campaign_name ? `🎯 Campaign: ${lead.campaign_name}\n` : '') +
      (lead.ad_name ? `📣 Ad: ${lead.ad_name}\n` : '') +
      `💬 Auto-SMS: ${smsSent ? '✅ sent' : '❌ failed'}`
    ).catch(() => {});

    // ── 3. Auto-enroll in default follow-up sequence ───────────
    const { data: sequence } = await supabaseAdmin
      .from('follow_up_sequences')
      .select('id, steps')
      .eq('client_id', lead.client_id)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (sequence && sequence.steps?.length > 0) {
      // Check not already enrolled
      const { data: existing } = await supabaseAdmin
        .from('lead_follow_up_state')
        .select('id')
        .eq('lead_id', lead.id)
        .eq('sequence_id', sequence.id)
        .single();

      if (!existing) {
        const firstStep = sequence.steps[0];
        const nextFollowUpAt = new Date();
        nextFollowUpAt.setDate(nextFollowUpAt.getDate() + (firstStep.day || 1));

        await supabaseAdmin.from('lead_follow_up_state').insert({
          lead_id: lead.id,
          sequence_id: sequence.id,
          current_step: 0,
          next_follow_up_at: nextFollowUpAt.toISOString(),
          completed: false,
        });

        console.log(`[auto-notify] Lead ${lead.id} enrolled in sequence ${sequence.id}, next at ${nextFollowUpAt.toISOString()}`);
      }
    }

    return NextResponse.json({ success: true, leadId: lead.id, smsSent });

  } catch (error: any) {
    console.error('[auto-notify] Exception:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

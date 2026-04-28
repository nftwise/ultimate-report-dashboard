import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendSMS } from '@/lib/twilio';

export const dynamic = 'force-dynamic'

export const maxDuration = 300;

/**
 * GET /api/cron/followup-sms
 * Hourly cron job: send automatic follow-up SMS to leads
 *
 * Process:
 * 1. Find leads with pending follow-ups (next_follow_up_at <= NOW)
 * 2. Get the follow-up message from their sequence
 * 3. Send SMS via Twilio
 * 4. Advance to next step or mark completed
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Auth check
    const authHeader = request.headers.get('authorization') || '';
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

    if (authHeader !== expectedAuth) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[followup-sms cron] Starting...');

    // Find leads with pending follow-ups
    const { data: pendingStates, error: stateError } = await supabaseAdmin
      .from('lead_follow_up_state')
      .select(
        `
        id,
        lead_id,
        sequence_id,
        current_step,
        fb_leads!inner(id, client_id, phone, status),
        follow_up_sequences!inner(id, steps)
      `
      )
      .lte('next_follow_up_at', new Date().toISOString())
      .eq('completed', false)
      .in(
        'fb_leads.status',
        ['new', 'contacted']
      );

    if (stateError) {
      console.error('[followup-sms] State query error:', stateError);
      return NextResponse.json(
        { error: stateError.message },
        { status: 500 }
      );
    }

    if (!pendingStates || pendingStates.length === 0) {
      return NextResponse.json({
        success: true,
        date: new Date().toISOString(),
        processed: 0,
        duration: `${Date.now() - startTime}ms`,
      });
    }

    const results = {
      success: true,
      date: new Date().toISOString(),
      processed: 0,
      sent: 0,
      errors: [] as string[],
      duration: '',
    };

    // Process each pending follow-up
    for (const state of pendingStates) {
      try {
        const lead = (state as any).fb_leads;
        const sequence = (state as any).follow_up_sequences;

        if (!lead || !sequence) {
          console.warn(`[followup-sms] Invalid data for state ${state.id}`);
          continue;
        }

        const steps = Array.isArray(sequence.steps) ? sequence.steps : [];
        const currentStep = steps[state.current_step];

        if (!currentStep) {
          // No more steps, mark completed
          await supabaseAdmin
            .from('lead_follow_up_state')
            .update({ completed: true })
            .eq('id', state.id);

          results.processed++;
          continue;
        }

        // Send SMS
        const twilioSid = await sendSMS(lead.phone, currentStep.message);

        // Record message
        await supabaseAdmin
          .from('sms_messages')
          .insert({
            lead_id: lead.id,
            client_id: lead.client_id,
            direction: 'outbound',
            body: currentStep.message,
            twilio_sid: twilioSid,
            status: 'sent',
          });

        // Update lead status if still new
        if (lead.status === 'new') {
          await supabaseAdmin
            .from('fb_leads')
            .update({
              status: 'contacted',
              last_contacted_at: new Date().toISOString(),
            })
            .eq('id', lead.id);
        }

        // Calculate next follow-up time
        const nextStep = steps[state.current_step + 1];
        let nextState: Record<string, any> = {
          current_step: state.current_step + 1,
        };

        if (nextStep) {
          // Schedule next follow-up
          const daysUntilNext = nextStep.day - currentStep.day;
          const nextTime = new Date();
          nextTime.setDate(nextTime.getDate() + daysUntilNext);
          nextState.next_follow_up_at = nextTime.toISOString();
        } else {
          // No more steps, mark completed
          nextState.completed = true;
        }

        await supabaseAdmin
          .from('lead_follow_up_state')
          .update(nextState)
          .eq('id', state.id);

        results.sent++;
        results.processed++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[followup-sms] Error processing state:`, error);
        results.errors.push(`State ${state.id}: ${errorMsg}`);
        results.processed++;
      }
    }

    results.duration = `${Date.now() - startTime}ms`;

    console.log(
      `[followup-sms cron] Done: ${results.sent} sent, ${results.errors.length} errors`
    );

    return NextResponse.json(results);
  } catch (error) {
    console.error('[followup-sms cron] Exception:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal error',
        duration: `${Date.now() - startTime}ms`,
      },
      { status: 500 }
    );
  }
}

/**
 * Telegram Alert System
 * Sends alerts to a Telegram bot when client metrics drop significantly
 * or when cron jobs fail / data is missing.
 */

const TELEGRAM_API = 'https://api.telegram.org';

export async function sendTelegramMessage(message: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.log('[Telegram] Skipped — TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set');
    return;
  }

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[Telegram] Failed to send message:', err);
    }
  } catch (err) {
    console.error('[Telegram] Error:', err);
  }
}

// ─────────────────────────────────────────
// Cron failure alert
// ─────────────────────────────────────────

export async function sendCronFailureAlert(
  cronName: string,
  date: string,
  errors: string[]
): Promise<void> {
  if (errors.length === 0) return;
  const lines = errors.slice(0, 10).map(e => `  • ${e}`).join('\n');
  const more = errors.length > 10 ? `\n  ... and ${errors.length - 10} more` : '';
  const message =
    `⚠️ <b>${cronName} — ${date}</b>\n` +
    `${errors.length} client(s) failed:\n\n` +
    lines + more;
  await sendTelegramMessage(message);
}

// ─────────────────────────────────────────
// Alert logic: compare 7-day rolling window
// ─────────────────────────────────────────

interface ClientMetric {
  client_id: string;
  name: string;
  current_leads: number;
  prev_leads: number;
  current_calls: number;
  prev_calls: number;
  current_sessions: number;
  prev_sessions: number;
}

function pctChange(current: number, prev: number): number {
  if (prev === 0) return 0;
  return Math.round(((current - prev) / prev) * 100);
}

function arrow(pct: number): string {
  if (pct <= -20) return '🔴';
  if (pct < 0) return '🟡';
  if (pct > 0) return '🟢';
  return '⚪';
}

export async function checkAndSendAlerts(
  supabaseAdmin: any,
  targetDate: string
): Promise<void> {
  try {
    const target = new Date(targetDate);

    // Current 7-day window: [targetDate-6 → targetDate]
    const cur7Start = new Date(target);
    cur7Start.setDate(cur7Start.getDate() - 6);

    // Previous 7-day window: [targetDate-13 → targetDate-7]
    const prev7End = new Date(target);
    prev7End.setDate(prev7End.getDate() - 7);
    const prev7Start = new Date(target);
    prev7Start.setDate(prev7Start.getDate() - 13);

    const fmt = (d: Date) => d.toISOString().split('T')[0];

    // Fetch both windows in parallel
    const [curRes, prevRes, clientsRes] = await Promise.all([
      supabaseAdmin
        .from('client_metrics_summary')
        .select('client_id, total_leads, gbp_calls, sessions')
        .gte('date', fmt(cur7Start))
        .lte('date', targetDate)
        .eq('period_type', 'daily'),

      supabaseAdmin
        .from('client_metrics_summary')
        .select('client_id, total_leads, gbp_calls, sessions')
        .gte('date', fmt(prev7Start))
        .lte('date', fmt(prev7End))
        .eq('period_type', 'daily'),

      supabaseAdmin
        .from('clients')
        .select('id, name')
        .eq('is_active', true),
    ]);

    const nameMap: Record<string, string> = {};
    for (const c of clientsRes.data || []) nameMap[c.id] = c.name;

    // Aggregate per client
    const aggregate = (rows: any[]) => {
      const map: Record<string, { leads: number; calls: number; sessions: number }> = {};
      for (const r of rows || []) {
        if (!map[r.client_id]) map[r.client_id] = { leads: 0, calls: 0, sessions: 0 };
        map[r.client_id].leads += r.total_leads || 0;
        map[r.client_id].calls += r.gbp_calls || 0;
        map[r.client_id].sessions += r.sessions || 0;
      }
      return map;
    };

    const cur = aggregate(curRes.data);
    const prev = aggregate(prevRes.data);

    // Find clients with significant drops (>20% on leads OR sessions)
    const alerts: string[] = [];

    for (const clientId of Object.keys(nameMap)) {
      const c = cur[clientId] || { leads: 0, calls: 0, sessions: 0 };
      const p = prev[clientId] || { leads: 0, calls: 0, sessions: 0 };

      const leadsPct = pctChange(c.leads, p.leads);
      const sessionsPct = pctChange(c.sessions, p.sessions);

      // Only alert if previous period had data (avoid alerting new clients)
      if (p.leads === 0 && p.sessions === 0) continue;

      if (leadsPct <= -20 || sessionsPct <= -30) {
        const name = nameMap[clientId] || clientId;
        alerts.push(
          `<b>${name}</b>\n` +
          `  ${arrow(leadsPct)} Leads: ${p.leads} → ${c.leads} (${leadsPct > 0 ? '+' : ''}${leadsPct}%)\n` +
          `  ${arrow(sessionsPct)} Traffic: ${p.sessions} → ${c.sessions} (${sessionsPct > 0 ? '+' : ''}${sessionsPct}%)`
        );
      }
    }

    if (alerts.length === 0) {
      console.log('[Telegram] No significant drops detected — no alert sent');
      return;
    }

    const message =
      `🚨 <b>Dashboard Alert</b> — ${targetDate}\n` +
      `${alerts.length} client(s) với metric giảm mạnh (so sánh 7 ngày):\n\n` +
      alerts.join('\n\n');

    await sendTelegramMessage(message);
    console.log(`[Telegram] Alert sent for ${alerts.length} client(s)`);

  } catch (err) {
    console.error('[Telegram] checkAndSendAlerts error:', err);
  }
}

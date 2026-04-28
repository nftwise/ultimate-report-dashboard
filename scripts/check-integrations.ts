#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const today    = new Date();
const startDate = new Date(today.getTime() - 14*86400000).toISOString().split('T')[0];
const endDate   = today.toISOString().split('T')[0];
const yesterday = new Date(today.getTime() - 86400000).toISOString().split('T')[0];

const p3 = (n: number) => n === 0 ? '  0' : String(n).padStart(3);
const ic  = (ok: boolean, has: boolean) => has ? (ok ? '✅' : '⚠️') : '— ';

async function main() {
  console.log(`\n⏰ UTC: ${today.toUTCString()}`);
  console.log(`📅 ${startDate} → ${endDate}\n`);

  // Step 1: clients first
  const { data: clients } = await sb
    .from('clients').select('id,name,sync_group').eq('is_active', true)
    .order('sync_group').order('name');

  const ids = (clients || []).map(c => c.id);

  // Step 2: everything else in parallel
  const [{ data: configs }, { data: gbpLocs }, { data: metrics }] = await Promise.all([
    sb.from('service_configs').select('client_id,ga_property_id,gads_customer_id,gsc_site_url,fb_ad_account_id'),
    sb.from('gbp_locations').select('client_id').eq('is_active', true),
    sb.from('client_metrics_summary')
      .select('client_id,date,sessions,ad_spend,gbp_calls,seo_clicks')
      .in('client_id', ids)
      .eq('period_type', 'daily')
      .gte('date', startDate).lte('date', endDate),
  ]);

  const cfgMap: Record<string, any> = {};
  (configs || []).forEach(c => { cfgMap[c.client_id] = c; });
  const gbpSet = new Set((gbpLocs || []).map(g => g.client_id));
  const mByClient: Record<string, any[]> = {};
  (metrics || []).forEach(m => {
    if (!mByClient[m.client_id]) mByClient[m.client_id] = [];
    mByClient[m.client_id].push(m);
  });

  // ─── TABLE ─────────────────────────────────────────────────────────────────
  console.log(`╔════════════════════════════════════════════════════════════════════════════╗`);
  console.log(`║  CLIENT INTEGRATION + DATA COVERAGE (14 days)                             ║`);
  console.log(`╠══════════════════════════════════╦═════╦════════════════╦════════════════╣`);
  console.log(`║ CLIENT                           ║ GRP ║ CONFIG         ║ DATA DAYS      ║`);
  console.log(`║                                  ║     ║ GA4 GSC ADS GBP║ GA4 ADS GBP SEO║`);
  console.log(`╠══════════════════════════════════╬═════╬════════════════╬════════════════╣`);

  const issues: string[] = [];
  let prevGrp = '';

  for (const c of (clients || [])) {
    const cfg = cfgMap[c.id] || {};
    const cm  = mByClient[c.id] || [];

    const hasGA4  = !!cfg.ga_property_id;
    const hasGSC  = !!cfg.gsc_site_url;
    const hasGAds = !!cfg.gads_customer_id;
    const hasGBP  = gbpSet.has(c.id);

    const dGA4 = cm.filter(m => m.sessions > 0).length;
    const dAds = cm.filter(m => m.ad_spend > 0).length;
    const dGBP = cm.filter(m => m.gbp_calls > 0).length;
    const dSEO = cm.filter(m => m.seo_clicks > 0).length;
    const missingYest = !cm.find(m => m.date === yesterday);

    const ga4i = ic(dGA4 >= 12, hasGA4);
    const gsci = ic(dSEO >= 10, hasGSC);
    const adsi = ic(dAds >= 7,  hasGAds);
    const gbpi = hasGBP ? ic(dGBP >= 7, true) : '❌';

    if (c.sync_group !== prevGrp) {
      console.log(`╠════════ Group ${c.sync_group} ═══════════════════╬═════╬════════════════╬════════════════╣`);
      prevGrp = c.sync_group;
    }

    const name = c.name.substring(0, 32).padEnd(32);
    const dStr = missingYest ? '⏳    ' : `${String(cm.length).padStart(2)}/14  `;
    console.log(`║ ${name} ║  ${c.sync_group}  ║${ga4i} ${gsci} ${adsi} ${gbpi}║${p3(dGA4)} ${p3(dAds)} ${p3(dGBP)} ${p3(dSEO)}║`);

    if (!hasGBP)                   issues.push(`❌ ${c.name}: No GBP location ID`);
    if (hasGAds && dAds < 5)       issues.push(`⚠️  ${c.name}: Google Ads only ${dAds}/14 days data`);
    if (hasGBP  && dGBP < 5)       issues.push(`⚠️  ${c.name}: GBP only ${dGBP}/14 days data`);
    if (hasGA4  && dGA4 < 10)      issues.push(`⚠️  ${c.name}: GA4 only ${dGA4}/14 days data`);
    if (hasGSC  && dSEO < 8)       issues.push(`⚠️  ${c.name}: GSC only ${dSEO}/14 days data`);
    if (missingYest)                issues.push(`⏳ ${c.name}: ${yesterday} data pending`);
  }

  console.log(`╚══════════════════════════════════╩═════╩════════════════╩════════════════╝`);
  console.log(`  ✅=OK  ⚠️=Low  ❌=Not configured  —=Not applicable  ⏳=Cron pending\n`);

  // ─── CRON STATUS ──────────────────────────────────────────────────────────
  const utcHour = today.getUTCHours();
  const cronsDone = utcHour >= 12;
  const missingYestCount = (clients || []).filter(c => !(mByClient[c.id] || []).find(m => m.date === yesterday)).length;

  console.log(`╔═══════════════════════════════════════════════════╗`);
  console.log(`║  CRONJOB STATUS — ${today.toUTCString().substring(0,25)}  ║`);
  console.log(`╠═══════════════════════════════════════════════════╣`);

  if (missingYestCount === 0) {
    console.log(`║  ✅ All ${(clients||[]).length} clients have ${yesterday} data      ║`);
    console.log(`║  Cronjobs working correctly                       ║`);
  } else if (!cronsDone) {
    const hoursLeft = 9 - utcHour;
    console.log(`║  ⏳ ${missingYestCount}/19 clients missing ${yesterday} data    ║`);
    console.log(`║  NOT A BUG — crons scheduled:                     ║`);
    console.log(`║    Group A: 09:00 UTC (~${hoursLeft}h from now)              ║`);
    console.log(`║    Group B: 10:00 UTC                             ║`);
    console.log(`║    Group C: 11:00 UTC                             ║`);
  } else {
    console.log(`║  ❌ ISSUE: ${missingYestCount} clients missing after crons ran   ║`);
    console.log(`║  Check GitHub Actions workflow logs               ║`);
  }
  console.log(`╚═══════════════════════════════════════════════════╝`);

  // ─── ISSUES ───────────────────────────────────────────────────────────────
  const pending   = issues.filter(i => i.startsWith('⏳'));
  const noGBP     = issues.filter(i => i.includes('No GBP'));
  const dataIssues = issues.filter(i => i.startsWith('⚠️') && !i.includes('pending'));

  if (noGBP.length) {
    console.log(`\n❌ MISSING GBP LOCATION (action needed):`);
    noGBP.forEach(i => console.log(`  ${i}`));
  }
  if (dataIssues.length) {
    console.log(`\n⚠️  LOW DATA COVERAGE (investigate):`);
    dataIssues.forEach(i => console.log(`  ${i}`));
  }
  if (pending.length) {
    console.log(`\n⏳ PENDING (will auto-fill when crons run today):`);
    pending.forEach(i => console.log(`  ${i}`));
  }
  console.log('');
}

main().catch(console.error);

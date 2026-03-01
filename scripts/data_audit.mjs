import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://tupedninjtaarmdwppgy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1cGVkbmluanRhYXJtZHdwcGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExNjMwNTQsImV4cCI6MjA3NjczOTA1NH0.tGme0vdFQRBfQU5CPIHLrBsw3r_mi_PfkrFGar3wXT4'
);

// Use California timezone for "today"
const caToday = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
const TODAY = `${caToday.getFullYear()}-${String(caToday.getMonth() + 1).padStart(2, '0')}-${String(caToday.getDate()).padStart(2, '0')}`;

// Step 1: Get active clients + GBP locations
const [{ data: clients }, { data: gbpLocs }] = await Promise.all([
  supabase.from('clients').select('id, name, slug, has_seo, has_ads, has_facebook, has_callrail, is_active').eq('is_active', true).order('name'),
  supabase.from('gbp_locations').select('client_id')
]);

const gbpClientIds = new Set(gbpLocs.map(l => l.client_id));

// Attach has_gbp
clients.forEach(c => { c.has_gbp = gbpClientIds.has(c.id); });

console.log(`\n========================================`);
console.log(`  DATA AUDIT - ${TODAY}`);
console.log(`========================================\n`);
console.log(`Active clients: ${clients.length}\n`);

// Categorize
const adsOnly = clients.filter(c => c.has_ads && !c.has_seo && !c.has_gbp);
console.log(`Ads-ONLY clients (SKIP): ${adsOnly.length} → ${adsOnly.map(c => c.name).join(', ') || 'None'}`);
console.log();

// Helpers
async function getDataDates(table, clientId) {
  let allDates = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('date')
      .eq('client_id', clientId)
      .order('date', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) return { dates: [], error: error.message };
    if (!data || data.length === 0) break;
    allDates = allDates.concat(data.map(r => r.date));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return { dates: [...new Set(allDates)].sort(), error: null };
}

const DATA_START = '2025-01-01'; // Operational data range starts here

function findGaps(dates) {
  if (dates.length === 0) return { gaps: [], newest: null, oldest: null, totalDays: 0 };
  const newest = dates[dates.length - 1];
  // Use DATA_START as minimum oldest date to avoid boundary chasing
  const rawOldest = dates[0];
  const oldest = rawOldest < DATA_START ? DATA_START : rawOldest;
  if (oldest > newest) return { gaps: [], newest, oldest, totalDays: 0 };
  const allDays = [];
  // Use T12:00:00Z (noon UTC) to avoid timezone boundary issues
  const start = new Date(oldest + 'T12:00:00Z');
  const end = new Date(newest + 'T12:00:00Z');
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    allDays.push(d.toISOString().split('T')[0]);
  }
  const dateSet = new Set(dates);
  const gaps = allDays.filter(d => !dateSet.has(d));
  return { gaps, newest, oldest, totalDays: allDays.length };
}

function daysSince(dateStr) {
  return Math.floor((new Date(TODAY + 'T12:00:00Z') - new Date(dateStr + 'T12:00:00Z')) / 86400000);
}

// Audit each client (skip ads-only)
const clientsToAudit = clients.filter(c => !(c.has_ads && !c.has_seo && !c.has_gbp));
const results = [];

for (const client of clientsToAudit) {
  const services = [];
  if (client.has_seo) services.push('SEO');
  if (client.has_ads) services.push('Ads');
  if (client.has_gbp) services.push('GBP');
  const issues = [];

  // --- SEO: client_metrics_summary ---
  if (client.has_seo) {
    const cms = await getDataDates('client_metrics_summary', client.id);
    const a = findGaps(cms.dates);
    if (cms.dates.length === 0) {
      issues.push({ svc: 'client_metrics_summary', msg: '❌ NO DATA' });
    } else {
      const stale = daysSince(a.newest);
      if (stale > 2) issues.push({ svc: 'client_metrics_summary', msg: `Stale → newest: ${a.newest} (${stale}d ago)` });
      if (a.gaps.length > 0) issues.push({ svc: 'client_metrics_summary', msg: `${a.gaps.length} gaps`, gaps: a.gaps });
    }

    // ga4_sessions
    const ga4 = await getDataDates('ga4_sessions', client.id);
    const g = findGaps(ga4.dates);
    if (ga4.dates.length === 0) {
      issues.push({ svc: 'ga4_sessions', msg: '❌ NO DATA' });
    } else {
      const stale = daysSince(g.newest);
      if (stale > 2) issues.push({ svc: 'ga4_sessions', msg: `Stale → newest: ${g.newest} (${stale}d ago)` });
      if (g.gaps.length > 0) issues.push({ svc: 'ga4_sessions', msg: `${g.gaps.length} gaps`, gaps: g.gaps });
    }
  }

  // --- Ads: ads_campaign_metrics (only if client also has other services) ---
  if (client.has_ads && (client.has_seo || client.has_gbp)) {
    const ads = await getDataDates('ads_campaign_metrics', client.id);
    const a = findGaps(ads.dates);
    if (ads.dates.length === 0) {
      issues.push({ svc: 'ads_campaign_metrics', msg: '❌ NO DATA' });
    } else {
      const stale = daysSince(a.newest);
      if (stale > 2) issues.push({ svc: 'ads_campaign_metrics', msg: `Stale → newest: ${a.newest} (${stale}d ago)` });
      if (a.gaps.length > 0) issues.push({ svc: 'ads_campaign_metrics', msg: `${a.gaps.length} gaps`, gaps: a.gaps });
    }
  }

  // --- GBP: gbp_location_daily_metrics ---
  if (client.has_gbp) {
    const gbp = await getDataDates('gbp_location_daily_metrics', client.id);
    const a = findGaps(gbp.dates);
    if (gbp.dates.length === 0) {
      issues.push({ svc: 'gbp_location_daily_metrics', msg: '❌ NO DATA' });
    } else {
      const stale = daysSince(a.newest);
      if (stale > 2) issues.push({ svc: 'gbp_location_daily_metrics', msg: `Stale → newest: ${a.newest} (${stale}d ago)` });
      if (a.gaps.length > 0) issues.push({ svc: 'gbp_location_daily_metrics', msg: `${a.gaps.length} gaps`, gaps: a.gaps });
    }
  }

  results.push({ name: client.name, services, issues });
}

// ===== PRINT RESULTS =====
console.log(`\n╔══════════════════════════════════════════════════════════╗`);
console.log(`║              AUDIT RESULTS                               ║`);
console.log(`╚══════════════════════════════════════════════════════════╝\n`);

const clean = results.filter(r => r.issues.length === 0);
const problematic = results.filter(r => r.issues.length > 0);

if (clean.length > 0) {
  console.log(`✅ CLEAN (${clean.length} clients):`);
  clean.forEach(c => console.log(`   ${c.name} [${c.services.join(', ')}]`));
}

if (problematic.length > 0) {
  console.log(`\n❌ ISSUES FOUND (${problematic.length} clients):\n`);
  for (const client of problematic) {
    console.log(`━━━ ${client.name} [${client.services.join(', ')}] ━━━`);
    for (const issue of client.issues) {
      console.log(`  ⚠️  ${issue.svc}: ${issue.msg}`);
      if (issue.gaps) {
        // Group consecutive gaps into ranges
        const ranges = [];
        let start = issue.gaps[0], prev = issue.gaps[0];
        for (let i = 1; i < issue.gaps.length; i++) {
          const curr = issue.gaps[i];
          const prevD = new Date(prev + 'T00:00:00');
          const currD = new Date(curr + 'T00:00:00');
          if ((currD - prevD) === 86400000) {
            prev = curr;
          } else {
            ranges.push(start === prev ? start : `${start} → ${prev}`);
            start = curr;
            prev = curr;
          }
        }
        ranges.push(start === prev ? start : `${start} → ${prev}`);
        const display = ranges.length > 8
          ? ranges.slice(0, 8).join(' | ') + ` ... +${ranges.length - 8} more ranges`
          : ranges.join(' | ');
        console.log(`      ${display}`);
      }
    }
    console.log();
  }
}

console.log(`Audit complete. ${clients.length} clients checked.`);

#!/usr/bin/env node
/**
 * full-audit-march.mjs
 * Full per-client, per-metric audit: raw tables vs client_metrics_summary
 * Shows every metric, missing data, and discrepancies in detail.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tupedninjtaarmdwppgy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1cGVkbmluanRhYXJtZHdwcGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExNjMwNTQsImV4cCI6MjA3NjczOTA1NH0.tGme0vdFQRBfQU5CPIHLrBsw3r_mi_PfkrFGar3wXT4';

const monthArg = process.argv.find(a => a.startsWith('--month='))?.split('=')[1] || '2026-03';
const [year, month] = monthArg.split('-');
const START = `${year}-${month}-01`;
const LAST  = new Date(parseInt(year), parseInt(month), 0).getDate();
const END   = `${year}-${month}-${String(LAST).padStart(2,'0')}`;
const EXPECTED_DAYS = LAST;

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── helpers ──────────────────────────────────────────────────────────────────
const num  = (n, d=0) => n == null ? '—' : (d ? Number(n).toFixed(d) : Math.round(n).toLocaleString());
const pct  = (a,b) => (!a && !b) ? 0 : Math.abs(a-b)/Math.max(Math.abs(a),Math.abs(b));
const diff = (a,b) => { const d=pct(a,b); return d===0?'✓':d>0.1?`⚠ ${(d*100).toFixed(0)}%`:`~${(d*100).toFixed(0)}%`; };
const sign = (raw,sum) => raw>sum?'raw↑':'sum↑';

async function fetchAll(table, select, extra={}) {
  let rows=[], from=0, ps=1000;
  while(true){
    let q = sb.from(table).select(select).gte('date',START).lte('date',END).range(from,from+ps-1);
    if(extra.eq) for(const[k,v] of Object.entries(extra.eq)) q=q.eq(k,v);
    if(extra.gt) for(const[k,v] of Object.entries(extra.gt)) q=q.gt(k,v);
    const {data,error}=await q;
    if(error) throw new Error(`${table}: ${error.message}`);
    rows=[...rows,...(data||[])];
    if(!data||data.length<ps) break;
    from+=ps;
  }
  return rows;
}

async function main() {
  console.log(`\n${'═'.repeat(120)}`);
  console.log(`  FULL AUDIT — RAW TABLES vs CLIENT_METRICS_SUMMARY — ${monthArg}`);
  console.log(`  Range: ${START} → ${END}  |  Expected days per client: ${EXPECTED_DAYS}`);
  console.log(`${'═'.repeat(120)}\n`);

  // ── load everything in parallel ───────────────────────────────────────────
  process.stdout.write('Loading data... ');
  const [
    clients, serviceConfigs,
    ga4Rows, ga4EventRows, ga4ConvRows,
    gscRows, gscQueryRows,
    adsRows,
    gbpRows, gbpLocations,
    summaryRows,
  ] = await Promise.all([
    sb.from('clients').select('id,name,slug,has_seo,has_ads').eq('is_active',true).order('name').then(r=>r.data||[]),
    sb.from('service_configs').select('client_id,ga_property_id,gads_customer_id,gsc_site_url').then(r=>r.data||[]),
    fetchAll('ga4_sessions',         'client_id,date,sessions,total_users,new_users'),
    fetchAll('ga4_events',           'client_id,date,event_count'),
    fetchAll('ga4_conversions',      'client_id,date,conversions'),
    fetchAll('gsc_daily_summary',    'client_id,date,total_clicks,total_impressions,top_keywords_count'),
    fetchAll('gsc_queries',          'client_id,date'),
    fetchAll('ads_campaign_metrics', 'client_id,date,cost,clicks,impressions,conversions'),
    fetchAll('gbp_location_daily_metrics','client_id,date,phone_calls,views,website_clicks,direction_requests'),
    sb.from('gbp_locations').select('client_id,gbp_location_id,location_name,is_active').then(r=>r.data||[]),
    fetchAll('client_metrics_summary',
      'client_id,date,sessions,users,new_users,seo_clicks,seo_impressions,top_keywords,ad_spend,ads_clicks,ads_impressions,google_ads_conversions,gbp_calls,gbp_profile_views,gbp_website_clicks,gbp_directions',
      {eq:{period_type:'daily'}}
    ),
  ]);
  console.log('done.\n');

  // ── build lookup maps ─────────────────────────────────────────────────────
  const scMap = new Map(serviceConfigs.map(s=>[s.client_id,s]));
  const gbpLocByClient = new Map();
  for(const l of gbpLocations){
    if(!gbpLocByClient.has(l.client_id)) gbpLocByClient.set(l.client_id,[]);
    gbpLocByClient.get(l.client_id).push(l);
  }

  // aggregate raw per client
  const aggRaw = new Map();
  const initR = () => ({
    // GA4
    ga4Days:new Set(), ga4Sessions:0, ga4Users:0, ga4NewUsers:0, ga4Events:0, ga4Conversions:0,
    // GSC
    gscDays:new Set(), gscClicks:0, gscImpressions:0, gscKeywords:0,
    gscQueryDays:new Set(),
    // Ads
    adsDays:new Set(), adsCost:0, adsClicks:0, adsImpressions:0, adsConversions:0, adsCampaigns:new Set(),
    // GBP
    gbpDays:new Set(), gbpCalls:0, gbpViews:0, gbpWebClicks:0, gbpDirs:0,
  });
  const getR = (id) => { if(!aggRaw.has(id)) aggRaw.set(id,initR()); return aggRaw.get(id); };

  for(const r of ga4Rows){ const c=getR(r.client_id); c.ga4Days.add(r.date); c.ga4Sessions+=r.sessions||0; c.ga4Users+=r.total_users||0; c.ga4NewUsers+=r.new_users||0; }
  for(const r of ga4EventRows){ const c=getR(r.client_id); c.ga4Events+=r.event_count||0; }
  for(const r of ga4ConvRows){ const c=getR(r.client_id); c.ga4Conversions+=r.conversions||0; }
  for(const r of gscRows){ const c=getR(r.client_id); c.gscDays.add(r.date); c.gscClicks+=r.total_clicks||0; c.gscImpressions+=r.total_impressions||0; c.gscKeywords+=r.top_keywords_count||0; }
  for(const r of gscQueryRows){ getR(r.client_id).gscQueryDays.add(r.date); }
  for(const r of adsRows){ const c=getR(r.client_id); c.adsDays.add(r.date); c.adsCost+=r.cost||0; c.adsClicks+=r.clicks||0; c.adsImpressions+=r.impressions||0; c.adsConversions+=r.conversions||0; }
  for(const r of gbpRows){ const c=getR(r.client_id); c.gbpDays.add(r.date); c.gbpCalls+=r.phone_calls||0; c.gbpViews+=r.views||0; c.gbpWebClicks+=r.website_clicks||0; c.gbpDirs+=r.direction_requests||0; }

  // aggregate summary per client
  const aggSum = new Map();
  const initS = () => ({ days:new Set(), sessions:0, users:0, newUsers:0, seoClicks:0, seoImpressions:0, topKeywords:0, adSpend:0, adsClicks:0, adsImpressions:0, adsConversions:0, gbpCalls:0, gbpViews:0, gbpWebClicks:0, gbpDirs:0 });
  const getS = (id) => { if(!aggSum.has(id)) aggSum.set(id,initS()); return aggSum.get(id); };

  for(const r of summaryRows){
    const c=getS(r.client_id); c.days.add(r.date);
    c.sessions+=r.sessions||0; c.users+=r.users||0; c.newUsers+=r.new_users||0;
    c.seoClicks+=r.seo_clicks||0; c.seoImpressions+=r.seo_impressions||0; c.topKeywords+=r.top_keywords||0;
    c.adSpend+=r.ad_spend||0; c.adsClicks+=r.ads_clicks||0; c.adsImpressions+=r.ads_impressions||0; c.adsConversions+=r.google_ads_conversions||0;
    c.gbpCalls+=r.gbp_calls||0; c.gbpViews+=r.gbp_profile_views||0; c.gbpWebClicks+=r.gbp_website_clicks||0; c.gbpDirs+=r.gbp_directions||0;
  }

  // ── per-client report ─────────────────────────────────────────────────────
  const allIssues = [];

  for(const client of clients){
    const sc  = scMap.get(client.id);
    const r   = aggRaw.get(client.id) || initR();
    const s   = getS(client.id);
    const locs = gbpLocByClient.get(client.id) || [];
    const activeLocs = locs.filter(l=>l.is_active);

    const hasGA4 = !!sc?.ga_property_id;
    const hasAds = !!sc?.gads_customer_id;
    const hasGSC = !!sc?.gsc_site_url;
    const hasGBP = activeLocs.length > 0;

    console.log(`${'─'.repeat(120)}`);
    console.log(`  CLIENT: ${client.name.toUpperCase()}  (${client.slug})`);
    console.log(`  Config: GA4=${hasGA4?'✓':'✗'} (${sc?.ga_property_id||'—'})  Ads=${hasAds?'✓':'✗'} (${sc?.gads_customer_id||'—'})  GSC=${hasGSC?'✓':'✗'}  GBP=${hasGBP?'✓ '+activeLocs.length+' loc':'✗'}`);
    console.log(`  Summary days in DB: ${s.days.size}/${EXPECTED_DAYS}`);
    console.log();

    const row = (label, rawVal, sumVal, unit='', note='') => {
      const rStr = rawVal==null ? '  N/A  ' : num(rawVal) + (unit?' '+unit:'');
      const sStr = sumVal==null ? '  N/A  ' : num(sumVal) + (unit?' '+unit:'');
      const bothZero = (rawVal||0)===0 && (sumVal||0)===0;
      let status='✓', statusColor='';
      if(rawVal==null||sumVal==null){ status='—'; statusColor='\x1b[2m'; }
      else if(bothZero){ status='○'; statusColor='\x1b[2m'; }
      else {
        const d=pct(rawVal,sumVal);
        if(d>0.15){ status=`✗ ${(d*100).toFixed(0)}% ${sign(rawVal,sumVal)}`; statusColor='\x1b[31m'; }
        else if(d>0.03){ status=`~ ${(d*100).toFixed(0)}% ${sign(rawVal,sumVal)}`; statusColor='\x1b[33m'; }
        else { status='✓'; statusColor='\x1b[32m'; }
      }
      if(statusColor&&status!=='✓'&&status!=='—'&&status!=='○'){
        allIssues.push({client:client.name, metric:label, raw:rawVal, summary:sumVal, diffPct:Math.round(pct(rawVal,sumVal)*1000)/10});
      }
      console.log(`    ${label.padEnd(30)} Raw: ${String(rStr).padStart(14)}  |  Sum: ${String(sStr).padStart(14)}  |  ${statusColor}${status}\x1b[0m${note?' ('+note+')':''}`);
    };

    // ── GA4 ─────────────────────────────────────────────────────────────────
    console.log(`  \x1b[36m[GA4]\x1b[0m ${hasGA4?'':'⚠ NOT CONFIGURED — skipping GA4 sync'}`);
    if(hasGA4||r.ga4Days.size>0||s.sessions>0){
      row('  Days with data',    r.ga4Days.size,        s.days.size,   'days');
      row('  Sessions',          r.ga4Sessions,         s.sessions);
      row('  Users',             r.ga4Users,            s.users);
      row('  New users',         r.ga4NewUsers,         s.newUsers);
      row('  Conversions (raw)', r.ga4Conversions,      s.adsConversions, '', 'GA4 conv vs ads_conversions in sum');
      if(r.ga4Days.size===0 && hasGA4) console.log(`    \x1b[31m  ✗ NO GA4 DATA IN RAW TABLE — sync-ga4 chưa chạy cho client này\x1b[0m`);
    } else {
      console.log(`    \x1b[2m  (no GA4 data)\x1b[0m`);
    }

    // ── GSC ─────────────────────────────────────────────────────────────────
    console.log(`  \x1b[36m[GSC]\x1b[0m ${hasGSC?'':'⚠ NOT CONFIGURED'}`);
    if(hasGSC||r.gscDays.size>0||s.seoClicks>0){
      row('  Days (daily_summary)',r.gscDays.size,      null,          'days');
      row('  Days (queries)',      r.gscQueryDays.size, null,          'days');
      row('  Clicks',             r.gscClicks,          s.seoClicks);
      row('  Impressions',        r.gscImpressions,     s.seoImpressions);
      row('  Top keywords',       r.gscKeywords,        s.topKeywords);
      if(r.gscDays.size===0 && hasGSC) console.log(`    \x1b[31m  ✗ NO GSC DATA IN RAW TABLE — sync-gsc chưa chạy\x1b[0m`);
    } else {
      console.log(`    \x1b[2m  (no GSC data)\x1b[0m`);
    }

    // ── Ads ──────────────────────────────────────────────────────────────────
    console.log(`  \x1b[36m[Ads]\x1b[0m ${hasAds?'':'⚠ NOT CONFIGURED'}`);
    if(hasAds||r.adsDays.size>0||s.adSpend>0){
      row('  Days with data',    r.adsDays.size,        null,          'days');
      row('  Spend',             Math.round(r.adsCost*100)/100, Math.round(s.adSpend*100)/100, '$');
      row('  Clicks',            r.adsClicks,           s.adsClicks);
      row('  Impressions',       r.adsImpressions,      s.adsImpressions);
      row('  Conversions',       Math.round(r.adsConversions), s.adsConversions);
      if(r.adsDays.size===0 && hasAds) console.log(`    \x1b[31m  ✗ NO ADS DATA IN RAW TABLE — sync-ads chưa chạy\x1b[0m`);
    } else {
      console.log(`    \x1b[2m  (no Ads data)\x1b[0m`);
    }

    // ── GBP ──────────────────────────────────────────────────────────────────
    console.log(`  \x1b[36m[GBP]\x1b[0m ${hasGBP?activeLocs.map(l=>l.location_name||l.gbp_location_id).join(', '):'⚠ NOT CONFIGURED'}`);
    if(hasGBP||r.gbpDays.size>0||s.gbpCalls>0){
      row('  Days with data',    r.gbpDays.size,        null,          'days');
      row('  Phone calls',       r.gbpCalls,            s.gbpCalls);
      row('  Profile views',     r.gbpViews,            s.gbpViews);
      row('  Website clicks',    r.gbpWebClicks,        s.gbpWebClicks);
      row('  Direction requests',r.gbpDirs,             s.gbpDirs);
      if(r.gbpDays.size===0 && hasGBP) console.log(`    \x1b[31m  ✗ NO GBP DATA IN RAW TABLE — sync-gbp chưa chạy\x1b[0m`);
    } else {
      console.log(`    \x1b[2m  (no GBP data)\x1b[0m`);
    }
    console.log();
  }

  // ── Global issue summary ──────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(120)}`);
  console.log(`  TỔNG HỢP DISCREPANCIES > 3%`);
  console.log(`${'═'.repeat(120)}`);

  if(allIssues.length===0){
    console.log(`\n  \x1b[32m✓ Tất cả metrics khớp!\x1b[0m\n`);
  } else {
    const byMetric = {};
    for(const i of allIssues){
      if(!byMetric[i.metric]) byMetric[i.metric]=[];
      byMetric[i.metric].push(i);
    }
    for(const [metric, issues] of Object.entries(byMetric).sort(([,a],[,b])=>b.length-a.length)){
      console.log(`\n  \x1b[33m${metric}\x1b[0m (${issues.length} clients):`);
      for(const i of issues.sort((a,b)=>b.diffPct-a.diffPct)){
        const col = i.diffPct>15?'\x1b[31m':'\x1b[33m';
        const arrow = i.raw>i.summary?'raw↑':'sum↑';
        console.log(`    ${i.client.padEnd(40)} raw=${String(Math.round(i.raw*100)/100).padStart(12)}  sum=${String(Math.round(i.summary*100)/100).padStart(12)}  ${col}${i.diffPct}% ${arrow}\x1b[0m`);
      }
    }
  }
  console.log(`\n${'═'.repeat(120)}\n`);
}

main().catch(e=>{ console.error('Fatal:',e); process.exit(1); });

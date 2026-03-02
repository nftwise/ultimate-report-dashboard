import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join('/Users/imac2017/Desktop/ultimate-report-dashboard', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function main() {
  const { data: clients, error } = await supabase
    .from('clients')
    .select(`
      id, name, slug, city, contact_email, owner, website_url,
      ads_budget_month, notes, is_active, has_seo, has_ads, has_gbp,
      created_at, updated_at,
      service_configs(ga_property_id, gads_customer_id, gsc_site_url, gbp_location_id, callrail_account_id)
    `)
    .eq('is_active', true)
    .order('name');

  if (error) { console.error('Error:', error); return; }

  console.log(`\n=== ACTIVE CLIENTS (${clients?.length}) ===\n`);
  
  for (const c of clients || []) {
    const cfg = Array.isArray(c.service_configs) ? c.service_configs[0] : c.service_configs || {};
    console.log(`\n──────────────────────────────────────────────`);
    console.log(`NAME:     ${c.name}`);
    console.log(`Slug:     ${c.slug}`);
    console.log(`City:     ${c.city || '(none)'}`);
    console.log(`Email:    ${c.contact_email || '(none)'}`);
    console.log(`Owner:    ${c.owner || '(none)'}`);
    console.log(`Website:  ${c.website_url || '(none)'}`);
    console.log(`Budget:   ${c.ads_budget_month ? '$' + c.ads_budget_month + '/mo' : '(none)'}`);
    console.log(`Services: SEO=${c.has_seo ? '✓' : '✗'} | Ads=${c.has_ads ? '✓' : '✗'} | GBP=${c.has_gbp ? '✓' : '✗'}`);
    console.log(`--- Integration IDs ---`);
    console.log(`GA4:      ${cfg.ga_property_id || '(missing)'}`);
    console.log(`Ads ID:   ${cfg.gads_customer_id || '(missing)'}`);
    console.log(`GSC URL:  ${cfg.gsc_site_url || '(missing)'}`);
    console.log(`GBP ID:   ${cfg.gbp_location_id || '(missing)'}`);
    console.log(`CallRail: ${cfg.callrail_account_id || '(none)'}`);
    console.log(`Notes:    ${c.notes || '(none)'}`);
  }

  // Summary table
  console.log(`\n\n=== SUMMARY TABLE ===\n`);
  console.log(`${'#'.padEnd(3)} ${'Name'.padEnd(38)} ${'GA4'.padEnd(6)} ${'Ads'.padEnd(6)} ${'GSC'.padEnd(6)} ${'GBP'.padEnd(6)} Budget`);
  console.log('-'.repeat(80));
  let i = 1;
  for (const c of clients || []) {
    const cfg = Array.isArray(c.service_configs) ? c.service_configs[0] : c.service_configs || {};
    const ga4 = cfg.ga_property_id ? '✓' : (c.has_seo ? '⚠ miss' : '-');
    const ads = cfg.gads_customer_id ? '✓' : (c.has_ads ? '⚠ miss' : '-');
    const gsc = cfg.gsc_site_url ? '✓' : (c.has_seo ? '⚠ miss' : '-');
    const gbp = cfg.gbp_location_id ? '✓' : (c.has_gbp ? '⚠ miss' : '-');
    const budget = c.ads_budget_month ? `$${c.ads_budget_month}` : '-';
    console.log(`${String(i++).padEnd(3)} ${c.name.padEnd(38)} ${ga4.padEnd(6)} ${ads.padEnd(6)} ${gsc.padEnd(6)} ${gbp.padEnd(6)} ${budget}`);
  }
}

main().catch(console.error);

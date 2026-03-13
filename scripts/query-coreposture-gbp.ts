import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tupedninjtaarmdwppgy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1cGVkbmluanRhYXJtZHdwcGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExNjMwNTQsImV4cCI6MjA3NjczOTA1NH0.tGme0vdFQRBfQU5CPIHLrBsw3r_mi_PfkrFGar3wXT4';
const CLIENT_ID = '3c80f930-5f4d-49d6-9428-f2440e496aac';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function queryPeriod(label: string, startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from('client_metrics_summary')
    .select('date, gbp_calls')
    .eq('client_id', CLIENT_ID)
    .eq('period_type', 'daily')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });

  if (error) {
    console.log(`${label} - ERROR:`, error.message);
    return null;
  }

  const total = (data || []).reduce((sum, row) => sum + (row.gbp_calls || 0), 0);
  const count = data?.length || 0;
  
  console.log(`\n${label}`);
  console.log(`  Date Range: ${startDate} to ${endDate}`);
  console.log(`  Days with data: ${count}`);
  console.log(`  Total GBP Calls: ${total}`);
  
  return { label, total, count, data };
}

async function main() {
  console.log(`CorePosture (${CLIENT_ID}) - GBP Phone Calls Query\n`);
  console.log('=' .repeat(60));

  // Jan 1-31 2026
  await queryPeriod('January 2026 (Jan 1-31)', '2026-01-01', '2026-01-31');

  // Dec 1-31 2025
  await queryPeriod('December 2025 (Dec 1-31)', '2025-12-01', '2025-12-31');

  // Jan 11 - Feb 10 2026 (30-day window)
  await queryPeriod('30-Day Window 1 (Jan 11 - Feb 10)', '2026-01-11', '2026-02-10');

  // Feb 10 - Mar 11 2026 (30-day window)
  await queryPeriod('30-Day Window 2 (Feb 10 - Mar 11)', '2026-02-10', '2026-03-11');

  console.log('\n' + '='.repeat(60));
}

main().catch(console.error);

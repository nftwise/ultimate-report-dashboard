import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  'https://tupedninjtaarmdwppgy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1cGVkbmluanRhYXJtZHdwcGd5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTE2MzA1NCwiZXhwIjoyMDc2NzM5MDU0fQ.ulXb0ri8GGnXogfI08yGf-j8MaQsBRhd2ZUxyk470Vw',
  { auth: { persistSession: false } }
);

async function checkAllMonths() {
  console.log('📊 GBP Database Coverage - All Months\n');
  console.log('=' .repeat(80) + '\n');

  // Get all unique dates from database
  const { data: allRecords } = await supabaseAdmin
    .from('gbp_location_daily_metrics')
    .select('date')
    .order('date', { ascending: true });

  if (!allRecords || allRecords.length === 0) {
    console.log('❌ No data found in database');
    return;
  }

  // Extract unique months
  const months = new Map();
  for (const record of allRecords) {
    const [year, month] = record.date.split('-').slice(0, 2);
    const key = `${year}-${month}`;
    if (!months.has(key)) {
      months.set(key, { year, month, count: 0, calls: 0 });
    }
    months.get(key).count++;
  }

  // Get call totals per month
  console.log('Checking call totals per month...\n');

  const monthStats = [];
  for (const [key, stats] of months) {
    const { data: monthRecords } = await supabaseAdmin
      .from('gbp_location_daily_metrics')
      .select('phone_calls')
      .gte('date', `${stats.year}-${stats.month}-01`)
      .lte('date', `${stats.year}-${stats.month}-31`);

    const totalCalls = (monthRecords || []).reduce((sum, r) => sum + (r.phone_calls || 0), 0);
    monthStats.push({
      key,
      year: stats.year,
      month: stats.month,
      records: stats.count,
      calls: totalCalls,
    });
  }

  // Sort chronologically
  monthStats.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });

  // Display
  console.log('Month           Records    Calls    Status\n');
  console.log('─'.repeat(80));

  const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  for (const stat of monthStats) {
    const monthName = monthNames[parseInt(stat.month)] || '?';
    const status = stat.records >= 16 ? '✅' : `⚠️  (${stat.records}/16 locs)`;
    console.log(
      `${monthName} ${stat.year}`.padEnd(15) +
      String(stat.records).padStart(10) +
      String(stat.calls).padStart(10) +
      '   ' + status
    );
  }

  console.log('\n' + '='.repeat(80) + '\n');

  // Summary
  const totalMonths = monthStats.length;
  const completeMonths = monthStats.filter(m => m.records >= 16).length;
  const totalRecords = allRecords.length;
  const totalCalls = monthStats.reduce((sum, m) => sum + m.calls, 0);

  console.log(`📈 Summary:`);
  console.log(`  Total months: ${totalMonths}`);
  console.log(`  Complete months (≥16 records): ${completeMonths}`);
  console.log(`  Incomplete months: ${totalMonths - completeMonths}`);
  console.log(`  Total records: ${totalRecords}`);
  console.log(`  Total calls: ${totalCalls}\n`);

  // Show first and last
  console.log(`First month: ${monthStats[0].key}`);
  console.log(`Last month:  ${monthStats[monthStats.length - 1].key}\n`);

  // Check for gaps
  console.log('📋 Data Quality Check:');
  const incompleteMonths = monthStats.filter(m => m.records < 16);
  if (incompleteMonths.length === 0) {
    console.log('  ✅ All months have complete data (16 locations each)');
  } else {
    console.log(`  ⚠️  ${incompleteMonths.length} months with incomplete data:`);
    incompleteMonths.forEach(m => {
      console.log(`     ${monthNames[parseInt(m.month)]} ${m.year}: ${m.records}/16 records`);
    });
  }
}

checkAllMonths().catch(console.error);

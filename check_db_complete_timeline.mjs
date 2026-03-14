import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://tupedninjtaarmdwppgy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1cGVkbmluanRhYXJtZHdwcGd5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTE2MzA1NCwiZXhwIjoyMDc2NzM5MDU0fQ.ulXb0ri8GGnXogfI08yGf-j8MaQsBRhd2ZUxyk470Vw',
  { auth: { persistSession: false } }
);

async function checkTimeline() {
  console.log('📅 Complete Database Timeline\n');
  console.log('=' .repeat(80) + '\n');

  // Get all unique dates
  const { data: allDates } = await sb
    .from('gbp_location_daily_metrics')
    .select('date')
    .order('date', { ascending: true });

  if (!allDates || allDates.length === 0) {
    console.log('No data found');
    return;
  }

  // Group by month-year
  const monthMap = new Map();
  for (const record of allDates) {
    const [year, month] = record.date.substring(0, 7).split('-');
    const key = `${year}-${month}`;
    if (!monthMap.has(key)) {
      monthMap.set(key, []);
    }
    monthMap.get(key).push(record.date);
  }

  // Convert to sorted array
  const months = Array.from(monthMap.entries())
    .map(([key, dates]) => {
      const uniqueDates = [...new Set(dates)];
      return {
        key,
        year: parseInt(key.split('-')[0]),
        month: parseInt(key.split('-')[1]),
        daysWithData: uniqueDates.length,
        recordsCount: dates.length,
      };
    })
    .sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });

  const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  console.log('Month          Days    Records   Call Totals\n');
  console.log('─'.repeat(80));

  let prevYear = null;
  for (const m of months) {
    if (prevYear !== m.year && prevYear !== null) {
      console.log('');
    }
    prevYear = m.year;

    // Get call total for this month
    const { data: monthRecords } = await sb
      .from('gbp_location_daily_metrics')
      .select('phone_calls')
      .gte('date', `${m.year}-${String(m.month).padStart(2, '0')}-01`)
      .lte('date', `${m.year}-${String(m.month).padStart(2, '0')}-31`);

    const callTotal = (monthRecords || []).reduce((sum, r) => sum + (r.phone_calls || 0), 0);

    const dateStr = `${monthNames[m.month]} ${m.year}`.padEnd(14);
    console.log(
      dateStr +
      String(m.daysWithData).padStart(8) +
      String(m.recordsCount).padStart(10) +
      String(callTotal).padStart(15)
    );
  }

  console.log('\n' + '='.repeat(80) + '\n');

  // Summary stats
  const totalRecords = allDates.length;
  const uniqueDates = [...new Set(allDates.map(d => d.date))].length;
  let allCalls = 0;
  for (const m of months) {
    const { data: monthRecords } = await sb
      .from('gbp_location_daily_metrics')
      .select('phone_calls')
      .gte('date', `${m.year}-${String(m.month).padStart(2, '0')}-01`)
      .lte('date', `${m.year}-${String(m.month).padStart(2, '0')}-31`);
    allCalls += (monthRecords || []).reduce((s, r) => s + (r.phone_calls || 0), 0);
  }

  console.log(`📊 Summary:`);
  console.log(`  Time period: ${months[0].key} to ${months[months.length - 1].key}`);
  console.log(`  Months covered: ${months.length}`);
  console.log(`  Unique dates: ${uniqueDates}`);
  console.log(`  Total records: ${totalRecords}`);
  console.log(`  Total calls: ${allCalls}`);
}

checkTimeline().catch(console.error);

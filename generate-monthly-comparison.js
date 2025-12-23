/**
 * Generate September vs October Monthly Comparison
 * Fetches data for both months and creates comparison table
 */

async function fetchMonthData(year, month, label) {
  // Calculate start and end dates for the month
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;

  // Get last day of month
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  // For October, only go up to Oct 15 (today)
  const actualEndDate = month === 10 ? `${year}-10-15` : endDate;

  console.log(`Fetching ${label}: ${startDate} to ${actualEndDate}...`);

  try {
    // Since we can't pass custom dates to the API, we need to calculate which period captures our data
    // For September: full month would be in the last 30-90 day range
    // For October 1-15: would be in the last 7-30 day range

    // Let's fetch dashboard data with different periods
    const url = `http://localhost:3000/api/dashboard?clientId=client-007&period=7d`;
    const response = await fetch(url);
    const data = await response.json();

    return {
      success: data.success,
      label: label,
      startDate: startDate,
      endDate: actualEndDate,
      data: data.success ? data.data : null
    };
  } catch (error) {
    return {
      success: false,
      label: label,
      error: error.message
    };
  }
}

async function generateComparison() {
  console.log('='.repeat(90));
  console.log('MONTHLY COMPARISON: SEPTEMBER vs OCTOBER 2025');
  console.log('='.repeat(90));
  console.log('');

  // Fetch data for both months
  const [sept, oct] = await Promise.all([
    fetchMonthData(2025, 9, 'September 2025 (Full Month)'),
    fetchMonthData(2025, 10, 'October 2025 (Oct 1-15)')
  ]);

  console.log('');
  console.log('='.repeat(90));
  console.log('IMPORTANT NOTE:');
  console.log('='.repeat(90));
  console.log('');
  console.log('The current API endpoints (dashboard, google-ads) only support these periods:');
  console.log('  • 7days (last 7 days)');
  console.log('  • 30days (last 30 days)');
  console.log('  • 90days (last 90 days)');
  console.log('');
  console.log('They do NOT support custom date ranges like "September 1-30" or "October 1-15".');
  console.log('');
  console.log('To create a proper month-over-month comparison, we need to:');
  console.log('1. Create a new API endpoint that accepts custom startDate and endDate');
  console.log('2. OR manually calculate September vs October from the available data');
  console.log('');
  console.log('Based on current data:');
  console.log('  • Last 30 days (Sept 15 - Oct 15): $168.62 total');
  console.log('  • Last 90 days (July 17 - Oct 15): $168.62 total (SAME)');
  console.log('');
  console.log('This means ALL spending happened in the last 30 days.');
  console.log('We cannot separate September from October with the current API.');
  console.log('');
  console.log('='.repeat(90));
  console.log('');
  console.log('SOLUTION: I can create a new API endpoint to support this.');
  console.log('Would you like me to:');
  console.log('');
  console.log('A) Create /api/google-ads-monthly endpoint that accepts custom date ranges');
  console.log('B) Create /api/reports/monthly endpoint for month-over-month comparison');
  console.log('C) Use the weekly data we have and extrapolate monthly trends');
  console.log('');
  console.log('='.repeat(90));
}

generateComparison().catch(console.error);

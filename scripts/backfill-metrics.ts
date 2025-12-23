/**
 * Backfill Historical Metrics
 *
 * This script populates the client_metrics_summary table with historical data
 * by calling the rollup API for each day.
 *
 * Usage: npx tsx scripts/backfill-metrics.ts [days]
 * Example: npx tsx scripts/backfill-metrics.ts 30
 */

const ROLLUP_API = 'http://localhost:3000/api/admin/run-rollup';

// Custom fetch with longer timeout (3 minutes for 59 metrics)
async function fetchWithTimeout(url: string, options: RequestInit, timeout = 180000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error: any) {
    clearTimeout(id);
    throw error;
  }
}

async function backfill(days: number) {
  console.log(`🔄 Backfilling ${days} days with 59 metrics...\n`);

  const today = new Date();
  const results: { date: string; success: boolean; duration?: number; error?: string }[] = [];

  for (let i = 1; i <= days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    process.stdout.write(`📅 ${dateStr}... `);

    try {
      const response = await fetchWithTimeout(ROLLUP_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateStr }),
      }, 180000); // 3 minute timeout

      const data = await response.json();

      if (data.success) {
        console.log(`✅ ${data.processed} clients, ${data.metrics || 59} metrics (${data.duration}ms)`);
        results.push({ date: dateStr, success: true, duration: data.duration });
      } else {
        console.log(`❌ ${data.error}`);
        results.push({ date: dateStr, success: false, error: data.error });
      }
    } catch (error: any) {
      console.log(`❌ ${error.message}`);
      results.push({ date: dateStr, success: false, error: error.message });
    }

    // Delay between days to let server recover
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Summary
  console.log('\n' + '─'.repeat(50));
  console.log('📊 Backfill Summary:');
  console.log(`  Total days: ${days}`);
  console.log(`  Successful: ${results.filter(r => r.success).length}`);
  console.log(`  Failed: ${results.filter(r => !r.success).length}`);

  const avgDuration = results
    .filter(r => r.duration)
    .reduce((sum, r) => sum + (r.duration || 0), 0) / results.filter(r => r.duration).length;
  console.log(`  Avg duration: ${Math.round(avgDuration)}ms`);

  const failedDates = results.filter(r => !r.success).map(r => r.date);
  if (failedDates.length > 0) {
    console.log(`\n⚠️  Failed dates: ${failedDates.join(', ')}`);
  }
}

// Parse command line args
const days = parseInt(process.argv[2] || '30', 10);

if (isNaN(days) || days < 1 || days > 365) {
  console.log('Usage: npx tsx scripts/backfill-metrics.ts [days]');
  console.log('  days: Number of days to backfill (1-365, default: 30)');
  process.exit(1);
}

backfill(days);

import { config } from 'dotenv';
config({ path: '.env.local' });

/**
 * Backfill script - calls run-rollup API for each date
 */
async function backfill() {
  const days = parseInt(process.argv[2] || '7');
  const baseUrl = 'http://localhost:3000/api/admin/run-rollup';
  const secret = 'mychiropractice2024';

  console.log(`Backfilling ${days} days...`);

  for (let i = days; i >= 1; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    console.log(`\nProcessing ${dateStr}...`);

    try {
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateStr })
      });

      const result = await response.json();
      if (result.success) {
        console.log(`  ✅ ${dateStr}: ${result.processed} clients, ${result.duration}ms`);
      } else {
        console.log(`  ❌ ${dateStr}: ${result.error}`);
      }
    } catch (e) {
      console.log(`  ❌ ${dateStr}: ${(e as Error).message}`);
    }
  }

  console.log('\nBackfill complete!');
}

backfill().catch(console.error);

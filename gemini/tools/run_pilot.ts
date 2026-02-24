import { processDate } from './backfill_engine';

async function runPilot() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 2); // 2 days ago to ensure data is "final"
    const dateStr = yesterday.toISOString().split('T')[0];

    console.log(`🚀 [Pilot] Starting manual backfill for ${dateStr}...`);
    try {
        const processed = await processDate(dateStr);
        console.log(`✅ [Pilot] Completed. Processed ${processed} clients.`);
    } catch (error) {
        console.error(`❌ [Pilot] Failed:`, error);
        process.exit(1);
    }
}

runPilot();

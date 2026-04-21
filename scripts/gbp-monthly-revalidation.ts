import { supabaseAdmin } from '../src/lib/supabase';
import { fetchGBPRangePerDay, transformGBPMetrics } from '../src/lib/gbp-fetch-utils';
import { sendTelegramMessage } from '../src/lib/telegram';

const args = process.argv.slice(2);
const getArg = (name: string): string | undefined => {
  const idx = args.indexOf('--' + name);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : undefined;
};

const BATCH_SIZE = 3;

function monthRange(monthsAgo: number): { start: string; end: string } {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, 1));
  const start = d.toISOString().split('T')[0];
  const endD = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  const end = endD.toISOString().split('T')[0];
  return { start, end };
}

async function main() {
  const monthsBack = parseInt(process.env.MONTHS_BACK || getArg('months') || '3', 10);
  console.log(`[gbp-revalidation] Re-validating last ${monthsBack} months of GBP data`);

  // Build list of month ranges to process
  const ranges: { start: string; end: string }[] = [];
  for (let i = 1; i <= monthsBack; i++) {
    ranges.push(monthRange(i));
  }

  const { data: locations, error: locErr } = await supabaseAdmin
    .from('gbp_locations')
    .select('id, client_id, gbp_location_id, location_name')
    .eq('is_active', true);

  if (locErr) {
    console.error('[gbp-revalidation] Failed to fetch locations:', locErr.message);
    process.exit(1);
  }

  const validLocations = (locations || []).filter(l => l.gbp_location_id);
  console.log(`[gbp-revalidation] Processing ${validLocations.length} locations across ${ranges.length} months`);

  let totalRows = 0;
  const errors: string[] = [];

  for (const range of ranges) {
    console.log(`[gbp-revalidation] Range: ${range.start} → ${range.end}`);

    for (let i = 0; i < validLocations.length; i += BATCH_SIZE) {
      const batch = validLocations.slice(i, i + BATCH_SIZE);

      await Promise.all(batch.map(async (loc) => {
        try {
          const perDayMap = await fetchGBPRangePerDay(loc.gbp_location_id, range.start, range.end);
          const rows: any[] = [];

          for (const [date, metrics] of perDayMap) {
            rows.push({
              ...transformGBPMetrics(metrics, loc.id, loc.client_id, date),
              fetch_status: 'success',
            });
          }

          if (rows.length > 0) {
            const { error } = await supabaseAdmin
              .from('gbp_location_daily_metrics')
              .upsert(rows, { onConflict: 'location_id,date', ignoreDuplicates: false });

            if (error) {
              errors.push(`${loc.location_name} (${range.start}→${range.end}): ${error.message}`);
            } else {
              totalRows += rows.length;
              console.log(`[gbp-revalidation] ${loc.location_name}: ${rows.length} rows upserted`);
            }
          }
        } catch (err: any) {
          errors.push(`${loc.location_name} (${range.start}→${range.end}): ${err.message}`);
          console.error(`[gbp-revalidation] ${loc.location_name} failed:`, err.message);
        }
      }));
    }
  }

  console.log(`[gbp-revalidation] Done: ${totalRows} rows upserted, ${errors.length} errors`);

  if (errors.length > 0) {
    console.error('[gbp-revalidation] Errors:\n' + errors.join('\n'));
    await sendTelegramMessage(
      `⚠️ <b>GBP Monthly Re-validation</b>\n\n` +
      `✅ ${totalRows} rows upserted\n` +
      `❌ ${errors.length} errors\n\n` +
      errors.slice(0, 5).join('\n')
    ).catch(() => {});
    process.exit(1);
  } else {
    await sendTelegramMessage(
      `✅ <b>GBP Monthly Re-validation Complete</b>\n\n` +
      `📊 ${totalRows} rows upserted across last ${monthsBack} months\n` +
      `📍 ${validLocations.length} locations`
    ).catch(() => {});
  }
}

main();

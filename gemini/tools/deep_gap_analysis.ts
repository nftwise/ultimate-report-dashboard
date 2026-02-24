import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function runDeepGapAnalysis() {
    console.log('🔍 Starting Deep 365-Day Gap Analysis...\n');

    const { data: clients } = await supabase
        .from('clients')
        .select('id, slug, name')
        .eq('is_active', true);

    if (!clients) return;

    const today = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(today.getFullYear() - 1);

    const sources = [
        { name: 'Google Ads', table: 'ads_campaign_metrics', column: 'cost' },
        { name: 'GA4', table: 'ga4_sessions', column: 'sessions' },
        { name: 'GBP', table: 'gbp_location_daily_metrics', column: 'phone_calls' },
        { name: 'Summary', table: 'client_metrics_summary', column: 'total_leads' }
    ];

    const results: any[] = [];

    for (const client of clients) {
        console.log(`Processing ${client.slug}...`);
        const clientReport: any = { client: client.name, slug: client.slug, gaps: [] };

        for (const source of sources) {
            // Fetch all dates for this client in the last year
            const { data: records, error } = await supabase
                .from(source.table)
                .select(`date, ${source.column}`)
                .eq('client_id', client.id)
                .gte('date', oneYearAgo.toISOString().split('T')[0])
                .lte('date', today.toISOString().split('T')[0]);

            if (error) {
                console.error(`Error fetching ${source.name} for ${client.slug}:`, error);
                continue;
            }

            const dateMap = new Map();
            records?.forEach(r => {
                // If it's the Summary table, check if total_leads is 0 but it has a record
                const rec = r as Record<string, any>;
                const val = rec[source.column];
                dateMap.set(rec.date, val);
            });

            // Scan day by day
            let currentGapStart: string | null = null;
            let zeroValRanges: any[] = [];
            let missingRanges: any[] = [];

            for (let d = new Date(oneYearAgo); d <= today; d.setDate(d.getDate() + 1)) {
                const dateStr = d.toISOString().split('T')[0];
                const val = dateMap.get(dateStr);

                if (val === undefined) {
                    // Missing record entirely
                    if (!currentGapStart) currentGapStart = dateStr;
                } else {
                    if (currentGapStart) {
                        missingRanges.push({ start: currentGapStart, end: dateStr === firstDayOf(d) ? dateStr : prevDay(d) });
                        currentGapStart = null;
                    }

                    // Check for "Hollow Data" (Record exists but main metric is zero/null)
                    if (val === 0 || val === null) {
                        // We could track these too
                    }
                }
            }

            if (currentGapStart) {
                missingRanges.push({ start: currentGapStart, end: today.toISOString().split('T')[0] });
            }

            if (missingRanges.length > 0) {
                clientReport.gaps.push({ source: source.name, missing: missingRanges });
            }
        }
        results.push(clientReport);
    }

    // Generate Report
    let report = "# Deep Data Gap Report (Past 365 Days)\n\n";
    report += `Generated: ${new Date().toLocaleString()}\n\n`;

    for (const res of results) {
        report += `## ${res.client} (${res.slug})\n`;
        if (res.gaps.length === 0) {
            report += "✅ All data sources appear continuous for the last year.\n\n";
        } else {
            for (const gap of res.gaps) {
                report += `### 🔴 ${gap.source}\n`;
                gap.missing.forEach((m: any) => {
                    report += `- Missing: **${m.start}** to **${m.end}**\n`;
                });
                report += "\n";
            }
        }
    }

    fs.writeFileSync('gemini/365_DAY_GAP_REPORT.md', report);
    console.log('\n✅ Deep Gap Report generated: gemini/365_DAY_GAP_REPORT.md');
}

function prevDay(date: Date) {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
}

function firstDayOf(date: Date) {
    return date.toISOString().split('T')[0];
}

runDeepGapAnalysis();

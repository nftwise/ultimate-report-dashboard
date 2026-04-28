import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function runDeepGapAudit() {
    console.log('🕵️ Starting Deep Gap Analysis (Day-by-Day Audit)...');

    const { data: clients } = await supabase
        .from('clients')
        .select('id, name, slug, has_ads, has_gbp, has_seo')
        .eq('is_active', true);

    if (!clients) return;

    const startDate = new Date('2025-01-01');
    const endDate = new Date();
    const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    console.log(`📅 Auditing approximately ${totalDays} days per client...\n`);

    let report = "# 🚨 Detailed Backfill Gap Report (2025-2026)\n\n";
    report += "Report generated on: " + new Date().toLocaleString() + "\n\n";

    for (const client of clients) {
        console.log(`Processing: ${client.name}`);
        report += `## 🏢 ${client.name} (${client.slug})\n`;

        // Fetch all summary records for this client at once to be efficient
        const { data: records } = await supabase
            .from('client_metrics_summary')
            .select('date, ad_spend, total_leads, gbp_calls, google_ads_conversions, form_fills')
            .eq('client_id', client.id)
            .gte('date', '2025-01-01')
            .order('date', { ascending: true });

        const recordMap = new Map();
        if (records) {
            records.forEach(r => recordMap.set(r.date, r));
        }

        const gaps: string[] = [];
        const zeroes: string[] = [];

        let current = new Date(startDate);
        while (current <= endDate) {
            const dStr = current.toISOString().split('T')[0];
            const record = recordMap.get(dStr);

            if (!record) {
                gaps.push(dStr);
            } else {
                const isZero = (Number(record.ad_spend) === 0 &&
                    Number(record.total_leads) === 0 &&
                    Number(record.gbp_calls) === 0);
                if (isZero) {
                    zeroes.push(dStr);
                }
            }
            current.setDate(current.getDate() + 1);
        }

        if (gaps.length === 0 && zeroes.length === 0) {
            report += "✅ **Dữ liệu hoàn hảo**: Không phát hiện lỗ hổng nào.\n\n";
        } else {
            if (gaps.length > 0) {
                report += `❌ **Miss hoàn toàn (Missing Records)**: ${gaps.length} ngày.\n`;
                if (gaps.length > 20) {
                    report += `   - Giai đoạn: ${gaps[0]} đến ${gaps[gaps.length - 1]}\n`;
                } else {
                    report += `   - Các ngày: ${gaps.join(', ')}\n`;
                }
            }

            if (zeroes.length > 0) {
                report += `⚠️ **Có record nhưng 0 metrics (Empty Records)**: ${zeroes.length} ngày.\n`;
                if (zeroes.length > 20) {
                    report += `   - Giai đoạn: ${zeroes[0]} đến ${zeroes[zeroes.length - 1]}\n`;
                } else {
                    report += `   - Các ngày: ${zeroes.join(', ')}\n`;
                }
            }
            report += "\n";
        }
        report += "--- \n\n";
    }

    fs.writeFileSync('gemini/365_DAY_GAP_REPORT.md', report);
    console.log('\n✅ Deep Gap Analysis complete. Report saved to: gemini/365_DAY_GAP_REPORT.md');
}

runDeepGapAudit();

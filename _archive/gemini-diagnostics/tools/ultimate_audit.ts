import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function runEnhancedAudit() {
    console.log('🚀 Starting ULTIMATE Client Data Audit...\n');

    // 1. Get all active clients with their IDs
    const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select(`
        id, 
        name, 
        slug,
        service_configs (ga_property_id, gads_customer_id, gsc_site_url, gbp_location_id)
    `)
        .eq('is_active', true);

    if (clientsError) {
        console.error('Error fetching clients:', clientsError);
        return;
    }

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    console.log(`📊 Found ${clients.length} active clients. Audit Date: ${todayStr}\n`);

    const sources = [
        { name: 'Google Ads', table: 'ads_campaign_metrics', idKey: 'gads_customer_id' },
        { name: 'GA4', table: 'ga4_sessions', idKey: 'ga_property_id' },
        { name: 'GBP', table: 'gbp_location_daily_metrics', idKey: 'gbp_location_id' },
        { name: 'GSC', table: 'gsc_queries', idKey: 'gsc_site_url' }
    ];

    const auditResults = [];

    for (const client of clients) {
        const config = Array.isArray(client.service_configs) ? client.service_configs[0] : client.service_configs;
        const clientResult: any = {
            name: client.name,
            slug: client.slug,
            sources: {}
        };

        for (const source of sources) {
            const configId = config ? (config as Record<string, any>)[source.idKey] : null;

            try {
                // Count records
                const { count, error: countError } = await supabase
                    .from(source.table)
                    .select('*', { count: 'exact', head: true })
                    .eq('client_id', client.id);

                if (count === 0 || count === null) {
                    clientResult.sources[source.name] = {
                        status: configId ? '⚠️ Missing Data' : '❌ No ID Set',
                        count: 0,
                        start: '-',
                        end: '-',
                        gap: '-'
                    };
                    continue;
                }

                // Get Min/Max
                const { data: minData } = await supabase
                    .from(source.table)
                    .select('date')
                    .eq('client_id', client.id)
                    .order('date', { ascending: true })
                    .limit(1);

                const { data: maxData } = await supabase
                    .from(source.table)
                    .select('date')
                    .eq('client_id', client.id)
                    .order('date', { ascending: false })
                    .limit(1);

                const minDate = minData?.[0]?.date;
                const maxDate = maxData?.[0]?.date;

                // Calculate Gap
                let gap = 'N/A';
                if (maxDate) {
                    const lastDate = new Date(maxDate);
                    const diffTime = Math.abs(today.getTime() - lastDate.getTime());
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) - 1;
                    gap = `${diffDays} days`;
                }

                clientResult.sources[source.name] = {
                    status: '✅ OK',
                    count: count,
                    start: minDate,
                    end: maxDate,
                    gap: gap
                };

            } catch (err: any) {
                clientResult.sources[source.name] = {
                    status: '❌ Error',
                    count: 0,
                    start: '-',
                    end: '-',
                    gap: '-'
                };
            }
        }
        auditResults.push(clientResult);
    }

    // Display Table
    console.log('| Client Name | Source | Status | Records | Start Date | End Date | Gap (Since Today) |');
    console.log('| :--- | :--- | :--- | :--- | :--- | :--- | :--- |');

    auditResults.forEach(res => {
        Object.entries(res.sources).forEach(([sourceName, data]: [string, any]) => {
            console.log(`| ${res.slug} | ${sourceName} | ${data.status} | ${data.count} | ${data.start} | ${data.end} | ${data.gap} |`);
        });
        console.log('| --- | --- | --- | --- | --- | --- | --- |');
    });

    console.log('\n✨ Audit Complete!');
}

runEnhancedAudit();

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkConversionFunnelData() {
  try {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║         📊 CONVERSION FUNNEL DATA (Sessions -> Events -> Conv)    ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    // Get client
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name')
      .limit(1);

    if (!clients?.length) {
      console.log('❌ No clients found');
      return;
    }

    const client = clients[0];
    console.log(`✅ Client: ${client.name}\n`);

    // Date range: last 31 days
    const thirtyOneDaysAgo = new Date();
    thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);
    const fromDate = thirtyOneDaysAgo.toISOString().split('T')[0];

    // ============================================
    // 1. GA4 SESSIONS
    // ============================================
    console.log('📊 1. GA4 SESSIONS (Stage 1 - Entry):');
    console.log('─'.repeat(70));

    const { data: sessions } = await supabase
      .from('ga4_sessions')
      .select('date, sessions, total_users, conversions, conversion_rate')
      .eq('client_id', client.id)
      .gte('date', fromDate)
      .order('date', { ascending: false })
      .limit(1);

    if (sessions?.length) {
      const s = sessions[0];
      console.log(`  Date: ${s.date}`);
      console.log(`  Total Sessions: ${s.sessions?.toLocaleString()}`);
      console.log(`  Total Users: ${s.total_users?.toLocaleString()}`);
      console.log(`  Conversions: ${s.conversions?.toLocaleString()}`);
      console.log(`  Conversion Rate: ${s.conversion_rate}%\n`);
    } else {
      console.log('  ⚠️  No session data\n');
    }

    // ============================================
    // 2. GA4 EVENTS (Stage 2 - Engagement)
    // ============================================
    console.log('📊 2. GA4 EVENTS (Stage 2 - Engagement):');
    console.log('─'.repeat(70));

    const { data: events } = await supabase
      .from('ga4_events')
      .select('date, event_name, event_count, total_users')
      .eq('client_id', client.id)
      .gte('date', fromDate)
      .order('date', { ascending: false })
      .limit(5);

    if (events?.length) {
      const totalEvents = events.reduce((sum, e) => sum + (e.event_count || 0), 0);
      const uniqueEventTypes = [...new Set(events.map(e => e.event_name))];
      console.log(`  Total Events (last 5 days): ${totalEvents?.toLocaleString()}`);
      console.log(`  Unique Event Types: ${uniqueEventTypes.length}`);
      uniqueEventTypes.slice(0, 5).forEach(et => {
        console.log(`    • ${et}`);
      });
      console.log('');
    } else {
      console.log('  ⚠️  No event data\n');
    }

    // ============================================
    // 3. GA4 CONVERSIONS (Stage 3 - Goal)
    // ============================================
    console.log('📊 3. GA4 CONVERSIONS (Stage 3 - Goal):');
    console.log('─'.repeat(70));

    const { data: conversions } = await supabase
      .from('ga4_conversions')
      .select('date, conversion_event, conversions, total_users, conversion_rate')
      .eq('client_id', client.id)
      .gte('date', fromDate)
      .order('date', { ascending: false })
      .limit(5);

    if (conversions?.length) {
      const totalConversions = conversions.reduce((sum, c) => sum + (c.conversions || 0), 0);
      const uniqueConvEvents = [...new Set(conversions.map(c => c.conversion_event))];
      console.log(`  Total Conversions (last 5 days): ${totalConversions?.toLocaleString()}`);
      console.log(`  Unique Conversion Events: ${uniqueConvEvents.length}`);
      uniqueConvEvents.forEach(ce => {
        console.log(`    • ${ce}`);
      });
      console.log('');
    } else {
      console.log('  ⚠️  No conversion data\n');
    }

    // ============================================
    // 4. FUNNEL CALCULATION (31 days aggregate)
    // ============================================
    console.log('🎯 CONVERSION FUNNEL (31 days):');
    console.log('─'.repeat(70));

    const { data: sessionsAgg } = await supabase
      .from('ga4_sessions')
      .select('sessions, conversions, total_users')
      .eq('client_id', client.id)
      .gte('date', fromDate);

    const { data: eventsAgg } = await supabase
      .from('ga4_events')
      .select('event_count, total_users')
      .eq('client_id', client.id)
      .gte('date', fromDate);

    const { data: conversionsAgg } = await supabase
      .from('ga4_conversions')
      .select('conversions, total_users')
      .eq('client_id', client.id)
      .gte('date', fromDate);

    const totalSessions = sessionsAgg?.reduce((sum, s) => sum + (s.sessions || 0), 0) || 0;
    const totalSessionUsers = sessionsAgg?.reduce((sum, s) => sum + (s.total_users || 0), 0) || 0;
    const totalSessionConversions = sessionsAgg?.reduce((sum, s) => sum + (s.conversions || 0), 0) || 0;

    const totalEventCount = eventsAgg?.reduce((sum, e) => sum + (e.event_count || 0), 0) || 0;
    const totalEventUsers = eventsAgg?.reduce((sum, e) => sum + (e.total_users || 0), 0) || 0;

    const totalConversionCount = conversionsAgg?.reduce((sum, c) => sum + (c.conversions || 0), 0) || 0;
    const totalConversionUsers = conversionsAgg?.reduce((sum, c) => sum + (c.total_users || 0), 0) || 0;

    const eventToSessionRate = totalSessions > 0 ? ((totalEventCount / totalSessions) * 100).toFixed(2) : 0;
    const conversionToEventRate = totalEventCount > 0 ? ((totalConversionCount / totalEventCount) * 100).toFixed(2) : 0;
    const conversionToSessionRate = totalSessions > 0 ? ((totalConversionCount / totalSessions) * 100).toFixed(2) : 0;

    console.log(`\n  Stage 1 - Sessions:     ${totalSessions.toLocaleString()} 🔷`);
    console.log(`                         ${totalSessionUsers.toLocaleString()} users`);
    console.log(`                         ↓`);
    console.log(`  Stage 2 - Events:       ${totalEventCount.toLocaleString()} events (${eventToSessionRate}% of sessions) 🔷`);
    console.log(`                         ${totalEventUsers.toLocaleString()} users`);
    console.log(`                         ↓`);
    console.log(`  Stage 3 - Conversions:  ${totalConversionCount.toLocaleString()} conversions (${conversionToEventRate}% of events) 🔷`);
    console.log(`                         ${totalConversionUsers.toLocaleString()} users`);

    console.log(`\n  📈 FUNNEL METRICS:`);
    console.log(`     Sessions → Events:      ${eventToSessionRate}% conversion`);
    console.log(`     Events → Conversions:   ${conversionToEventRate}% conversion`);
    console.log(`     Sessions → Conversions: ${conversionToSessionRate}% overall`);

    // ============================================
    // 5. TOP LANDING PAGES
    // ============================================
    console.log('\n📄 TOP LANDING PAGES:');
    console.log('─'.repeat(70));

    const { data: landingPages } = await supabase
      .from('ga4_landing_pages')
      .select('landing_page, sessions, conversions, conversion_rate, bounce_rate')
      .eq('client_id', client.id)
      .gte('date', fromDate)
      .order('sessions', { ascending: false })
      .limit(5);

    if (landingPages?.length) {
      landingPages.forEach((page, idx) => {
        console.log(`  ${idx + 1}. ${page.landing_page}`);
        console.log(`     Sessions: ${page.sessions} | Conversions: ${page.conversions} | Rate: ${page.conversion_rate}% | Bounce: ${page.bounce_rate}%`);
      });
    } else {
      console.log('  ⚠️  No landing page data');
    }

    // ============================================
    // 6. TOP KEYWORDS (GSC)
    // ============================================
    console.log('\n🔑 TOP KEYWORDS (GSC):');
    console.log('─'.repeat(70));

    const { data: topKeywords } = await supabase
      .from('gsc_queries')
      .select('query, clicks, impressions, ctr, position')
      .eq('client_id', client.id)
      .gte('date', fromDate)
      .order('impressions', { ascending: false })
      .limit(5);

    if (topKeywords?.length) {
      topKeywords.forEach((kw, idx) => {
        console.log(`  ${idx + 1}. ${kw.query}`);
        console.log(`     Position: ${kw.position.toFixed(1)} | Impressions: ${kw.impressions} | Clicks: ${kw.clicks} | CTR: ${kw.ctr.toFixed(2)}%`);
      });
    } else {
      console.log('  ⚠️  No keyword data');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkConversionFunnelData();

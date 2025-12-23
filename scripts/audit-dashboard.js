const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function auditDashboard() {
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║           COMPREHENSIVE DASHBOARD DATA AUDIT                    ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  // Get sample data
  const { data: sample } = await supabase
    .from("client_metrics_summary")
    .select("*")
    .eq("client_id", "3c80f930-5f4d-49d6-9428-f2440e496aac")
    .eq("date", "2025-12-15")
    .single();

  // Get all clients data summary
  const { data: allData } = await supabase
    .from("client_metrics_summary")
    .select("*")
    .gte("date", "2025-11-19")
    .lte("date", "2025-12-18");

  const { data: clients } = await supabase.from("clients").select("id, name");
  const clientNames = {};
  clients.forEach(c => clientNames[c.id] = c.name);

  // Aggregate by client
  const totals = {};
  allData.forEach(row => {
    if (!totals[row.client_id]) {
      totals[row.client_id] = {};
      Object.keys(row).forEach(k => totals[row.client_id][k] = 0);
    }
    Object.keys(row).forEach(k => {
      if (typeof row[k] === 'number') {
        totals[row.client_id][k] += row[k];
      }
    });
  });

  // =============== SECTION 1: DATA IN DB BUT ALWAYS 0 ===============
  console.log("═══════════════════════════════════════════════════════════════════");
  console.log("❌ SECTION 1: DATA COLUMNS ALWAYS = 0 (Never populated)");
  console.log("═══════════════════════════════════════════════════════════════════\n");

  const alwaysZeroColumns = [
    "gbp_profile_views", "gbp_searches_direct", "gbp_searches_discovery",
    "gbp_reviews_count", "gbp_reviews_new", "gbp_rating_avg", "gbp_q_and_a_count",
    "days_since_review", "gbp_photos_count", "gbp_posts_count", "gbp_posts_views",
    "gbp_posts_clicks", "days_since_post",
    "ads_impression_share", "ads_search_lost_budget", "ads_quality_score",
    "ads_top_impression_rate",
    "branded_traffic", "keywords_improved",
    "blog_sessions", "content_conversions",
    "mom_leads_change", "alerts_count"
  ];

  alwaysZeroColumns.forEach(col => {
    let hasAnyData = false;
    Object.values(totals).forEach((t) => {
      if (t[col] > 0) hasAnyData = true;
    });
    if (!hasAnyData) {
      console.log(`  ❌ ${col} - NO DATA (rollup function not fetching this)`);
    }
  });

  // =============== SECTION 2: DATA IN DB NOT SHOWN ON DASHBOARD ===============
  console.log("\n═══════════════════════════════════════════════════════════════════");
  console.log("⚠️  SECTION 2: DATA EXISTS IN DB BUT NOT DISPLAYED ON DASHBOARD");
  console.log("═══════════════════════════════════════════════════════════════════\n");

  const notDisplayed = [
    { col: "new_users", desc: "New vs returning users breakdown" },
    { col: "sessions_mobile", desc: "Mobile/Desktop session split" },
    { col: "sessions_desktop", desc: "Mobile/Desktop session split" },
    { col: "ads_ctr", desc: "Ads Click-Through Rate (calculated but not shown)" },
    { col: "ads_avg_cpc", desc: "Average Cost Per Click" },
    { col: "ads_conversion_rate", desc: "Ads Conversion Rate %" },
    { col: "google_rank", desc: "Google Ranking position" },
    { col: "top_keywords", desc: "Number of top keywords" },
    { col: "non_branded_traffic", desc: "Non-branded search traffic" },
    { col: "keywords_declined", desc: "Keywords that dropped in rank" },
    { col: "returning_users", desc: "Returning users count" },
    { col: "conversion_rate", desc: "Overall conversion rate %" },
    { col: "health_score", desc: "Client health score (0-100)" },
    { col: "budget_utilization", desc: "Budget utilization %" },
  ];

  notDisplayed.forEach(item => {
    let hasData = false;
    Object.values(totals).forEach((t) => {
      if (t[item.col] > 0) hasData = true;
    });
    if (hasData) {
      console.log(`  ⚠️  ${item.col} - ${item.desc}`);
    }
  });

  // =============== SECTION 3: CLIENT COVERAGE ===============
  console.log("\n═══════════════════════════════════════════════════════════════════");
  console.log("📊 SECTION 3: DATA COVERAGE BY CLIENT (30 days)");
  console.log("═══════════════════════════════════════════════════════════════════\n");

  let hasGA = 0, hasAds = 0, hasGBP = 0, hasSEO = 0, hasAI = 0;
  const total = Object.keys(totals).length;

  Object.entries(totals).forEach(([id, t]) => {
    const name = (clientNames[id] || "Unknown").substring(0, 28).padEnd(28);
    const ga = t.sessions > 0 ? "✅" : "❌";
    const ads = t.ad_spend > 0 ? "✅" : "❌";
    const gbp = (t.gbp_calls + t.gbp_website_clicks + t.gbp_directions) > 0 ? "✅" : "❌";
    const seo = t.seo_clicks > 0 ? "✅" : "❌";
    const ai = t.traffic_ai > 0 ? "✅" : "❌";

    if (t.sessions > 0) hasGA++;
    if (t.ad_spend > 0) hasAds++;
    if ((t.gbp_calls + t.gbp_website_clicks + t.gbp_directions) > 0) hasGBP++;
    if (t.seo_clicks > 0) hasSEO++;
    if (t.traffic_ai > 0) hasAI++;

    console.log(`${name} GA:${ga} Ads:${ads} GBP:${gbp} SEO:${seo} AI:${ai}`);
  });

  console.log("\n--- Coverage Summary ---");
  console.log(`GA4 Data:    ${hasGA}/${total} clients (${Math.round(hasGA/total*100)}%)`);
  console.log(`Ads Data:    ${hasAds}/${total} clients (${Math.round(hasAds/total*100)}%)`);
  console.log(`GBP Data:    ${hasGBP}/${total} clients (${Math.round(hasGBP/total*100)}%)`);
  console.log(`SEO Data:    ${hasSEO}/${total} clients (${Math.round(hasSEO/total*100)}%)`);
  console.log(`AI Traffic:  ${hasAI}/${total} clients (${Math.round(hasAI/total*100)}%)`);

  // =============== SECTION 4: GSC DATA DELAY ===============
  console.log("\n═══════════════════════════════════════════════════════════════════");
  console.log("⏰ SECTION 4: DATA FRESHNESS / DELAYS");
  console.log("═══════════════════════════════════════════════════════════════════\n");

  // Check last 3 days for GSC data
  const { data: recentData } = await supabase
    .from("client_metrics_summary")
    .select("date, seo_clicks, seo_impressions")
    .eq("client_id", "3c80f930-5f4d-49d6-9428-f2440e496aac")
    .gte("date", "2025-12-15")
    .order("date", { ascending: false });

  console.log("GSC Data (CorePosture - last 4 days):");
  recentData.forEach(row => {
    const hasData = row.seo_clicks > 0 || row.seo_impressions > 0;
    console.log(`  ${row.date}: ${hasData ? "✅" : "❌"} clicks=${row.seo_clicks} impressions=${row.seo_impressions}`);
  });
  console.log("  Note: GSC data has 2-3 day delay from Google");

  // =============== SECTION 5: ISSUES SUMMARY ===============
  console.log("\n═══════════════════════════════════════════════════════════════════");
  console.log("🔧 SECTION 5: ISSUES & RECOMMENDATIONS");
  console.log("═══════════════════════════════════════════════════════════════════\n");

  console.log("1. ❌ GBP REVIEWS/POSTS - Not being fetched by rollup");
  console.log("   → Need to implement My Business API for reviews/posts");
  console.log("   → Columns affected: gbp_reviews_count, gbp_rating_avg, gbp_posts_count, etc.\n");

  console.log("2. ❌ ADS ADVANCED METRICS - Not being fetched");
  console.log("   → ads_impression_share, ads_quality_score, ads_top_impression_rate");
  console.log("   → Need to add these to Google Ads API calls\n");

  console.log("3. ⚠️  DASHBOARD NOT SHOWING AVAILABLE DATA:");
  console.log("   → Mobile/Desktop breakdown (sessions_mobile, sessions_desktop)");
  console.log("   → New vs Returning users (new_users, returning_users)");
  console.log("   → Health score & Budget utilization");
  console.log("   → Non-branded traffic breakdown\n");

  console.log("4. ⏰ GSC DATA DELAY (by design):");
  console.log("   → 2-3 days delay from Google - EXPECTED\n");

  console.log("5. 🤖 AI TRAFFIC:");
  console.log(`   → Only ${hasAI}/${total} clients have AI referral traffic`);
  console.log("   → This is expected - AI traffic is still emerging\n");
}

auditDashboard().catch(console.error);

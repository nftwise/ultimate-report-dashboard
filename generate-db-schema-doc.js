const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function generateDoc() {
  let md = `# Supabase Database Schema Reference

> **IMPORTANT**: Claude MUST read this file before working on any dashboard feature.
> This file contains the complete database schema with all tables and columns.

Generated: ${new Date().toISOString()}

---

## Quick Reference

### GBP (Google Business Profile) Data Sources
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| \`gbp_location_daily_metrics\` | Detailed daily GBP metrics | phone_calls, website_clicks, direction_requests, views |
| \`client_metrics_summary\` | Aggregated metrics (different column names!) | gbp_calls, gbp_website_clicks, gbp_directions, gbp_profile_views |
| \`gbp_locations\` | Location info | location_name, address, phone |
| \`gbp_posts\` | GBP posts data | post_title, views, actions |

### Google Ads Data Sources
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| \`ads_campaign_metrics\` | Campaign performance | impressions, clicks, cost, conversions |
| \`ads_ad_group_metrics\` | Ad group performance | ad_group_name, impressions, clicks, cost |
| \`campaign_conversion_actions\` | Conversion tracking | conversions, conversion_action_name |
| \`campaign_search_terms\` | Search terms | search_term, impressions, clicks, conversions |

### SEO/Analytics Data Sources
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| \`ga4_sessions\` | GA4 session data | sessions, users, conversions |
| \`ga4_events\` | GA4 events | event_name, event_count |
| \`ga4_landing_pages\` | Landing page data | landing_page, sessions, conversions |
| \`gsc_queries\` | Search Console queries | query, clicks, impressions, position |
| \`gsc_pages\` | Search Console pages | page, clicks, impressions |

---

## Complete Table Schemas

`;

  // Get all tables
  const tables = [
    'clients',
    'client_metrics_summary',
    'gbp_location_daily_metrics',
    'gbp_locations',
    'gbp_posts',
    'gbp_location_photos',
    'ads_campaign_metrics',
    'ads_ad_group_metrics',
    'campaign_conversion_actions',
    'campaign_search_terms',
    'ga4_sessions',
    'ga4_events',
    'ga4_conversions',
    'ga4_landing_pages',
    'gsc_queries',
    'gsc_pages'
  ];

  for (const tableName of tables) {
    console.log(`Processing ${tableName}...`);
    
    // Get sample row to see columns
    const { data: sample, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);

    if (error) {
      md += `### ${tableName}\n\n⚠️ Error accessing table: ${error.message}\n\n---\n\n`;
      continue;
    }

    md += `### ${tableName}\n\n`;

    if (sample && sample.length > 0) {
      const columns = Object.keys(sample[0]);
      md += `**Columns (${columns.length}):**\n\n`;
      md += `| Column | Sample Value | Type |\n`;
      md += `|--------|--------------|------|\n`;
      
      for (const col of columns) {
        const val = sample[0][col];
        const type = val === null ? 'null' : typeof val;
        const displayVal = val === null ? 'NULL' : 
                          typeof val === 'object' ? 'JSON' :
                          String(val).substring(0, 50);
        md += `| \`${col}\` | ${displayVal} | ${type} |\n`;
      }
    } else {
      md += `*No data available*\n`;
    }

    // Get row count
    const { count } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });
    
    md += `\n**Total Rows:** ${count || 0}\n\n`;
    md += `---\n\n`;
  }

  // Add column mapping section
  md += `## Column Name Mapping (IMPORTANT!)

### GBP Columns: gbp_location_daily_metrics vs client_metrics_summary

| gbp_location_daily_metrics | client_metrics_summary | Description |
|---------------------------|------------------------|-------------|
| \`phone_calls\` | \`gbp_calls\` | Phone calls from GBP |
| \`website_clicks\` | \`gbp_website_clicks\` | Website clicks |
| \`direction_requests\` | \`gbp_directions\` | Direction requests |
| \`views\` | \`gbp_profile_views\` | Profile views |
| \`total_reviews\` | \`gbp_reviews_count\` | Total review count |
| \`new_reviews_today\` | \`gbp_reviews_new\` | New reviews |
| \`average_rating\` | \`gbp_rating_avg\` | Average star rating |
| \`posts_count\` | \`gbp_posts_count\` | Active posts |
| \`posts_views\` | \`gbp_posts_views\` | Post views |
| \`posts_actions\` | \`gbp_posts_clicks\` | Post clicks/actions |

### When to use which table:
- **gbp_location_daily_metrics**: Use for detailed GBP analytics page
- **client_metrics_summary**: Use for overview/dashboard pages (has ALL metrics aggregated)

---

## Usage Examples

### Fetching GBP Data (with fallback)
\`\`\`typescript
// Fetch from BOTH tables and merge
const { data: gbpData } = await supabase
  .from('gbp_location_daily_metrics')
  .select('date, phone_calls, website_clicks, direction_requests, views')
  .eq('client_id', clientId);

const { data: summaryData } = await supabase
  .from('client_metrics_summary')
  .select('date, gbp_calls, gbp_website_clicks, gbp_directions, gbp_profile_views')
  .eq('client_id', clientId);

// Merge: prefer gbpData, fallback to summaryData
\`\`\`

### Fetching Ads Data
\`\`\`typescript
const { data: campaignData } = await supabase
  .from('ads_campaign_metrics')
  .select('date, impressions, clicks, cost, conversions')
  .eq('client_id', clientId);

const { data: conversions } = await supabase
  .from('campaign_conversion_actions')
  .select('date, conversions, conversion_action_name')
  .eq('client_id', clientId);
\`\`\`

### Fetching SEO Data
\`\`\`typescript
const { data: sessions } = await supabase
  .from('ga4_sessions')
  .select('date, sessions, users, conversions')
  .eq('client_id', clientId);

const { data: keywords } = await supabase
  .from('gsc_queries')
  .select('query, clicks, impressions, ctr, position')
  .eq('client_id', clientId);
\`\`\`

---

## Notes

1. **Always check BOTH GBP tables** - data may exist in one but not the other
2. **Column names differ** between tables - use the mapping above
3. **client_metrics_summary** is the main aggregated table with 66 columns
4. **Date format** is always 'YYYY-MM-DD' string
5. **client_id** is UUID format

`;

  return md;
}

generateDoc().then(md => {
  require('fs').writeFileSync('DATABASE_SCHEMA.md', md);
  console.log('Generated DATABASE_SCHEMA.md');
});

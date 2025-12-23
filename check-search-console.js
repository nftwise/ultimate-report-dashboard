#!/usr/bin/env node

/**
 * Search Console Verification Tool
 * Check which sites the service account can access
 */

require('dotenv').config({ path: '.env.local' });

const { google } = require('googleapis');
const { JWT } = require('google-auth-library');

async function checkSearchConsole() {
  console.log('\n🔍 Google Search Console Access Check\n');
  console.log('='.repeat(80));

  try {
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const configuredSite = process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL;

    console.log('\n📧 Service Account Email:');
    console.log(`   ${clientEmail}`);
    console.log('\n📍 Configured Site URL:');
    console.log(`   ${configuredSite}`);
    console.log('\n' + '='.repeat(80));

    // Create JWT auth
    const auth = new JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly']
    });

    const searchconsole = google.searchconsole({ version: 'v1', auth });

    console.log('\n⏳ Checking accessible sites...\n');

    try {
      const response = await searchconsole.sites.list();

      if (!response.data.siteEntry || response.data.siteEntry.length === 0) {
        console.log('❌ NO SITES FOUND!\n');
        console.log('This means the service account has NOT been added to any Search Console properties.\n');
        console.log('📝 TO FIX THIS:\n');
        console.log('1. Copy this email:');
        console.log(`   ${clientEmail}\n`);
        console.log('2. Go to: https://search.google.com/search-console\n');
        console.log('3. Select your property (e.g., https://mychiropractice.com)\n');
        console.log('4. Click: Settings (gear icon) → Users and permissions\n');
        console.log('5. Click: Add user\n');
        console.log('6. Paste the email above\n');
        console.log('7. Select permission: Full (or Owner)\n');
        console.log('8. Click: Add\n');
        console.log('9. WAIT 5-10 minutes for Google to propagate the permissions\n');
        console.log('10. Run this script again to verify\n');
        return;
      }

      console.log(`✅ Found ${response.data.siteEntry.length} accessible site(s):\n`);

      let foundConfiguredSite = false;

      response.data.siteEntry.forEach((site, index) => {
        const isConfigured = site.siteUrl === configuredSite ||
                            site.siteUrl === configuredSite + '/' ||
                            site.siteUrl + '/' === configuredSite;

        console.log(`${index + 1}. ${site.siteUrl}`);
        console.log(`   Permission: ${site.permissionLevel}`);

        if (isConfigured) {
          console.log(`   ⭐ THIS IS YOUR CONFIGURED SITE!`);
          foundConfiguredSite = true;
        }
        console.log('');
      });

      console.log('='.repeat(80) + '\n');

      if (foundConfiguredSite) {
        console.log('✅ SUCCESS! Your configured site is accessible!\n');
        console.log('The API should work. If you still see errors, try:\n');
        console.log('1. Wait a few more minutes (permissions can take up to 10 minutes)\n');
        console.log('2. Make sure the URL in .env.local exactly matches the one above\n');
        console.log('3. Try deploying to Vercel - sometimes it works there even if local test fails\n');
      } else {
        console.log('⚠️  WARNING: Your configured site was NOT found!\n');
        console.log(`Configured: ${configuredSite}\n`);
        console.log('Available sites are listed above.\n');
        console.log('📝 TO FIX:\n');
        console.log('Option 1: Update your .env.local to use one of the available sites above\n');
        console.log('Option 2: Add the service account to your configured site:\n');
        console.log(`   - Go to Search Console for: ${configuredSite}`);
        console.log('   - Add user with email: ' + clientEmail);
        console.log('   - Permission: Full\n');
      }

      // Try a test query on the first site
      if (response.data.siteEntry.length > 0) {
        const testSite = foundConfiguredSite
          ? configuredSite
          : response.data.siteEntry[0].siteUrl;

        console.log(`\n🧪 Testing data query on: ${testSite}\n`);

        try {
          const endDate = new Date();
          const startDate = new Date();
          startDate.setDate(endDate.getDate() - 7);

          const analyticsResponse = await searchconsole.searchanalytics.query({
            siteUrl: testSite,
            requestBody: {
              startDate: startDate.toISOString().split('T')[0],
              endDate: endDate.toISOString().split('T')[0],
              dimensions: ['query'],
              rowLimit: 5
            }
          });

          if (analyticsResponse.data.rows && analyticsResponse.data.rows.length > 0) {
            console.log(`✅ Data query successful! Found ${analyticsResponse.data.rows.length} queries\n`);
            console.log('Sample queries:');
            analyticsResponse.data.rows.slice(0, 3).forEach((row, i) => {
              console.log(`${i + 1}. "${row.keys[0]}" - ${row.clicks} clicks, ${row.impressions} impressions`);
            });
            console.log('\n🎉 Search Console API is FULLY WORKING!\n');
          } else {
            console.log('⚠️  Query returned no data (site may be new or have no search traffic)\n');
          }
        } catch (queryError) {
          console.log(`❌ Data query failed: ${queryError.message}\n`);
          console.log('This could mean:');
          console.log('- The site has no search data yet');
          console.log('- Permissions are still propagating (wait 5-10 minutes)');
          console.log('- You need "Full" permission level (not just "Restricted")\n');
        }
      }

    } catch (error) {
      if (error.message.includes('Login Required') || error.message.includes('403')) {
        console.log('❌ PERMISSION DENIED\n');
        console.log('The service account has NOT been added to Search Console.\n');
        console.log('📝 SOLUTION:\n');
        console.log('1. Copy this email:');
        console.log(`   ${clientEmail}\n`);
        console.log('2. Go to: https://search.google.com/search-console\n');
        console.log('3. For EACH property you want to access:\n');
        console.log('   - Select the property');
        console.log('   - Settings → Users and permissions → Add user');
        console.log('   - Paste email, set permission to "Full"');
        console.log('   - Click Add\n');
        console.log('4. Wait 5-10 minutes\n');
        console.log('5. Run this script again\n');
      } else {
        throw error;
      }
    }

  } catch (error) {
    console.error('\n💥 Error:', error.message);
    console.error('\nFull error:', error);
  }

  console.log('='.repeat(80) + '\n');
}

checkSearchConsole();

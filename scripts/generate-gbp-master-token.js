/**
 * Agency GBP Master Token Generator
 *
 * This script generates a SINGLE OAuth token that can access ALL client GBPs
 * that your agency Google account has Manager/Owner access to.
 *
 * Steps:
 * 1. Run this script: node scripts/generate-gbp-master-token.js
 * 2. Sign in with your AGENCY Google account (e.g., seo@mychiropractice.com)
 *    that has Manager access to all client GBPs
 * 3. The token will be saved as agency-gbp-master.json
 * 4. This single token will work for ALL client GBPs you manage!
 *
 * Benefits:
 * - Clients don't need to connect their own accounts
 * - One token manages everything
 * - You control all access centrally
 * - Just store gbp_location_id for each client in the database
 */

const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
require('dotenv').config({ path: '.env.local' });

// Function to open URL in browser (cross-platform)
const openBrowser = (url) => {
  const platform = process.platform;
  let command;
  if (platform === 'darwin') {
    command = `open "${url}"`;
  } else if (platform === 'win32') {
    command = `start "${url}"`;
  } else {
    command = `xdg-open "${url}"`;
  }
  exec(command, (err) => {
    if (err) {
      console.log('Could not open browser automatically.');
      console.log('Please open this URL manually:\n');
      console.log(url);
      console.log('\n');
    }
  });
};

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3002/callback';

// Scopes needed for Google Business Profile
const SCOPES = [
  'https://www.googleapis.com/auth/business.manage',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Error: Missing GOOGLE_OAUTH_CLIENT_ID or GOOGLE_OAUTH_CLIENT_SECRET in .env.local');
  process.exit(1);
}

// Generate authorization URL
const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
  `client_id=${CLIENT_ID}&` +
  `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
  `response_type=code&` +
  `scope=${encodeURIComponent(SCOPES)}&` +
  `access_type=offline&` +
  `prompt=consent`;

console.log('\n=== Agency GBP Master Token Generator ===\n');
console.log('IMPORTANT: Sign in with your AGENCY Google account');
console.log('(the account that has Manager access to all client GBPs)\n');
console.log('1. Opening browser for authorization...');
console.log('2. Sign in with your agency Google account (e.g., seo@mychiropractice.com)\n');

// Create a simple server to receive the callback
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);

  if (parsedUrl.pathname === '/callback') {
    const code = parsedUrl.query.code;

    if (code) {
      try {
        // Exchange code for tokens
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            code: code,
            grant_type: 'authorization_code',
            redirect_uri: REDIRECT_URI,
          }),
        });

        const tokens = await tokenResponse.json();

        if (tokens.refresh_token) {
          // Save token as agency master token
          const tokenDir = path.join(process.cwd(), '.oauth-tokens');
          if (!fs.existsSync(tokenDir)) {
            fs.mkdirSync(tokenDir, { recursive: true });
          }

          const tokenFile = path.join(tokenDir, 'agency-gbp-master.json');
          fs.writeFileSync(tokenFile, JSON.stringify(tokens, null, 2));

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: sans-serif; padding: 40px; max-width: 800px; margin: 0 auto;">
                <h1 style="color: #22c55e;">Success! Agency Master Token Created</h1>
                <p>Your agency GBP master token has been saved.</p>
                <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; border: 1px solid #86efac;">
                  <p><strong>Token saved to:</strong></p>
                  <code>.oauth-tokens/agency-gbp-master.json</code>
                </div>
                <h3>What this means:</h3>
                <ul>
                  <li>This single token can access ALL GBPs you manage</li>
                  <li>Clients don't need to connect their own accounts</li>
                  <li>Just store the <code>gbp_location_id</code> for each client</li>
                </ul>
                <h3>Next Steps:</h3>
                <ol>
                  <li>For each client, find their GBP location ID</li>
                  <li>Store it in the <code>service_configs</code> table</li>
                  <li>The dashboard will automatically use this master token</li>
                </ol>
                <p style="color: #666;">You can close this window now.</p>
              </body>
            </html>
          `);

          console.log('\n=== SUCCESS! ===\n');
          console.log('Agency master token saved to:');
          console.log('  .oauth-tokens/agency-gbp-master.json');
          console.log('\nThis token will be used for ALL client GBP data.\n');
          console.log('For each client, just store their gbp_location_id in the database.');
          console.log('\n');
        } else {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: sans-serif; padding: 40px;">
                <h1 style="color: #ef4444;">Error</h1>
                <p>Failed to get refresh token:</p>
                <pre>${JSON.stringify(tokens, null, 2)}</pre>
              </body>
            </html>
          `);
          console.error('Error getting tokens:', tokens);
        }
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error exchanging code for tokens');
        console.error('Error:', error);
      }
    } else {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('No authorization code received');
    }

    // Close server after handling callback
    setTimeout(() => {
      server.close();
      process.exit(0);
    }, 1000);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

server.listen(3002, () => {
  console.log('Waiting for authorization callback on http://localhost:3002...\n');

  // Open browser automatically
  openBrowser(authUrl);
});

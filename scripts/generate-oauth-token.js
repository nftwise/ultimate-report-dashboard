/**
 * OAuth Token Generator for Google Ads
 *
 * This script helps you generate a new refresh token for Google Ads API.
 *
 * Steps:
 * 1. Run this script: node scripts/generate-oauth-token.js
 * 2. Open the URL in your browser
 * 3. Sign in with the Google account that has access to the Ads account
 * 4. Copy the authorization code
 * 5. Paste it back in the terminal
 * 6. Copy the refresh_token and update .env.local
 */

const http = require('http');
const url = require('url');
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

// Use GOOGLE_ADS credentials specifically for Google Ads API
const CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3001/callback';

// Scopes needed for Google Ads
const SCOPES = [
  'https://www.googleapis.com/auth/adwords',
].join(' ');

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Error: Missing GOOGLE_ADS_CLIENT_ID or GOOGLE_ADS_CLIENT_SECRET in .env.local');
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

console.log('\n=== Google Ads OAuth Token Generator ===\n');
console.log('1. Opening browser for authorization...');
console.log('2. Sign in with your Google account that has access to Google Ads\n');

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
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: sans-serif; padding: 40px; max-width: 800px; margin: 0 auto;">
                <h1 style="color: #22c55e;">Success!</h1>
                <p>Your refresh token has been generated. Copy it below:</p>
                <div style="background: #f1f5f9; padding: 20px; border-radius: 8px; word-break: break-all;">
                  <code style="font-size: 14px;">${tokens.refresh_token}</code>
                </div>
                <h3>Next Steps:</h3>
                <ol>
                  <li>Open <code>.env.local</code></li>
                  <li>Find <code>GOOGLE_ADS_REFRESH_TOKEN</code></li>
                  <li>Replace the value with the token above</li>
                  <li>Restart the dev server</li>
                </ol>
                <p style="color: #666;">You can close this window now.</p>
              </body>
            </html>
          `);

          console.log('\n=== SUCCESS! ===\n');
          console.log('Refresh Token:');
          console.log(tokens.refresh_token);
          console.log('\n');
          console.log('Update your .env.local file:');
          console.log(`GOOGLE_ADS_REFRESH_TOKEN=${tokens.refresh_token}`);
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

server.listen(3001, () => {
  console.log('Waiting for authorization callback on http://localhost:3001...\n');

  // Open browser automatically
  openBrowser(authUrl);
});

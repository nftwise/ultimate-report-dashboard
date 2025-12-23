// Test if the private key format is correct for JWT authentication
const fs = require('fs');
const { JWT } = require('google-auth-library');

// Read the escaped private key
const escapedKey = fs.readFileSync('temp-private-key-escaped-fixed.txt', 'utf8').trim();
console.log('Escaped key length:', escapedKey.length);
console.log('First 50 chars:', escapedKey.substring(0, 50));
console.log('Last 50 chars:', escapedKey.substring(escapedKey.length - 50));

// Convert escaped \n to actual newlines (same as what the code does)
const privateKey = escapedKey.replace(/\\n/g, '\n');
console.log('\nConverted key first 50 chars:', privateKey.substring(0, 50));
console.log('Has actual newlines:', privateKey.includes('\n'));

// Try to create a JWT client with it
try {
  const auth = new JWT({
    email: 'analysis-api@uplifted-triode-432610-r7.iam.gserviceaccount.com',
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly']
  });
  console.log('\n✅ JWT client created successfully!');
  console.log('Email:', auth.email);
} catch (error) {
  console.error('\n❌ Failed to create JWT client:');
  console.error(error.message);
}

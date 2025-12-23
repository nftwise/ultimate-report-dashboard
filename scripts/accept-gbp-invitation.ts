import { google } from 'googleapis';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function acceptGBPInvitation() {
  console.log('🔐 Setting up Google authentication...');
  
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    projectId: process.env.GOOGLE_PROJECT_ID,
    scopes: [
      'https://www.googleapis.com/auth/business.manage',
    ],
  });

  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();

  console.log('✅ Authentication successful!');
  console.log('📧 Service Account:', process.env.GOOGLE_CLIENT_EMAIL);

  // List pending invitations
  const accountId = '108464329640897455666';
  const locationId = 'accounts/108464329640897455666/locations/1203151849529238982';

  console.log('\n📋 Checking for invitations...');

  try {
    // Try to list invitations
    const response = await fetch(
      `https://mybusinessaccountmanagement.googleapis.com/v1/accounts/${accountId}/invitations`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken.token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();
    console.log('Invitations:', JSON.stringify(data, null, 2));

    if (data.invitations && data.invitations.length > 0) {
      console.log(`\n✉️ Found ${data.invitations.length} invitation(s)!`);
      
      for (const invitation of data.invitations) {
        console.log(`\nAccepting invitation: ${invitation.name}`);
        
        const acceptResponse = await fetch(
          `https://mybusinessaccountmanagement.googleapis.com/v1/${invitation.name}:accept`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken.token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (acceptResponse.ok) {
          console.log('✅ Invitation accepted!');
        } else {
          const error = await acceptResponse.text();
          console.error('❌ Failed to accept:', error);
        }
      }
    } else {
      console.log('ℹ️ No pending invitations found.');
      console.log('\n💡 Note: Service accounts cannot receive email invitations.');
      console.log('   You need to add the service account directly as a user in GBP.');
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

acceptGBPInvitation();

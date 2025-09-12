// Script to create client users in batch
// Run this with: node scripts/create-client-users.js

const clients = [
  {
    email: "john@abcmarketing.com",
    password: "TempPassword123",
    companyName: "ABC Marketing",
    googleAnalyticsPropertyId: "123456789",
    googleAdsCustomerId: "123-456-7890",
    callrailAccountId: "abc123"
  },
  {
    email: "sarah@xyzcorp.com", 
    password: "TempPassword456",
    companyName: "XYZ Corporation",
    googleAnalyticsPropertyId: "987654321",
    googleAdsCustomerId: "987-654-3210",
    callrailAccountId: "xyz789"
  },
  {
    email: "mike@techsolutions.com",
    password: "TempPassword789",
    companyName: "Tech Solutions Inc",
    googleAnalyticsPropertyId: "456789123",
    googleAdsCustomerId: "456-789-1230",
    callrailAccountId: "tech456"
  },
  // Add your remaining 47 clients here...
];

async function createClients() {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  
  console.log('Creating client accounts...\n');
  
  for (const client of clients) {
    try {
      const response = await fetch(`${baseUrl}/api/admin/create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(client),
      });

      const result = await response.json();
      
      if (result.success) {
        console.log(`✅ Created account for ${client.companyName} (${client.email})`);
      } else {
        console.log(`❌ Failed to create ${client.companyName}: ${result.error}`);
      }
    } catch (error) {
      console.log(`❌ Error creating ${client.companyName}:`, error.message);
    }
  }
  
  console.log('\nDone! Send login credentials to your clients:');
  console.log('\nExample email to client:');
  console.log('---');
  console.log('Subject: Your Analytics Dashboard is Ready');
  console.log('');
  console.log('Hi [Client Name],');
  console.log('');
  console.log('Your analytics dashboard is now live! You can access it at:');
  console.log(`${baseUrl}/login`);
  console.log('');
  console.log('Your login credentials:');
  console.log('Email: [CLIENT_EMAIL]');
  console.log('Password: [TEMP_PASSWORD]');
  console.log('');
  console.log('Once you log in, you\'ll see your website analytics automatically.');
  console.log('');
  console.log('Best regards,');
  console.log('[Your Name]');
}

// Only run if this file is executed directly
if (require.main === module) {
  createClients().catch(console.error);
}

module.exports = { clients, createClients };
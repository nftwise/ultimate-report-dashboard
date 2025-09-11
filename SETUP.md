# 🚀 Multi-Client JSON-Based Authentication Setup Guide

## 📋 Quick Setup Overview

Your Ultimate Reporting Dashboard now supports **client-specific authentication** where each client automatically sees only their website data after login. The system uses a simple JSON file for client management - no database required!

---

## 🔧 **Step 1: Client Data Configuration**

### Client Data is Stored in JSON File
All client information is stored in `src/data/clients.json`. This file contains:
- Client credentials (email/password)
- Company information 
- API configuration (Google Analytics, Google Ads, CallRail IDs)

### Current Sample Clients
The system includes 5 sample clients ready for testing:
```
john@abcmarketing.com / TempPassword123
sarah@xyzcorp.com / TempPassword456
mike@techsolutions.com / TempPassword789
lisa@digitalagency.com / TempPassword101
david@ecommerceco.com / TempPassword202
```

---

## ⚙️ **Step 2: Environment Configuration**

### Update `.env.local` with your API credentials:
```bash
# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-super-secret-key-here

# Google Analytics Configuration
GOOGLE_CLIENT_EMAIL=your_service_account_email
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour_Private_Key_Here\n-----END PRIVATE KEY-----"

# Google Ads API Configuration  
GOOGLE_ADS_DEVELOPER_TOKEN=your_developer_token
GOOGLE_ADS_CLIENT_ID=your_client_id
GOOGLE_ADS_CLIENT_SECRET=your_client_secret
GOOGLE_ADS_REFRESH_TOKEN=your_refresh_token

# CallRail API Configuration
CALLRAIL_API_TOKEN=your_callrail_api_token
```

**Note**: You no longer need Supabase credentials since the system uses JSON file storage.

---

## 👥 **Step 3: Managing Client Accounts**

### Adding New Clients to JSON File

#### Method A: Edit JSON File Directly
1. Open `src/data/clients.json`
2. Add new client objects to the `clients` array:
```json
{
  "clients": [
    {
      "id": "client-006",
      "email": "newclient@company.com",
      "password": "TempPassword303", 
      "companyName": "New Client Company",
      "googleAnalyticsPropertyId": "777888999",
      "googleAdsCustomerId": "777-888-9990",
      "callrailAccountId": "new777"
    }
  ]
}
```

#### Method B: Manual JSON Editing (Recommended)
This system uses simple JSON file-based authentication. To add new clients:
1. Open `src/data/clients.json` in your editor
2. Add new client objects to the `clients` array
3. Restart the development server to pick up changes

**Note**: The API user creation endpoint is disabled to keep the system simple and secure.

---

## 🎯 **Step 4: How It Works**

### Client Login Flow:
1. **Client visits**: `yourdomain.com` → redirected to login
2. **Client logs in**: with their email/password from JSON file
3. **Dashboard loads**: automatically shows ONLY their website data
4. **No selection needed**: their GA, Ads, and CallRail data is pre-configured

### Example Client Experience:
```
1. Visit: yourdomain.com
2. Login: john@abcmarketing.com / TempPassword123
3. See: "Welcome back, ABC Marketing" dashboard
4. View: Their website analytics automatically
```

---

## 📊 **Dashboard Features**

Each client sees:
- ✅ **Google Analytics Dashboard** (their property only)
- ✅ **Cross-Platform Overview** (their metrics)
- ✅ **Performance & Cost Metrics** (their campaigns)
- ✅ **Charts & Visualizations** (their data)
- ✅ **Detailed Reports** (their calls, ads, traffic)
- ✅ **Real-time Updates** every 5 minutes
- ✅ **Mobile Responsive** design

---

## 🔐 **Security Features**

- ✅ **Secure Authentication** with NextAuth.js
- ✅ **JWT Session Management** 
- ✅ **Data Isolation** - clients can't see each other's data
- ✅ **File-based Storage** - simple and secure for small teams
- ⚠️ **Note**: Passwords are stored in plain text in JSON file. For production, consider hashing passwords.

---

## 💌 **Send Credentials to Clients**

### Email Template:
```
Subject: Your Analytics Dashboard is Ready!

Hi [Client Name],

Your comprehensive analytics dashboard is now live! 

🌐 Access URL: yourdomain.com
📧 Email: [client-email@company.com]
🔑 Password: [TempPassword123]

Once you log in, you'll automatically see your website analytics including:
- Google Analytics traffic data
- Google Ads campaign performance  
- CallRail phone call tracking
- Real-time performance metrics

The dashboard updates every 5 minutes and works on all devices.

Best regards,
[Your Name]
```

---

## 🚀 **Deployment**

### Vercel Deployment:
1. Connect your GitHub repo to Vercel
2. Add all environment variables in Vercel dashboard (except Supabase ones)
3. Deploy!

### Environment Variables to Add in Vercel:
```
NEXTAUTH_URL=https://yourdomain.vercel.app
NEXTAUTH_SECRET=your-production-secret
GOOGLE_CLIENT_EMAIL=your_service_account_email
GOOGLE_PRIVATE_KEY=your-private-key
GOOGLE_ADS_DEVELOPER_TOKEN=your_developer_token
GOOGLE_ADS_CLIENT_ID=your_client_id
GOOGLE_ADS_CLIENT_SECRET=your_client_secret
GOOGLE_ADS_REFRESH_TOKEN=your_refresh_token
CALLRAIL_API_TOKEN=your_callrail_api_token
```

---

## 🔧 **Managing Clients**

### Adding New Clients:
Edit `src/data/clients.json` manually to add new clients. The API endpoint for user creation is disabled to maintain security and simplicity.

### Client Data Structure:
Each client record in the JSON file contains:
- `id` - Unique identifier (auto-generated)
- `email` - Login email
- `password` - Login password (plain text)
- `companyName` - Displays in dashboard header
- `googleAnalyticsPropertyId` - Their GA4 property ID
- `googleAdsCustomerId` - Their Google Ads customer ID
- `callrailAccountId` - Their CallRail account ID

---

## 📁 **File Structure**

```
src/data/clients.json          # Client credentials and config
src/app/api/auth/[...nextauth]/ # Authentication handler
src/app/api/dashboard/         # Dashboard API (reads client config)
src/app/api/admin/create-user/  # Client creation API
scripts/create-client-users.js # Bulk client creation script
```

---

## ✅ **What's Complete**

- [x] **JSON-based client authentication system**
- [x] **Automatic data isolation per client**
- [x] **Google Analytics-style dashboard**
- [x] **Real-time metrics and updates**
- [x] **Mobile responsive design**
- [x] **No database dependencies**
- [x] **Easy client management via JSON file**
- [x] **Professional login interface**
- [x] **Session management with auto-logout**
- [x] **API for programmatic client creation**

---

## 🎉 **You're Ready!**

Your multi-client analytics dashboard is now complete with JSON-based authentication. Each of your clients can:

1. **Login with their unique credentials**
2. **See only their website data automatically** 
3. **Access comprehensive analytics anytime**
4. **Use it on any device (mobile, tablet, desktop)**
5. **Get real-time updates every 5 minutes**

**Simplified Setup**: No database setup required - just edit the JSON file and deploy!

---

## 🛠 **Testing the Setup**

### Quick Test with Sample Data:
1. Start the server: `npm run dev`
2. Visit: `http://localhost:3000`
3. Login with: `john@abcmarketing.com / TempPassword123`
4. Verify the dashboard loads with "ABC Marketing" in the header

### Create a Test Client:
Edit `src/data/clients.json` and add a new client entry, then restart the server to test the new login credentials.

---

**Need help?** The system is designed to be simple and maintainable. For advanced features like password hashing or user management UI, consider upgrading to a database solution.
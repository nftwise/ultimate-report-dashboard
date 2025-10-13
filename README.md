# Ultimate Reporting Dashboard

A comprehensive marketing analytics dashboard that integrates Google Analytics, Google Ads, Google Search Console, and CallRail to provide real-time insights into your marketing performance.

## 🚀 Features

- **Real-time Dashboard**: Live metrics updating every 5 minutes
- **Multi-source Integration**: Google Analytics, Google Ads, Google Search Console, and CallRail
- **Key Metrics**:
  - Website traffic and user behavior
  - Ad spend, CPC, and cost per lead
  - Phone call tracking and attribution
  - Conversion rates across all channels
- **Interactive Charts**: Line, bar, area, and pie charts
- **Data Tables**: Sortable and filterable data views
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Performance Optimized**: Built-in caching and efficient data fetching

## 📊 Dashboard Metrics

### Google Analytics
- Sessions, Users, Pageviews
- Bounce Rate, Session Duration
- Conversions and Goal Completions
- Traffic Sources and Device Data
- Revenue and Ecommerce Metrics

### Google Search Console
- Search Clicks and Impressions
- Click-through Rates (CTR)
- Average Search Position
- Top Search Queries
- Top Performing Pages
- Search Performance Trends

### Google Ads
- Impressions, Clicks, CTR
- Cost Per Click (CPC)
- Cost Per Conversion/Lead
- Phone Call Conversions
- Campaign, Ad Group, and Keyword Performance
- Quality Score and Search Impression Share

### CallRail
- Total Calls, Answered/Missed Calls
- Call Duration and First-time Callers
- Call Source Attribution
- Lead Status and Conversion Rates
- Tracking Number Performance
- Call Recordings and Transcriptions

## 🛠 Tech Stack

- **Frontend**: Next.js 14, React, TypeScript
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **APIs**:
  - Google Analytics Data API v1
  - Google Search Console API v1
  - Google Ads API
  - CallRail REST API
- **Caching**: In-memory cache with TTL
- **Deployment**: Vercel-ready

## 📋 Prerequisites

1. **Google Cloud Project** with the following APIs enabled:
   - Google Analytics Data API
   - Google Ads API
   
2. **Service Account** with appropriate permissions

3. **Google Ads Developer Token**

4. **CallRail Account** with API access

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ultimate-reporting-dashboard
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Fill in your API credentials in `.env.local`:
   ```
   # Google Analytics
   GOOGLE_ANALYTICS_PROPERTY_ID=your_property_id
   
   # Google Ads
   GOOGLE_ADS_DEVELOPER_TOKEN=your_developer_token
   GOOGLE_ADS_CLIENT_ID=your_oauth_client_id
   GOOGLE_ADS_CLIENT_SECRET=your_oauth_client_secret
   GOOGLE_ADS_REFRESH_TOKEN=your_refresh_token
   GOOGLE_ADS_CUSTOMER_ID=your_customer_id
   
   # Google Service Account
   GOOGLE_CLIENT_EMAIL=your_service_account_email
   GOOGLE_PRIVATE_KEY=your_service_account_private_key
   GOOGLE_PROJECT_ID=your_google_cloud_project_id
   
   # CallRail
   CALLRAIL_API_KEY=your_callrail_api_key
   CALLRAIL_ACCOUNT_ID=your_callrail_account_id
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open in browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🔑 API Setup Guide

### Google Analytics Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Google Analytics Data API
4. Create a Service Account:
   - Go to IAM & Admin > Service Accounts
   - Create new service account
   - Download the JSON key file
   - Extract `client_email` and `private_key`
5. In Google Analytics:
   - Go to Admin > Property > Property Access Management
   - Add the service account email as a Viewer

### Google Ads Setup

1. Apply for Google Ads API access
2. Get developer token from Google Ads Manager account
3. Set up OAuth 2.0:
   - Go to Google Cloud Console > APIs & Services > Credentials
   - Create OAuth 2.0 Client ID
   - Use OAuth 2.0 Playground to generate refresh token

### CallRail Setup

1. Log into your CallRail account
2. Go to Integrations > API
3. Generate an API key
4. Note your Account ID from the URL or account settings

## 📱 Dashboard Features

### Time Range Filters
- Today
- 7 Days
- 30 Days
- 90 Days
- Custom date ranges (coming soon)

### Real-time Updates
- Data refreshes automatically every 5 minutes
- Manual refresh capability
- Last updated timestamp display

### Export Options (Coming Soon)
- PDF reports
- CSV data export
- Scheduled email reports

## 🚀 Deployment

### Vercel Deployment

1. **Connect to Vercel**
   ```bash
   npm i -g vercel
   vercel
   ```

2. **Set Environment Variables**
   Add all environment variables in the Vercel dashboard under Project Settings > Environment Variables

3. **Deploy**
   ```bash
   vercel --prod
   ```

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## 🔍 API Endpoints

- `GET /api/dashboard?period=7days` - Main dashboard data
- `GET /api/google-analytics?period=7days&report=basic` - GA metrics
- `GET /api/google-ads?period=7days&report=campaigns` - Google Ads data
- `GET /api/callrail?period=7days&report=calls` - CallRail data

## 🎨 Customization

### Adding New Metrics

1. Update type definitions in `src/types/index.ts`
2. Modify API connectors in `src/lib/`
3. Update dashboard components in `src/components/`
4. Add new API routes if needed

### Styling

- Modify `src/app/globals.css` for global styles
- Update Tailwind classes in components
- Customize color scheme in CSS variables

## 📊 Performance

- **Caching**: 5-minute TTL on API responses
- **Optimization**: Efficient data fetching and rendering
- **Monitoring**: Built-in performance tracking
- **Scalability**: Designed for high-traffic scenarios

## 🔒 Security

- Environment variables for sensitive data
- API rate limiting
- HTTPS enforcement
- Service account authentication

## 🐛 Troubleshooting

### Common Issues

1. **API Authentication Errors**
   - Verify all credentials are correct
   - Check API quotas and limits
   - Ensure service account has proper permissions

2. **No Data Displaying**
   - Check API credentials
   - Verify time range settings
   - Check browser console for errors

3. **Performance Issues**
   - Check API response times
   - Monitor cache hit rates
   - Optimize data queries

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📞 Support

For support and questions:
- Create an issue on GitHub
- Check the troubleshooting guide
- Review API documentation

## 🔄 Roadmap

- [ ] Real-time data streaming
- [ ] Advanced filtering and segmentation
- [ ] Custom dashboard builder
- [ ] Automated reporting
- [ ] Mobile app
- [ ] Data warehouse integration
- [ ] Machine learning insights

---

Built with ❤️ using Next.js and TypeScript

# Deployment Guide for Ultimate Reporting Dashboard

## 🚀 Vercel Deployment Checklist

### Pre-Deployment Steps

- [ ] Test build locally: `npm run build`
- [ ] Test production start: `npm start`
- [ ] Verify all environment variables are set
- [ ] Update NEXTAUTH_URL to production domain
- [ ] Test all API endpoints are working

### Required Environment Variables

Copy these to Vercel Dashboard → Settings → Environment Variables:

```bash
# Google Analytics
GOOGLE_CLIENT_EMAIL=analysis-api@uplifted-triode-432610-r7.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour_Private_Key_Here\n-----END PRIVATE KEY-----"
GOOGLE_PROJECT_ID=uplifted-triode-432610-r7
GOOGLE_ANALYTICS_PROPERTY_ID=326814792

# Google Ads (Optional - currently limited to test accounts)
GOOGLE_ADS_DEVELOPER_TOKEN=your_developer_token
GOOGLE_ADS_CLIENT_ID=your_client_id
GOOGLE_ADS_CLIENT_SECRET=your_client_secret
GOOGLE_ADS_REFRESH_TOKEN=your_refresh_token
GOOGLE_ADS_CUSTOMER_ID=2812810609

# CallRail
CALLRAIL_API_TOKEN=9a921de293dee5561bf963e3a13cc81e
CALLRAIL_ACCOUNT_ID=ACCe5277425fcef4c6cbc46addc72f11323

# NextAuth (IMPORTANT - Generate new secret for production)
NEXTAUTH_SECRET=generate_with_openssl_rand_base64_32
NEXTAUTH_URL=https://your-vercel-app.vercel.app
```

### Deployment Commands

```bash
# Method 1: Vercel CLI
npm install -g vercel
vercel login
vercel

# Method 2: Git + Vercel Dashboard
git add .
git commit -m "Deploy to production"
git push origin main
# Then import from GitHub in Vercel Dashboard
```

### Post-Deployment Steps

- [ ] Verify deployment at provided URL
- [ ] Test login with client credentials
- [ ] Verify Google Analytics data loads
- [ ] Verify CallRail data loads
- [ ] Check all time period filters work
- [ ] Test responsive design on mobile

### Troubleshooting

**Build Errors:**
- Check TypeScript compilation: `npx tsc --noEmit`
- Verify all imports are correct
- Check for any missing dependencies

**Runtime Errors:**
- Check Vercel function logs
- Verify environment variables are set correctly
- Test API endpoints individually

**Authentication Issues:**
- Verify NEXTAUTH_SECRET is set
- Check NEXTAUTH_URL matches your domain
- Ensure client data in `/src/data/clients.json` is valid

### Production Optimizations

**Security:**
- [ ] Use strong NEXTAUTH_SECRET (32+ characters)
- [ ] Verify API keys are not exposed in client code
- [ ] Check that private keys are properly escaped

**Performance:**
- [ ] Enable Vercel Analytics
- [ ] Monitor API response times
- [ ] Consider implementing caching for API responses

**Monitoring:**
- [ ] Set up error tracking (Sentry)
- [ ] Monitor API quotas (Google Analytics/CallRail)
- [ ] Set up uptime monitoring

## 📊 Current Features in Production

✅ **Google Analytics Integration**: Live data from 15K+ sessions
✅ **CallRail Integration**: Real-time call tracking and metrics  
✅ **Multi-Client Authentication**: JSON-based client management
✅ **Responsive Dashboard**: Works on all devices
✅ **Real-Time Updates**: Auto-refresh every 5 minutes
✅ **Trends & Insights**: Week/month-over-month comparisons

❌ **Google Ads**: Limited to test accounts (requires Standard access approval)

## 🔒 Security Notes

- All API keys are server-side only
- Client passwords in JSON file should be hashed in production
- NEXTAUTH_SECRET must be unique and secure
- Consider implementing rate limiting for API endpoints

## 📈 Scaling Considerations

- Current setup supports 50+ clients
- CallRail API has rate limits - monitor usage
- Google Analytics API has daily quotas
- Consider Redis for caching at scale
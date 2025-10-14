# Automatic Deployment Setup Guide

## Overview
This guide will help you set up automatic deployment from GitHub to Vercel. Every time you push code to the `main` branch, it will automatically deploy to production.

---

## Prerequisites

- GitHub account with repository access
- Vercel account connected to your GitHub
- All environment variables ready

---

## Step 1: Setup GitHub Secrets

You need to add the following secrets to your GitHub repository:

1. Go to your GitHub repository: `https://github.com/nftwise/ultimate-report-dashboard`
2. Click **Settings** > **Secrets and variables** > **Actions**
3. Click **New repository secret** and add each of these:

### Required GitHub Secrets:

| Secret Name | Description | Where to Find |
|------------|-------------|---------------|
| `VERCEL_TOKEN` | Vercel API token | Vercel Dashboard > Settings > Tokens |
| `VERCEL_ORG_ID` | Your Vercel organization ID | Already have: `team_shx071glXN8SSnRSYE0B9fIQ` |
| `VERCEL_PROJECT_ID` | Your Vercel project ID | Already have: `prj_lqBXx2jkViNE46uX96L1PQYpJVzM` |
| `NEXTAUTH_URL` | Your production URL | `https://your-app.vercel.app` |
| `NEXTAUTH_SECRET` | NextAuth secret key | Generate with: `openssl rand -base64 32` |
| `GOOGLE_CLIENT_EMAIL` | Google service account email | From your .env.local |
| `GOOGLE_PRIVATE_KEY` | Google private key | From your .env.local |
| `GOOGLE_PROJECT_ID` | Google Cloud project ID | From your .env.local |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Google Ads API token | From your .env.local |
| `GOOGLE_ADS_CLIENT_ID` | Google Ads OAuth client ID | From your .env.local |
| `GOOGLE_ADS_CLIENT_SECRET` | Google Ads OAuth secret | From your .env.local |
| `GOOGLE_ADS_REFRESH_TOKEN` | Google Ads refresh token | From your .env.local |
| `CALLRAIL_API_TOKEN` | CallRail API token | From your .env.local |

### How to Get Your Vercel Token:

```bash
# Option 1: Via CLI
npx vercel login
npx vercel token create

# Option 2: Via Dashboard
# Go to: https://vercel.com/account/tokens
# Click "Create Token"
# Name it "GitHub Actions"
# Copy the token
```

---

## Step 2: Configure Vercel Dashboard

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project: `ultimate-report-dashboard`
3. Go to **Settings** > **Environment Variables**
4. Add all environment variables for **Production**, **Preview**, and **Development**:

### Environment Variables to Add in Vercel:

```bash
NEXTAUTH_URL=https://your-app.vercel.app
NEXTAUTH_SECRET=your-generated-secret-key

GOOGLE_CLIENT_EMAIL=your-service-account-email
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour_Private_Key\n-----END PRIVATE KEY-----"
GOOGLE_PROJECT_ID=your-project-id

GOOGLE_ADS_DEVELOPER_TOKEN=your-token
GOOGLE_ADS_CLIENT_ID=your-client-id
GOOGLE_ADS_CLIENT_SECRET=your-client-secret
GOOGLE_ADS_REFRESH_TOKEN=your-refresh-token

CALLRAIL_API_TOKEN=your-callrail-token
```

5. **Important**: Make sure to select all environments (Production, Preview, Development) for each variable

---

## Step 3: Configure Vercel Git Integration

1. In Vercel Dashboard, go to your project
2. Click **Settings** > **Git**
3. Ensure your GitHub repository is connected
4. **Production Branch**: Set to `main`
5. Enable **Automatic Deployments from GitHub**

### Deployment Settings:

- **Production Branch**: `main`
- **Auto Deploy**: Enabled
- **Branch Deployments**: Enabled (optional for preview deployments)
- **Deployment Protection**: Configure as needed

---

## Step 4: Push Your Changes

Now that everything is configured, push the deployment setup to GitHub:

```bash
# Add all new files
git add .

# Commit the changes
git commit -m "Setup automatic deployment with GitHub Actions and Vercel"

# Push to GitHub
git push origin main
```

---

## Step 5: Verify Automatic Deployment

After pushing, you should see:

1. **GitHub Actions**:
   - Go to your repo > **Actions** tab
   - You should see a workflow running
   - It will build and deploy to Vercel

2. **Vercel Dashboard**:
   - Go to your project dashboard
   - You should see a new deployment in progress
   - Once complete, you'll get a production URL

---

## How Automatic Deployment Works

### On Push to Main Branch:
1. GitHub Actions triggers the workflow
2. Checks out your code
3. Installs dependencies (`npm ci`)
4. Runs linter (`npm run lint`)
5. Builds the project (`npm run build`)
6. Deploys to Vercel Production (`vercel --prod`)

### On Pull Request:
1. Same steps as above
2. Deploys to Vercel Preview (preview URL)
3. Adds deployment URL as comment on PR

---

## Testing Your Setup

### Test 1: Make a Small Change
```bash
# Edit README.md or any file
echo "Test deployment" >> README.md

# Commit and push
git add README.md
git commit -m "Test automatic deployment"
git push origin main
```

### Test 2: Check Deployment
1. Go to GitHub Actions tab - should see workflow running
2. Go to Vercel dashboard - should see new deployment
3. Once complete, visit your production URL

---

## Troubleshooting

### Build Fails in GitHub Actions

**Check:**
- All GitHub secrets are added correctly
- No typos in secret names
- GOOGLE_PRIVATE_KEY includes the full key with `\n` for line breaks

**Fix:**
```bash
# Regenerate NEXTAUTH_SECRET
openssl rand -base64 32

# Update in GitHub Secrets and Vercel
```

### Deployment Fails in Vercel

**Check:**
1. Vercel Dashboard > Project > Settings > Environment Variables
2. Ensure all variables are set for Production environment
3. Check deployment logs for specific errors

**Common Issues:**
- Missing environment variables
- Incorrect NEXTAUTH_URL (must match your Vercel URL)
- Google Private Key not properly escaped

### GitHub Actions Can't Access Secrets

**Check:**
1. Secrets are added in the correct repository
2. Secret names match exactly (case-sensitive)
3. Workflow file is in `.github/workflows/` directory

---

## Deployment Workflow Diagram

```
┌─────────────────┐
│  Push to Main   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ GitHub Actions  │
│   Triggered     │
└────────┬────────┘
         │
         ├─── Install Dependencies
         ├─── Run Linter
         ├─── Build Project
         │
         ▼
┌─────────────────┐
│ Deploy to Vercel│
│   (Production)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Live on Web    │
│ your-app.vercel │
└─────────────────┘
```

---

## Best Practices

### 1. Branch Protection
- Set up branch protection rules for `main`
- Require PR reviews before merging
- Require status checks to pass

### 2. Environment Management
- Keep `.env.local` file locally (never commit it)
- Use different secrets for development/production
- Rotate API keys regularly

### 3. Monitoring
- Check Vercel deployment logs regularly
- Monitor GitHub Actions for failed builds
- Set up Vercel deployment notifications

### 4. Security
- Never commit `.env` files
- Use strong NEXTAUTH_SECRET
- Regularly update dependencies

---

## Quick Reference Commands

```bash
# Build locally before pushing
npm run build

# Test production build locally
npm run start

# Check for linting errors
npm run lint

# Install Vercel CLI
npm i -g vercel

# Link to Vercel project
vercel link

# Pull environment variables from Vercel
vercel env pull

# Deploy manually (if needed)
vercel --prod
```

---

## Next Steps

After successful deployment:

1. ✅ Test all dashboard features on production
2. ✅ Verify Google Analytics data loads
3. ✅ Test CallRail integration
4. ✅ Check authentication with client credentials
5. ✅ Test on mobile devices
6. ✅ Set up custom domain (optional)
7. ✅ Configure Vercel Analytics
8. ✅ Set up monitoring/alerts

---

## Support

If you encounter issues:

1. Check GitHub Actions logs: `https://github.com/nftwise/ultimate-report-dashboard/actions`
2. Check Vercel deployment logs: Vercel Dashboard > Deployments > Click on deployment
3. Review this guide's troubleshooting section
4. Check Vercel and Next.js documentation

---

## Files Created/Modified

- ✅ `.github/workflows/deploy.yml` - GitHub Actions workflow
- ✅ `vercel.json` - Vercel configuration
- ✅ `.gitignore` - Updated to ignore common files
- ✅ `AUTO_DEPLOYMENT_GUIDE.md` - This guide

---

**Your automatic deployment is now configured!** 🚀

Every push to `main` will automatically deploy to production.

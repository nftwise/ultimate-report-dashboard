# Quick Setup Checklist for Automatic Deployment

Follow these steps in order to enable automatic deployment:

## ✅ Step 1: Get Your Vercel Information

You already have a Vercel project connected! Here's your info:

- **Project ID**: `prj_lqBXx2jkViNE46uX96L1PQYpJVzM`
- **Org ID**: `team_shx071glXN8SSnRSYE0B9fIQ`
- **GitHub Repo**: `https://github.com/nftwise/ultimate-report-dashboard`

## ✅ Step 2: Create Vercel Token

```bash
# Run this command and follow prompts:
npx vercel token create github-actions

# Or visit: https://vercel.com/account/tokens
# Click "Create Token" and name it "GitHub Actions"
```

**Copy the token** - you'll need it in the next step!

## ✅ Step 3: Add GitHub Secrets

Go to: `https://github.com/nftwise/ultimate-report-dashboard/settings/secrets/actions`

Click **"New repository secret"** and add these:

### Essential Secrets (Required):

```
Name: VERCEL_TOKEN
Value: [Paste token from Step 2]

Name: VERCEL_ORG_ID
Value: team_shx071glXN8SSnRSYE0B9fIQ

Name: VERCEL_PROJECT_ID
Value: prj_lqBXx2jkViNE46uX96L1PQYpJVzM

Name: NEXTAUTH_SECRET
Value: [Run: openssl rand -base64 32]

Name: NEXTAUTH_URL
Value: https://ultimate-report-dashboard.vercel.app
```

### API Secrets (Copy from your .env.local):

```
Name: GOOGLE_CLIENT_EMAIL
Value: [Your service account email]

Name: GOOGLE_PRIVATE_KEY
Value: [Your private key - include -----BEGIN/END----- lines]

Name: GOOGLE_PROJECT_ID
Value: [Your Google Cloud project ID]

Name: GOOGLE_ADS_DEVELOPER_TOKEN
Value: [Your Google Ads token]

Name: GOOGLE_ADS_CLIENT_ID
Value: [Your OAuth client ID]

Name: GOOGLE_ADS_CLIENT_SECRET
Value: [Your OAuth client secret]

Name: GOOGLE_ADS_REFRESH_TOKEN
Value: [Your refresh token]

Name: CALLRAIL_API_TOKEN
Value: [Your CallRail API token]
```

## ✅ Step 4: Push Changes to GitHub

```bash
# Check what files changed
git status

# Add all files
git add .

# Commit with a message
git commit -m "Setup automatic deployment to Vercel"

# Push to GitHub (this will trigger first deployment!)
git push origin main
```

## ✅ Step 5: Watch It Deploy

After pushing:

1. **GitHub**: Go to `https://github.com/nftwise/ultimate-report-dashboard/actions`
   - You should see a workflow running

2. **Vercel**: Go to `https://vercel.com/dashboard`
   - Select your project
   - You should see a new deployment

## ✅ Step 6: Verify Production

Once deployment completes:

1. Visit your production URL
2. Test login with client credentials
3. Check that all data loads correctly

---

## What Happens Now?

**Every time you push to main:**
1. GitHub Actions automatically runs
2. Builds your project
3. Deploys to Vercel production
4. Your site updates automatically

**On Pull Requests:**
1. Creates a preview deployment
2. You can test changes before merging

---

## Quick Test After Setup

```bash
# Make a small change
echo "# Deployed with automatic deployment" >> README.md

# Commit and push
git add README.md
git commit -m "Test automatic deployment"
git push origin main

# Watch: https://github.com/nftwise/ultimate-report-dashboard/actions
```

---

## Need the Full Guide?

See [AUTO_DEPLOYMENT_GUIDE.md](AUTO_DEPLOYMENT_GUIDE.md) for detailed instructions and troubleshooting.

---

## Troubleshooting

### "VERCEL_TOKEN not found"
- Make sure you added the secret in GitHub repo settings
- Secret name must be exactly `VERCEL_TOKEN` (case-sensitive)

### Build fails
- Check GitHub Actions logs for specific error
- Verify all secrets are added correctly

### Can't login after deployment
- Check NEXTAUTH_URL matches your Vercel URL
- Verify NEXTAUTH_SECRET is set

---

**That's it!** Your automatic deployment is ready! 🎉

#!/bin/bash

# Setup Vercel Environment Variables
# This script adds missing environment variables to Vercel

echo "🔧 Setting up Vercel Environment Variables"
echo "=========================================="
echo ""

# Load .env.local to get values
if [ ! -f .env.local ]; then
    echo "❌ Error: .env.local not found"
    exit 1
fi

# Source the .env.local file to get values
export $(grep -v '^#' .env.local | xargs)

echo "📝 Adding missing environment variables to Vercel..."
echo ""

# Add GOOGLE_SEARCH_CONSOLE_SITE_URL
echo "Adding GOOGLE_SEARCH_CONSOLE_SITE_URL..."
echo "${GOOGLE_SEARCH_CONSOLE_SITE_URL}" | vercel env add GOOGLE_SEARCH_CONSOLE_SITE_URL production

# Add GOOGLE_ADS_MCC_ID
echo "Adding GOOGLE_ADS_MCC_ID..."
echo "${GOOGLE_ADS_MCC_ID}" | vercel env add GOOGLE_ADS_MCC_ID production

echo ""
echo "✅ Environment variables added to Vercel!"
echo ""
echo "📋 Next steps:"
echo "1. Add service account to Search Console (see FIX_SEARCH_CONSOLE.md)"
echo "2. Wait 5-10 minutes for Search Console permissions"
echo "3. Deploy: npx vercel --prod"
echo "4. Test the live deployment"
echo ""

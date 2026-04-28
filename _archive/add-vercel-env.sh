#!/bin/bash

echo "🔧 Adding missing environment variables to Vercel (all environments)"
echo "=================================================================="
echo ""

cd "/Users/trieu/Desktop/VS CODE/ultimate-report-dashboard"

# Add GOOGLE_SEARCH_CONSOLE_SITE_URL to all environments
echo "1️⃣ Adding GOOGLE_SEARCH_CONSOLE_SITE_URL..."
echo "   Value: https://drdigrado.com"
echo ""

echo "https://drdigrado.com" | npx vercel env add GOOGLE_SEARCH_CONSOLE_SITE_URL development
echo "https://drdigrado.com" | npx vercel env add GOOGLE_SEARCH_CONSOLE_SITE_URL preview

echo ""
echo "2️⃣ Adding GOOGLE_ADS_MCC_ID..."
echo "   Value: 8432700368"
echo ""

echo "8432700368" | npx vercel env add GOOGLE_ADS_MCC_ID development
echo "8432700368" | npx vercel env add GOOGLE_ADS_MCC_ID preview

echo ""
echo "✅ All environment variables added!"
echo ""
echo "📝 Verifying..."
npx vercel env ls | grep -E "(GOOGLE_SEARCH_CONSOLE|GOOGLE_ADS_MCC)"
echo ""
echo "🚀 Ready to deploy: npx vercel --prod"

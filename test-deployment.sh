#!/bin/bash

DEPLOYMENT_URL="https://ultimate-report-dashboard-k0vomxsl7-my-chiropractices-projects.vercel.app"

echo "🧪 Testing Vercel Deployment"
echo "=========================================="
echo "URL: $DEPLOYMENT_URL"
echo ""

echo "1️⃣ Testing Google Ads API Diagnose Endpoint..."
echo "   URL: $DEPLOYMENT_URL/api/google-ads/diagnose"
echo ""
curl -s "$DEPLOYMENT_URL/api/google-ads/diagnose" | head -100
echo ""
echo ""

echo "2️⃣ Testing Google Ads API Status..."
echo "   URL: $DEPLOYMENT_URL/api/google-ads?report=status"
echo ""
curl -s "$DEPLOYMENT_URL/api/google-ads?report=status"
echo ""
echo ""

echo "3️⃣ Testing Search Console API Status..."
echo "   URL: $DEPLOYMENT_URL/api/search-console?clientId=client-007&type=status"
echo ""
curl -s "$DEPLOYMENT_URL/api/search-console?clientId=client-007&type=status"
echo ""
echo ""

echo "=========================================="
echo "✅ Testing complete!"
echo ""
echo "🌐 Visit the dashboard at:"
echo "   $DEPLOYMENT_URL/login"
echo ""
echo "Login with:"
echo "   Email: admin@mychiropractice.com"
echo "   Password: MyPassword123"
echo ""

#!/bin/bash

# Navigate to project directory
cd "/Users/trieu/Desktop/VS CODE/ultimate-report-dashboard"

# Show current status
echo "📊 Current Git Status:"
git status --short

echo ""
echo "📁 Files to be committed:"
git status --short | wc -l
echo ""

# Add all files
echo "➕ Adding files..."
git add .

# Commit
echo "💾 Committing changes..."
git commit -m "Add deployment automation and documentation"

# Push to GitHub
echo "🚀 Pushing to GitHub..."
git push origin main

echo ""
echo "✅ Done! Check your deployment at:"
echo "   Vercel: https://vercel.com/dashboard"
echo "   Live Site: https://ultimate-report-dashboard.vercel.app"

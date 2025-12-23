#!/bin/bash
# Check Vercel logs for Search Console errors

echo "Fetching recent Vercel logs for Search Console API calls..."
npx vercel logs ultimate-report-dashboard-qre6e38f6-my-chiropractices-projects.vercel.app --since 10m 2>&1 | grep -A 5 -B 5 -i "search\|console\|webmasters\|error\|401"

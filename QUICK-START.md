# 🚀 Quick Start - Get Running in 5 Minutes

## Step 1: Add Your Clients (2 minutes)

Open this file:
```
src/data/clients.json
```

You'll see 8 test clients already there. **Add your real 25 clients** like this:

```json
{
  "clients": [
    {
      "id": "dr-digrado",
      "companyName": "Dr DiGrado Chiropractic",
      "googleAnalyticsPropertyId": "326814792",
      "googleAdsCustomerId": "2812810609",
      "googleAdsMccId": "8432700368",
      "callrailAccountId": "ACCe5277425fcef4c6cbc46addc72f11323"
    },
    {
      "id": "polished-cary",
      "companyName": "Polished Cary Nail Salon",
      "googleAnalyticsPropertyId": "YOUR_GA_ID_HERE",
      "googleAdsCustomerId": "YOUR_ADS_ID_HERE",
      "googleAdsMccId": "8432700368",
      "callrailAccountId": "YOUR_CALLRAIL_ID_HERE"
    }
    ... add all 25 clients ...
  ]
}
```

**Save the file.**

---

## Step 2: Start Dashboard (1 minute)

Open Terminal and run:

```bash
cd "/Users/trieu/Desktop/VS CODE/ultimate-report-dashboard"
npm run dev
```

Wait for:
```
✓ Ready in 2.5s
○ Local:   http://localhost:3000
```

---

## Step 3: Open Admin Dashboard (30 seconds)

In your browser, go to:

```
http://localhost:3000/admin-dashboard
```

---

## Step 4: Select a Client (10 seconds)

You'll see:
```
┌──────────────────────────────────┐
│ Viewing Dashboard For:           │
│ [Dr DiGrado ▼]                   │
│                                   │
│ Dropdown shows all clients:      │
│  • Dr DiGrado Chiropractic       │
│  • Polished Cary Nail Salon      │
│  • ABC Law Firm                  │
│  • ... all your clients          │
└──────────────────────────────────┘
```

**Click dropdown → Select any client → See their dashboard!**

---

## Step 5: Switch Clients (10 seconds)

Click dropdown again → Select different client → See NEW data!

**Done!** 🎉

---

## 📊 What You Can Do Now

✅ View any client's dashboard
✅ Switch between all 25+ clients instantly
✅ See real-time data for each client
✅ Add new clients by editing `clients.json`

---

## 🔍 Where to Find Client IDs

You need these for each client:

| ID | Where to Find |
|----|---------------|
| **Google Analytics Property ID** | GA4 → Admin → Property Settings → Copy the number |
| **Google Ads Customer ID** | Google Ads → Top right corner (looks like 123-456-7890) |
| **MCC ID** | Your manager account (same for all clients you manage) |
| **CallRail Account ID** | CallRail → Settings → Account Info |

---

## 🐛 Problems?

### "Can't find page"
- Make sure dev server is running: `npm run dev`
- Check URL is: `http://localhost:3000/admin-dashboard`

### "Dropdown is empty"
- Check `clients.json` has valid JSON
- Restart dev server: Stop (Ctrl+C) → Start again (`npm run dev`)

### "No data showing"
- Check client's IDs are correct in `clients.json`
- Verify APIs are connected

---

## 📖 Full Documentation

See [MULTI-CLIENT-SETUP-GUIDE.md](MULTI-CLIENT-SETUP-GUIDE.md) for:
- Complete explanations
- Security setup
- Login system
- Advanced features
- Troubleshooting

---

**You're ready to go!** Open the admin dashboard and start viewing your clients! 🚀

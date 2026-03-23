# Facebook Section + Google Sheets Auto-Sync Setup Guide

**Goal**: Auto-sync Facebook leads to per-client Google Sheets in real-time

---

## 🔧 Part 1: Get Google Service Account Credentials

### Step 1: Create Google Cloud Project
1. Go: https://console.cloud.google.com/
2. Click **"Select a Project"** (top)
3. Click **"NEW PROJECT"**
4. Name: `Facebook Leads Dashboard`
5. Click **CREATE**
6. Wait for project to load

### Step 2: Enable Google Sheets API
1. In Google Cloud console, search bar: **"Google Sheets API"**
2. Click **Google Sheets API**
3. Click **ENABLE**
4. Wait for it to finish

### Step 3: Create Service Account
1. Go: https://console.cloud.google.com/iam-admin/serviceaccounts
2. Click **CREATE SERVICE ACCOUNT**
3. **Service account name**: `facebook-leads-sync`
4. **Service account ID**: `facebook-leads-sync`
5. Click **CREATE AND CONTINUE**
6. **Grant this service account access to project**: Skip (click **CONTINUE**)
7. Click **CREATE KEY** (bottom)
   - Key type: **JSON**
   - Click **CREATE**
8. ✅ A JSON file downloads automatically
   - **SAVE THIS FILE** — you'll need it

### Step 4: Get JSON Key Content
1. Open the downloaded JSON file with text editor
2. Copy **entire content** (⌘A → ⌘C)
3. Keep it safe — you'll paste into Vercel env vars

---

## 📋 Part 2: Run SQL Migration

**In Supabase Dashboard:**

1. Go: https://app.supabase.com/
2. Click your project
3. **SQL Editor** (left sidebar)
4. **New Query**
5. Copy-paste this:

```sql
ALTER TABLE service_configs
ADD COLUMN fb_sheet_id TEXT;
```

6. Click **RUN**
7. ✅ Should see success message

---

## 🌍 Part 3: Add Env Variables to Vercel

**In Vercel Dashboard:**

1. Go: https://vercel.com/your-team/ultimate-report-dashboard
2. **Settings** → **Environment Variables**
3. Add this variable:

```
Name: GOOGLE_SHEETS_SERVICE_KEY
Value: [paste the JSON content from Step 4 above]
Environments: Production, Preview, Development
→ Save
```

**IMPORTANT**: Paste the ENTIRE JSON file content as the value (it's one long string)

---

## 🚀 Part 4: Test Setup

### Test 1: Create Google Sheet for a Client

```bash
# Call the setup endpoint
curl -X POST https://your-domain.com/api/facebook/sheets/setup \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "YOUR-CLIENT-UUID-HERE"
  }'
```

**Response should be:**
```json
{
  "success": true,
  "sheetId": "1A2B3C4D5E6F...",
  "sheetUrl": "https://docs.google.com/spreadsheets/d/1A2B3C4D5E6F..."
}
```

✅ Click the sheetUrl → verify Google Sheet created with headers:
- Name, Phone, Email, Lead Source, Ad Name, Campaign, Status, Created Date, Last Contact, Notes

### Test 2: Add a Lead (Auto-Sync Test)

```bash
curl -X POST https://your-domain.com/api/facebook/leads \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "YOUR-CLIENT-UUID-HERE",
    "leadSource": "manual",
    "phone": "+16175551234",
    "name": "John Doe",
    "email": "john@example.com",
    "adName": "Spring Promo",
    "campaignName": "Q2 Campaign"
  }'
```

**Then check Google Sheet:**
- Go to the Sheet URL from Test 1
- Refresh the page
- ✅ New row should appear with your lead data

### Test 3: Update Lead Status (Auto-Sync Test)

```bash
curl -X PATCH https://your-domain.com/api/facebook/leads/[lead-id] \
  -H "Content-Type: application/json" \
  -d '{
    "status": "responded",
    "notes": "Customer is interested"
  }'
```

**Then check Google Sheet:**
- Refresh
- ✅ Status column should update to "responded"
- ✅ Notes should appear in the Notes column

---

## ✅ Checklist

- [ ] Google Cloud Project created
- [ ] Google Sheets API enabled
- [ ] Service Account created
- [ ] JSON key downloaded and saved
- [ ] SQL migration run (`fb_sheet_id` column added)
- [ ] Vercel env var `GOOGLE_SHEETS_SERVICE_KEY` added
- [ ] Test 1: Create Sheet for client ✓
- [ ] Test 2: Add lead → appears in Sheet ✓
- [ ] Test 3: Update status → syncs to Sheet ✓

---

## 🔄 How It Works

```
User adds lead via API
    ↓
Lead saved to Supabase (fb_leads table)
    ↓
Auto-sync triggered (non-blocking):
  1. Check if client has fb_sheet_id configured
  2. If yes → append row to Google Sheet
  3. If no → skip (user can set up later)
    ↓
Response returned immediately (don't wait for sync)
```

**If sync fails**, lead is still saved to database. Sync happens in background and won't block the API.

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| "GOOGLE_SHEETS_SERVICE_KEY not found" | Make sure env var is added to Vercel (not just local) |
| "Invalid JSON in service key" | Copy-paste entire JSON file without line breaks |
| Lead added but not in Sheet | Check if `fb_sheet_id` is set for client (run Test 1 first) |
| "Sheets API error 403" | Google Service Account may not have Sheets API enabled |
| "Sheet not found" | Check Sheet ID is correct in database |

---

## 📞 Support

If issues arise:
1. Check Vercel logs: `vercel logs --follow`
2. Check Supabase logs: SQL Editor
3. Verify env var is set: `vercel env list`

---

**All set!** Now:
- Leads auto-sync to per-client Google Sheets
- Status updates sync automatically
- Each client gets their own Sheet
- Clients can share Sheet with their team

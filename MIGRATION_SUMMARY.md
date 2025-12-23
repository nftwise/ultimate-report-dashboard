# Migration Summary: JSON to Database

## ✅ What's Been Done

### 1. Created Migration Scripts
- `scripts/migrate-step1-add-columns.sql` - SQL to add city/owner columns
- `scripts/migrate-json-to-db-v2.ts` - Complete migration script
- `scripts/check-data-sources.ts` - Verification tool

### 2. Updated Code
- ✅ `src/lib/server-utils.ts` - Now reads from database first, falls back to JSON
- ✅ Maintains backwards compatibility during migration

### 3. Documentation
- ✅ `MIGRATION_GUIDE.md` - Step-by-step migration instructions
- ✅ `MIGRATION_SUMMARY.md` - This file

## 🚀 How to Run the Migration

### Step 1: Add Database Columns

Open Supabase Dashboard → SQL Editor and run:

```sql
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS owner TEXT;
```

### Step 2: Run Migration

```bash
cd "/Users/trieu/Desktop/VS CODE/ultimate-report-dashboard"
npx tsx scripts/migrate-json-to-db-v2.ts
```

Expected output:
- ✅ 10 clients updated with city/owner from JSON
- ✅ Service configs synced for all clients
- ⚠️ 18 database-only clients will still need city data

### Step 3: Add City Data for Remaining Clients

You can add city data for the 18 remaining clients by running SQL:

```sql
-- Example:
UPDATE clients SET
  city = 'City Name, State',
  owner = 'Owner Name'
WHERE slug = 'client-slug';
```

Or use Supabase dashboard to edit directly.

### Step 4: Verify

Visit your admin dashboard at http://localhost:3000/admin and check:
- ✅ All clients appear
- ✅ Google Rank column shows values (not "-") for clients with city data
- ✅ Keywords column shows counts

## 📊 Current Status

### Data Sources
- **Before Migration**: Hybrid (Database + JSON file)
- **After Step 2**: Database-first with JSON fallback
- **After Step 3**: Database only (can remove JSON)

### Client Coverage
- **10 clients**: Will have city data immediately after migration
- **18 clients**: Need manual city entry (database-only clients)
- **Total**: 28 active clients

## 🎯 Benefits After Migration

1. **Google Rank filtering works** - City data available for keyword filtering
2. **Single source of truth** - All data in database
3. **Better performance** - No file system reads
4. **Easier management** - Use Supabase dashboard or admin panel
5. **Scalable** - Easy to add new clients

## 📝 Files Changed

### New Files:
- `scripts/migrate-step1-add-columns.sql`
- `scripts/migrate-json-to-db-v2.ts`
- `scripts/check-data-sources.ts`
- `MIGRATION_GUIDE.md`
- `MIGRATION_SUMMARY.md`

### Modified Files:
- `src/lib/server-utils.ts` - Updated to read from database

### Unchanged Files:
- `src/data/clients.json` - Kept as backup, still works as fallback

## 🔧 Testing Checklist

After running migration:

- [ ] Run migration script successfully
- [ ] No errors in console
- [ ] Admin dashboard loads
- [ ] Client list shows all 28 clients
- [ ] Google Rank shows values for clients with city
- [ ] Keywords column shows counts
- [ ] GBP Calls shows data for connected clients
- [ ] Individual client dashboards work

## 🆘 Troubleshooting

### Issue: "city and/or owner columns do not exist"
**Solution**: Run Step 1 SQL in Supabase dashboard first

### Issue: Migration shows errors
**Solution**: Check Supabase connection in `.env.local`

### Issue: Google Rank still shows "-"
**Solution**: Client needs city data (Step 3)

### Issue: Dashboard doesn't load
**Solution**: Check browser console and server logs

## 📞 Next Steps

1. Run the migration (Steps 1-2)
2. Add city data for remaining 18 clients (Step 3)
3. Test thoroughly (Testing Checklist)
4. Once confirmed working, you can remove JSON fallback code
5. Consider adding city data to client onboarding flow

## 🎉 You're All Set!

After migration, your admin dashboard will have:
- ✅ Complete client data in database
- ✅ Google Rank filtering for chiropractor keywords
- ✅ Keywords count for all top 10 keywords
- ✅ GBP Calls from Google Business Profile
- ✅ Better performance and scalability

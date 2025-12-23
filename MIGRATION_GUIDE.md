# Migration Guide: JSON to Database

This guide will help you migrate all client data from `clients.json` to Supabase database.

## Why Migrate?

- ✅ Single source of truth (database only)
- ✅ Better performance (no file reads)
- ✅ Easier to manage
- ✅ All 28 clients will have complete data
- ✅ Google Rank filtering will work for all clients

## Migration Steps

### Step 1: Add Columns to Database

Go to your Supabase Dashboard → SQL Editor and run:

```sql
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS owner TEXT;
```

### Step 2: Run Migration Script

```bash
cd /Users/trieu/Desktop/VS\ CODE/ultimate-report-dashboard
npx tsx scripts/migrate-json-to-db-v2.ts
```

This will:
- Update 10 existing clients with city and owner data from JSON
- Update/insert service_configs for all clients
- Show summary of what was migrated

### Step 3: Add City Data for Remaining 18 Clients

The 18 database-only clients will still need city information. You can:

**Option A:** Add them manually in Supabase dashboard
**Option B:** Create a CSV and import
**Option C:** Add them via SQL:

```sql
UPDATE clients SET city = 'City Name, State', owner = 'Owner Name' WHERE slug = 'client-slug';
```

### Step 4: Update getClientConfig Function

After migration, update the code to read from database instead of JSON:

File: `src/lib/server-utils.ts`

Replace current implementation with database query (we'll do this next).

### Step 5: Test

Visit the admin dashboard and verify:
- All clients show up
- Google Rank column works (shows values, not "-")
- All data is correct

## Rollback Plan

If something goes wrong:
1. The original `clients.json` file is not modified
2. You can restore by running the migration again
3. Database backups are available in Supabase

## Files Created

- `scripts/migrate-step1-add-columns.sql` - SQL to add columns
- `scripts/migrate-json-to-db-v2.ts` - Main migration script
- `MIGRATION_GUIDE.md` - This file

## Support

If you encounter issues, check:
1. Supabase connection string is correct in `.env.local`
2. Service role key has proper permissions
3. Columns were added successfully (Step 1)

# SOP: Automated Backfill Protocol

## 1. Overview
This SOP defines the deterministic process for backfilling historical marketing data into the Supabase database.

## 2. Inputs
- `start_date`: YYYY-MM-DD
- `end_date`: YYYY-MM-DD
- `channels`: [ga4, ads, gsc, callrail, gbp]
- `client_ids`: Optional list of specific clients

## 3. Sequence (Deterministic Loop)
For each `date` in range [`start_date`, `end_date`]:
1. **Initialize:** Log job start in `task_progress` table.
2. **Fetch:**
    - Call GA4 Connector for events (Form Leads).
    - Call Google Ads Connector for Spend, Impressions, Conversions.
    - Call GSC for average position and queries.
    - Call GBP for phone actions.
3. **Calculate:**
    - `total_leads` = GA4 Leads + Ads Conversions + GBP Calls.
    - `CPL` = Ads Spend / `total_leads`.
4. **Persist:**
    - Use `upsert` in `client_metrics_summary` to prevent duplicates.
    - Conflict key: `(client_id, date, period_type)`.
5. **Verify:**
    - Query Supabase for the just-written row.
    - Log success/failure in `findings.md`.

## 4. Error Handling
- **API Timeout:** Retry once after 2 seconds.
- **Quota Limit:** Halt for 60 seconds if 429 error occurs.
- **Invalid Credentials:** Log immediately to `progress.md` and skip client.

## 5. Verification Policy
Data is considered "Accurate" only if:
- `total_leads` >= 0
- `spend` >= 0
- Row count for day matches active client count.

# Project Constitution (Gemini) - Ultimate Report Dashboard

## 📜 Architectural Invariants
1. **Determinism:** Every backfill job must be logged with a unique `job_id` and timestamp.
2. **Idempotency:** Re-running a backfill for the same date must update existing records, not duplicate them.
3. **Verification:** No data is "final" until verified against the source's aggregate count.
4. **Rate Limiting:** Backfill agents must respect API quotas (max 1 request per second for Google APIs).

## 📊 Data Schemas
### Payload: `backfill_metrics`
```json
{
  "date": "YYYY-MM-DD",
  "client_id": "string",
  "metrics": {
    "sessions": "number",
    "clicks": "number",
    "spend": "number",
    "conversions": "number",
    "calls": "number"
  },
  "source": "ga4 | ads | callrail | gsc",
  "status": "pending | success | failed",
  "verification_hash": "string"
}
```

## 🛠️ Behavioral Rules
1. **Backfill Agent:** Must retry failed dates up to 3 times before flagging for human intervention.
2. **Data Guard:** Must run a daily "Audit Report" comparing Supabase counts with API totals.
3. **Tone:** Professional, deterministic, and evidence-based.

## 🪵 Maintenance Log
*Long-term stability and updates.*

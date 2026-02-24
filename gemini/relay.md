# 🏁 Gemini Relay - Change History

This file tracks significant architectural decisions, major bug fixes, and system maintenance tasks to ensure continuity between AI sessions.

---

## 📅 [[2026-02-24]] - System Cleanup & Data Audit

### 🛠 Changes
- **Project Sanitization**: 
    - Moved 80+ redundant/temporary files (scripts, docs, mockups) to `retired_artifacts/`.
    - Permanently deleted sensitive private key and credential files from root.
- **Continuity Audit**:
    - Created `gemini/tools/ultimate_audit.ts` and `gemini/tools/continuity_audit.ts`.
    - Identified critical 29-day gap in GBP data and 19-day gap in GA4 data.
    - Confirmed GSC tables are currently empty across all 19 active clients.

### 💡 Context
- The root directory was cluttered with over 120 files, making maintenance difficult. 
- Discovered that while "latest" data was present, many historical days were missing (Hollow Data).

---

## 📅 [[2026-02-23]] - GBP Auth Recovery & Initial Pilot

### 🛠 Changes
- **GBP Auth FIX**: Integrated OAuth token retrieval logic into `backfill_engine.ts` using tokens from Supabase `system_settings`.
- **Pilot Run**: Successfully backfilled GBP and Ads data for `2026-02-21`.
- **Environment Update**: Fixed `.env.local` with real Google OAuth IDs.

### 💡 Context
- GBP backfill was failing due to stale tokens and incorrect ID normalization.
- Transitioned from "Building a new Engine" to "Solution A" (Backfilling Raw Tables to utilize existing Rollup logic).

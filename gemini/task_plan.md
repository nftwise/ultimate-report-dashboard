# Task Plan - Ultimate Report Dashboard

## Phase 1: Blueprint (Vision & Logic)
- [x] Answer Discovery Questions
- [x] Define Data Schema in `gemini.md`
- [ ] Finalize Backfill SOP in `architecture/backfill_sop.md`

## Phase 2: Link (Connectivity)
- [ ] Verify Supabase Write Permissions
- [ ] Test GA4/Ads Connectivity via `tools/test_connections.js`

## Phase 3: Architect (The 3-Layer Build)
- [ ] **Agent: Backfill Pilot**
    - [ ] Create `tools/backfill_engine.ts` (Core logic for pulling/pushing)
    - [ ] Implement `architecture/navigation_logic.md` for routing
- [ ] **Agent: Data Guard**
    - [ ] Create `tools/data_validator.ts` (Accuracy checker)
    - [ ] Implement Daily Audit reporting

## Phase 4: Stylize (Refinement & UI)
- [ ] Update `ADMIN_DASHBOARD` to show Backfill Status & Accuracy %
- [ ] Add "Trigger Manual Backfill" button to UI

## Phase 5: Trigger (Deployment)
- [ ] Set up Cron Job (GitHub Action or Vercel Cron)
- [ ] Finalize Maintenance Log in `gemini.md`

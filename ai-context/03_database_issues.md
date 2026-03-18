# Database Issues — Fixed & Pending

Audit ngày 2026-03-18 cho Dec 2025 / Jan 2026 / Feb 2026.

---

## ✅ ĐÃ FIX

### 1. Timezone Date Bug — CRITICAL (Commit `8756d85c`)

**Vấn đề:** Dashboard dùng `.toISOString().split('T')[0]` để convert date từ user click.
- `new Date(2025, 11, 1)` (Dec 1) ở UTC+7 = Nov 30 17:00 UTC
- `.toISOString()` → `"2025-11-30"` → query bắt đầu từ Nov 30, thiếu Dec 31
- Kết quả: WBW Dec 2025 hiển thị 192 calls thay vì 202 (lệch 10 calls)

**Fix:** `toLocalDateStr()` helper trong `src/lib/format.ts`:
```typescript
export const toLocalDateStr = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
```
Applied vào 5 pages: admin-dashboard, [clientSlug], /gbp, /seo, /google-ads.

---

### 2. GBP Silent Fetch — Historical Data Returns Zero

**Vấn đề:** Fetch GBP day-by-day (`start = end = date`) với historical dates → Google API trả về 0 không có error.
- Tails Animal Jan 2026: 4 calls trong DB (thực tế 12)
- Southport Dec 2026: 42 calls (thực tế 57)

**Fix:** Dùng monthly range API (`start ≠ end`) → parse `datedValues` array → upsert từng ngày.
```typescript
// ĐÚNG: fetch cả tháng
const metrics = await fetchGBPRange(locationId, '2026-01-01', '2026-01-31');

// SAI: fetch từng ngày (silent zero cho historical)
const metrics = await fetchGBPDay(locationId, '2026-01-15'); // unreliable for past dates
```

---

### 3. GBP Location ID ở Sai Table

**Vấn đề:** `clients` table KHÔNG có `gbp_location_id`. Column nằm ở `gbp_locations` table.

**Pattern đúng:**
```javascript
// ĐÚNG
const { data: locs } = await supabase
  .from('gbp_locations')
  .select('client_id, location_id, location_name')
  .eq('is_active', true);

// SAI — column không tồn tại
const { data } = await supabase.from('clients').select('gbp_location_id');
```

---

### 4. GitHub Actions Rollup dùng POST thay vì GET

**Vấn đề:** Workflows dùng `curl -X POST` cho `/api/admin/run-rollup`.
Endpoint chỉ accept `GET` với `?group=X&date=Y`.
→ Run fail tại rollup step với jq parse error (2026-03-18 10:43 UTC).

**Fix:** Đổi sang `curl -f -s -X GET "URL?group=X"`. Verified 10:58 UTC → tất cả 5 steps pass.

---

### 5. NextAuth Middleware Chặn Rollup Endpoint

**Vấn đề:** `/api/admin/run-rollup` bị NextAuth redirect về login page.
GitHub Actions không có session → nhận HTML thay vì JSON → jq fail.

**Fix:** Thêm `/api/admin/run-rollup` vào exclude list trong `middleware.ts`.

---

### 6. Feb 2026 GBP Data Chưa Được Backfill

**Fix:** Fetch monthly range Feb 1-28 cho 16 active GBP clients → 938 total calls, 0 errors.
Sau đó re-run rollup cho 28 ngày Feb.

---

### 7. Rollup Thiếu cho Historical Dates

**Vấn đề:** Sau backfill raw data, `client_metrics_summary` không cập nhật tự động.

**Fix:** Bash loop gọi `/api/admin/run-rollup?date=X` cho 90 ngày (Dec+Jan+Feb).

---

## ❌ CHƯA FIX

### 1. Zen Care Physical Medicine — Không có GBP Location ID
- Không có entry trong `gbp_locations` table → không sync GBP
- **Action:** User cung cấp Location ID từ Google Business Profile URL
- INSERT vào `gbp_locations(client_id, location_id, location_name, is_active)`

### 2. Cinque Chiropractic — Không có GBP ID + Không có Sync Group
- **Action:** (1) `UPDATE clients SET sync_group='A' WHERE slug='cinque-chiropractic'`
- (2) INSERT GBP location vào `gbp_locations`

### 3. Google Ads Search Terms — 400 INVALID_ARGUMENT
- Error: `searchTerms: Ads API 400 INVALID_ARGUMENT` — tất cả clients
- Non-blocking (search terms không hiển thị trong dashboard)
- **File:** `src/app/api/cron/sync-ads/route.ts` — phần search terms query
- Chưa investigate root cause

### 4. GA4 Landing Pages — INTEGER Overflow
- 4 clients: "numeric field overflow" khi sync `ga4_landing_pages`
- **Fix cần làm:** `ALTER TABLE ga4_landing_pages ALTER COLUMN [col] TYPE BIGINT`
- Impact: landing pages data bị skip cho 4 clients này

---

## DATA INTEGRITY SUMMARY (2026-03-18)

| API | Kết quả | Notes |
|-----|---------|-------|
| GBP | ✅ 16/22 | Zen Care + Cinque thiếu location ID |
| Google Ads | ✅ 15/22 | 7 clients không chạy Ads (expected) |
| GA4 | ✅ 19/22 | 3 clients không có GA4 (expected) |
| GSC | ✅ 57/57 (100%) | 3-day lag cuối tháng là bình thường |

**Clients không có Ads (expected):**
Abundant Life Clinic, Case Animal Hospital, Chiropractic First, Chiropractic Health Club, ChiroSolutions Center, Haven Chiropractic, Rigel & Rigel

**Clients không có GA4/GSC (expected):**
Abundant Life Clinic, Case Animal Hospital, Rigel & Rigel

---

## Quan trọng cần nhớ

**GA4 raw table partial data:**
- `ga4_sessions` lưu data theo source/medium/device combination — KHÔNG phải tổng sessions
- Tổng `ga4_sessions.sessions` sẽ thấp hơn thực tế 80-99% — đây là by design
- Source of truth: `client_metrics_summary.sessions`

**GBP API vs Google Dashboard:**
- GBP API trả về raw `CALL_CLICKS` (higher)
- Google Business Profile UI làm tròn/filter → số thấp hơn
- Database (API) là đúng, spreadsheet khách có thể sai

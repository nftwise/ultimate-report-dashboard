# Key Patterns & Rules

Các patterns quan trọng — AI cần biết trước khi code bất kỳ thứ gì.

---

## 1. Date Handling — CRITICAL

**KHÔNG dùng `.toISOString()` cho frontend date queries.**

```typescript
// ❌ SAI — gây UTC shift bug (lệch 1 ngày với user UTC+7)
const dateStr = someDate.toISOString().split('T')[0];

// ✅ ĐÚNG — dùng local timezone
import { toLocalDateStr } from '@/lib/format';
const dateStr = toLocalDateStr(someDate);

// ✅ ĐÚNG — hoặc inline
const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
```

**Cho date iteration (tránh timezone boundary):**
```typescript
// ✅ Dùng T12:00:00Z (noon UTC) thay vì T00:00:00Z
const d = new Date(dateStr + 'T12:00:00Z');
```

---

## 2. GBP Data — Hai bảng, tên cột khác nhau

```typescript
// Raw table: gbp_location_daily_metrics
{ phone_calls, website_clicks, direction_requests, views }

// Summary table: client_metrics_summary
{ gbp_calls, gbp_website_clicks, gbp_directions, gbp_profile_views }
```

**GBP Location IDs nằm ở `gbp_locations` table, KHÔNG phải `clients`:**
```typescript
const { data: locs } = await supabase
  .from('gbp_locations')
  .select('client_id, location_id, location_name')
  .eq('is_active', true);
```

---

## 3. GBP API Fetch — Dùng Range, Không Dùng Single Day

```typescript
import { fetchGBPRange, fetchGBPDay } from '@/lib/gbp-fetch-utils';

// ✅ ĐÚNG — fetch cả tháng (1 API call, đầy đủ data)
const metrics = await fetchGBPRange(locationId, '2026-01-01', '2026-01-31');

// ⚠️ Single day — chỉ dùng cho cron daily (dùng range internally)
const metrics = await fetchGBPDay(locationId, '2026-01-15');

// ❌ KHÔNG dùng — day-by-day fetch cho historical data → silent zero
```

---

## 4. client_metrics_summary là Source of Truth

```typescript
// ✅ ĐÚNG — đọc từ summary cho dashboard
const { data } = await supabase
  .from('client_metrics_summary')
  .select('date, sessions, gbp_calls, google_ads_spend, ...')
  .eq('client_id', clientId)
  .eq('period_type', 'daily')  // QUAN TRỌNG: filter period_type
  .gte('date', dateFrom)
  .lte('date', dateTo);

// ⚠️ CHỈ đọc raw tables khi cần granular data (e.g. per-campaign, per-keyword)
```

**GA4 sessions:**
```typescript
// ❌ KHÔNG làm — ga4_sessions chỉ là partial (by source/medium)
const total = ga4Sessions.reduce((sum, r) => sum + r.sessions, 0); // WRONG

// ✅ ĐÚNG — đọc tổng từ summary
const { data } = await supabase
  .from('client_metrics_summary')
  .select('sessions')
  .eq('client_id', clientId);
```

---

## 5. Supabase Query Pattern

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// Cho server-side (cron, admin routes) — dùng service role
import { supabaseAdmin } from '@/lib/supabase'; // has service_role key
```

---

## 6. Client Sync Groups

Mỗi client có `sync_group = 'A' | 'B' | 'C'` trong `clients` table.
Client không có sync_group → **KHÔNG được sync tự động.**

```sql
-- Check clients chưa có sync_group
SELECT name FROM clients WHERE is_active = true AND sync_group IS NULL;
```

---

## 7. API Authorization

Tất cả cron endpoints yêu cầu:
```
Authorization: Bearer ${CRON_SECRET}
```

`CRON_SECRET` là Vercel environment variable. GitHub Actions lấy từ `secrets.CRON_SECRET`.

---

## 8. Rollup Endpoint

```
GET /api/admin/run-rollup?group=A&date=2026-03-15
```

- Aggregate raw tables → `client_metrics_summary`
- Phải chạy SAU khi sync raw data
- Không cần auth nếu gọi từ server (NextAuth excluded)
- Trả về `{ success, processed }` khi thành công

---

## 9. Number Display

```typescript
import { formatNumber, formatCurrency, formatPercent } from '@/lib/format';

formatNumber(1234567)   // "1,234,567"
formatCurrency(1234.5)  // "$1,234.50"
formatPercent(0.1234)   // "12.34%"
```

---

## 10. DB là đúng, spreadsheet khách có thể sai

Khi có mismatch giữa DB và file Excel của client:
1. Kiểm tra lại DB trực tiếp từ GBP API
2. Giải thích cho client: API raw số > Google dashboard UI (rounding)
3. Tin DB, không phải file Excel

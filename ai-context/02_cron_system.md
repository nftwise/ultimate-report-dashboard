# Cron System — GitHub Actions Auto Sync

Hệ thống sync data tự động, chạy mỗi ngày không cần can thiệp thủ công.

---

## Lịch chạy hàng ngày

| UTC | VN (UTC+7) | Group | Clients | Workflow file |
|-----|-----------|-------|---------|--------------|
| 09:00 | 16:00 | A — CA South + OC | 7 clients | `.github/workflows/sync-group-a.yml` |
| 10:00 | 17:00 | B — CA North + Mountain | 8 clients | `.github/workflows/sync-group-b.yml` |
| 11:00 | 18:00 | C — East Coast + Europe | 7 clients | `.github/workflows/sync-group-c.yml` |

---

## 5 bước mỗi workflow (chạy tuần tự)

```
Step 1: Sync GA4    → GET /api/cron/sync-ga4?group=X[&date=YYYY-MM-DD]
Step 2: Sync Ads    → GET /api/cron/sync-ads?group=X[&date=YYYY-MM-DD]
Step 3: Sync GSC    → GET /api/cron/sync-gsc?group=X[&date=YYYY-MM-DD]
Step 4: Sync GBP    → GET /api/cron/sync-gbp?group=X[&date=YYYY-MM-DD]
Step 5: Rollup      → GET /api/admin/run-rollup?group=X[&date=YYYY-MM-DD]

(Chỉ Group C thêm):
Step 6: Health Check → GET /api/cron/health-check
```

- Auth: `-H "Authorization: Bearer $CRON_SECRET"`
- Không truyền `date` → sync **yesterday** (California timezone)
- Timeout: 10 phút per workflow

---

## Health Check (tự động sau Group C, ~11:xx UTC)

```
1. Query DB: tất cả active clients có data của hôm qua?
   - GA4:  ga4_sessions[date=yesterday] tồn tại?
   - Ads:  ads_campaign_metrics[date=yesterday] tồn tại?
   - GBP:  gbp_location_daily_metrics[date=yesterday, fetch_status != 'error'] tồn tại?
   - GSC:  gsc_daily_summary[date=yesterday-3days] tồn tại? (GSC có 3-day lag)

2. Nếu thiếu:
   → Telegram alert (@Orca_Monitor_Bot, chat_id: 1902460211)
   → Auto-trigger refetch cho clients bị thiếu (fire-and-forget)

3. Nếu OK:
   → Telegram "✅ All N clients synced OK"
```

---

## Clients phân chia theo Group

**Group A** (sync_group = 'A', 09:00 UTC):
- Whole Body Wellness, Ray Chiropractic, DeCarlo Chiropractic, Hood Chiropractic
- CorePosture, South Bay Chiropractic, + 1 more CA South client

**Group B** (sync_group = 'B', 10:00 UTC):
- CA North + Mountain + Central clients

**Group C** (sync_group = 'C', 11:00 UTC):
- East Coast + Europe clients

> Xem chính xác từ DB: `SELECT name, sync_group FROM clients WHERE is_active=true ORDER BY sync_group, name`

---

## Khi cần can thiệp thủ công

```bash
# Trigger 1 ngày cụ thể (via GitHub web UI hoặc CLI)
gh workflow run sync-group-a.yml -f date=2026-03-15
gh workflow run sync-group-b.yml -f date=2026-03-15
gh workflow run sync-group-c.yml -f date=2026-03-15

# Backfill range nhiều ngày (bash script)
bash scripts/backfill-all-gaps.mjs   # Tìm và fill tất cả gaps

# Chỉ re-run rollup (raw data đã có, chỉ cần update summary)
for date in 2026-03-01 2026-03-02 ...; do
  curl -H "Authorization: Bearer $CRON_SECRET" \
    "https://ultimate-report-dashboard.vercel.app/api/admin/run-rollup?date=$date"
done
```

---

## Endpoints API

| Endpoint | Method | Params | Mô tả |
|----------|--------|--------|-------|
| `/api/cron/sync-ga4` | GET | `?group=A&date=YYYY-MM-DD` | Sync GA4 sessions + events |
| `/api/cron/sync-ads` | GET | `?group=A&date=YYYY-MM-DD` | Sync Google Ads campaigns |
| `/api/cron/sync-gsc` | GET | `?group=A&date=YYYY-MM-DD` | Sync Search Console |
| `/api/cron/sync-gbp` | GET | `?group=A&date=YYYY-MM-DD` | Sync GBP metrics |
| `/api/admin/run-rollup` | GET | `?group=A&date=YYYY-MM-DD` | Aggregate raw → summary |
| `/api/cron/health-check` | GET | none | Check data completeness + Telegram |

---

## Vercel — KHÔNG có crons

Vercel Hobby plan = max 2 crons. Đã xoá hết để tránh conflict với GitHub Actions.
Vercel chỉ là **host** cho API endpoints. **GitHub Actions là scheduler duy nhất.**

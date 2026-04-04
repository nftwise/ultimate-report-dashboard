# Skills Changelog

Track mọi thay đổi của skills để improve theo thời gian.

**Format mỗi entry:**
```
## YYYY-MM-DD — [skill] — [loại thay đổi]
**Why:** lý do thay đổi (bug gặp phải / feedback / pattern mới phát hiện)
**What:** thay đổi cụ thể
**Result:** kết quả sau khi apply
```

---

## 2026-04-04 — Initial Creation

### builder v1.0
- Build từ đầu dựa trên codebase scan
- Includes: design system, GBP mapping, Supabase pattern, build order

### fixer v1.0
- Build từ đầu
- Includes: bug classification table, common patterns

### syncer v1.0
- Build từ đầu
- Includes: cron pattern từ sync-ga4, GBP range, vercel.json slots

---

## 2026-04-04 — All skills v1.1 (Post-evaluation fixes)

### builder v1.1
**Why:** Đánh giá 7.5/10 — thiếu patterns thật từ codebase
**What:**
- Thêm `ServiceNotActive` component pattern (lấy từ google-ads/page.tsx)
- Thêm loading/skeleton state pattern (lấy từ google-ads/page.tsx)
- Thêm Recharts import + usage pattern (lấy từ seo/page.tsx)
- Thêm `service_configs` join pattern (lấy từ sync-ga4/route.ts)
**Result:** Score tăng từ 7.5 → ~8.5

### fixer v1.1
**Why:** Shell injection `grep console.error` không targeted, thiếu Facebook patterns
**What:**
- Thay shell injection: `git log --oneline -10` + `git diff --name-only HEAD~1`
- Thêm Facebook data missing vào classification table
- Thêm `src/lib/gbp-fetch-utils.ts` vào key files map
- Làm rõ `service_configs` array access pattern
**Result:** Score tăng từ 8 → ~8.5

### syncer v1.1
**Why:** Thiếu rollup trigger sau sync, thiếu `?group=X` và `?clientId=UUID` params
**What:**
- Thêm Step 5: rollup trigger sau khi sync xong
- Thêm `?clientId=UUID` và `?group=GROUP_NAME` params vào backfill section
**Result:** Score tăng từ 8.5 → ~9

### CLAUDE.md v1.1
**Why:** Edge case "cron bị lỗi" vs "thêm cron mới" không rõ → nhầm agent
**What:**
- Thêm 4 edge cases cụ thể để phân biệt `/fixer` vs `/syncer`
**Result:** Auto-detection chính xác hơn

---

## TEMPLATE cho entries tiếp theo

Khi gặp bug do skill gây ra, hoặc phát hiện pattern mới, thêm entry:

```markdown
## YYYY-MM-DD — [builder/fixer/syncer] — [fix/improve/add-pattern]
**Why:** [mô tả vấn đề gặp phải, task nào trigger]
**What:** [thay đổi cụ thể trong SKILL.md]
**Result:** [skill hoạt động tốt hơn như thế nào]
```

**Khi nào nên update:**
- Skill tạo ra code sai convention → add pattern đúng
- Skill hỏi lại điều đã biết → add context vào Step 0
- Skill bỏ sót bước quan trọng → add vào quy trình
- Pattern mới xuất hiện trong codebase → document lại

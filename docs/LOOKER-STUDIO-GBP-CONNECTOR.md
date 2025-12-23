# Tìm Google Business Profile Connector trong Looker Studio

## ⚠️ Vấn đề: Không tìm thấy "Google Business Profile" trong Looker Studio

Google đã thay đổi tên và cách kết nối GBP data trong Looker Studio.

## ✅ CÁCH ĐÚNG ĐỂ KẾT NỐI GBP DATA:

### Option 1: Sử dụng Google Sheets (Recommended - Đơn giản nhất)

#### Bước 1: Export GBP Data ra Google Sheets
1. Vào **Google Business Profile dashboard**: https://business.google.com/
2. Chọn location: **CorePosture Chiropractic**
3. Click **"Performance"** (hoặc **"Insights"**)
4. Ở góc trên bên phải, tìm nút **"Download"** hoặc **"Export"**
5. Chọn **"Export to Sheets"** hoặc **"Download CSV"**

**LƯU Ý:** Nếu không có nút Export, có nghĩa là:
- ❌ Google chưa cấp Performance data cho location này
- ❌ Location không đủ điều kiện để xem Performance metrics
- ❌ Không có data available (do không đủ search volume)

#### Bước 2: Kết nối Google Sheets với Looker Studio
1. Vào https://lookerstudio.google.com/
2. Click **"Create"** → **"Data Source"**
3. Tìm và chọn **"Google Sheets"**
4. Chọn Sheets file vừa export
5. Click **"Connect"**

**Nhược điểm:** Phải manual export hàng tháng

---

### Option 2: Kiểm tra xem có Performance Data không

#### Test 1: Kiểm tra trong GBP Dashboard
1. Vào: https://business.google.com/
2. Login bằng **seo@mychiropractice.com**
3. Chọn **CorePosture Chiropractic**
4. Click tab **"Performance"** hoặc **"Insights"**

**Nếu thấy data (views, calls, clicks):**
- ✅ Location CÓ Performance data
- ➡️ Chuyển sang Option 3 hoặc 4

**Nếu KHÔNG thấy data hoặc hiển thị "No data available":**
- ❌ Google chưa cấp Performance data cho location này
- ❌ KHÔNG CÓ CÁCH NÀO lấy data qua Looker Studio
- ➡️ Phải dùng Manual Entry hoặc Third-party tools

---

### Option 3: Google Search Console (Alternative)

Nếu GBP không có data, có thể dùng **Google Search Console** để thay thế một phần:

#### Bước 1: Verify Website trong Search Console
1. Vào: https://search.google.com/search-console
2. Add property: **coreposturechiropractic.com**
3. Verify ownership

#### Bước 2: Kết nối Search Console với Looker Studio
1. Vào Looker Studio: https://lookerstudio.google.com/
2. Click **"Create"** → **"Data Source"**
3. Tìm: **"Search Console"** ✅ (Cái này CÓ!)
4. Select property: **coreposturechiropractic.com**
5. Choose table type: **"URL impression"** hoặc **"Site impression"**
6. Click **"Connect"**

**Data có thể lấy từ Search Console:**
- ✅ Search queries (từ khóa)
- ✅ Impressions (lượt hiển thị)
- ✅ Clicks (clicks vào website)
- ✅ Position (vị trí trên Google)
- ❌ KHÔNG có: Phone calls từ GBP
- ❌ KHÔNG có: Direction requests
- ❌ KHÔNG có: GBP-specific actions

---

### Option 4: Community Connector (Third-party)

Có một số community connectors cho GBP, nhưng hầu hết đều deprecated hoặc không hoạt động:

1. Vào Looker Studio: https://lookerstudio.google.com/
2. Click **"Create"** → **"Data Source"**
3. Scroll xuống phần **"Partner Connectors"** hoặc **"Community Connectors"**
4. Tìm kiếm: **"Google My Business"** hoặc **"Business Profile"**

**Connectors có thể thử:**
- Supermetrics (Paid - $69/month)
- Porter (Paid)
- Windsor.ai (Paid)

**LƯU Ý:** Các connectors này cũng gặp vấn đề tương tự - nếu Google không cấp Performance API access thì connector cũng không lấy được data.

---

## 🔍 CHẨN ĐOÁN: CorePosture có Performance Data không?

Hãy làm test này để xác định:

### Test A: Vào GBP Dashboard
```
URL: https://business.google.com/
Login: seo@mychiropractice.com
Location: CorePosture Chiropractic
Tab: Performance
```

**Bạn thấy gì?**

**A1. Có data (charts hiển thị views, actions, etc.):**
- ✅ Location ĐỦ điều kiện
- ➡️ Google đang giấu connector trong Looker Studio
- ➡️ Thử Option 1 (Export to Sheets) hoặc Option 4 (Paid connectors)

**A2. "No data available" hoặc "Not enough data":**
- ❌ Location KHÔNG ĐỦ điều kiện
- ❌ Google KHÔNG CẤP Performance data
- ➡️ KHÔNG THỂ lấy qua bất kỳ cách nào (API, Looker, Connectors)
- ➡️ Chỉ còn cách: Manual Entry hàng tháng

**A3. "Upgrade to access insights":**
- ❌ Account cần upgrade hoặc verify thêm
- ➡️ Follow hướng dẫn của Google để upgrade

---

## 💡 GIẢI PHÁP THỰC TẾ

Dựa trên kết quả test API trước đó (tất cả đều 404), rất có thể:

### Kết luận: CorePosture KHÔNG CÓ Performance Data

**Bằng chứng:**
1. ❌ Performance API: 404 (Google chưa cấp quyền)
2. ❌ Insights API: 404
3. ❌ Search Keywords API: 404
4. ❌ All 26 endpoints tested: Failed

**Nguyên nhân:**
- Business không đủ search volume
- Location chưa đủ 18 tháng verified data
- Không meet Google's quality requirements

**➡️ Looker Studio cũng SẼ KHÔNG có data** vì source data từ cùng 1 hệ thống.

---

## 🎯 HÀNH ĐỘNG TIẾP THEO

### Bước 1: XÁC NHẬN
Hãy check GBP dashboard xem có Performance tab với data không:
1. Vào https://business.google.com/
2. Login: seo@mychiropractice.com
3. Chọn CorePosture
4. Check tab Performance

**Chụp screenshot và cho tôi biết bạn thấy gì.**

### Bước 2: NẾU KHÔNG CÓ DATA
Chúng ta sẽ implement:

**Plan B: Manual Data Entry Form**
- Tạo admin form để nhập GBP metrics hàng tháng
- Lưu vào database
- Hiển thị historical data
- Export reports

**Hoặc Plan C: Remove GBP Section**
- Giữ lại Reviews (có data)
- Giữ lại Local Posts (có data)
- Giữ lại Photos (có data)
- Bỏ Performance metrics (không có data)

### Bước 3: NẾU CÓ DATA
- Tôi sẽ tìm chính xác connector name trong Looker Studio
- Hoặc hướng dẫn export/import via Sheets

---

## ❓ TRƯỚC KHI TIẾP TỤC

**Hãy trả lời:**
1. Bạn có thấy Performance data trong GBP dashboard không? (https://business.google.com/)
2. Nếu có, nó hiển thị metrics gì? (views, calls, clicks, etc.)
3. Bạn muốn implement Plan B (Manual Entry) hay Plan C (Remove section)?

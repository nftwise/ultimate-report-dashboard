# Hướng Dẫn Tích Hợp Google Looker Studio cho GBP Performance Data

## Tổng Quan

Google Looker Studio (trước đây là Data Studio) có thể kết nối TRỰC TIẾP với Google Business Profile và lấy được TẤT CẢ performance data mà API không cho phép:
- ✅ Views (Maps & Search)
- ✅ Phone call clicks
- ✅ Website clicks
- ✅ Direction requests
- ✅ Search keywords
- ✅ Photo views

## Bước 1: Tạo Looker Studio Report

### 1.1. Truy cập Looker Studio
1. Mở: https://lookerstudio.google.com/
2. Login bằng email **seo@mychiropractice.com** (email có quyền quản lý GBP)

### 1.2. Tạo Report Mới
1. Click **"Create"** → **"Report"**
2. Hoặc click **"Blank Report"**

## Bước 2: Kết Nối Google Business Profile Data Source

### 2.1. Add Data Source
1. Trong màn hình report, click **"Add data"**
2. Tìm kiếm: **"Google My Business"** hoặc **"Business Profile"**
3. Click **"SELECT"**

### 2.2. Authorize Connection
1. Google sẽ yêu cầu authorize
2. Click **"AUTHORIZE"**
3. Chọn account: **seo@mychiropractice.com**
4. Click **"Allow"** để cấp quyền

### 2.3. Configure Data Source
1. **Select Account**: Chọn `Trieu Ly` (account ID: 111728963099305708584)
2. **Select Locations**: Chọn business locations bạn muốn track
   - CorePosture Chiropractic
   - DeCarlo Chiropractic
   - Hood Chiropractic
   - Hoặc **"All Locations"** để track tất cả
3. Click **"ADD"**

## Bước 3: Thiết Kế Dashboard

### 3.1. Metrics Cần Hiển Thị

**A. Search Views (Lượt xem)**
- **Metric name**: `Total Impressions` hoặc `Views`
- **Dimensions**:
  - Desktop Maps
  - Mobile Maps
  - Desktop Search
  - Mobile Search

**B. Customer Actions (Hành động)**
- **Phone Calls**: `Phone Calls` metric
- **Website Clicks**: `Website Clicks` metric
- **Direction Requests**: `Direction Requests` metric

**C. Search Queries (Từ khóa tìm kiếm)**
- **Metric**: `Search Keywords`
- **Dimensions**: Keyword, Impressions

**D. Photo Stats**
- **Merchant Photos**: `Merchant Photos Views`
- **Customer Photos**: `Customer Photos Views`

### 3.2. Thêm Charts

#### Time Series Chart (Views Over Time)
1. Click **"Add a chart"** → **"Time series"**
2. **Date Range Dimension**: Date
3. **Metric**: Total Impressions
4. **Breakdown Dimension**: Search Type (Maps vs Search)

#### Scorecard (Tổng số)
1. Click **"Add a chart"** → **"Scorecard"**
2. Tạo 4 scorecards cho:
   - Total Views (Tổng lượt xem)
   - Phone Calls (Số cuộc gọi)
   - Website Clicks (Click vào website)
   - Direction Requests (Yêu cầu chỉ đường)

#### Table (Search Keywords)
1. Click **"Add a chart"** → **"Table"**
2. **Dimension**: Search Query
3. **Metrics**: Impressions, Actions
4. Sắp xếp theo Impressions giảm dần

## Bước 4: Tùy Chỉnh Design

### 4.1. Theme & Style
1. Click **"Theme and layout"** (thanh bên phải)
2. Chọn theme phù hợp với dashboard của bạn
3. Adjust colors để match brand colors của client

### 4.2. Add Filters
1. Click **"Add a control"** → **"Date range control"**
2. Thêm date range selector để user có thể chọn:
   - Last 7 days
   - Last 30 days
   - Last 90 days
   - Custom range

### 4.3. Add Client Branding
1. Thêm logo: **Insert** → **Image** → Upload client logo
2. Thêm header text với tên client
3. Thêm footer với thông tin liên hệ (optional)

## Bước 5: Publish & Get Embed Code

### 5.1. Share Settings
1. Click **"Share"** (góc trên bên phải)
2. Click **"Manage access"**
3. Chọn quyền truy cập:
   - **"Anyone with the link can view"** - Để client có thể xem
   - Hoặc **"Restricted"** - Chỉ người được invite mới xem

### 5.2. Get Embed Code
1. Click **"File"** → **"Embed report"**
2. Hoặc click icon **"..."** → **"Embed"**
3. Copy **Embed URL** hoặc **Iframe code**

Ví dụ embed code:
```html
<iframe
  width="1200"
  height="800"
  src="https://lookerstudio.google.com/embed/reporting/YOUR_REPORT_ID/page/YOUR_PAGE_ID"
  frameborder="0"
  style="border:0"
  allowfullscreen>
</iframe>
```

### 5.3. Lấy Report ID
Từ URL của report, copy phần sau `/reporting/`:
```
https://lookerstudio.google.com/reporting/abc123-def456-ghi789
                                            ^^^^^^^^^^^^^^^^^^^^^^^^
                                            Đây là Report ID
```

## Bước 6: Tích Hợp Vào Dashboard

### 6.1. Tạo Component Mới

Tạo file: `/src/components/GBPLookerStudioEmbed.tsx`

```typescript
'use client';

import React from 'react';

interface GBPLookerStudioEmbedProps {
  reportId: string;
  pageId?: string;
  height?: string;
  className?: string;
}

export default function GBPLookerStudioEmbed({
  reportId,
  pageId,
  height = '800px',
  className = ''
}: GBPLookerStudioEmbedProps) {
  const embedUrl = pageId
    ? `https://lookerstudio.google.com/embed/reporting/${reportId}/page/${pageId}`
    : `https://lookerstudio.google.com/embed/reporting/${reportId}`;

  return (
    <div className={`looker-studio-container ${className}`}>
      <iframe
        src={embedUrl}
        width="100%"
        height={height}
        frameBorder="0"
        style={{ border: 0 }}
        allowFullScreen
        sandbox="allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      />
    </div>
  );
}
```

### 6.2. Thêm Vào Dashboard Page

Update file: `/src/app/dashboard/page.tsx`

```typescript
import GBPLookerStudioEmbed from '@/components/GBPLookerStudioEmbed';

// Trong component Dashboard
<section className="gbp-performance">
  <h2>Google Business Profile Performance</h2>
  <GBPLookerStudioEmbed
    reportId="YOUR_REPORT_ID_HERE"
    height="600px"
  />
</section>
```

### 6.3. Lưu Report ID Vào Database

Thêm column vào bảng `clients`:

```sql
ALTER TABLE clients
ADD COLUMN gbp_looker_studio_report_id TEXT;

-- Update cho CorePosture
UPDATE clients
SET gbp_looker_studio_report_id = 'YOUR_REPORT_ID_HERE'
WHERE slug = 'coreposture';
```

### 6.4. Dynamic Loading Based on Client

```typescript
// Lấy report ID từ database
const client = await getClientData(clientId);

if (client.gbp_looker_studio_report_id) {
  return (
    <GBPLookerStudioEmbed
      reportId={client.gbp_looker_studio_report_id}
    />
  );
}
```

## Bước 7: Tạo Report Cho Nhiều Clients

### Option A: 1 Report Per Client
1. Tạo separate report cho từng client
2. Lưu từng reportId vào database
3. Mỗi client có dashboard riêng

**Ưu điểm:**
- Customize riêng cho từng client
- Bảo mật tốt hơn (client chỉ thấy data của mình)

**Nhược điểm:**
- Phải tạo nhiều reports
- Khó maintain

### Option B: 1 Report + Location Filter
1. Tạo 1 report cho tất cả locations
2. Thêm **Location Filter Control**
3. Khi embed, pass location parameter

```typescript
const embedUrl = `https://lookerstudio.google.com/embed/reporting/${reportId}?params=%7B%22df1%22:%22include%25EE%2580%25800%25EE%2580%2580IN%25EE%2580%2580${locationId}%22%7D`;
```

**Ưu điểm:**
- Chỉ cần maintain 1 report
- Dễ update design cho tất cả

**Nhược điểm:**
- Phức tạp hơn với URL encoding
- Cần test kỹ filtering

## Bước 8: Testing

### 8.1. Test Embed
1. Mở dashboard tại: http://localhost:3000/dashboard?clientId=coreposture
2. Verify Looker Studio report hiển thị đúng
3. Check date filters hoạt động
4. Test responsive trên mobile

### 8.2. Verify Data
1. So sánh data trên Looker Studio với GBP dashboard gốc
2. Đảm bảo metrics match
3. Check date ranges đúng

## Troubleshooting

### Issue 1: "Report not found" hoặc blank iframe
**Giải pháp:**
- Check report ID đúng chưa
- Verify report đã được set "Anyone with link can view"
- Check iframe sandbox attributes

### Issue 2: "No data available"
**Giải pháp:**
- Verify data source connection vẫn active
- Check date range có data không
- Re-authorize GBP connection nếu cần

### Issue 3: Performance chậm
**Giải pháp:**
- Giảm số charts trong report
- Use caching trong Looker Studio settings
- Giảm date range (chỉ hiển thị 90 days)

## Best Practices

### 1. Data Refresh
- Looker Studio tự động refresh data mỗi 15-30 phút
- Có thể set manual refresh nếu cần

### 2. Mobile Optimization
- Test trên mobile devices
- Adjust chart sizes cho mobile
- Consider hiding một số charts trên mobile

### 3. Security
- Đừng share public link nếu chứa sensitive data
- Use password protection nếu cần
- Regularly review access permissions

### 4. Maintenance
- Review reports monthly để đảm bảo data source vẫn connected
- Update designs khi có feedback từ clients
- Check for new metrics Google thêm vào

## Kết Luận

Looker Studio là cách DUY NHẤT và MIỄN PHÍ để lấy đầy đủ GBP Performance data mà API không cung cấp.

**Thời gian setup:** 30-45 phút cho report đầu tiên, 10-15 phút cho mỗi client tiếp theo.

**Chi phí:** $0 - Hoàn toàn miễn phí

**Data availability:** Real-time (refresh mỗi 15-30 phút)

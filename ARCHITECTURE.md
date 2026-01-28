# 🏗️ ULTIMATE REPORT DASHBOARD - ARCHITECTURE & SYSTEM DESIGN

> **Complete Technical Documentation**
> Version: 2.0 | Last Updated: January 28, 2026

---

## 📋 TABLE OF CONTENTS

1. [System Overview](#1-system-overview)
2. [Technology Stack](#2-technology-stack)
3. [Architecture Diagram](#3-architecture-diagram)
4. [Data Flow](#4-data-flow)
5. [Component Structure](#5-component-structure)
6. [API Layer](#6-api-layer)
7. [Database Schema](#7-database-schema)
8. [Authentication & Authorization](#8-authentication--authorization)
9. [Deployment Architecture](#9-deployment-architecture)

---

## 1. SYSTEM OVERVIEW

**Ultimate Report Dashboard** is a multi-tenant analytics platform that aggregates data from 5+ marketing data sources into a unified dashboard for chiropractic clinics.

### Core Purpose
- **Multi-client management**: Single admin can manage 20-25+ clinic accounts
- **Data aggregation**: Combines Google Analytics, Google Ads, Search Console, Google Business Profile, CallRail
- **Performance tracking**: KPIs, trends, comparisons, rankings
- **Automated reporting**: Weekly reports, email delivery, PDF export

### System Type
```
┌─────────────────────────────────────────────────┐
│  SaaS Multi-Tenant Dashboard Platform           │
│  ├─ Admin Portal (Multi-client management)      │
│  ├─ Client Portal (Individual clinic view)      │
│  └─ API Layer (Data aggregation & caching)      │
└─────────────────────────────────────────────────┘
```

---

## 2. TECHNOLOGY STACK

### Frontend
```typescript
- React 19 + Next.js 15 (App Router)
- TypeScript for type safety
- Tailwind CSS for styling
- Recharts for data visualization
- NextAuth.js 4 for authentication
```

### Backend
```typescript
- Next.js API Routes (Serverless)
- Node.js runtime
- Vercel Edge Functions
- TypeScript
```

### Database
```
- PostgreSQL (Supabase)
- Real-time subscriptions
- Row-level security (RLS)
```

### External Services
```
- Google Analytics Data API
- Google Search Console API
- Google Business Profile Performance API
- Google Ads API
- CallRail API
```

### Deployment
```
- Vercel (Next.js optimized)
- GitHub for version control
- PostgreSQL on Supabase
```

---

## 3. ARCHITECTURE DIAGRAM

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT BROWSER                           │
├─────────────────────────────────────────────────────────────────┤
│
│ React Components
│ ├─ Admin Dashboard (Client Switcher)
│ ├─ Client Dashboard (Metrics View)
│ └─ Reports Page
│
└─────────┬───────────────────────────────────────────────────────┘
          │ HTTP/HTTPS
          ▼
┌─────────────────────────────────────────────────────────────────┐
│              VERCEL - NEXT.JS APPLICATION                        │
├─────────────────────────────────────────────────────────────────┤
│
│ Middleware
│ ├─ Authentication (NextAuth.js)
│ └─ CORS/Security Headers
│
│ API Routes
│ ├─ /api/dashboard (Fetch metrics for client)
│ ├─ /api/google-analytics (GA4 data)
│ ├─ /api/search-console (GSC data)
│ ├─ /api/google-business-profile (GBP data)
│ ├─ /api/google-ads (Ads data)
│ ├─ /api/callrail (Call tracking)
│ └─ /api/admin/* (Admin endpoints)
│
│ Services
│ ├─ Google Analytics Connector
│ ├─ Google Search Console Connector
│ ├─ Google Business Profile Connector
│ ├─ Google Ads Connector
│ ├─ CallRail Connector
│ └─ Data Cache Manager
│
└─────────┬───────────────────────────────────────────────────────┘
          │ HTTPS
          ▼
┌─────────────────────────────────────────────────────────────────┐
│              SUPABASE - POSTGRESQL DATABASE                      │
├─────────────────────────────────────────────────────────────────┤
│
│ Tables
│ ├─ clients (client info)
│ ├─ users (authentication)
│ ├─ client_metrics_summary (aggregated metrics)
│ ├─ gbp_locations (Google Business Profile locations)
│ ├─ gbp_location_daily_metrics (GBP daily data)
│ ├─ client_campaigns (campaign data)
│ └─ system_settings (GBP OAuth tokens)
│
└─────────┬───────────────────────────────────────────────────────┘
          │ HTTPS
          ▼
┌─────────────────────────────────────────────────────────────────┐
│           EXTERNAL MARKETING APIs                                │
├─────────────────────────────────────────────────────────────────┤
│
│ ├─ Google Analytics (GA4 API)
│ ├─ Google Search Console API
│ ├─ Google Business Profile API
│ ├─ Google Ads API
│ └─ CallRail API
│
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. DATA FLOW

### Real-time Flow (Dashboard Load)
```
1. User selects client in dropdown
   ↓
2. Browser calls: GET /api/dashboard?clientId=xxx
   ↓
3. API reads client config from Supabase
   ↓
4. API queries marketing APIs (GA, GSC, GBP, Ads, CallRail)
   ↓
5. Data cached in memory (5 min TTL)
   ↓
6. Aggregated metrics returned to browser
   ↓
7. React re-renders with new data
```

### Batch Backfill Flow (Nightly)
```
1. Vercel Cron triggers: POST /api/admin/run-rollup (2 AM UTC)
   ↓
2. Script fetches yesterday's metrics from all APIs
   ↓
3. Data batch processed (3 clients at a time)
   ↓
4. Metrics stored in Supabase (client_metrics_summary)
   ↓
5. GBP data synced to gbp_location_daily_metrics
   ↓
6. Dashboard reads from DB (< 1 second response)
```

### GBP OAuth Flow
```
1. Admin visits: /api/auth/google-business
   ↓
2. Redirects to Google OAuth consent screen
   ↓
3. User authorizes agency access
   ↓
4. Callback stores token in Supabase (system_settings.gbp_oauth_token)
   ↓
5. Auto-discovers GBP locations and accounts
   ↓
6. Maps locations to client_id in database
```

---

## 5. COMPONENT STRUCTURE

### App Router Layout
```
app/
├── layout.tsx (Root layout + providers)
├── page.tsx (Home/redirect)
├── dashboard/ (Client view)
│   ├── page.tsx (Main dashboard)
│   └── layout.tsx (Dashboard layout)
├── admin-dashboard/ (Admin portal)
│   ├── page.tsx (Multi-client switcher)
│   └── layout.tsx
├── reports/ (Automated reports)
│   ├── page.tsx
│   └── weekly/
├── api/ (API Routes)
│   ├── dashboard/
│   │   └── route.ts
│   ├── google-analytics/
│   │   └── route.ts
│   ├── search-console/
│   │   └── route.ts
│   ├── google-business-profile/
│   │   └── route.ts
│   ├── google-ads/
│   │   └── route.ts
│   ├── callrail/
│   │   └── route.ts
│   ├── auth/
│   │   ├── [...nextauth]/
│   │   │   └── route.ts
│   │   ├── google-business/
│   │   │   ├── route.ts (Initiate OAuth)
│   │   │   └── callback/
│   │   │       └── route.ts (Handle callback)
│   │   └── route.ts (Deprecated)
│   └── admin/
│       ├── run-rollup/ (Nightly cron)
│       ├── check-supabase-data/ (Health check)
│       └── gbp/
│           └── backfill/ (GBP historical data)
│
└── components/
    ├── AdminClientSwitcher.tsx
    ├── Dashboard/
    ├── Charts/
    └── UI/

src/
├── lib/
│   ├── server-utils.ts (Client config fetcher)
│   ├── supabase.ts (Supabase clients)
│   ├── connectors/
│   │   ├── google-analytics.ts
│   │   ├── google-search-console.ts
│   │   ├── google-business-profile.ts
│   │   ├── google-ads.ts
│   │   └── callrail.ts
│   └── cache.ts (In-memory caching)
└── data/
    └── clients.json (Legacy - migrated to DB)
```

---

## 6. API LAYER

### Dashboard Endpoint
```typescript
GET /api/dashboard?clientId=dr-digrado&period=7days

Response:
{
  success: true,
  data: {
    googleAnalytics: {
      sessions: 1245,
      users: 342,
      pageviews: 3421,
      ...
    },
    googleAds: {
      impressions: 12000,
      clicks: 450,
      cost: 1200,
      ...
    },
    searchConsole: {
      clicks: 342,
      impressions: 8500,
      ctr: 0.04,
      ...
    },
    googleBusinessProfile: {
      views: 2100,
      actions: 463,
      ...
    },
    callrail: {
      calls: 45,
      conversions: 12,
      ...
    }
  },
  timestamp: "2026-01-28T...",
  cached: true
}
```

### Admin Endpoints

**Check Supabase Data:**
```
GET /api/admin/check-supabase-data
Response: Health status + record counts
```

**Run Rollup (Nightly):**
```
POST /api/admin/run-rollup
Response: Sync status + counts updated
```

**GBP Backfill:**
```
POST /api/admin/gbp/backfill
Request: { locations: [...], daily_metrics: [...] }
Response: { success: true, results: { inserted: 1095, ... } }
```

---

## 7. DATABASE SCHEMA

### Clients Table
```sql
CREATE TABLE clients (
  id UUID PRIMARY KEY,
  slug TEXT UNIQUE,
  name TEXT,
  contact_email TEXT,
  city TEXT,
  owner TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Service Configs (Nested)
```sql
CREATE TABLE service_configs (
  client_id UUID REFERENCES clients(id),
  ga_property_id TEXT,
  gads_customer_id TEXT,
  gsc_site_url TEXT,
  callrail_account_id TEXT,
  gbp_location_id TEXT,
  created_at TIMESTAMP
);
```

### Client Metrics Summary
```sql
CREATE TABLE client_metrics_summary (
  id UUID PRIMARY KEY,
  client_id UUID REFERENCES clients(id),
  date DATE,
  sessions INTEGER,
  users INTEGER,
  google_ads_conversions INTEGER,
  form_fills INTEGER,
  gbp_calls INTEGER,
  seo_impressions INTEGER,
  ads_impressions INTEGER,
  gbp_website_clicks INTEGER,
  gbp_directions INTEGER,
  gbp_profile_views INTEGER,
  gbp_reviews_count INTEGER,
  gbp_rating_avg DECIMAL
);
```

### GBP Locations
```sql
CREATE TABLE gbp_locations (
  id UUID PRIMARY KEY,
  client_id UUID REFERENCES clients(id),
  gbp_location_id TEXT,
  location_name TEXT,
  address TEXT,
  phone TEXT,
  website TEXT,
  created_at TIMESTAMP,
  synced_at TIMESTAMP
);
```

### GBP Location Daily Metrics
```sql
CREATE TABLE gbp_location_daily_metrics (
  id UUID PRIMARY KEY,
  gbp_location_id TEXT,
  date DATE,
  views INTEGER,
  actions INTEGER,
  direction_requests INTEGER,
  phone_calls INTEGER,
  website_clicks INTEGER,
  total_reviews INTEGER,
  average_rating DECIMAL
);
```

### System Settings (OAuth Tokens)
```sql
CREATE TABLE system_settings (
  key TEXT PRIMARY KEY,
  value JSONB,
  updated_at TIMESTAMP
);

Example: gbp_oauth_token
{
  "access_token": "...",
  "refresh_token": "...",
  "expires_at": 1706604800000,
  "created_at": "2026-01-28T..."
}
```

---

## 8. AUTHENTICATION & AUTHORIZATION

### NextAuth.js Configuration
```typescript
- Provider: Database (Supabase)
- Session: JWT
- Callbacks: Custom user/session mapping
- Pages: Custom login page
```

### User Types
1. **Admin** - Full access to all clients
2. **Client User** - Access only to own client data
3. **Service Account** - API access for backfill jobs

### Security
- JWT tokens stored in HTTP-only cookies
- CSRF protection enabled
- CORS configured for trusted domains
- RLS on Supabase tables

---

## 9. DEPLOYMENT ARCHITECTURE

### Vercel Deployment
```
┌─────────────────────────────────────┐
│     GitHub Repository               │
│     └─ branch: production-clean     │
└────────────┬────────────────────────┘
             │ Push to GitHub
             ▼
┌─────────────────────────────────────┐
│     Vercel Dashboard                │
│     └─ Auto-deploy on push          │
└────────────┬────────────────────────┘
             │ Build & Deploy
             ▼
┌─────────────────────────────────────┐
│     Vercel Edge Network             │
│     ├─ API Routes                   │
│     ├─ Static Assets                │
│     ├─ Cron Jobs (2 AM UTC)         │
│     └─ Environment Variables        │
└─────────────────────────────────────┘
```

### Environment Variables (Vercel)
```bash
# Google Services
GOOGLE_CLIENT_EMAIL=...
GOOGLE_PRIVATE_KEY=...
GOOGLE_ANALYTICS_PROPERTY_ID=...
GOOGLE_ADS_DEVELOPER_TOKEN=...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...

# NextAuth
NEXTAUTH_SECRET=...
NEXTAUTH_URL=...

# OAuth
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
NEXT_PUBLIC_APP_URL=...
```

### Cron Jobs
```
0 2 * * * POST /api/admin/run-rollup (2 AM UTC daily)
```

---

**Generated with Claude Code**
**Updated**: January 28, 2026

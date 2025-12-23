import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { GoogleAdsServiceAccountConnector } from '@/lib/google-ads-service-account'
import { GoogleAnalyticsConnector } from '@/lib/google-analytics'
import { JWT } from 'google-auth-library'
import { fastCache } from '@/lib/fast-cache'

/**
 * GET /api/admin/overview
 * OPTIMIZED endpoint for admin dashboard - fetches all client data in parallel batches
 * ~10x faster than the old per-client approach
 *
 * Query params:
 * - startDate: YYYY-MM-DD format
 * - endDate: YYYY-MM-DD format
 * - forceFresh: 'true' to skip cache
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const forceFresh = searchParams.get('forceFresh') === 'true'

    if (!startDate || !endDate) {
      return NextResponse.json({
        success: false,
        error: 'startDate and endDate parameters are required'
      }, { status: 400 })
    }

    const timeRange = { startDate, endDate, period: 'custom' as const }
    const cacheKey = `admin-overview-${startDate}-${endDate}`

    // Check cache first (5 min TTL)
    if (!forceFresh) {
      const cached = fastCache.get<any>(cacheKey)
      if (cached) {
        console.log(`⚡ [Admin Overview] Cache HIT - returning in ${Date.now() - startTime}ms`)
        return NextResponse.json({
          success: true,
          clients: cached,
          cached: true,
          duration: Date.now() - startTime
        })
      }
    }

    console.log(`🔄 [Admin Overview] Cache miss, fetching fresh data...`)

    // Step 1: Fetch all clients with their service configs in ONE query
    const { data: clients, error: clientsError } = await supabaseAdmin
      .from('clients')
      .select(`
        id,
        name,
        slug,
        is_active,
        service_configs (
          ga_property_id,
          gads_customer_id,
          gbp_location_id,
          gsc_site_url
        )
      `)
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (clientsError) {
      console.error('[Admin Overview] Error fetching clients:', clientsError)
      return NextResponse.json({ success: false, error: clientsError.message }, { status: 500 })
    }

    console.log(`[Admin Overview] Found ${clients?.length || 0} active clients`)

    // Step 2: Process clients and prepare for batch API calls
    const clientsData = (clients || []).map((client: any) => {
      const config = Array.isArray(client.service_configs)
        ? client.service_configs[0]
        : client.service_configs || {}

      return {
        id: client.id,
        name: client.name,
        slug: client.slug,
        gaPropertyId: config.ga_property_id,
        adsCustomerId: config.gads_customer_id,
        gbpLocationId: config.gbp_location_id,
        gscSiteUrl: config.gsc_site_url,
        services: {
          googleAds: !!(config.gads_customer_id && config.gads_customer_id.trim()),
          seo: !!(config.gsc_site_url && config.gsc_site_url.trim()),
          googleLocalService: !!(config.gbp_location_id && config.gbp_location_id.trim()),
          fbAds: false,
        }
      }
    })

    // Step 3: Batch fetch Google Ads data (parallel, 5 at a time)
    const BATCH_SIZE = 5
    const TIMEOUT_MS = 5000
    const mccId = process.env.GOOGLE_ADS_MCC_ID || '8432700368'
    const adsConnector = new GoogleAdsServiceAccountConnector()

    const clientsWithAds = clientsData.filter(c => c.adsCustomerId)
    console.log(`[Admin Overview] Fetching Google Ads for ${clientsWithAds.length} clients`)

    const adsResults = new Map<string, any>()

    for (let i = 0; i < clientsWithAds.length; i += BATCH_SIZE) {
      const batch = clientsWithAds.slice(i, i + BATCH_SIZE)
      const batchPromises = batch.map(async (client) => {
        try {
          const result = await Promise.race([
            adsConnector.getCampaignReport(timeRange, client.adsCustomerId, mccId),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), TIMEOUT_MS))
          ])
          return { clientId: client.id, data: result }
        } catch (error) {
          console.log(`[Admin Overview] Ads error for ${client.name}:`, (error as Error).message)
          return { clientId: client.id, data: null }
        }
      })

      const batchResults = await Promise.all(batchPromises)
      batchResults.forEach(r => adsResults.set(r.clientId, r.data))
    }

    // Step 4: Batch fetch GA data (parallel, 5 at a time)
    const clientsWithGA = clientsData.filter(c => c.gaPropertyId)
    console.log(`[Admin Overview] Fetching GA for ${clientsWithGA.length} clients`)

    const gaResults = new Map<string, any>()

    for (let i = 0; i < clientsWithGA.length; i += BATCH_SIZE) {
      const batch = clientsWithGA.slice(i, i + BATCH_SIZE)
      const batchPromises = batch.map(async (client) => {
        try {
          const gaConnector = new GoogleAnalyticsConnector(client.slug)
          const result = await Promise.race([
            gaConnector.getBasicMetrics(timeRange, client.gaPropertyId),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), TIMEOUT_MS))
          ])
          // Also fetch events
          const events = await Promise.race([
            gaConnector.getEventCounts(timeRange, client.gaPropertyId),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
          ]).catch(() => ({ formSubmissions: 0, phoneCalls: 0, clickToChat: 0 }))

          return { clientId: client.id, data: result, events }
        } catch (error) {
          console.log(`[Admin Overview] GA error for ${client.name}:`, (error as Error).message)
          return { clientId: client.id, data: null, events: null }
        }
      })

      const batchResults = await Promise.all(batchPromises)
      batchResults.forEach(r => gaResults.set(r.clientId, { metrics: r.data, events: r.events }))
    }

    // Step 5: Batch fetch Search Console data (for Google Rank and Keywords)
    const clientsWithGSC = clientsData.filter(c => c.gscSiteUrl)
    console.log(`[Admin Overview] Fetching Search Console for ${clientsWithGSC.length} clients`)

    const gscResults = new Map<string, any>()

    try {
      const auth = getSearchConsoleAuth()

      for (let i = 0; i < clientsWithGSC.length; i += BATCH_SIZE) {
        const batch = clientsWithGSC.slice(i, i + BATCH_SIZE)
        const batchPromises = batch.map(async (client) => {
          try {
            const result = await Promise.race([
              fetchSearchConsoleQueries(auth, client.gscSiteUrl, startDate, endDate),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), TIMEOUT_MS))
            ])
            return { clientId: client.id, data: result }
          } catch (error) {
            console.log(`[Admin Overview] GSC error for ${client.name}:`, (error as Error).message)
            return { clientId: client.id, data: null }
          }
        })

        const batchResults = await Promise.all(batchPromises)
        batchResults.forEach(r => gscResults.set(r.clientId, { queries: r.data }))
      }
    } catch (error) {
      console.log('[Admin Overview] Search Console auth error:', (error as Error).message)
    }

    // Step 6: Aggregate results for each client
    // OPTIMIZED: Only return fields actually used in the admin table
    const results = clientsData.map(client => {
      const adsData = adsResults.get(client.id)
      const gaData = gaResults.get(client.id)
      const gscData = gscResults.get(client.id)

      // Google Ads metrics
      const googleAdsConversions = Math.round(adsData?.totalMetrics?.conversions || 0)
      const adSpend = Math.round((adsData?.totalMetrics?.cost || 0) * 100) / 100  // Round to 2 decimals

      // GA metrics - REMOVED: traffic (not displayed in table)
      const formFills = gaData?.events?.formSubmissions || 0

      // Search Console metrics
      let googleRank: number | undefined
      let topKeywords: number | undefined

      if (gscData?.queries && Array.isArray(gscData.queries)) {
        // Count keywords in top 10
        topKeywords = gscData.queries.filter((q: any) => q.position <= 10).length

        // Calculate average position for chiropractor-related queries as Google Rank
        const chiropractorQueries = gscData.queries.filter((q: any) => {
          const query = q.query.toLowerCase()
          return query.includes('chiropractor') || query.includes('chiropractic')
        })

        if (chiropractorQueries.length > 0) {
          const totalPosition = chiropractorQueries.reduce((sum: number, q: any) => sum + q.position, 0)
          googleRank = Math.round((totalPosition / chiropractorQueries.length) * 10) / 10
        }
      }

      // Calculate total leads (Ads conversions + Form fills)
      // Note: GBP calls are NOT included here to avoid slowing down the overview
      const totalLeads = googleAdsConversions + formFills

      // Calculate CPL - round to 2 decimals for smaller payload
      const cpl = totalLeads > 0 ? Math.round((adSpend / totalLeads) * 100) / 100 : 0

      // OPTIMIZED: Only return fields actually used in the admin table
      // REMOVED: traffic (not displayed)
      // KEPT: adSpend, cpl (used for underperforming calculations)
      return {
        id: client.id,
        name: client.name,
        slug: client.slug,
        googleAdsConversions,
        formFills,
        adSpend,
        cpl,
        googleRank,
        topKeywords,
        totalLeads,
        services: client.services,
      }
    })

    const duration = Date.now() - startTime
    console.log(`✅ [Admin Overview] Completed in ${duration}ms for ${results.length} clients`)

    // Cache for 5 minutes
    fastCache.set(cacheKey, results, 300)

    return NextResponse.json({
      success: true,
      clients: results,
      cached: false,
      duration
    })

  } catch (error: any) {
    console.error('[Admin Overview] Fatal error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

// Helper: Get Search Console auth client
function getSearchConsoleAuth() {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL

  if (!privateKey || !clientEmail) {
    throw new Error('Missing Google service account credentials')
  }

  return new JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly']
  })
}

// Helper: Fetch Search Console queries
async function fetchSearchConsoleQueries(
  auth: JWT,
  siteUrl: string,
  startDate: string,
  endDate: string
): Promise<any[]> {
  const tokenResponse = await auth.getAccessToken()
  const token = tokenResponse.token || ''

  const encodedSiteUrl = encodeURIComponent(siteUrl)
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodedSiteUrl}/searchAnalytics/query`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      startDate,
      endDate,
      dimensions: ['query'],
      rowLimit: 100,
      dataState: 'final'
    })
  })

  if (!response.ok) {
    throw new Error(`Search Console API error: ${response.status}`)
  }

  const data = await response.json()

  return (data.rows || []).map((row: any) => ({
    query: row.keys[0],
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position
  }))
}

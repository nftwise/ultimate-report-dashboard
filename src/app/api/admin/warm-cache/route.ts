import { NextRequest, NextResponse } from 'next/server'
import { fastCache } from '@/lib/fast-cache'

/**
 * POST /api/admin/warm-cache
 * Background cache pre-warming endpoint
 *
 * This endpoint triggers a background refresh of the admin overview cache.
 * It returns immediately and fetches data in the background.
 *
 * Body params:
 * - startDate: YYYY-MM-DD format
 * - endDate: YYYY-MM-DD format
 * - force: boolean - force refresh even if cache is fresh
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { startDate, endDate, force = false } = body

    if (!startDate || !endDate) {
      return NextResponse.json({
        success: false,
        error: 'startDate and endDate are required'
      }, { status: 400 })
    }

    const cacheKey = `admin-overview-${startDate}-${endDate}`

    // Check if warming is needed
    const needsWarming = force || fastCache.needsWarming(cacheKey)

    if (!needsWarming) {
      const entry = fastCache.getEntry(cacheKey)
      const remainingMs = entry ? entry.expiresAt - Date.now() : 0
      const remainingSec = Math.round(remainingMs / 1000)

      return NextResponse.json({
        success: true,
        status: 'fresh',
        message: `Cache is fresh, expires in ${remainingSec}s`,
        cacheKey,
        expiresIn: remainingSec
      })
    }

    // Mark as warming to prevent duplicate requests
    fastCache.setWarming(cacheKey, true)

    // Start background fetch (don't await)
    warmCacheInBackground(startDate, endDate, cacheKey)
      .catch(err => {
        console.error('[Cache Warming] Background fetch failed:', err)
        fastCache.setWarming(cacheKey, false)
      })

    return NextResponse.json({
      success: true,
      status: 'warming',
      message: 'Cache warming started in background',
      cacheKey
    })

  } catch (error: any) {
    console.error('[Cache Warming] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

/**
 * GET /api/admin/warm-cache
 * Check cache status
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')

  if (!startDate || !endDate) {
    // Return general cache stats
    return NextResponse.json({
      success: true,
      stats: fastCache.getStats(),
      keys: fastCache.getKeys('admin-overview-*')
    })
  }

  const cacheKey = `admin-overview-${startDate}-${endDate}`
  const entry = fastCache.getEntry(cacheKey)

  if (!entry) {
    return NextResponse.json({
      success: true,
      status: 'empty',
      cacheKey,
      needsWarming: true
    })
  }

  const now = Date.now()
  const ttl = entry.expiresAt - entry.createdAt
  const elapsed = now - entry.createdAt
  const remaining = entry.expiresAt - now
  const percentUsed = Math.round((elapsed / ttl) * 100)

  return NextResponse.json({
    success: true,
    status: remaining > 0 ? 'valid' : 'expired',
    cacheKey,
    createdAt: new Date(entry.createdAt).toISOString(),
    expiresAt: new Date(entry.expiresAt).toISOString(),
    ttlSeconds: Math.round(ttl / 1000),
    remainingSeconds: Math.max(0, Math.round(remaining / 1000)),
    percentUsed,
    needsWarming: fastCache.needsWarming(cacheKey),
    warmingInProgress: entry.warmingInProgress || false
  })
}

/**
 * Background cache warming function
 * Fetches fresh data and updates the cache without blocking
 */
async function warmCacheInBackground(startDate: string, endDate: string, cacheKey: string) {
  const startTime = Date.now()
  console.log(`🔥 [Cache Warming] Starting background refresh for ${cacheKey}`)

  try {
    // Build the full URL for internal API call
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const url = `${baseUrl}/api/admin/overview?startDate=${startDate}&endDate=${endDate}&forceFresh=true`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()
    const duration = Date.now() - startTime

    if (data.success) {
      console.log(`✅ [Cache Warming] Completed in ${duration}ms - ${data.clients?.length || 0} clients cached`)
    } else {
      console.error(`❌ [Cache Warming] API returned error:`, data.error)
    }

  } catch (error) {
    console.error(`❌ [Cache Warming] Failed:`, error)
    throw error
  } finally {
    fastCache.setWarming(cacheKey, false)
  }
}

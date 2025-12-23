import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { JWT } from 'google-auth-library';

/**
 * GET /api/admin/test-rank-logic
 * Test the NEW ranking logic for a specific client
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const clientSlug = searchParams.get('client') || 'decarlo-chiro';

    // Get client info
    const { data: client } = await supabaseAdmin
      .from('clients')
      .select(`
        id,
        name,
        slug,
        city,
        service_configs (
          gsc_site_url
        )
      `)
      .eq('slug', clientSlug)
      .single();

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const config = Array.isArray(client.service_configs)
      ? client.service_configs[0]
      : client.service_configs || {};

    const gscSiteUrl = config.gsc_site_url;
    if (!gscSiteUrl) {
      return NextResponse.json({ error: 'No GSC site URL configured' }, { status: 400 });
    }

    // Fetch GSC data
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;

    if (!privateKey || !clientEmail) {
      return NextResponse.json({ error: 'Missing GSC credentials' }, { status: 500 });
    }

    const auth = new JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly']
    });

    const tokenResponse = await auth.getAccessToken();
    const token = tokenResponse.token || '';

    // Query last 7 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const encodedSiteUrl = encodeURIComponent(gscSiteUrl);
    const url = `https://www.googleapis.com/webmasters/v3/sites/${encodedSiteUrl}/searchAnalytics/query`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        dimensions: ['query'],
        rowLimit: 500,
        dataState: 'final'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: `GSC API error: ${response.status} - ${errorText}` }, { status: 500 });
    }

    const data = await response.json();
    const gscData = (data.rows || []).map((row: any) => ({
      query: row.keys[0],
      position: row.position,
      clicks: row.clicks,
      impressions: row.impressions
    }));

    // ========== NEW STRICTER LOGIC ==========
    const cityFull = client.city ? client.city.split(',')[0].toLowerCase().trim() : '';
    const cityWords = cityFull.split(' ').filter((w: string) => w.length > 0);
    const ambiguousWords = ['new', 'north', 'south', 'east', 'west', 'the', 'san', 'los', 'las', 'el', 'la', 'de', 'del', 'city', 'beach', 'park', 'lake', 'springs', 'hills', 'valley', 'center', 'point', 'heights'];

    const localChiroQueries = gscData.filter((q: any) => {
      const query = q.query.toLowerCase();
      const hasChiro = query.includes('chiropractor') || query.includes('chiropractic');

      if (!hasChiro || !cityFull) return false;

      // Skip placeholder keywords
      if (query.includes('[') || query.includes(']')) return false;

      // PRIORITY 1: Match full city name exactly
      if (query.includes(cityFull)) return true;

      // PRIORITY 2: Match unique identifying word (5+ chars, not ambiguous)
      const uniqueWords = cityWords.filter((w: string) => !ambiguousWords.includes(w) && w.length >= 5);
      if (uniqueWords.length > 0) {
        return uniqueWords.some((word: string) => query.includes(word));
      }

      return false;
    });

    // All chiro keywords (for comparison)
    const allChiroQueries = gscData.filter((q: any) => {
      const query = q.query.toLowerCase();
      return query.includes('chiropractor') || query.includes('chiropractic');
    });

    // Calculate new rank
    let newGoogleRank: number | null = null;
    if (localChiroQueries.length > 0) {
      const totalPosition = localChiroQueries.reduce((sum: number, q: any) => sum + q.position, 0);
      newGoogleRank = Math.round((totalPosition / localChiroQueries.length) * 10) / 10;
    }

    // Calculate old rank (all chiro keywords) for comparison
    let oldGoogleRank: number | null = null;
    if (allChiroQueries.length > 0) {
      const totalPosition = allChiroQueries.reduce((sum: number, q: any) => sum + q.position, 0);
      oldGoogleRank = Math.round((totalPosition / allChiroQueries.length) * 10) / 10;
    }

    // Find unique words used
    const uniqueWords = cityWords.filter((w: string) => !ambiguousWords.includes(w) && w.length >= 5);

    return NextResponse.json({
      success: true,
      client: {
        name: client.name,
        slug: client.slug,
        city: client.city,
        gscSiteUrl,
      },
      parsing: {
        cityFull,
        cityWords,
        uniqueWords,
        ambiguousWordsFiltered: cityWords.filter((w: string) => ambiguousWords.includes(w)),
      },
      results: {
        totalKeywords: gscData.length,
        allChiroKeywords: allChiroQueries.length,
        localChiroKeywords: localChiroQueries.length,
        oldRank_allChiro: oldGoogleRank,
        newRank_localOnly: newGoogleRank,
      },
      localChiroKeywords: localChiroQueries.slice(0, 20).map((q: any) => ({
        query: q.query,
        position: Math.round(q.position * 10) / 10,
        clicks: q.clicks,
      })),
      note: `For "New City": now only matching "city" (significant word), not "new" (common word)`
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

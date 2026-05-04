import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getPortalSession, PortalAuthError } from '@/lib/portal-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/portal/geo?clientSlug=X
 *
 * Resolves slug → client and returns AI/GEO citation data in one shot.
 * Auth: client role can only request their own slug; admin/team can request any.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getPortalSession();
    const requestedSlug = request.nextUrl.searchParams.get('clientSlug') || '';
    if (!requestedSlug) {
      return NextResponse.json({ success: false, error: 'clientSlug is required' }, { status: 400 });
    }

    // Look up client first (need the id for downstream queries)
    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('id, name, slug, city')
      .eq('slug', requestedSlug)
      .eq('is_active', true)
      .maybeSingle();

    if (!client) {
      return NextResponse.json({ success: false, error: 'Client not found' }, { status: 404 });
    }

    // Authorize: client role must match the requested slug
    if (session.role === 'client') {
      if (!session.clientId || session.clientId !== (client as any).id) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
    }

    const clientId = (client as any).id;

    const [{ data: aiDaily }, { data: aiPages }, { data: aiQueries }] = await Promise.all([
      supabaseAdmin
        .from('bing_ai_citations')
        .select('date, citations, cited_pages')
        .eq('client_id', clientId)
        .order('date', { ascending: true }),
      supabaseAdmin
        .from('bing_ai_page_citations')
        .select('page_url, citations')
        .eq('client_id', clientId)
        .order('citations', { ascending: false })
        .limit(20),
      supabaseAdmin
        .from('bing_ai_queries')
        .select('query_text, citations, date')
        .eq('client_id', clientId)
        .order('citations', { ascending: false })
        .limit(50),
    ]);

    return NextResponse.json({
      success: true,
      client,
      aiDaily: aiDaily || [],
      aiPages: aiPages || [],
      aiQueries: aiQueries || [],
    });
  } catch (err: any) {
    if (err instanceof PortalAuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    console.error('[/api/portal/geo]', err);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}

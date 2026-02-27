import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * POST /api/admin/import-bing-ai
 *
 * Imports Bing AI Citations data that cannot be fetched via BWT API.
 * Data comes from the Bing Webmaster Tools dashboard (manual export).
 *
 * Body:
 * {
 *   clientId: string,
 *   dailyCitations: Array<{ date: string; citations: number; citedPages: number }>,
 *   pageCitations:  Array<{ pageUrl: string; citations: number }>
 * }
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (!session || (role !== 'admin' && role !== 'team')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    clientId: string;
    dailyCitations?: Array<{ date: string; citations: number; citedPages: number }>;
    pageCitations?: Array<{ pageUrl: string; citations: number }>;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { clientId, dailyCitations = [], pageCitations = [] } = body;
  if (!clientId) {
    return NextResponse.json({ error: 'clientId required' }, { status: 400 });
  }

  const results: Record<string, any> = {};

  // Upsert daily citations
  if (dailyCitations.length > 0) {
    const rows = dailyCitations.map(r => ({
      client_id: clientId,
      date: r.date,
      citations: r.citations ?? 0,
      cited_pages: r.citedPages ?? 0,
    }));
    const { error } = await supabaseAdmin
      .from('bing_ai_citations')
      .upsert(rows, { onConflict: 'client_id,date' });
    results.dailyCitations = error ? { error: error.message } : { upserted: rows.length };
  }

  // Upsert page-level citations
  if (pageCitations.length > 0) {
    const rows = pageCitations.map(r => ({
      client_id: clientId,
      page_url: r.pageUrl,
      citations: r.citations ?? 0,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabaseAdmin
      .from('bing_ai_page_citations')
      .upsert(rows, { onConflict: 'client_id,page_url' });
    results.pageCitations = error ? { error: error.message } : { upserted: rows.length };
  }

  return NextResponse.json({ success: true, results });
}

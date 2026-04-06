import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// One-shot: drop confirmed-unused tables from database
export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tables = ['gbp_posts', 'gbp_reviews', 'gsc_pages', 'reveal_sessions', 'email_reports'];
  const results: Record<string, string> = {};

  for (const table of tables) {
    const { error } = await supabaseAdmin.rpc('exec_sql', {
      sql: `DROP TABLE IF EXISTS ${table} CASCADE;`
    });
    results[table] = error ? `ERROR: ${error.message}` : 'DROPPED';
  }

  return NextResponse.json({ success: true, results });
}

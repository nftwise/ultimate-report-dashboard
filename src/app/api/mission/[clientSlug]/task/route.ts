import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientSlug: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { clientSlug } = await params;
  const body = await req.json();
  const { tags, text } = body as { tags: string[]; text: string };

  if (!text?.trim() && (!tags || tags.length === 0)) {
    return NextResponse.json({ error: 'Empty task' }, { status: 400 });
  }

  // Look up client_id from slug
  const { data: client, error: clientError } = await supabaseAdmin
    .from('clients')
    .select('id, name')
    .eq('slug', clientSlug)
    .eq('is_active', true)
    .single();

  if (clientError || !client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  const userName = (session.user as any)?.name || session.user.email || 'Client';
  const title = tags.length > 0
    ? `📋 Client request: ${tags.join(', ')}`
    : `📋 Client request`;

  const description = text?.trim() || tags.join(', ');

  const { error } = await supabaseAdmin.from('mission_events').insert({
    client_id: client.id,
    client_slug: clientSlug,
    event_type: 'client_task_submitted',
    category: 'client',
    severity: 'info',
    title,
    description,
    actor: userName,
    source: 'client_portal',
    data: { tags, text, submitted_by: userName },
  });

  if (error) {
    console.error('[mission/task] insert error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

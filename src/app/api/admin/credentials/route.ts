import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { encryptPassword } from '@/lib/telegram-bot';

export const dynamic = 'force-dynamic'

// GET /api/admin/credentials?clientId=xxx
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role === 'client') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const clientId = request.nextUrl.searchParams.get('clientId');
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('bot_credentials')
    .select('id, label, username, url, notes, created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ credentials: data || [] });
}

// POST /api/admin/credentials — add credential
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role === 'client') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { client_id, label, username, password, url, notes } = body;

  if (!client_id || !label || !username || !password) {
    return NextResponse.json({ error: 'client_id, label, username, password required' }, { status: 400 });
  }

  const password_encrypted = encryptPassword(password);

  const { data, error } = await supabaseAdmin
    .from('bot_credentials')
    .insert({ client_id, label, username, password_encrypted, url: url || null, notes: notes || null })
    .select('id, label, username, url, notes, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ credential: data });
}

// DELETE /api/admin/credentials?id=xxx
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role === 'client') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { error } = await supabaseAdmin
    .from('bot_credentials')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

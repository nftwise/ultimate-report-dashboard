import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/add-user
 * Add a new user to the database (admin only)
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (!session || role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { email, role: userRole, clientId, password } = body;

    if (!email || !userRole) {
      return NextResponse.json({
        success: false,
        error: 'Email and role are required'
      }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json({ success: false, error: 'Invalid email format' }, { status: 400 });
    }

    if (!password || !password.trim()) {
      return NextResponse.json({
        success: false,
        error: 'Password is required'
      }, { status: 400 });
    }

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return NextResponse.json({
        success: false,
        error: 'User already exists'
      }, { status: 400 });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Insert new user
    const { data: newUser, error } = await supabaseAdmin
      .from('users')
      .insert({
        email,
        role: userRole,
        client_id: clientId || null,
        password_hash: passwordHash,
        is_active: true,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating user:', error);
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        is_active: newUser.is_active,
        created_at: newUser.created_at,
        last_login: null,
        client_id: newUser.client_id,
      }
    });

  } catch (error: any) {
    console.error('Error in add-user:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/add-user
 * Update user (toggle is_active or reset password) (admin only)
 */
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (!session || role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { id, is_active, password } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (is_active !== undefined) updates.is_active = is_active;
    if (password) {
      updates.password_hash = await bcrypt.hash(password, 12);
      // Bump password_version so any JWT minted before this reset is invalidated
      // by the NextAuth session callback on the user's next request.
      const { data: row } = await supabaseAdmin.from('users').select('password_version').eq('id', id).single();
      const currentVersion = typeof (row as any)?.password_version === 'number' ? (row as any).password_version : 1;
      updates.password_version = currentVersion + 1;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from('users').update(updates).eq('id', id);
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/add-user
 * Delete a user by ID (admin only)
 */
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (!session || role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from('users').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * GET /api/admin/add-user
 * List all users. Admin sees full list + login_logs. Team sees user list only (no login history).
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (!session || (role !== 'admin' && role !== 'team')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('id, email, role, client_id, is_active, created_at, last_login')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Login history is sensitive — only admin can see all users' activity
    let loginLogs: { user_id: string; logged_at: string }[] = [];
    if (role === 'admin') {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const { data: logs } = await supabaseAdmin
        .from('login_logs')
        .select('user_id, logged_at')
        .gte('logged_at', sixMonthsAgo.toISOString())
        .order('logged_at', { ascending: false })
        .limit(5000);
      loginLogs = logs || [];
    }

    return NextResponse.json({ success: true, users, loginLogs });

  } catch (error: any) {
    console.error('Error listing users:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

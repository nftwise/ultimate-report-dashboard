import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

/**
 * POST /api/admin/add-user
 * Add a new user to the database
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, role, clientId, password } = body;

    if (!email || !role) {
      return NextResponse.json({
        success: false,
        error: 'Email and role are required'
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

    // Hash password if provided (for credentials login)
    let passwordHash = null;
    if (password) {
      passwordHash = await bcrypt.hash(password, 10);
    }

    // Insert new user
    const { data: newUser, error } = await supabaseAdmin
      .from('users')
      .insert({
        email,
        role,
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
 * GET /api/admin/add-user
 * List all users
 */
export async function GET() {
  try {
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('id, email, role, client_id, is_active, created_at, last_login')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      users
    });

  } catch (error: any) {
    console.error('Error listing users:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

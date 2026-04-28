import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

// ONE-TIME endpoint — DELETE AFTER USE
export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret')
  if (secret !== 'reset-wisecrm-2026') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: users } = await supabaseAdmin
    .from('users').select('id,email,role').eq('role', 'admin')

  const hash = bcrypt.hashSync('Admin123!@#', 10)
  const { error } = await supabaseAdmin
    .from('users').update({ password_hash: hash }).eq('role', 'admin')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    success: true,
    message: 'Password reset to Admin123!@# for all admin accounts',
    admins: users?.map(u => u.email)
  })
}

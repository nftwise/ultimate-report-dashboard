import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST() {
  try {
    // Activate all clients
    const { data, error } = await supabaseAdmin
      .from('clients')
      .update({ is_active: true })
      .eq('is_active', false)
      .select('id, name, slug');

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Activated ${data?.length || 0} clients`,
      activated: data
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    // Get all clients from the database
    const { data: allClients, error: allError } = await supabaseAdmin
      .from('clients')
      .select('id, name, slug, is_active')
      .order('name', { ascending: true });

    // Get active clients only
    const { data: activeClients, error: activeError } = await supabaseAdmin
      .from('clients')
      .select('id, name, slug')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (allError || activeError) {
      return NextResponse.json({
        success: false,
        error: allError?.message || activeError?.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      total: allClients?.length || 0,
      active: activeClients?.length || 0,
      inactive: (allClients?.length || 0) - (activeClients?.length || 0),
      clients: allClients
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

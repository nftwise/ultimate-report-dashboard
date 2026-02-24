import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, slug, city, contact_name, contact_email, has_seo, has_ads, has_gbp } = body;

    if (!name || !slug || !city) {
      return NextResponse.json({ error: 'Name, slug, and city are required' }, { status: 400 });
    }

    // Check if slug already exists
    const { data: existing } = await supabaseAdmin
      .from('clients')
      .select('id')
      .eq('slug', slug)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'A client with this slug already exists' }, { status: 409 });
    }

    const { data, error } = await supabaseAdmin
      .from('clients')
      .insert({
        name,
        slug,
        city,
        contact_name: contact_name || null,
        contact_email: contact_email || null,
        has_seo: has_seo ?? false,
        has_ads: has_ads ?? false,
        has_gbp: has_gbp ?? false,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

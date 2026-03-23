import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const maxDuration = 60;

export interface FollowUpStep {
  day: number;
  message: string;
}

/**
 * GET /api/facebook/sequences
 * List all follow-up sequences for a client
 */
export async function GET(request: NextRequest) {
  try {
    const clientId = request.nextUrl.searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json(
        { error: 'Missing clientId parameter' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('follow_up_sequences')
      .select('*')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[sequences GET]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('[sequences GET] Exception:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/facebook/sequences
 * Create a new follow-up sequence
 * Body: { clientId, name, steps: [{day, message}, ...] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientId, name, steps } = body;

    if (!clientId || !name || !Array.isArray(steps) || steps.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: clientId, name, steps (non-empty array)' },
        { status: 400 }
      );
    }

    // Validate steps format
    for (const step of steps) {
      if (typeof step.day !== 'number' || typeof step.message !== 'string') {
        return NextResponse.json(
          { error: 'Each step must have day (number) and message (string)' },
          { status: 400 }
        );
      }
    }

    const { data, error } = await supabaseAdmin
      .from('follow_up_sequences')
      .insert({
        client_id: clientId,
        name,
        steps: steps as FollowUpStep[],
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('[sequences POST]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('[sequences POST] Exception:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/facebook/sequences/[id]
 * Update a sequence (name, steps, or active status)
 */
export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Missing id parameter' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { name, steps, isActive } = body;

    const updates: Record<string, any> = {};

    if (name !== undefined) {
      updates.name = name;
    }
    if (Array.isArray(steps)) {
      updates.steps = steps;
    }
    if (isActive !== undefined) {
      updates.is_active = isActive;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('follow_up_sequences')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Sequence not found' },
          { status: 404 }
        );
      }
      console.error('[sequences PATCH]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('[sequences PATCH] Exception:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/facebook/sequences/[id]
 * Delete a sequence (soft delete by setting is_active=false)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Missing id parameter' },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from('follow_up_sequences')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Sequence not found' },
          { status: 404 }
        );
      }
      console.error('[sequences DELETE]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[sequences DELETE] Exception:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

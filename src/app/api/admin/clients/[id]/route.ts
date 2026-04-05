import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// Fields that belong to service_configs, not clients
const SERVICE_CONFIG_FIELDS = ['ga_property_id', 'gads_customer_id', 'gsc_site_url', 'callrail_account_id'];

// ---------------------------------------------------------------------------
// Validation helpers (mirrors create-client validation)
// ---------------------------------------------------------------------------
function validateServiceConfigPatch(fields: Record<string, unknown>): { valid: boolean; error?: string } {
  const gaPropertyId = fields['ga_property_id'] as string | undefined;
  const gadsCustomerId = fields['gads_customer_id'] as string | undefined;
  const gscSiteUrl = fields['gsc_site_url'] as string | undefined;

  if (gaPropertyId) {
    if (!/^\d{6,12}$/.test(gaPropertyId.trim())) {
      return {
        valid: false,
        error: `Invalid ga_property_id "${gaPropertyId}": must be a numeric string of 6–12 digits (e.g. "305884406")`,
      };
    }
  }

  if (gadsCustomerId) {
    const stripped = gadsCustomerId.replace(/-/g, '').trim();
    if (!/^\d{10}$/.test(stripped)) {
      return {
        valid: false,
        error: `Invalid gads_customer_id "${gadsCustomerId}": must be 10 digits (e.g. "1234567890" or "123-456-7890")`,
      };
    }
  }

  if (gscSiteUrl) {
    if (!/^https?:\/\//i.test(gscSiteUrl.trim())) {
      return {
        valid: false,
        error: `Invalid gsc_site_url "${gscSiteUrl}": must start with http:// or https://`,
      };
    }
  }

  return { valid: true };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role === 'client') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
    }

    // Remove fields that shouldn't be updated directly
    const { id: _id, created_at, ...allFields } = body;

    // Split into clients fields vs service_configs fields
    const serviceConfigUpdates: Record<string, string | null> = {};
    const clientUpdates: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(allFields)) {
      if (SERVICE_CONFIG_FIELDS.includes(key)) {
        serviceConfigUpdates[key] = value as string | null;
      } else {
        clientUpdates[key] = value;
      }
    }

    if (Object.keys(clientUpdates).length === 0 && Object.keys(serviceConfigUpdates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    // Validate service config formats before writing
    if (Object.keys(serviceConfigUpdates).length > 0) {
      const validation = validateServiceConfigPatch(serviceConfigUpdates);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
    }

    let clientData = null;

    // Update clients table
    if (Object.keys(clientUpdates).length > 0) {
      clientUpdates.updated_at = new Date().toISOString();

      const { data, error } = await supabaseAdmin
        .from('clients')
        .update(clientUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      if (!data) {
        return NextResponse.json({ error: 'Client not found' }, { status: 404 });
      }
      clientData = data;
    }

    // Upsert service_configs table — fetch existing first to avoid overwriting other fields
    if (Object.keys(serviceConfigUpdates).length > 0) {
      const { data: existingConfig } = await supabaseAdmin
        .from('service_configs')
        .select('*')
        .eq('client_id', id)
        .maybeSingle();

      const merged = { ...(existingConfig || {}), client_id: id, ...serviceConfigUpdates };

      const { error: configError } = await supabaseAdmin
        .from('service_configs')
        .upsert(merged, { onConflict: 'client_id' });

      if (configError) {
        return NextResponse.json({ error: `service_configs update failed: ${configError.message}` }, { status: 500 });
      }
    }

    return NextResponse.json({ data: clientData });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

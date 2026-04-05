import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function validateServiceConfigs(
  gaPropertyId?: string,
  gadsCustomerId?: string,
  gscSiteUrl?: string,
  gbpLocationId?: string,
): { valid: boolean; error?: string } {
  if (gaPropertyId) {
    if (!/^\d{6,12}$/.test(gaPropertyId.trim())) {
      return {
        valid: false,
        error: `Invalid gaPropertyId "${gaPropertyId}": must be a numeric string of 6–12 digits (e.g. "305884406")`,
      };
    }
  }

  if (gadsCustomerId) {
    const stripped = gadsCustomerId.replace(/-/g, '').trim();
    if (!/^\d{10}$/.test(stripped)) {
      return {
        valid: false,
        error: `Invalid gadsCustomerId "${gadsCustomerId}": must be 10 digits (e.g. "1234567890" or "123-456-7890")`,
      };
    }
  }

  if (gscSiteUrl) {
    if (!/^https?:\/\//i.test(gscSiteUrl.trim())) {
      return {
        valid: false,
        error: `Invalid gscSiteUrl "${gscSiteUrl}": must start with http:// or https://`,
      };
    }
  }

  if (gbpLocationId) {
    const trimmed = gbpLocationId.trim();
    if (!/^locations\/\d+$/.test(trimmed) && !/^\d+$/.test(trimmed)) {
      return {
        valid: false,
        error: `Invalid gbpLocationId "${gbpLocationId}": must be "locations/DIGITS" or a numeric string`,
      };
    }
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// sync_group round-robin helper
// ---------------------------------------------------------------------------

async function assignSyncGroup(newClientId: string): Promise<string> {
  const { data: rows } = await supabaseAdmin
    .from('clients')
    .select('sync_group')
    .eq('is_active', true)
    .not('sync_group', 'is', null);

  const counts: Record<string, number> = { A: 0, B: 0, C: 0 };
  for (const row of rows || []) {
    const g = row.sync_group as string;
    if (g in counts) counts[g]++;
  }

  // Pick group with fewest members
  const group = Object.entries(counts).sort(([, a], [, b]) => a - b)[0][0] as 'A' | 'B' | 'C';

  await supabaseAdmin
    .from('clients')
    .update({ sync_group: group })
    .eq('id', newClientId);

  return group;
}

// ---------------------------------------------------------------------------
// Background backfill (fire-and-forget)
// ---------------------------------------------------------------------------

async function triggerInitialBackfill(
  clientId: string,
  clientName: string,
  hasGbp: boolean,
): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const secret = process.env.CRON_SECRET;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (secret) headers['Authorization'] = `Bearer ${secret}`;

  // Build list of dates: yesterday going back 90 days
  const dates: string[] = [];
  for (let i = 1; i <= 90; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }

  console.log(
    `[backfill] Starting 90-day background backfill for ${clientName} (${clientId}), ${dates.length} days`,
  );

  let totalGbpRecords = 0;

  for (const date of dates) {
    try {
      // Sync GA4
      await fetch(`${baseUrl}/api/cron/sync-ga4?clientId=${clientId}&date=${date}`, { headers });

      // Sync GSC
      await fetch(`${baseUrl}/api/cron/sync-gsc?clientId=${clientId}&date=${date}`, { headers });

      // Sync Google Ads
      await fetch(`${baseUrl}/api/cron/sync-ads?clientId=${clientId}&date=${date}`, { headers });

      // Sync GBP (only if client has GBP configured)
      if (hasGbp) {
        const gbpRes = await fetch(
          `${baseUrl}/api/cron/sync-gbp?clientId=${clientId}&date=${date}`,
          { headers },
        );
        if (gbpRes.ok) {
          const gbpJson = await gbpRes.json().catch(() => ({}));
          totalGbpRecords += gbpJson?.synced || 0;
        }
      }

      // Run rollup for this date
      await fetch(`${baseUrl}/api/admin/run-rollup`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ date, clientId }),
      });

      // 1 second delay to avoid overwhelming APIs
      await new Promise((r) => setTimeout(r, 1000));
    } catch (err) {
      console.error(`[backfill] Error for ${clientName} on ${date}:`, err);
      // Continue to next date — don't abort
    }
  }

  if (hasGbp && totalGbpRecords === 0) {
    console.warn(
      `[backfill] GBP returned 0 records for client ${clientName} (${clientId}) — check location ID`,
    );
  }

  console.log(`[backfill] Completed 90-day backfill for ${clientName} (${clientId})`);
}

// ---------------------------------------------------------------------------
// POST /api/admin/create-client
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role === 'client') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      slug,
      name,
      contactEmail,
      contact_email,
      contact_name,
      city,
      owner,
      has_seo,
      has_ads,
      has_gbp,
      gaPropertyId,
      gadsCustomerId,
      gscSiteUrl,
      gbpLocationId,
      callrailAccountId,
    } = body;

    const email = contactEmail || contact_email || null;

    // Validate required fields
    if (!slug || !name || !email) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: slug, name, contactEmail',
        },
        { status: 400 },
      );
    }

    // Gap 1 — Validate service config formats
    const configValidation = validateServiceConfigs(
      gaPropertyId,
      gadsCustomerId,
      gscSiteUrl,
      gbpLocationId,
    );
    if (!configValidation.valid) {
      return NextResponse.json(
        { success: false, error: configValidation.error },
        { status: 400 },
      );
    }

    // Gap 4 — GBP location ID format warning (non-blocking, checked above in validation)
    // The strict format check already runs inside validateServiceConfigs — if it passes,
    // we additionally note if it looks like a bare numeric ID (no "locations/" prefix)
    const gbpWarning =
      gbpLocationId && /^\d+$/.test(gbpLocationId.trim())
        ? `gbpLocationId "${gbpLocationId}" is a bare number — consider using "locations/${gbpLocationId}" format`
        : undefined;

    // Check if slug already exists
    const { data: existingClient } = await supabaseAdmin
      .from('clients')
      .select('slug')
      .eq('slug', slug)
      .single();

    if (existingClient) {
      return NextResponse.json(
        {
          success: false,
          error: `Client with slug "${slug}" already exists`,
        },
        { status: 400 },
      );
    }

    // Step 1: Insert client
    const { data: newClient, error: clientError } = await supabaseAdmin
      .from('clients')
      .insert({
        slug,
        name,
        contact_email: email,
        contact_name: contact_name || null,
        city: city || null,
        owner: owner || null,
        has_seo: has_seo ?? false,
        has_ads: has_ads ?? false,
        is_active: true,
      })
      .select('id')
      .single();

    if (clientError) {
      console.error('Error creating client:', clientError);
      return NextResponse.json(
        {
          success: false,
          error: `Failed to create client: ${clientError.message}`,
        },
        { status: 500 },
      );
    }

    // Step 2: Insert service_configs
    const { error: configError } = await supabaseAdmin.from('service_configs').insert({
      client_id: newClient.id,
      ga_property_id: gaPropertyId || null,
      gads_customer_id: gadsCustomerId || null,
      gsc_site_url: gscSiteUrl || null,
      callrail_account_id: callrailAccountId || null,
    });

    if (configError) {
      console.error('Error creating service config:', configError);

      // Rollback: delete the client we just created
      await supabaseAdmin.from('clients').delete().eq('id', newClient.id);

      return NextResponse.json(
        {
          success: false,
          error: `Failed to create service configuration: ${configError.message}`,
        },
        { status: 500 },
      );
    }

    // Step 3: Insert gbp_locations if GBP location ID provided
    if (gbpLocationId) {
      const { error: gbpError } = await supabaseAdmin.from('gbp_locations').insert({
        client_id: newClient.id,
        gbp_location_id: gbpLocationId,
        location_name: name,
        is_active: true,
      });

      if (gbpError) {
        console.error('Error creating GBP location (non-fatal):', gbpError);
        // Non-fatal: client + config already created, just log
      }
    }

    // Gap 3 — Auto-assign sync_group via round-robin
    const assignedGroup = await assignSyncGroup(newClient.id);
    console.log(`[create-client] Assigned sync_group=${assignedGroup} to ${name} (${newClient.id})`);

    // Gap 2 — Fire-and-forget 90-day backfill (does not block response)
    const clientHasGbp = !!(has_gbp || gbpLocationId);
    triggerInitialBackfill(newClient.id, name, clientHasGbp).catch((err) =>
      console.error('[create-client] Background backfill failed:', err),
    );

    return NextResponse.json({
      success: true,
      message: 'Client created. Backfilling 90 days of data in background.',
      client: {
        id: newClient.id,
        slug,
        name,
        sync_group: assignedGroup,
      },
      backfillStarted: true,
      backfillDays: 90,
      ...(gbpWarning ? { warning: gbpWarning } : {}),
    });
  } catch (error: any) {
    console.error('Error in create-client API:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Unknown error occurred',
      },
      { status: 500 },
    );
  }
}

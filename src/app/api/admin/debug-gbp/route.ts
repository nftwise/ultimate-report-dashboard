import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';

/**
 * GET /api/admin/debug-gbp
 * Debug GBP connection and data for a client
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const clientSlug = searchParams.get('client') || 'decarlo-chiro';

    // Get client info with GBP config
    const { data: client } = await supabaseAdmin
      .from('clients')
      .select(`
        id,
        name,
        slug,
        service_configs (
          gbp_location_id,
          gbp_connected_email
        )
      `)
      .eq('slug', clientSlug)
      .single();

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const config = Array.isArray(client.service_configs)
      ? client.service_configs[0]
      : client.service_configs || {};

    // Check OAuth token files
    const tokensDir = path.join(process.cwd(), '.oauth-tokens');
    const possibleFiles = [
      'agency-gbp-master.json',
      `${client.id}-gbp.json`,
      `${client.slug}-gbp.json`,
    ];

    const tokenStatus: any = { found: false, files: [] };

    for (const file of possibleFiles) {
      const fullPath = path.join(tokensDir, file);
      const exists = fs.existsSync(fullPath);
      tokenStatus.files.push({
        file,
        exists,
        path: fullPath
      });
      if (exists && !tokenStatus.found) {
        tokenStatus.found = true;
        tokenStatus.usedFile = file;
        try {
          const tokenData = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
          tokenStatus.hasAccessToken = !!tokenData.access_token;
          tokenStatus.hasRefreshToken = !!tokenData.refresh_token;
          tokenStatus.expiryDate = tokenData.expiry_date;
        } catch (e) {
          tokenStatus.error = 'Failed to parse token file';
        }
      }
    }

    // Check recent GBP data in database
    const { data: recentGBP } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('date, gbp_calls')
      .eq('client_id', client.id)
      .order('date', { ascending: false })
      .limit(10);

    const gbpCallsSum = (recentGBP || []).reduce((sum, r) => sum + (r.gbp_calls || 0), 0);

    return NextResponse.json({
      success: true,
      client: {
        id: client.id,
        name: client.name,
        slug: client.slug,
      },
      gbpConfig: {
        locationId: config.gbp_location_id || 'NOT SET',
        connectedEmail: config.gbp_connected_email || 'NOT SET',
        hasLocationId: !!config.gbp_location_id,
      },
      tokenStatus,
      recentData: {
        last10Days: recentGBP,
        totalGBPCalls: gbpCallsSum,
      },
      diagnosis: {
        configOK: !!config.gbp_location_id,
        tokenOK: tokenStatus.found && tokenStatus.hasAccessToken,
        dataOK: gbpCallsSum > 0,
      }
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

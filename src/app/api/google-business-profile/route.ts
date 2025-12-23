import { NextRequest, NextResponse } from 'next/server';
import { GoogleBusinessProfileConnector } from '@/lib/google-business-profile';
import { getClientConfig } from '@/lib/server-utils';
import { supabaseAdmin } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';

/**
 * GET /api/google-business-profile
 * Fetch Google Business Profile performance metrics
 *
 * Query params:
 * - clientId: Client identifier
 * - period: Time period (7days, 30days, 90days)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const clientId = searchParams.get('clientId');
    const period = searchParams.get('period') || '30days';

    if (!clientId) {
      return NextResponse.json({
        success: false,
        error: 'clientId parameter is required'
      }, { status: 400 });
    }

    // Get client configuration
    const clientConfig = await getClientConfig(clientId);

    if (!clientConfig) {
      return NextResponse.json({
        success: false,
        error: 'Client not found'
      }, { status: 404 });
    }

    // Check if client has GBP location ID configured
    if (!clientConfig.gbpLocationId || clientConfig.gbpLocationId.trim() === '') {
      return NextResponse.json({
        success: false,
        error: 'Google Business Profile not configured for this client'
      }, { status: 404 });
    }

    // Calculate date range based on period
    const endDate = new Date();
    const startDate = new Date();

    switch (period) {
      case '7days':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30days':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90days':
        startDate.setDate(endDate.getDate() - 90);
        break;
      default:
        startDate.setDate(endDate.getDate() - 30);
    }

    const timeRange = {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      period: period as 'today' | '7days' | '30days' | '90days' | 'custom',
    };

    // Check if client has OAuth tokens stored in file
    let gbpConnector: GoogleBusinessProfileConnector;
    let refreshToken: string | null = null;

    try {
      const tokenFile = path.join(process.cwd(), '.oauth-tokens', `${clientId}-gbp.json`);

      if (fs.existsSync(tokenFile)) {
        const tokenData = JSON.parse(fs.readFileSync(tokenFile, 'utf-8'));
        refreshToken = tokenData.refresh_token;
        console.log('[GBP API] Found OAuth tokens in file for client:', clientId);
      }
    } catch (error: any) {
      console.log('[GBP API] No OAuth tokens file found:', error.message);
    }

    if (refreshToken) {
      // Use OAuth2 authentication
      console.log('[GBP API] Using OAuth2 authentication for client:', clientId);
      gbpConnector = new GoogleBusinessProfileConnector(true, refreshToken);
    } else {
      // Fallback to service account (will likely fail)
      console.log('[GBP API] No OAuth tokens found, using service account (may fail)');
      gbpConnector = new GoogleBusinessProfileConnector();
    }

    // Fetch GBP metrics
    const metrics = await gbpConnector.getPerformanceMetrics(
      clientConfig.gbpLocationId,
      timeRange
    );

    // Get connected email from service_configs (if available)
    let connectedEmail: string | null = null;
    try {
      const { data: serviceConfig } = await supabaseAdmin
        .from('service_configs')
        .select('gbp_connected_email')
        .eq('client_id', clientId)
        .single();

      connectedEmail = serviceConfig?.gbp_connected_email || null;
    } catch (error) {
      console.log('[GBP API] Could not fetch connected email from database');
    }

    return NextResponse.json({
      success: true,
      data: {
        metrics,
        timeRange,
        locationId: clientConfig.gbpLocationId,
        connectedEmail,
      },
      timestamp: new Date().toISOString(),
      cached: false,
    });

  } catch (error: any) {
    console.error('Error in Google Business Profile API:', error);

    // Handle specific API errors
    if (error.message.includes('403')) {
      return NextResponse.json({
        success: false,
        error: 'Access denied. Please ensure the API is enabled and you have proper permissions.',
        details: error.message,
      }, { status: 403 });
    }

    if (error.message.includes('404')) {
      return NextResponse.json({
        success: false,
        error: 'Location not found. Please check the location ID.',
        details: error.message,
      }, { status: 404 });
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch Google Business Profile data',
      details: error.message,
    }, { status: 500 });
  }
}

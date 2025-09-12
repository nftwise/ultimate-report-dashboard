import { NextRequest, NextResponse } from 'next/server';
import { CallRailConnector } from '@/lib/callrail';
import { withCache, cacheKeys } from '@/lib/cache';
import { getTimeRangeDates } from '@/lib/utils';
import { getClientConfig } from '@/lib/server-utils';
import { ApiResponse } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || '7days';
    const report = searchParams.get('report') || searchParams.get('type') || 'calls';
    const clientId = searchParams.get('clientId');
    const timeRange = getTimeRangeDates(period);

    // Get client-specific configuration
    const clientConfig = clientId ? await getClientConfig(clientId) : null;
    const callrailAccountId = clientConfig?.callrailAccountId;

    const connector = new CallRailConnector();

    let result;
    
    switch (report) {
      case 'status':
        // Simple status check - verify API credentials
        try {
          if (!process.env.CALLRAIL_API_TOKEN && !process.env.CALLRAIL_API_KEY) {
            throw new Error('Missing CallRail API credentials');
          }
          result = { data: { status: 'connected' }, cached: false };
        } catch (error) {
          throw new Error(`CallRail API configuration error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        break;
        
      case 'calls':
      case 'overview':
        result = await withCache(
          `${cacheKeys.callRail(timeRange)}_${clientId}`,
          () => connector.getCallsReport(timeRange, callrailAccountId)
        );
        break;
        
      case 'calls-list':
        result = await withCache(
          `cr_calls_list_${period}_${clientId}`,
          () => connector.getCallsReport(timeRange, callrailAccountId)
        );
        break;
        
      case 'tracking-numbers':
        result = await withCache(
          `cr_tracking_numbers_${clientId}`,
          () => connector.getCallsReport(timeRange, callrailAccountId)
        );
        break;
        
      case 'by-day':
        result = await withCache(
          `${cacheKeys.callsByDay(timeRange)}_${clientId}`,
          () => connector.getCallsByDay(timeRange, callrailAccountId)
        );
        break;
        
      case 'by-source':
        result = await withCache(
          `${cacheKeys.callsBySource(timeRange)}_${clientId}`,
          () => connector.getCallsBySource(timeRange, callrailAccountId)
        );
        break;
        
      case 'by-tracking-number':
        result = await withCache(
          `cr_by_tracking_${period}_${clientId}`,
          () => connector.getCallsByTrackingNumber(timeRange, callrailAccountId)
        );
        break;
        
      case 'recent-calls':
        result = await withCache(
          `cr_recent_calls_${period}_${clientId}`,
          () => connector.getRecentCalls(timeRange, callrailAccountId, 10)
        );
        break;
        
      default:
        throw new Error(`Unknown report type: ${report}`);
    }

    const response: ApiResponse<any> = {
      success: true,
      data: result.data,
      timestamp: new Date().toISOString(),
      cached: result.cached,
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('CallRail API error:', error);
    
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to fetch CallRail data',
      timestamp: new Date().toISOString(),
      cached: false,
    };

    return NextResponse.json(response, { status: 500 });
  }
}
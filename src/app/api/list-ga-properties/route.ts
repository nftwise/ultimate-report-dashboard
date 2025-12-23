import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * GET /api/list-ga-properties
 * List all GA4 properties accessible via OAuth token
 */
export async function GET(request: NextRequest) {
  try {
    // Get session for OAuth token
    const session = await getServerSession(authOptions) as { user?: { accessToken?: string } } | null;
    const accessToken = session?.user?.accessToken;

    if (!accessToken) {
      return NextResponse.json({
        success: false,
        error: 'No OAuth access token available',
        message: 'Please sign in with Google OAuth to list properties'
      }, { status: 401 });
    }

    console.log('[ListGA] Fetching all GA4 properties...');

    const properties: Array<{
      propertyId: string;
      displayName: string;
      accountId: string;
      accountName: string;
      websiteUrl?: string;
    }> = [];

    // Fetch account summaries from Admin API
    const gaResponse = await fetch(
      'https://analyticsadmin.googleapis.com/v1beta/accountSummaries',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!gaResponse.ok) {
      const errorText = await gaResponse.text();
      console.error('[ListGA] Admin API error:', gaResponse.status, errorText);

      // If Admin API fails, return error with details
      return NextResponse.json({
        success: false,
        error: `GA4 Admin API returned ${gaResponse.status}`,
        details: errorText,
        hint: gaResponse.status === 403
          ? 'The analytics.edit scope may be required. Please sign out and sign back in to grant the new permission.'
          : 'Check if the Google account has access to any GA4 properties.'
      }, { status: gaResponse.status });
    }

    const gaData = await gaResponse.json();

    if (!gaData.accountSummaries || gaData.accountSummaries.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No GA4 accounts found for this Google account',
        properties: [],
        total: 0
      });
    }

    // Process each account and property
    for (const account of gaData.accountSummaries) {
      const accountId = account.account?.replace('accounts/', '') || '';
      const accountName = account.displayName || 'Unknown Account';

      if (account.propertySummaries) {
        for (const property of account.propertySummaries) {
          const propertyId = property.property.replace('properties/', '');

          const propEntry = {
            propertyId,
            displayName: property.displayName,
            accountId,
            accountName,
            websiteUrl: undefined as string | undefined,
          };

          // Fetch data streams to get website URL
          try {
            const streamsResponse = await fetch(
              `https://analyticsadmin.googleapis.com/v1beta/properties/${propertyId}/dataStreams`,
              {
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                },
              }
            );

            if (streamsResponse.ok) {
              const streamsData = await streamsResponse.json();
              const webStream = streamsData.dataStreams?.find(
                (s: any) => s.type === 'WEB_DATA_STREAM' && s.webStreamData?.defaultUri
              );
              if (webStream) {
                propEntry.websiteUrl = webStream.webStreamData.defaultUri;
              }
            }
          } catch (e) {
            // Ignore stream fetch errors
          }

          properties.push(propEntry);
          console.log(`[ListGA] Found: ${property.displayName} (${propertyId}) - ${propEntry.websiteUrl || 'no website'}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      properties,
      total: properties.length,
      accounts: gaData.accountSummaries.length
    });

  } catch (error: any) {
    console.error('[ListGA] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to list GA4 properties',
      details: error.message
    }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { GoogleAdsApi } from 'google-ads-api';

export async function GET(request: NextRequest) {
  try {
    const diagnostics: any = {
      timestamp: new Date().toISOString(),
      accessLevel: 'Basic Access',
      checks: [],
      accessibleCustomers: [],
      errors: [],
      recommendations: []
    };

    // Check 1: Environment Variables
    diagnostics.checks.push({
      name: 'Environment Variables',
      status: 'checking'
    });

    const requiredEnvVars = [
      'GOOGLE_ADS_DEVELOPER_TOKEN',
      'GOOGLE_ADS_CLIENT_ID',
      'GOOGLE_ADS_CLIENT_SECRET',
      'GOOGLE_ADS_REFRESH_TOKEN'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
      diagnostics.checks.push({
        name: 'Environment Variables',
        status: 'failed',
        message: `Missing variables: ${missingVars.join(', ')}`
      });
      diagnostics.errors.push(`Missing environment variables: ${missingVars.join(', ')}`);
      return NextResponse.json(diagnostics);
    }

    diagnostics.checks.push({
      name: 'Environment Variables',
      status: 'passed',
      message: 'All required environment variables are set'
    });

    // Check 2: Initialize Google Ads Client
    diagnostics.checks.push({
      name: 'Initialize Client',
      status: 'checking'
    });

    let client: GoogleAdsApi;
    try {
      client = new GoogleAdsApi({
        client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
        client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
        developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
      });

      diagnostics.checks.push({
        name: 'Initialize Client',
        status: 'passed',
        message: 'Google Ads client initialized successfully'
      });
    } catch (error: any) {
      diagnostics.checks.push({
        name: 'Initialize Client',
        status: 'failed',
        message: error.message
      });
      diagnostics.errors.push(`Client initialization failed: ${error.message}`);
      return NextResponse.json(diagnostics, { status: 500 });
    }

    // Check 3: List Accessible Customers
    diagnostics.checks.push({
      name: 'List Accessible Customers',
      status: 'checking'
    });

    try {
      // Create a customer instance with MCC ID to list accessible customers
      const customer = client.Customer({
        customer_id: process.env.GOOGLE_ADS_MCC_ID || '0000000000',
        refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
      });

      // Try to list accessible customers
      const query = `
        SELECT
          customer_client.id,
          customer_client.descriptive_name,
          customer_client.currency_code,
          customer_client.manager,
          customer_client.level,
          customer_client.status
        FROM customer_client
        WHERE customer_client.status = 'ENABLED'
      `;

      try {
        const results = await Promise.race([
          customer.query(query),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout after 10 seconds')), 10000)
          )
        ]) as any[];

        diagnostics.checks.push({
          name: 'List Accessible Customers',
          status: 'passed',
          message: `Found ${results.length} accessible customer(s)`
        });

        diagnostics.accessibleCustomers = results.map((row: any) => ({
          customerId: row.customer_client.id?.toString(),
          name: row.customer_client.descriptive_name || 'Unknown',
          currency: row.customer_client.currency_code || 'USD',
          isManager: row.customer_client.manager || false,
          level: row.customer_client.level || 0,
          status: row.customer_client.status || 'UNKNOWN'
        }));

      } catch (queryError: any) {
        // If the query fails, try a different approach - just test with a customer ID
        diagnostics.checks.push({
          name: 'List Accessible Customers',
          status: 'warning',
          message: 'Could not list customers via query, will test direct access'
        });
        diagnostics.errors.push(`Query failed: ${queryError.message}`);
      }

    } catch (error: any) {
      diagnostics.checks.push({
        name: 'List Accessible Customers',
        status: 'failed',
        message: error.message
      });
      diagnostics.errors.push(`Failed to list customers: ${error.message}`);
    }

    // Check 4: Test Specific Customer ID (from clients.json or env)
    const testCustomerId = '2812810609'; // The customer ID from your clients.json

    diagnostics.checks.push({
      name: `Test Customer ID: ${testCustomerId}`,
      status: 'checking'
    });

    try {
      const customer = client.Customer({
        customer_id: testCustomerId,
        refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
      });

      const query = `
        SELECT
          customer.id,
          customer.descriptive_name,
          customer.currency_code,
          customer.status
        FROM customer
        LIMIT 1
      `;

      const results = await Promise.race([
        customer.query(query),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout after 10 seconds')), 10000)
        )
      ]) as any[];

      if (results && results.length > 0) {
        diagnostics.checks.push({
          name: `Test Customer ID: ${testCustomerId}`,
          status: 'passed',
          message: `Successfully accessed customer: ${results[0].customer.descriptive_name || testCustomerId}`
        });

        diagnostics.testedCustomer = {
          customerId: testCustomerId,
          name: results[0].customer.descriptive_name,
          currency: results[0].customer.currency_code,
          status: results[0].customer.status,
          accessible: true
        };
      }

    } catch (error: any) {
      diagnostics.checks.push({
        name: `Test Customer ID: ${testCustomerId}`,
        status: 'failed',
        message: error.message
      });
      diagnostics.errors.push(`Cannot access customer ${testCustomerId}: ${error.message}`);

      diagnostics.testedCustomer = {
        customerId: testCustomerId,
        accessible: false,
        error: error.message
      };

      // Parse the error to give helpful recommendations
      if (error.message.includes('PERMISSION_DENIED') || error.message.includes('permission')) {
        diagnostics.recommendations.push({
          issue: 'Permission Denied',
          solution: 'The refresh token does not have permission to access this customer ID',
          steps: [
            'Verify you have Admin or Standard (edit) access to this Google Ads account',
            'Go to https://ads.google.com/aw/overview and check if you can see this account',
            'If not, ask the account owner to add your email with Admin access',
            'Or regenerate the refresh token while logged in as a user with access'
          ]
        });
      }

      if (error.message.includes('AUTHENTICATION_ERROR') || error.message.includes('authentication')) {
        diagnostics.recommendations.push({
          issue: 'Authentication Error',
          solution: 'The refresh token is invalid or expired',
          steps: [
            'Regenerate the refresh token using OAuth Playground',
            'Ensure you are logged in as the correct Google account',
            'Use scope: https://www.googleapis.com/auth/adwords',
            'Update GOOGLE_ADS_REFRESH_TOKEN in environment variables'
          ]
        });
      }

      if (error.message.includes('NOT_FOUND') || error.message.includes('not found')) {
        diagnostics.recommendations.push({
          issue: 'Customer Not Found',
          solution: 'The customer ID does not exist or is not accessible',
          steps: [
            'Verify the customer ID is correct: 2812810609',
            'Check if the account is active (not deleted or suspended)',
            'Try with a different customer ID that you know you have access to',
            'Format should be 10 digits without hyphens'
          ]
        });
      }

      if (error.message.includes('developer token')) {
        diagnostics.recommendations.push({
          issue: 'Developer Token Issue',
          solution: 'Issue with developer token access level',
          steps: [
            'Basic Access should work for accounts you have permission for',
            'Verify the token is not suspended or revoked',
            'Consider applying for Standard Access for better reliability',
            'Check token status at: https://ads.google.com/aw/apicenter'
          ]
        });
      }
    }

    // Final recommendations
    if (diagnostics.accessibleCustomers.length === 0 && diagnostics.errors.length > 0) {
      diagnostics.recommendations.push({
        issue: 'No Accessible Customers Found',
        solution: 'Cannot access any Google Ads accounts with current credentials',
        steps: [
          '1. Verify your refresh token is correct and not expired',
          '2. Ensure you have Admin or Edit access to at least one Google Ads account',
          '3. Try regenerating the refresh token with the correct Google account',
          '4. Check https://ads.google.com/aw/overview to see which accounts you can access'
        ]
      });
    }

    if (diagnostics.accessibleCustomers.length > 0 && !diagnostics.testedCustomer?.accessible) {
      diagnostics.recommendations.push({
        issue: 'Customer ID Mismatch',
        solution: `You have access to ${diagnostics.accessibleCustomers.length} account(s), but not the one configured (${testCustomerId})`,
        steps: [
          'Update the googleAdsCustomerId in src/data/clients.json',
          'Use one of the accessible customer IDs listed above',
          'Or get access added to customer ID ' + testCustomerId
        ]
      });
    }

    // Summary
    diagnostics.summary = {
      totalChecks: diagnostics.checks.length,
      passed: diagnostics.checks.filter((c: any) => c.status === 'passed').length,
      failed: diagnostics.checks.filter((c: any) => c.status === 'failed').length,
      warnings: diagnostics.checks.filter((c: any) => c.status === 'warning').length,
      accessibleCustomerCount: diagnostics.accessibleCustomers.length,
      canAccessTargetCustomer: diagnostics.testedCustomer?.accessible || false
    };

    return NextResponse.json(diagnostics);

  } catch (error: any) {
    console.error('Diagnostic error:', error);
    return NextResponse.json({
      error: 'Diagnostic failed',
      message: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { sendDashboardReport } from '@/lib/email-service';

export async function POST(request: NextRequest) {
  try {
    // Get user from cookie
    const userCookie = request.cookies.get('user');
    if (!userCookie) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userData = JSON.parse(userCookie.value);
    
    // Get user details from cookie
    const user = {
      company_name: userData.companyName || 'Your Company',
      email: userData.email
    };

    const body = await request.json();
    const { 
      emails, 
      period = '7days', 
      attachPDF = true,
      dashboardData 
    } = body;

    // Validate email addresses
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one email address is required' },
        { status: 400 }
      );
    }

    // Validate dashboard data
    if (!dashboardData) {
      return NextResponse.json(
        { success: false, error: 'Dashboard data is required' },
        { status: 400 }
      );
    }

    // Prepare report data
    const reportData = {
      companyName: user.company_name,
      period,
      metrics: {
        totalSessions: dashboardData.googleAnalytics?.metrics?.sessions || 0,
        adSpend: dashboardData.googleAds?.totalMetrics?.cost || 0,
        phoneCalls: dashboardData.callRail?.metrics?.totalCalls || 0,
        totalConversions: dashboardData.combined?.totalConversions || 0,
        costPerClick: dashboardData.googleAds?.totalMetrics?.cpc || 0,
        costPerLead: dashboardData.combined?.overallCostPerLead || 0,
        avgCallDuration: dashboardData.callRail?.metrics?.averageDuration || 0,
        callConversionRate: dashboardData.callRail?.metrics?.conversionRate || 0,
      },
      trends: dashboardData.trends ? {
        sessionsChange: dashboardData.trends.sessionsChange || 0,
        spendChange: dashboardData.trends.spendChange || 0,
        callsChange: dashboardData.trends.callsChange || 0,
        conversionsChange: dashboardData.trends.conversionsChange || 0,
      } : undefined,
    };

    // Send email report
    const emailSent = await sendDashboardReport({
      to: emails,
      companyName: user.company_name,
      reportData,
      period,
      attachPDF,
    });

    if (emailSent) {
      return NextResponse.json({
        success: true,
        message: `Report sent successfully to ${emails.length} recipient${emails.length > 1 ? 's' : ''}`,
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Failed to send email report' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Email report API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to check email configuration
export async function GET(request: NextRequest) {
  try {
    const userCookie = request.cookies.get('user');
    if (!userCookie) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if email is configured
    const emailConfigured = !!(
      process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS
    );

    return NextResponse.json({
      success: true,
      data: {
        emailConfigured,
        smtpHost: emailConfigured ? process.env.SMTP_HOST : null,
        smtpUser: emailConfigured ? process.env.SMTP_USER : null,
      },
    });
  } catch (error) {
    console.error('Email config check error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
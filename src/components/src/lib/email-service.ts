import nodemailer from 'nodemailer';
import { format } from 'date-fns';
import { generateDashboardPDF, ReportData } from './pdf-export';

interface EmailReportOptions {
  to: string[];
  companyName: string;
  reportData: ReportData;
  period: string;
  attachPDF?: boolean;
}

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

// Create transporter based on environment variables
function createTransporter(): nodemailer.Transporter | null {
  const emailConfig: EmailConfig | null = getEmailConfig();
  
  if (!emailConfig) {
    console.warn('Email configuration not found. Email sending disabled.');
    return null;
  }

  return nodemailer.createTransport(emailConfig);
}

function getEmailConfig(): EmailConfig | null {
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_SECURE,
    SMTP_USER,
    SMTP_PASS,
  } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    return null;
  }

  return {
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT),
    secure: SMTP_SECURE === 'true',
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  };
}

export async function sendDashboardReport({
  to,
  companyName,
  reportData,
  period,
  attachPDF = true,
}: EmailReportOptions): Promise<boolean> {
  const transporter = createTransporter();
  
  if (!transporter) {
    console.error('Email transporter not available');
    return false;
  }

  try {
    // Generate email content
    const htmlContent = generateReportHTML(reportData, period);
    const textContent = generateReportText(reportData, period);

    // Prepare email options
    const mailOptions: nodemailer.SendMailOptions = {
      from: `"${companyName} Dashboard" <${process.env.SMTP_USER}>`,
      to: to.join(', '),
      subject: `${companyName} - Analytics Report (${getPeriodText(period)})`,
      text: textContent,
      html: htmlContent,
    };

    // Add PDF attachment if requested
    if (attachPDF) {
      try {
        const pdfBuffer = Buffer.from(await (await generateDashboardPDF(reportData)).arrayBuffer());
        mailOptions.attachments = [
          {
            filename: `dashboard-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ];
      } catch (pdfError) {
        console.warn('Failed to generate PDF attachment:', pdfError);
        // Continue without PDF attachment
      }
    }

    // Send email
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}

function generateReportHTML(data: ReportData, period: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${data.companyName} - Analytics Report</title>
      <style>
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          line-height: 1.6; 
          color: #333; 
          max-width: 800px; 
          margin: 0 auto; 
          padding: 20px; 
        }
        .header { 
          background: linear-gradient(135deg, #2563eb, #3b82f6); 
          color: white; 
          padding: 30px; 
          text-align: center; 
          border-radius: 8px;
          margin-bottom: 30px; 
        }
        .metric-grid { 
          display: grid; 
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
          gap: 20px; 
          margin: 30px 0; 
        }
        .metric-card { 
          background: #f8fafc; 
          border: 1px solid #e2e8f0; 
          padding: 20px; 
          border-radius: 8px; 
          text-align: center; 
        }
        .metric-value { 
          font-size: 24px; 
          font-weight: bold; 
          color: #1e40af; 
          margin: 10px 0; 
        }
        .metric-label { 
          color: #64748b; 
          font-size: 14px; 
        }
        .footer { 
          text-align: center; 
          color: #64748b; 
          font-size: 12px; 
          margin-top: 40px; 
          padding-top: 20px; 
          border-top: 1px solid #e2e8f0; 
        }
        .period { 
          background: #dbeafe; 
          padding: 10px 20px; 
          border-radius: 20px; 
          display: inline-block; 
          margin: 10px 0; 
          color: #1e40af; 
          font-weight: 500; 
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${data.companyName}</h1>
        <div class="period">${getPeriodText(period)}</div>
        <p>Analytics Report Generated on ${format(new Date(), 'MMMM dd, yyyy')}</p>
      </div>

      <div class="metric-grid">
        <div class="metric-card">
          <div class="metric-label">👥 Total Sessions</div>
          <div class="metric-value">${formatNumber(data.metrics.totalSessions)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">💰 Ad Spend</div>
          <div class="metric-value">${formatCurrency(data.metrics.adSpend)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">📞 Phone Calls</div>
          <div class="metric-value">${formatNumber(data.metrics.phoneCalls)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">🎯 Total Conversions</div>
          <div class="metric-value">${formatNumber(data.metrics.totalConversions)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">🖱️ Cost Per Click</div>
          <div class="metric-value">${formatCurrency(data.metrics.costPerClick)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">📈 Cost Per Lead</div>
          <div class="metric-value">${formatCurrency(data.metrics.costPerLead)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">⏱️ Avg Call Duration</div>
          <div class="metric-value">${formatDuration(data.metrics.avgCallDuration)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">📞 Call Conversion Rate</div>
          <div class="metric-value">${data.metrics.callConversionRate.toFixed(1)}%</div>
        </div>
      </div>

      ${data.trends ? `
        <h2>📊 Performance Trends</h2>
        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; border-radius: 4px; margin: 20px 0;">
          <p><strong>Sessions:</strong> ${data.trends.sessionsChange > 0 ? '↗️' : '↘️'} ${data.trends.sessionsChange > 0 ? '+' : ''}${data.trends.sessionsChange.toFixed(1)}%</p>
          <p><strong>Ad Spend:</strong> ${data.trends.spendChange > 0 ? '↗️' : '↘️'} ${data.trends.spendChange > 0 ? '+' : ''}${data.trends.spendChange.toFixed(1)}%</p>
          <p><strong>Phone Calls:</strong> ${data.trends.callsChange > 0 ? '↗️' : '↘️'} ${data.trends.callsChange > 0 ? '+' : ''}${data.trends.callsChange.toFixed(1)}%</p>
          <p><strong>Conversions:</strong> ${data.trends.conversionsChange > 0 ? '↗️' : '↘️'} ${data.trends.conversionsChange > 0 ? '+' : ''}${data.trends.conversionsChange.toFixed(1)}%</p>
        </div>
      ` : ''}

      <div class="footer">
        <p>Generated by Ultimate Reporting Dashboard</p>
        <p>Report ID: ${Date.now()}</p>
      </div>
    </body>
    </html>
  `;
}

function generateReportText(data: ReportData, period: string): string {
  return `
${data.companyName} - Analytics Report
${getPeriodText(period)}
Generated on ${format(new Date(), 'MMMM dd, yyyy')}

KEY METRICS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👥 Total Sessions: ${formatNumber(data.metrics.totalSessions)}
💰 Ad Spend: ${formatCurrency(data.metrics.adSpend)}
📞 Phone Calls: ${formatNumber(data.metrics.phoneCalls)}
🎯 Total Conversions: ${formatNumber(data.metrics.totalConversions)}
🖱️ Cost Per Click: ${formatCurrency(data.metrics.costPerClick)}
📈 Cost Per Lead: ${formatCurrency(data.metrics.costPerLead)}
⏱️ Avg Call Duration: ${formatDuration(data.metrics.avgCallDuration)}
📞 Call Conversion Rate: ${data.metrics.callConversionRate.toFixed(1)}%

${data.trends ? `
PERFORMANCE TRENDS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Sessions: ${data.trends.sessionsChange > 0 ? '↗️' : '↘️'} ${data.trends.sessionsChange > 0 ? '+' : ''}${data.trends.sessionsChange.toFixed(1)}%
Ad Spend: ${data.trends.spendChange > 0 ? '↗️' : '↘️'} ${data.trends.spendChange > 0 ? '+' : ''}${data.trends.spendChange.toFixed(1)}%
Phone Calls: ${data.trends.callsChange > 0 ? '↗️' : '↘️'} ${data.trends.callsChange > 0 ? '+' : ''}${data.trends.callsChange.toFixed(1)}%
Conversions: ${data.trends.conversionsChange > 0 ? '↗️' : '↘️'} ${data.trends.conversionsChange > 0 ? '+' : ''}${data.trends.conversionsChange.toFixed(1)}%
` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Generated by Ultimate Reporting Dashboard
Report ID: ${Date.now()}
  `;
}

// Helper functions
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}m ${secs}s`;
}

function getPeriodText(period: string): string {
  switch (period) {
    case 'today':
      return 'Today';
    case '7days':
      return 'Last 7 Days';
    case '30days':
      return 'Last 30 Days';
    case '90days':
      return 'Last 90 Days';
    default:
      return period;
  }
}

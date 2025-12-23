import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { format } from 'date-fns';

// Legacy interface (for backward compatibility)
export interface ReportData {
  companyName: string;
  period: string;
  metrics: {
    totalSessions: number;
    adSpend: number;
    phoneCalls: number;
    totalConversions: number;
    costPerClick: number;
    costPerLead: number;
    avgCallDuration: number;
    callConversionRate: number;
  };
  trends?: {
    sessionsChange: number;
    spendChange: number;
    callsChange: number;
    conversionsChange: number;
  };
}

// New interface for client-dashboard API data (59 metrics)
export interface ClientDashboardReportData {
  client: {
    name: string;
    city?: string;
  };
  dateRange: {
    startDate: string;
    endDate: string;
  };
  metrics: {
    googleAdsConversions: number;
    adSpend: number;
    cpl: number;
    formFills: number;
    gbpCalls: number;
    googleRank: number | null;
    topKeywords: number;
    totalLeads: number;
  };
  changes: {
    googleAdsConversions: number | null;
    adSpend: number | null;
    cpl: number | null;
    formFills: number | null;
    gbpCalls: number | null;
    totalLeads: number | null;
  };
  daily?: Array<{
    date: string;
    googleAdsConversions: number;
    adSpend: number;
    formFills: number;
    gbpCalls: number;
    totalLeads: number;
    googleRank: number | null;
    topKeywords: number;
  }>;
}

export async function generateDashboardPDF(data: ReportData): Promise<Blob> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;

  // Header
  pdf.setFillColor(37, 99, 235); // Blue color
  pdf.rect(0, 0, pageWidth, 40, 'F');
  
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(24);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Marketing Analytics Report', margin, 25);
  
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Generated on ${format(new Date(), 'MMMM dd, yyyy')}`, margin, 33);

  // Company Info
  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.text(data.companyName, margin, 60);
  
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Report Period: ${getPeriodText(data.period)}`, margin, 70);

  // Key Metrics Section
  let yPos = 90;
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Key Performance Metrics', margin, yPos);
  
  yPos += 15;
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  
  // Metrics in a table format
  const metrics = [
    { label: 'Total Sessions', value: formatNumber(data.metrics.totalSessions), icon: '👥' },
    { label: 'Ad Spend', value: formatCurrency(data.metrics.adSpend), icon: '💰' },
    { label: 'Phone Calls', value: formatNumber(data.metrics.phoneCalls), icon: '📞' },
    { label: 'Total Conversions', value: formatNumber(data.metrics.totalConversions), icon: '🎯' },
    { label: 'Cost Per Click', value: formatCurrency(data.metrics.costPerClick), icon: '🖱️' },
    { label: 'Cost Per Lead', value: formatCurrency(data.metrics.costPerLead), icon: '📈' },
    { label: 'Avg Call Duration', value: formatDuration(data.metrics.avgCallDuration), icon: '⏱️' },
    { label: 'Call Conversion Rate', value: `${data.metrics.callConversionRate.toFixed(1)}%`, icon: '📞' },
  ];

  const itemsPerRow = 2;
  const itemWidth = (pageWidth - 2 * margin - 10) / itemsPerRow;
  const itemHeight = 25;

  metrics.forEach((metric, index) => {
    const row = Math.floor(index / itemsPerRow);
    const col = index % itemsPerRow;
    const x = margin + col * (itemWidth + 5);
    const y = yPos + row * itemHeight;

    // Background box
    pdf.setFillColor(248, 250, 252);
    pdf.setDrawColor(226, 232, 240);
    pdf.rect(x, y, itemWidth, itemHeight - 5, 'FD');

    // Icon and label
    pdf.setTextColor(71, 85, 105);
    pdf.setFontSize(10);
    pdf.text(`${metric.icon} ${metric.label}`, x + 5, y + 8);
    
    // Value
    pdf.setTextColor(15, 23, 42);
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text(metric.value, x + 5, y + 16);
    pdf.setFont('helvetica', 'normal');
  });

  // Trends Section (if available)
  yPos += Math.ceil(metrics.length / itemsPerRow) * itemHeight + 20;
  
  if (data.trends && yPos < pageHeight - 100) {
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Performance Trends', margin, yPos);
    
    yPos += 15;
    pdf.setFontSize(11);
    
    const trends = [
      { label: 'Sessions', change: data.trends.sessionsChange },
      { label: 'Ad Spend', change: data.trends.spendChange },
      { label: 'Phone Calls', change: data.trends.callsChange },
      { label: 'Conversions', change: data.trends.conversionsChange },
    ];

    trends.forEach((trend, index) => {
      const isPositive = trend.change > 0;
      const arrow = isPositive ? '↗️' : trend.change < 0 ? '↘️' : '➡️';
      const color: [number, number, number] = isPositive ? [34, 197, 94] : trend.change < 0 ? [239, 68, 68] : [107, 114, 128];
      
      pdf.setTextColor(...color);
      pdf.text(`${arrow} ${trend.label}: ${trend.change > 0 ? '+' : ''}${trend.change.toFixed(1)}%`, 
        margin, yPos + index * 12);
    });
  }

  // Footer
  pdf.setTextColor(107, 114, 128);
  pdf.setFontSize(8);
  pdf.text('Generated by Ultimate Reporting Dashboard', 
    margin, pageHeight - 15);
  pdf.text(`Report ID: ${Date.now()}`, 
    pageWidth - margin - 30, pageHeight - 15);

  // Return PDF as blob
  return pdf.output('blob');
}

export async function exportElementAsPDF(
  elementId: string, 
  filename: string = 'dashboard-export.pdf'
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element with ID "${elementId}" not found`);
  }

  const canvas = await html2canvas(element, {
    useCORS: true,
    allowTaint: false,
    backgroundColor: '#ffffff',
  } as any);

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({
    orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth - 20; // 10mm margin on each side
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 10; // Top margin

  // Add first page
  pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
  heightLeft -= pageHeight - 20; // Account for margins

  // Add additional pages if content is too long
  while (heightLeft >= 0) {
    position = heightLeft - imgHeight + 10;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
    heightLeft -= pageHeight - 20;
  }

  pdf.save(filename);
}

/**
 * Generate professional PDF report from client-dashboard API data
 * Uses pre-computed metrics for fast report generation
 */
export async function generateClientReport(data: ClientDashboardReportData): Promise<Blob> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;

  // ============================================
  // HEADER - Professional branding
  // ============================================
  pdf.setFillColor(139, 115, 85); // Thorbit warm brown
  pdf.rect(0, 0, pageWidth, 45, 'F');

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(22);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Marketing Performance Report', margin, 22);

  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  pdf.text(data.client.name + (data.client.city ? ` | ${data.client.city}` : ''), margin, 32);

  // Date range
  const startFormatted = format(new Date(data.dateRange.startDate), 'MMM d, yyyy');
  const endFormatted = format(new Date(data.dateRange.endDate), 'MMM d, yyyy');
  pdf.text(`${startFormatted} - ${endFormatted}`, margin, 40);

  // Generated date (right side)
  pdf.setFontSize(9);
  pdf.text(`Generated: ${format(new Date(), 'MMM d, yyyy')}`, pageWidth - margin - 40, 40);

  // ============================================
  // KEY METRICS SECTION
  // ============================================
  let yPos = 60;

  pdf.setTextColor(59, 59, 59); // Dark gray
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Key Performance Metrics', margin, yPos);

  yPos += 12;

  // Metrics grid (2 columns)
  const metrics = [
    { label: 'Total Leads', value: formatNumber(data.metrics.totalLeads), change: data.changes.totalLeads, icon: '🎯' },
    { label: 'Ad Spend', value: formatCurrency(data.metrics.adSpend), change: data.changes.adSpend, icon: '💰' },
    { label: 'Google Ads Conversions', value: formatNumber(data.metrics.googleAdsConversions), change: data.changes.googleAdsConversions, icon: '📈' },
    { label: 'Cost Per Lead', value: formatCurrency(data.metrics.cpl), change: data.changes.cpl, isLowerBetter: true, icon: '💵' },
    { label: 'GBP Calls', value: formatNumber(data.metrics.gbpCalls), change: data.changes.gbpCalls, icon: '📞' },
    { label: 'Form Fills', value: formatNumber(data.metrics.formFills), change: data.changes.formFills, icon: '📝' },
    { label: 'Google Rank', value: data.metrics.googleRank ? `#${data.metrics.googleRank.toFixed(1)}` : 'N/A', icon: '🔍' },
    { label: 'Keywords in Top 10', value: formatNumber(data.metrics.topKeywords), icon: '🏆' },
  ];

  const itemsPerRow = 2;
  const itemWidth = (contentWidth - 8) / itemsPerRow;
  const itemHeight = 28;

  metrics.forEach((metric, index) => {
    const row = Math.floor(index / itemsPerRow);
    const col = index % itemsPerRow;
    const x = margin + col * (itemWidth + 8);
    const y = yPos + row * (itemHeight + 4);

    // Card background
    pdf.setFillColor(250, 248, 245); // Light warm background
    pdf.setDrawColor(232, 228, 222);
    pdf.roundedRect(x, y, itemWidth, itemHeight, 2, 2, 'FD');

    // Metric label
    pdf.setTextColor(107, 83, 68); // Warm brown
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`${metric.icon} ${metric.label}`, x + 5, y + 9);

    // Metric value
    pdf.setTextColor(59, 59, 59);
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text(metric.value, x + 5, y + 20);

    // Change indicator (if available)
    if (metric.change !== undefined && metric.change !== null) {
      const isPositive = metric.isLowerBetter ? metric.change < 0 : metric.change > 0;
      const isNeutral = metric.change === 0;
      const arrow = isPositive ? '↑' : metric.change < 0 ? '↓' : '→';

      if (isNeutral) {
        pdf.setTextColor(107, 114, 128); // Gray
      } else if (isPositive) {
        pdf.setTextColor(34, 197, 94); // Green
      } else {
        pdf.setTextColor(239, 68, 68); // Red
      }

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      const changeText = `${arrow} ${Math.abs(metric.change)}%`;
      pdf.text(changeText, x + itemWidth - 25, y + 20);
    }
  });

  // ============================================
  // PERFORMANCE SUMMARY
  // ============================================
  yPos += Math.ceil(metrics.length / itemsPerRow) * (itemHeight + 4) + 15;

  pdf.setTextColor(59, 59, 59);
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Period Summary', margin, yPos);

  yPos += 10;
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(75, 85, 99);

  const summaryItems = [
    `Total investment: ${formatCurrency(data.metrics.adSpend)}`,
    `Generated ${data.metrics.totalLeads} leads from all sources`,
    `Average cost per lead: ${formatCurrency(data.metrics.cpl)}`,
    data.metrics.gbpCalls > 0 ? `Received ${data.metrics.gbpCalls} phone calls via Google Business Profile` : null,
    data.metrics.googleRank ? `Average Google ranking position: ${data.metrics.googleRank.toFixed(1)}` : null,
    data.metrics.topKeywords > 0 ? `${data.metrics.topKeywords} keywords ranking in top 10 positions` : null,
  ].filter(Boolean) as string[];

  summaryItems.forEach((item, index) => {
    pdf.text(`• ${item}`, margin + 3, yPos + index * 7);
  });

  // ============================================
  // DAILY BREAKDOWN (if data available)
  // ============================================
  if (data.daily && data.daily.length > 0 && yPos < pageHeight - 80) {
    yPos += summaryItems.length * 7 + 15;

    pdf.setTextColor(59, 59, 59);
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Daily Performance Trend', margin, yPos);

    yPos += 8;

    // Simple table header
    const colWidths = [30, 25, 25, 25, 25, 25];
    const headers = ['Date', 'Leads', 'Ad Spend', 'Conv.', 'GBP Calls', 'Forms'];

    pdf.setFillColor(139, 115, 85);
    pdf.rect(margin, yPos, contentWidth, 7, 'F');

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');

    let xPos = margin + 2;
    headers.forEach((header, i) => {
      pdf.text(header, xPos, yPos + 5);
      xPos += colWidths[i];
    });

    yPos += 8;
    pdf.setTextColor(59, 59, 59);
    pdf.setFont('helvetica', 'normal');

    // Show last 10 days (most recent first)
    const recentDays = data.daily.slice(-10).reverse();

    recentDays.forEach((day, index) => {
      if (yPos > pageHeight - 30) return; // Don't overflow page

      // Alternating row background
      if (index % 2 === 0) {
        pdf.setFillColor(250, 248, 245);
        pdf.rect(margin, yPos - 4, contentWidth, 7, 'F');
      }

      xPos = margin + 2;
      const rowData = [
        format(new Date(day.date), 'MMM d'),
        day.totalLeads.toString(),
        formatCurrency(day.adSpend),
        day.googleAdsConversions.toString(),
        day.gbpCalls.toString(),
        day.formFills.toString(),
      ];

      rowData.forEach((cell, i) => {
        pdf.text(cell, xPos, yPos);
        xPos += colWidths[i];
      });

      yPos += 7;
    });
  }

  // ============================================
  // FOOTER
  // ============================================
  pdf.setTextColor(139, 115, 85);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Powered by Ultimate Reporting Dashboard', margin, pageHeight - 12);
  pdf.text(`Report ID: ${Date.now()}`, pageWidth - margin - 35, pageHeight - 12);

  return pdf.output('blob');
}

/**
 * Generate CSV export from client dashboard data
 */
export function generateClientCSV(data: ClientDashboardReportData): string {
  const headers = ['Date', 'Total Leads', 'Ad Spend', 'Google Ads Conversions', 'CPL', 'GBP Calls', 'Form Fills', 'Google Rank', 'Top Keywords'];

  if (!data.daily || data.daily.length === 0) {
    // Single summary row
    return [
      headers.join(','),
      [
        `${data.dateRange.startDate} to ${data.dateRange.endDate}`,
        data.metrics.totalLeads,
        data.metrics.adSpend.toFixed(2),
        data.metrics.googleAdsConversions,
        data.metrics.cpl.toFixed(2),
        data.metrics.gbpCalls,
        data.metrics.formFills,
        data.metrics.googleRank || 'N/A',
        data.metrics.topKeywords,
      ].join(','),
    ].join('\n');
  }

  // Daily breakdown
  const rows = data.daily.map((day) => [
    day.date,
    day.totalLeads,
    day.adSpend.toFixed(2),
    day.googleAdsConversions,
    day.totalLeads > 0 ? (day.adSpend / day.totalLeads).toFixed(2) : '0.00',
    day.gbpCalls,
    day.formFills,
    day.googleRank || 'N/A',
    day.topKeywords,
  ].join(','));

  return [headers.join(','), ...rows].join('\n');
}

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

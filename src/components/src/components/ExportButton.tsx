'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileText, Loader } from 'lucide-react';
import { generateDashboardPDF, ReportData } from '@/lib/pdf-export';
import { format } from 'date-fns';

interface ExportButtonProps {
  data: {
    companyName?: string;
    period: string;
    googleAnalytics?: any;
    googleAds?: any;
    callRail?: any;
    combined?: any;
  };
  className?: string;
}

export function ExportButton({ data, className = '' }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handlePDFExport = async () => {
    setIsExporting(true);
    
    try {
      // Prepare report data
      const reportData: ReportData = {
        companyName: data.companyName || 'Analytics Dashboard',
        period: data.period,
        metrics: {
          totalSessions: data.googleAnalytics?.metrics?.sessions || 0,
          adSpend: data.googleAds?.totalMetrics?.cost || 0,
          phoneCalls: data.callRail?.metrics?.totalCalls || 0,
          totalConversions: data.combined?.totalConversions || 0,
          costPerClick: data.googleAds?.totalMetrics?.cpc || 0,
          costPerLead: data.combined?.overallCostPerLead || 0,
          avgCallDuration: data.callRail?.metrics?.averageDuration || 0,
          callConversionRate: data.callRail?.metrics?.conversionRate || 0,
        },
      };

      // Generate PDF
      const pdfBlob = await generateDashboardPDF(reportData);
      
      // Download PDF
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `dashboard-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('PDF export failed:', error);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      onClick={handlePDFExport}
      disabled={isExporting}
      variant="outline"
      className={`flex items-center gap-2 ${className}`}
    >
      {isExporting ? (
        <>
          <Loader className="w-4 h-4 animate-spin" />
          Exporting...
        </>
      ) : (
        <>
          <FileText className="w-4 h-4" />
          Export PDF
        </>
      )}
    </Button>
  );
}

export function CSVExportButton({ 
  data, 
  filename = 'dashboard-data.csv',
  className = '' 
}: {
  data: any[];
  filename?: string;
  className?: string;
}) {
  const [isExporting, setIsExporting] = useState(false);

  const handleCSVExport = async () => {
    setIsExporting(true);
    
    try {
      if (!data || data.length === 0) {
        alert('No data available to export');
        return;
      }

      // Convert data to CSV
      const headers = Object.keys(data[0]);
      const csvContent = [
        headers.join(','),
        ...data.map(row => 
          headers.map(header => {
            const value = row[header];
            // Handle values that might contain commas
            if (typeof value === 'string' && value.includes(',')) {
              return `"${value}"`;
            }
            return value || '';
          }).join(',')
        )
      ].join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('CSV export failed:', error);
      alert('Failed to export CSV. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      onClick={handleCSVExport}
      disabled={isExporting || !data || data.length === 0}
      variant="outline"
      size="sm"
      className={`flex items-center gap-2 ${className}`}
    >
      {isExporting ? (
        <>
          <Loader className="w-3 h-3 animate-spin" />
          Exporting...
        </>
      ) : (
        <>
          <Download className="w-3 h-3" />
          CSV
        </>
      )}
    </Button>
  );
}
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatNumber, formatPercentage, formatPhoneNumber } from '@/lib/utils';
import { CSVExportButton } from '@/components/ExportButton';

interface Column {
  key: string;
  label: string;
  format?: 'currency' | 'number' | 'percentage' | 'phone' | 'none';
  align?: 'left' | 'center' | 'right';
}

interface DataTableProps {
  title: string;
  data: any[];
  columns: Column[];
  loading?: boolean;
  maxRows?: number;
}

export function DataTable({
  title,
  data,
  columns,
  loading = false,
  maxRows = 10,
}: DataTableProps) {
  const formatCellValue = (value: any, format?: Column['format']) => {
    if (value === null || value === undefined) return '-';
    
    switch (format) {
      case 'currency':
        return formatCurrency(Number(value));
      case 'number':
        return formatNumber(Number(value));
      case 'percentage':
        return formatPercentage(Number(value));
      case 'phone':
        return formatPhoneNumber(String(value));
      default:
        return String(value);
    }
  };

  const getAlignmentClass = (align?: Column['align']) => {
    switch (align) {
      case 'center':
        return 'text-center';
      case 'right':
        return 'text-right';
      default:
        return 'text-left';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded mb-4"></div>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-6 bg-gray-100 rounded mb-2"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-8">
            No data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const displayData = data.slice(0, maxRows);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{title}</span>
          <div className="flex items-center gap-2">
            {data.length > maxRows && (
              <span className="text-sm font-normal text-gray-500">
                Showing {maxRows} of {data.length} rows
              </span>
            )}
            <CSVExportButton 
              data={data} 
              filename={`${title.toLowerCase().replace(/\s+/g, '-')}.csv`}
            />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={`py-3 px-4 font-medium text-gray-700 ${getAlignmentClass(column.align)}`}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayData.map((row, index) => (
                <tr
                  key={index}
                  className={`border-b hover:bg-gray-50 ${
                    index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                  }`}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`py-3 px-4 ${getAlignmentClass(column.align)}`}
                    >
                      {formatCellValue(row[column.key], column.format)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
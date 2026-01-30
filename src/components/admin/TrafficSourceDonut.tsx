'use client';

import { useMemo } from 'react';
import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

interface DailyData {
  date: string;
  total_leads: number;
  form_fills: number;
  gbp_calls: number;
  google_ads_conversions: number;
}

interface TrafficSourceDonutProps {
  data: DailyData[];
}

export default function TrafficSourceDonut({ data }: TrafficSourceDonutProps) {
  const chartData = useMemo(() => {
    // Calculate totals
    const totalLeads = data.reduce((sum, item) => sum + (item.total_leads || 0), 0);
    const totalFormFills = data.reduce((sum, item) => sum + (item.form_fills || 0), 0);
    const totalGbpCalls = data.reduce((sum, item) => sum + (item.gbp_calls || 0), 0);
    const totalAdsConversions = data.reduce((sum, item) => sum + (item.google_ads_conversions || 0), 0);

    const totalTraffic = totalLeads + totalFormFills + totalGbpCalls;

    // Calculate percentages
    const organicPercent = totalFormFills > 0 ? Math.round((totalFormFills / totalTraffic) * 100) : 0;
    const adsPercent = totalAdsConversions > 0 ? Math.round((totalAdsConversions / totalTraffic) * 100) : 0;
    const directPercent = totalGbpCalls > 0 ? Math.round((totalGbpCalls / totalTraffic) * 100) : 0;
    const referralPercent = 100 - organicPercent - adsPercent - directPercent;

    return {
      labels: ['Organic', 'Paid Ads', 'Local Search', 'Referral'],
      datasets: [
        {
          data: [
            organicPercent || 1,
            adsPercent || 1,
            directPercent || 1,
            referralPercent || 1,
          ],
          backgroundColor: [
            '#9db5a0', // Sage (Organic)
            '#c4704f', // Coral (Ads)
            '#d9a854', // Gold (Local)
            '#a8a094', // Gray (Referral)
          ],
          borderColor: '#fff',
          borderWidth: 2,
          hoverBorderColor: '#2c2419',
          hoverBorderWidth: 3,
        },
      ],
    };
  }, [data]);

  const options: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        display: true,
        position: 'right',
        labels: {
          color: '#5c5850',
          font: {
            size: 12,
            weight: 'bold',
          },
          padding: 15,
          usePointStyle: true,
          pointStyle: 'circle',
        },
      },
      tooltip: {
        backgroundColor: 'rgba(44, 36, 25, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: '#c4704f',
        borderWidth: 1,
        padding: 12,
        displayColors: true,
        callbacks: {
          label: function (context) {
            const label = context.label || '';
            const value = context.parsed || 0;
            return `${label}: ${value}%`;
          },
        },
      },
    },
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Doughnut data={chartData} options={options} />
    </div>
  );
}

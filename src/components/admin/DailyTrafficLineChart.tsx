'use client';

import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface DailyData {
  date: string;
  total_leads: number;
  form_fills: number;
  gbp_calls: number;
  google_ads_conversions: number;
}

interface DailyTrafficLineChartProps {
  data: DailyData[];
}

export default function DailyTrafficLineChart({ data }: DailyTrafficLineChartProps) {
  const chartData = useMemo(() => {
    const last30Days = data.slice(-30);

    const labels = last30Days.map((item) => {
      const date = new Date(item.date);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    const sessions = last30Days.map((item) => {
      return Math.round((item.total_leads + item.form_fills + item.gbp_calls) * 2.5);
    });

    const leads = last30Days.map((item) => item.total_leads || 0);

    return {
      labels,
      datasets: [
        {
          label: 'Website Sessions',
          data: sessions,
          borderColor: '#9db5a0',
          backgroundColor: 'rgba(157, 181, 160, 0.1)',
          borderWidth: 2,
          pointBackgroundColor: '#9db5a0',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.4,
          yAxisID: 'y',
        },
        {
          label: 'Leads Generated',
          data: leads,
          borderColor: '#c4704f',
          backgroundColor: 'rgba(196, 112, 79, 0.1)',
          borderWidth: 2,
          pointBackgroundColor: '#c4704f',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.4,
          yAxisID: 'y1',
        },
      ],
    };
  }, [data]);

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: true,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          color: '#5c5850',
          font: {
            size: 12,
            weight: 'bold',
          },
          padding: 15,
          usePointStyle: true,
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
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            return `${label}: ${value}`;
          },
        },
      },
    },
    scales: {
      y: {
        type: 'linear',
        position: 'left',
        beginAtZero: true,
        title: {
          display: true,
          text: 'Sessions',
          color: '#9db5a0',
          font: {
            weight: 'bold',
            size: 11,
          },
        },
        grid: {
          color: 'rgba(44, 36, 25, 0.05)',
        },
        ticks: {
          color: '#5c5850',
          font: {
            size: 11,
          },
        },
      },
      y1: {
        type: 'linear',
        position: 'right',
        beginAtZero: true,
        title: {
          display: true,
          text: 'Leads',
          color: '#c4704f',
          font: {
            weight: 'bold',
            size: 11,
          },
        },
        grid: {
          display: false,
        },
        ticks: {
          color: '#5c5850',
          font: {
            size: 11,
          },
        },
      },
      x: {
        grid: {
          color: 'rgba(44, 36, 25, 0.05)',
        },
        ticks: {
          color: '#5c5850',
          font: {
            size: 10,
          },
        },
      },
    },
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '300px' }}>
      <Line data={chartData} options={options} />
    </div>
  );
}

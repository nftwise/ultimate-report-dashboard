'use client';

import { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface SixMonthData {
  date: string;
  total_leads: number;
}

interface SixMonthBarChartProps {
  data: SixMonthData[];
}

export default function SixMonthBarChart({ data }: SixMonthBarChartProps) {
  const chartData = useMemo(() => {
    // Group data by month and sum leads
    const monthlyLeads: { [key: string]: number } = {};

    data.forEach((item) => {
      const date = new Date(item.date);
      const monthKey = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

      if (!monthlyLeads[monthKey]) {
        monthlyLeads[monthKey] = 0;
      }
      monthlyLeads[monthKey] += item.total_leads || 0;
    });

    const labels = Object.keys(monthlyLeads);
    const values = Object.values(monthlyLeads);

    return {
      labels,
      datasets: [
        {
          label: 'Leads Generated',
          data: values,
          backgroundColor: 'rgba(196, 112, 79, 0.7)',
          borderColor: '#c4704f',
          borderWidth: 1,
          borderRadius: 8,
          hoverBackgroundColor: 'rgba(196, 112, 79, 0.85)',
        },
      ],
    };
  }, [data]);

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: true,
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
        },
      },
      tooltip: {
        backgroundColor: 'rgba(44, 36, 25, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: '#c4704f',
        borderWidth: 1,
        padding: 10,
        displayColors: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: Math.max(...Object.values(chartData.datasets[0].data as number[])) || 100,
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
      x: {
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
    },
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '300px' }}>
      <Bar data={chartData} options={options} />
    </div>
  );
}

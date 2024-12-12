// src/components/DataChart.tsx
// src/components/DataChart.tsx

'use client';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Colors
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { type ChartData } from '@/types';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Colors
);

// Custom options for dark theme
const darkTheme = {
  color: 'rgb(229, 231, 235)', // text-gray-200
  grid: {
    color: 'rgba(75, 85, 99, 0.2)', // gray-600 with opacity
  }
};

export default function DataChart({ type, data }: ChartData) {
  if (!data || data.length === 0) return null;

  // Get numeric and label keys from data
  const numericKeys = data[0] ? Object.keys(data[0]).filter(key => 
    typeof data[0]?.[key] === 'number'
  ) : [];

  const labelKey = data[0] ? Object.keys(data[0]).find(key => 
    typeof data[0]?.[key] === 'string'
  ) : numericKeys[0];

  const labels = data.map(item => {
    const label = labelKey ? item[labelKey] : undefined;
    return label?.toString() || '';
  });

  // Generate datasets with gradients
  const datasets = numericKeys.map((key, index) => {
    const hue = (index * 360) / numericKeys.length;
    return {
      label: key.charAt(0).toUpperCase() + key.slice(1), // Capitalize label
      data: data.map(item => item[key]),
      borderColor: `hsl(${hue}, 70%, 60%)`,
      backgroundColor: `hsla(${hue}, 70%, 60%, 0.5)`,
      borderWidth: 2,
      tension: 0.4, // Smooth lines
      pointRadius: 4,
      pointHoverRadius: 6,
    };
  });

  const chartData = {
    labels,
    datasets,
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: darkTheme.color,
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 20,
        },
      },
      title: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.9)', // gray-900 with opacity
        titleColor: 'rgb(229, 231, 235)', // text-gray-200
        bodyColor: 'rgb(229, 231, 235)', // text-gray-200
        padding: 12,
        cornerRadius: 8,
        boxPadding: 6,
      }
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: darkTheme.color,
          maxRotation: 45,
          minRotation: 45,
        },
        border: {
          color: darkTheme.grid.color,
        },
      },
      y: {
        grid: {
          color: darkTheme.grid.color,
        },
        ticks: {
          color: darkTheme.color,
        },
        border: {
          color: darkTheme.grid.color,
        },
      },
    },
  };

  const ChartComponent = type === 'line' ? Line : Bar;

  return (
    <div className="relative w-full h-[300px] p-4">
      <ChartComponent 
        data={chartData} 
        options={options}
        className="bg-gray-900/50 rounded-lg backdrop-blur-sm"
      />
    </div>
  );
}
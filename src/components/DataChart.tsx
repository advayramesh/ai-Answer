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

  // Detect data structure
  const isGroupedData = data.some(item => 
    item.category !== undefined || 
    item.bin !== undefined || 
    item.count !== undefined
  );

  let labels, datasets;

  if (isGroupedData) {
    // For grouped/binned data
    labels = data.map(item => item.category || item.bin || 'Group');
    
    // Find numeric columns
    const numericColumns = data.length > 0 && data[0] ? Object.keys(data[0])
      .filter(key => 
        key !== 'category' && 
        key !== 'count' && 
        typeof data[0]?.[key] === 'number'
      ) 
      : [];

    datasets = numericColumns.length > 0 
      ? numericColumns.map((column, index) => {
          const hue = (index * 360) / numericColumns.length;
          return {
            label: column,
            data: data.map(item => item[column]),
            backgroundColor: `hsla(${hue}, 70%, 60%, 0.6)`,
            borderColor: `hsl(${hue}, 70%, 60%)`,
            borderWidth: 2
          };
        })
      : [{
          label: 'Count',
          data: data.map(item => item.count || 0),
          backgroundColor: 'rgba(54, 162, 235, 0.6)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 2
        }];
  } else {
    // Existing line/bar chart logic
    const numericKeys = data.length > 0 ? Object.keys(data[0]!)
      .filter(key => typeof data[0]![key] === 'number')
      : [];

    labels = data.map((_, index) => index);
    
    datasets = numericKeys.map((key, index) => {
      const hue = (index * 360) / numericKeys.length;
      return {
        label: key,
        data: data.map(item => item[key]),
        borderColor: `hsl(${hue}, 70%, 60%)`,
        backgroundColor: `hsla(${hue}, 70%, 60%, 0.5)`
      };
    });
  }

  const chartData = {
    labels,
    datasets,
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top'
      }
    },
    scales: {
      y: {
        beginAtZero: true
      }
    }
  };

  const ChartComponent = type === 'line' ? Line : Bar;

  return (
    <div className="relative w-full h-[400px] p-4">
      <ChartComponent 
        data={chartData} 
        options={options}
        className="bg-gray-900/50 rounded-lg backdrop-blur-sm"
      />
    </div>
  );
}
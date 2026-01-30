'use client';

import React from 'react';

interface SparklineWithContextProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}

export default function SparklineWithContext({
  data,
  width = 60,
  height = 28,
  color = '#9db5a0',
}: SparklineWithContextProps) {
  if (!data || data.length === 0) {
    return (
      <svg width={width} height={height} style={{ verticalAlign: 'middle' }}>
        <text x={width / 2} y={height / 2} textAnchor="middle" fontSize="10" fill="#9ca3af">
          —
        </text>
      </svg>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  // Find min and max indices
  let minIndex = 0;
  let maxIndex = 0;
  data.forEach((val, idx) => {
    if (val === min) minIndex = idx;
    if (val === max) maxIndex = idx;
  });

  // Generate points for polyline
  const points = data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * height;
      return `${x},${y}`;
    })
    .join(' ');

  // Generate polygon points for gradient fill
  const polygonPoints = `0,${height} ${points} ${width},${height}`;

  // Determine trajectory color (declining = coral, growing = sage)
  const isGrowing = data[data.length - 1] > data[0];
  const trajectoryColor = isGrowing ? '#9db5a0' : '#c4704f';

  return (
    <svg
      width={width}
      height={height}
      style={{ verticalAlign: 'middle', display: 'inline-block' }}
    >
      <defs>
        <linearGradient id={`gradient-${Math.random()}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={trajectoryColor} stopOpacity={0.3} />
          <stop offset="100%" stopColor={trajectoryColor} stopOpacity={0} />
        </linearGradient>
      </defs>

      {/* Gradient fill under the line */}
      <polygon
        points={polygonPoints}
        fill={`url(#gradient-${Math.random()})`}
      />

      {/* The line itself */}
      <polyline
        points={points}
        fill="none"
        stroke={trajectoryColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Min point (red dot) */}
      {data.length > 1 && (
        <circle
          cx={(minIndex / (data.length - 1)) * width}
          cy={height - ((min - min) / range) * height}
          r="2"
          fill="#ef4444"
          stroke="white"
          strokeWidth="0.5"
        />
      )}

      {/* Max point (green dot) */}
      {data.length > 1 && (
        <circle
          cx={(maxIndex / (data.length - 1)) * width}
          cy={height - ((max - min) / range) * height}
          r="2"
          fill="#10b981"
          stroke="white"
          strokeWidth="0.5"
        />
      )}
    </svg>
  );
}

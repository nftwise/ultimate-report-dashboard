'use client';

import React from 'react';

interface RadialProgressRingProps {
  percentage: number;
  label?: string;
  size?: number;
  strokeWidth?: number;
}

export default function RadialProgressRing({
  percentage,
  label = '',
  size = 100,
  strokeWidth = 8,
}: RadialProgressRingProps) {
  // Determine color based on percentage
  const getColor = (percent: number): string => {
    if (percent < 50) return '#c4704f'; // Coral
    if (percent < 75) return '#d9a854'; // Gold
    return '#9db5a0'; // Sage
  };

  const color = getColor(percentage);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
      <svg
        width={size}
        height={size}
        style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.05))' }}
      >
        {/* Background circle */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* Progress circle */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{
            transition: 'stroke-dashoffset 0.5s ease-out',
          }}
        />

        {/* Center text */}
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={Math.max(size / 4, 14)}
          fontWeight="bold"
          fill={color}
          style={{ fontFamily: '"Outfit", sans-serif' }}
        >
          {percentage}%
        </text>
      </svg>

      {label && (
        <p
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: '#5c5850',
            margin: 0,
            textAlign: 'center',
            fontFamily: '"Inter", sans-serif',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </p>
      )}
    </div>
  );
}

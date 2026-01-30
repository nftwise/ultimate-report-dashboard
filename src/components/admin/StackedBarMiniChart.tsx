'use client';

import React from 'react';

interface StackedBarData {
  forms: number;
  calls: number;
}

interface StackedBarMiniChartProps {
  data: StackedBarData[];
  height?: number;
}

export default function StackedBarMiniChart({
  data,
  height = 32,
}: StackedBarMiniChartProps) {
  if (!data || data.length === 0) {
    return (
      <div style={{ height: `${height}px`, display: 'flex', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', color: '#9ca3af' }}>No data</span>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: '2px',
        height: `${height}px`,
        width: '100%',
      }}
    >
      {data.map((item, index) => {
        const total = item.forms + item.calls;
        if (total === 0) {
          return (
            <div
              key={index}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column-reverse',
                height: '100%',
                borderRadius: '2px',
                background: '#f3f4f6',
                minHeight: '4px',
              }}
              title={`Week ${index + 1}: Forms ${item.forms}, Calls ${item.calls}`}
            />
          );
        }

        const formsPercentage = (item.forms / total) * 100;
        const callsPercentage = (item.calls / total) * 100;

        return (
          <div
            key={index}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column-reverse',
              height: '100%',
              borderRadius: '2px',
              overflow: 'hidden',
            }}
            title={`Week ${index + 1}: Forms ${item.forms} (${Math.round(formsPercentage)}%), Calls ${item.calls} (${Math.round(callsPercentage)}%)`}
          >
            {/* Forms (Sage) */}
            <div
              style={{
                flex: formsPercentage,
                background: '#9db5a0',
                minHeight: formsPercentage > 0 ? '2px' : '0px',
              }}
            />
            {/* Calls (Coral) */}
            <div
              style={{
                flex: callsPercentage,
                background: '#c4704f',
                minHeight: callsPercentage > 0 ? '2px' : '0px',
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

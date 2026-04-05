'use client';

import { useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface DateRangePickerProps {
  dateRange: { from: Date; to: Date };
  onDateRangeChange: (range: { from: Date; to: Date }) => void;
}

const getDaysInMonth = (date: Date) => {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
};

const getFirstDayOfMonth = (date: Date) => {
  return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
};

const PRESETS = [
  { label: 'Last 7d', days: 7 },
  { label: 'Last 30d', days: 30 },
  { label: 'Last 90d', days: 90 },
];

export default function DateRangePicker({ dateRange, onDateRangeChange }: DateRangePickerProps) {
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [tempFromDate, setTempFromDate] = useState<Date | null>(null);
  const [tempToDate, setTempToDate] = useState<Date | null>(null);

  const handlePreset = (days: number) => {
    const to = new Date(); to.setDate(to.getDate() - 1);
    const from = new Date(to); from.setDate(from.getDate() - days);
    onDateRangeChange({ from, to });
    setShowCalendar(false);
    setTempFromDate(null);
    setTempToDate(null);
  };

  const handleReset = () => {
    const to = new Date(); to.setDate(to.getDate() - 1);
    const from = new Date(to); from.setDate(from.getDate() - 30);
    onDateRangeChange({ from, to });
    setShowCalendar(false);
    setTempFromDate(null);
    setTempToDate(null);
  };

  const handleDateClick = (day: number) => {
    const selectedDate = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);

    if (tempFromDate === null) {
      setTempFromDate(selectedDate);
    } else if (tempToDate === null) {
      if (selectedDate < tempFromDate) {
        setTempToDate(tempFromDate);
        setTempFromDate(selectedDate);
      } else {
        setTempToDate(selectedDate);
      }
    }
  };

  const handleConfirm = () => {
    if (tempFromDate && tempToDate) {
      onDateRangeChange({ from: tempFromDate, to: tempToDate });
      setShowCalendar(false);
      setTempFromDate(null);
      setTempToDate(null);
    }
  };

  const handleCancel = () => {
    setShowCalendar(false);
    setTempFromDate(null);
    setTempToDate(null);
  };

  const monthName = calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const daysInMonth = getDaysInMonth(calendarMonth);
  const firstDay = getFirstDayOfMonth(calendarMonth);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const isDateInRange = (day: number) => {
    const date = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
    if (tempFromDate === null || tempToDate === null) return false;
    return date >= tempFromDate && date <= tempToDate;
  };

  const isDateStart = (day: number) => {
    const date = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
    return tempFromDate && date.toDateString() === tempFromDate.toDateString();
  };

  const isDateEnd = (day: number) => {
    const date = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
    return tempToDate && date.toDateString() === tempToDate.toDateString();
  };

  const isBothSelected = tempFromDate !== null && tempToDate !== null;

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' }}>
      {/* Reset link */}
      <button
        onClick={handleReset}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '11px',
          color: '#9ca3af',
          padding: '2px 4px',
          textDecoration: 'underline',
          transition: 'color 150ms',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = '#c4704f')}
        onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}
        title="Reset to last 30 days"
      >
        Reset
      </button>

      <button
        onClick={() => setShowCalendar(!showCalendar)}
        className="flex items-center gap-2 px-6 py-2 rounded-full text-sm font-semibold transition hover:bg-opacity-80"
        style={{
          background: '#fff',
          border: '1px solid rgba(44, 36, 25, 0.1)',
          color: '#2c2419'
        }}
      >
        <Calendar className="w-4 h-4" style={{ color: '#c4704f' }} />
        {dateRange.from.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} -{' '}
        {dateRange.to.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
      </button>

      {showCalendar && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '8px',
            background: '#fff',
            border: '1px solid rgba(44, 36, 25, 0.1)',
            borderRadius: '12px',
            padding: '16px',
            width: '300px',
            boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)',
            zIndex: 50
          }}
        >
          {/* Preset buttons row */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
            {PRESETS.map(({ label, days }) => (
              <button
                key={days}
                onClick={() => handlePreset(days)}
                style={{
                  flex: 1,
                  padding: '5px 8px',
                  background: 'rgba(196,112,79,0.08)',
                  border: '1px solid rgba(196,112,79,0.2)',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#c4704f',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = '#c4704f';
                  (e.currentTarget as HTMLButtonElement).style.color = '#fff';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(196,112,79,0.08)';
                  (e.currentTarget as HTMLButtonElement).style.color = '#c4704f';
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid rgba(44,36,25,0.08)', marginBottom: '12px' }} />

          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1))}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <ChevronLeft className="w-5 h-5" style={{ color: '#5c5850' }} />
            </button>
            <span style={{ color: '#2c2419', fontWeight: 'bold', fontSize: '14px' }}>{monthName}</span>
            <button
              onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1))}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <ChevronRight className="w-5 h-5" style={{ color: '#5c5850' }} />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
              <div
                key={day}
                style={{
                  textAlign: 'center',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#5c5850',
                  padding: '4px'
                }}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-1 mb-4">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {days.map((day) => (
              <button
                key={day}
                onClick={() => handleDateClick(day)}
                style={{
                  padding: '6px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '500',
                  border: 'none',
                  cursor: 'pointer',
                  background: isDateStart(day) || isDateEnd(day) ? '#c4704f' : isDateInRange(day) ? 'rgba(196, 112, 79, 0.2)' : 'transparent',
                  color: isDateStart(day) || isDateEnd(day) ? '#fff' : '#2c2419',
                  transition: 'all 0.2s',
                  opacity: isDateStart(day) || isDateEnd(day) ? 1 : 0.7
                }}
              >
                {day}
              </button>
            ))}
          </div>

          {/* Info text */}
          <div style={{ marginBottom: '12px', fontSize: '11px', color: '#5c5850', textAlign: 'center', minHeight: '20px' }}>
            {tempFromDate === null && 'Select start date'}
            {tempFromDate !== null && tempToDate === null && 'Select end date'}
            {tempFromDate !== null && tempToDate !== null && (
              <span style={{ color: '#c4704f', fontWeight: '600' }}>
                {tempFromDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {tempToDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleCancel}
              style={{
                flex: 1,
                padding: '8px 12px',
                background: 'rgba(44, 36, 25, 0.05)',
                border: '1px solid rgba(44, 36, 25, 0.1)',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                color: '#5c5850',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!isBothSelected}
              style={{
                flex: 1,
                padding: '8px 12px',
                background: isBothSelected ? '#c4704f' : 'rgba(196, 112, 79, 0.3)',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                color: isBothSelected ? '#fff' : 'rgba(255, 255, 255, 0.5)',
                cursor: isBothSelected ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s'
              }}
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

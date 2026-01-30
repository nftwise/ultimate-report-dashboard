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

export default function DateRangePicker({ dateRange, onDateRangeChange }: DateRangePickerProps) {
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectingStart, setSelectingStart] = useState(true);

  const handleDateClick = (day: number) => {
    const selectedDate = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);

    if (selectingStart) {
      onDateRangeChange({ from: selectedDate, to: dateRange.to });
      setSelectingStart(false);
    } else {
      if (selectedDate < dateRange.from) {
        onDateRangeChange({ from: selectedDate, to: dateRange.from });
      } else {
        onDateRangeChange({ from: dateRange.from, to: selectedDate });
      }
      setShowCalendar(false);
      setSelectingStart(true);
    }
  };

  const monthName = calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const daysInMonth = getDaysInMonth(calendarMonth);
  const firstDay = getFirstDayOfMonth(calendarMonth);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const isDateInRange = (day: number) => {
    const date = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
    return date >= dateRange.from && date <= dateRange.to;
  };

  const isDateStart = (day: number) => {
    const date = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
    return date.toDateString() === dateRange.from.toDateString();
  };

  const isDateEnd = (day: number) => {
    const date = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
    return date.toDateString() === dateRange.to.toDateString();
  };

  return (
    <div style={{ position: 'relative' }}>
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
          <div className="grid grid-cols-7 gap-1">
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
                  transition: 'all 0.2s'
                }}
              >
                {day}
              </button>
            ))}
          </div>

          {/* Info text */}
          <div style={{ marginTop: '12px', fontSize: '11px', color: '#5c5850', textAlign: 'center' }}>
            {selectingStart ? 'Select start date' : 'Select end date'}
          </div>
        </div>
      )}
    </div>
  );
}

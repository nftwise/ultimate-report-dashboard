'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { COLORS, Z_INDEX, BORDER_RADIUS, TRANSITIONS } from '@/lib/design-tokens';

interface DateRangePickerProps {
  dateRange: { from: Date; to: Date };
  onDateRangeChange: (range: { from: Date; to: Date }) => void;
}

const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const PRESETS = [
  { label: 'Last 7d',  days: 7  },
  { label: 'Last 30d', days: 30 },
  { label: 'Last 90d', days: 90 },
];

export default function DateRangePicker({ dateRange, onDateRangeChange }: DateRangePickerProps) {
  const [open, setOpen]               = useState(false);
  const [calMonth, setCalMonth]       = useState(() => new Date(dateRange.to));
  const [startDate, setStartDate]     = useState<Date | null>(null);
  const [hoverDate, setHoverDate]     = useState<Date | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number } | null>(null);
  const [mounted, setMounted]         = useState(false);
  const buttonRef                     = useRef<HTMLButtonElement>(null);
  const dropdownRef                   = useRef<HTMLDivElement>(null);

  // yesterday = max selectable date
  const yesterday = startOfDay(new Date());
  yesterday.setDate(yesterday.getDate() - 1);

  // Portal requires document to exist (SSR guard)
  useEffect(() => { setMounted(true); }, []);

  // Close on outside click — check both button and portaled dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const inButton   = buttonRef.current?.contains(target);
      const inDropdown = dropdownRef.current?.contains(target);
      if (!inButton && !inDropdown) {
        setOpen(false);
        resetTemp();
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleOpen = () => {
    setCalMonth(new Date(dateRange.to.getFullYear(), dateRange.to.getMonth(), 1));
    resetTemp();
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    }
    setOpen(true);
  };

  const resetTemp = () => {
    setStartDate(null);
    setHoverDate(null);
  };

  const applyPreset = (days: number) => {
    const to   = new Date(yesterday);
    const from = new Date(to);
    from.setDate(from.getDate() - days + 1);
    onDateRangeChange({ from, to });
    setOpen(false);
    resetTemp();
  };

  const applyReset = () => {
    const to   = new Date(yesterday);
    const from = new Date(to);
    from.setDate(from.getDate() - 29);
    onDateRangeChange({ from, to });
    setOpen(false);
    resetTemp();
  };

  const handleDayClick = (day: Date) => {
    if (day > yesterday) return;
    if (!startDate) {
      setStartDate(day);
    } else {
      const from = day < startDate ? day : startDate;
      const to   = day < startDate ? startDate : day;
      onDateRangeChange({ from, to });
      setOpen(false);
      resetTemp();
    }
  };

  const handleDayHover = (day: Date) => {
    if (startDate) setHoverDate(day);
  };

  const visualFrom = startDate && hoverDate ? (hoverDate < startDate ? hoverDate : startDate) : null;
  const visualTo   = startDate && hoverDate ? (hoverDate < startDate ? startDate : hoverDate) : null;

  const isInRange   = (day: Date) => visualFrom && visualTo ? day > visualFrom && day < visualTo : false;
  const isRangeStart = (day: Date) => !!(visualFrom && isoDate(day) === isoDate(visualFrom));
  const isRangeEnd   = (day: Date) => !!(visualTo   && isoDate(day) === isoDate(visualTo));
  const isSelected   = (day: Date) => !!(startDate && isoDate(day) === isoDate(startDate) && !hoverDate);
  const isFuture     = (day: Date) => day > yesterday;

  const year        = calMonth.getFullYear();
  const month       = calMonth.getMonth();
  const firstDow    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel  = calMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const fromLabel = dateRange.from.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const toLabel   = dateRange.to.toLocaleDateString('en-US',   { month: 'short', day: 'numeric' });

  const dayStyle = (d: Date): React.CSSProperties => {
    const future  = isFuture(d);
    const start   = isRangeStart(d);
    const end     = isRangeEnd(d);
    const inRange = isInRange(d);
    const sel     = isSelected(d);
    return {
      width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: start || end ? '50%' : inRange ? '0' : '50%',
      fontSize: '13px', fontWeight: start || end || sel ? '700' : '400',
      border: 'none', cursor: future ? 'not-allowed' : 'pointer', transition: TRANSITIONS.COLOR,
      background: start || end ? COLORS.ACCENT : sel ? COLORS.ACCENT : inRange ? COLORS.TREND_DOWN_BG : 'transparent',
      color: start || end || sel ? '#fff' : future ? COLORS.TEXT_DISABLED : COLORS.TEXT_PRIMARY,
      opacity: 1,
    };
  };

  const dropdown = open && dropdownPos && mounted ? createPortal(
    <div
      ref={dropdownRef}
      style={{
        position: 'fixed', top: dropdownPos.top, right: dropdownPos.right,
        background: '#fff', borderRadius: '14px', padding: '16px',
        width: '310px', zIndex: 99999,
        boxShadow: '0 8px 32px rgba(44,36,25,0.14), 0 1px 4px rgba(44,36,25,0.06)',
        border: '1px solid rgba(44,36,25,0.08)',
        animation: 'drpFadeIn 0.15s ease',
      }}
    >
      <style>{`@keyframes drpFadeIn { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }`}</style>

      {/* Presets */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
        {PRESETS.map(({ label, days }) => (
          <button
            key={days}
            onClick={() => applyPreset(days)}
            style={{ flex: 1, padding: '5px 0', borderRadius: '8px', fontSize: '12px', fontWeight: 600, color: COLORS.ACCENT, cursor: 'pointer', transition: TRANSITIONS.COLOR, background: COLORS.BG_ACTIVE, border: '1px solid rgba(196,112,79,0.18)' }}
            onMouseEnter={e => { e.currentTarget.style.background = COLORS.ACCENT; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = COLORS.BG_ACTIVE; e.currentTarget.style.color = COLORS.ACCENT; }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ borderTop: '1px solid rgba(44,36,25,0.07)', marginBottom: '14px' }} />

      {/* Month nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <button onClick={() => setCalMonth(new Date(year, month - 1, 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: BORDER_RADIUS.SM }} onMouseEnter={e => (e.currentTarget.style.background = COLORS.BG_HOVER)} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
          <ChevronLeft size={16} style={{ color: COLORS.TEXT_SECONDARY }} />
        </button>
        <span style={{ fontWeight: 700, fontSize: '14px', color: COLORS.TEXT_PRIMARY }}>{monthLabel}</span>
        <button onClick={() => setCalMonth(new Date(year, month + 1, 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: BORDER_RADIUS.SM }} onMouseEnter={e => (e.currentTarget.style.background = COLORS.BG_HOVER)} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
          <ChevronRight size={16} style={{ color: COLORS.TEXT_SECONDARY }} />
        </button>
      </div>

      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: '4px' }}>
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: '11px', fontWeight: 600, color: COLORS.TEXT_MUTED, padding: '4px 0' }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px' }}>
        {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const d = new Date(year, month, i + 1);
          return (
            <div key={i} style={{ display: 'flex', justifyContent: 'center' }}>
              <button onClick={() => handleDayClick(d)} onMouseEnter={() => handleDayHover(d)} onMouseLeave={() => setHoverDate(null)} style={dayStyle(d)}>
                {i + 1}
              </button>
            </div>
          );
        })}
      </div>

      {/* Status hint */}
      <div style={{ marginTop: '12px', fontSize: '11px', color: COLORS.TEXT_MUTED, textAlign: 'center', minHeight: '18px' }}>
        {!startDate && 'Click to select start date'}
        {startDate && !hoverDate && (
          <span><span style={{ color: COLORS.ACCENT, fontWeight: 600 }}>{startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>{' '}— now click end date</span>
        )}
        {startDate && hoverDate && visualFrom && visualTo && (
          <span style={{ color: COLORS.ACCENT, fontWeight: 600 }}>
            {visualFrom.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{' – '}{visualTo.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>

      {startDate && (
        <button onClick={() => resetTemp()} style={{ width: '100%', marginTop: '8px', padding: '7px', background: 'none', border: '1px solid rgba(44,36,25,0.1)', borderRadius: BORDER_RADIUS.MD, fontSize: '12px', fontWeight: 600, color: COLORS.TEXT_MUTED, cursor: 'pointer', transition: TRANSITIONS.COLOR }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = COLORS.ACCENT; e.currentTarget.style.color = COLORS.ACCENT; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(44,36,25,0.1)'; e.currentTarget.style.color = COLORS.TEXT_MUTED; }}
        >
          Start over
        </button>
      )}
    </div>,
    document.body
  ) : null;

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
      {/* Reset link */}
      <button onClick={applyReset} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: COLORS.TEXT_MUTED, padding: '2px 4px', textDecoration: 'underline', transition: TRANSITIONS.FAST }}
        onMouseEnter={e => (e.currentTarget.style.color = COLORS.ACCENT)}
        onMouseLeave={e => (e.currentTarget.style.color = COLORS.TEXT_MUTED)}
        title="Reset to last 30 days"
      >
        Reset
      </button>

      {/* Trigger button */}
      <button
        ref={buttonRef}
        onClick={open ? () => { setOpen(false); resetTemp(); } : handleOpen}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: TRANSITIONS.COLOR, background: open ? COLORS.ACCENT : '#fff', border: `1px solid ${open ? COLORS.ACCENT : 'rgba(44,36,25,0.12)'}`, color: open ? '#fff' : COLORS.TEXT_PRIMARY, boxShadow: open ? '0 2px 8px rgba(196,112,79,0.25)' : 'none' }}
      >
        <Calendar size={14} style={{ color: open ? '#fff' : '#c4704f' }} />
        {fromLabel} – {toLabel}
        {open && <X size={12} style={{ marginLeft: '2px', opacity: 0.7 }} />}
      </button>

      {dropdown}
    </div>
  );
}

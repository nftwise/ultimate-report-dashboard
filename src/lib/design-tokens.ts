// Design System Tokens — single source of truth for all UI constants

export const COLORS = {
  // Core palette
  DARK:    '#2c2419',
  ACCENT:  '#c4704f',
  GOLD:    '#d9a854',
  GREEN:   '#9db5a0',
  SUCCESS: '#10b981',

  // Text hierarchy
  TEXT_PRIMARY:   '#2c2419',
  TEXT_SECONDARY: '#5c5850',
  TEXT_MUTED:     '#9ca3af',
  TEXT_DISABLED:  'rgba(44,36,25,0.3)',

  // Error / Warning (brand-consistent, not brutal red)
  ERROR:   '#c4704f',
  WARNING: '#d9a854',

  // Backgrounds
  BG_CARD:    'rgba(255,255,255,0.9)',
  BG_HOVER:   'rgba(44,36,25,0.04)',
  BG_ACTIVE:  'rgba(196,112,79,0.08)',
  BG_OVERLAY: 'rgba(44,36,25,0.5)',

  // MoM trend colors
  TREND_UP_BG:        'rgba(157,181,160,0.15)',
  TREND_UP_TEXT:      '#4a6b4e',
  TREND_DOWN_BG:      'rgba(196,112,79,0.15)',
  TREND_DOWN_TEXT:    '#8a4a2e',
  TREND_NEUTRAL_BG:   'rgba(92,88,80,0.1)',
  TREND_NEUTRAL_TEXT: '#5c5850',
} as const;

export const Z_INDEX = {
  BASE:          0,
  STICKY_HEADER: 30,
  DROPDOWN:      100,
  MODAL_OVERLAY: 900,
  MODAL:         1000,
} as const;

export const TRANSITIONS = {
  FAST:      '120ms',
  NORMAL:    '150ms',
  SLOW:      '300ms',
  // Use specific properties, not 'all'
  COLOR:     'color 150ms ease, background-color 150ms ease',
  TRANSFORM: 'transform 150ms ease',
  SHADOW:    'box-shadow 150ms ease',
} as const;

export const FONT_SIZES = {
  XS:   '10px',  // badges, captions
  SM:   '11px',  // secondary labels
  BASE: '12px',  // body text
  MD:   '13px',  // default UI
  LG:   '14px',  // section headings
  XL:   '16px',  // card titles
  XXL:  '20px',  // page titles
} as const;

export const BORDER_RADIUS = {
  SM:   '6px',
  MD:   '8px',
  LG:   '12px',
  XL:   '16px',
  FULL: '9999px',  // pills / badges
} as const;

export const MS_PER_DAY = 86_400_000;

export const THRESHOLDS = {
  ENGAGEMENT_EXCELLENT: 60,  // %
  ENGAGEMENT_GOOD:      40,
  CTR_EXCELLENT:         5,  // %
  CTR_GOOD:              2,
  KEYWORD_TOP5:          5,
  KEYWORD_TOP10:        10,
  KEYWORD_TOP20:        20,
  POSITION_CHANGE:       0.5,  // rank change considered significant
} as const;

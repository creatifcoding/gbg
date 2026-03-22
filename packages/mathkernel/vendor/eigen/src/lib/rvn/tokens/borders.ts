/**
 * RVN Design Tokens: Borders & Shadows
 *
 * Brutalist border system:
 * - 3px solid black on major elements
 * - 2px for cards
 * - 1px for table rows
 * - NO border-radius (sharp edges only)
 * - 4px 4px box-shadow, removed on press
 */

export const RVN_BORDERS = {
  // Width
  widthPrimary: '3px',
  widthCard: '2px',
  widthTable: '1px',

  // Full border declarations
  primary: '3px solid #000000',
  card: '2px solid #000000',
  table: '1px solid #dddddd',
  tableHeader: '1px solid #000000',
  accent: '4px solid #000000', // Left accent borders

  // No radius - EVER
  radius: '0px',
} as const

export const RVN_SHADOWS = {
  // Standard shadow (4px offset)
  default: '4px 4px 0px rgba(0, 0, 0, 1)',
  lg: '6px 6px 0px rgba(0, 0, 0, 1)',

  // Pressed state (no shadow)
  pressed: 'none',

  // Inset for inputs
  inset: 'inset 0 1px 2px rgba(0, 0, 0, 0.1)',
} as const

/**
 * Critical state diagonal stripe pattern
 * Used for alerts, warnings, critical telemetry
 */
export const RVN_PATTERNS = {
  criticalStripe: 'repeating-linear-gradient(45deg, #000000, #000000 5px, #ffffff 5px, #ffffff 10px)',
  warningStripe: 'repeating-linear-gradient(45deg, #000000, #000000 3px, #e6e6e6 3px, #e6e6e6 6px)',
  disabledStripe: 'repeating-linear-gradient(45deg, #cccccc, #cccccc 2px, #ffffff 2px, #ffffff 4px)',
} as const

/**
 * Press state transform
 * Shadow removal + translate to simulate "push"
 */
export const RVN_PRESS_TRANSFORM = {
  transform: 'translate(4px, 4px)',
  boxShadow: 'none',
} as const

/**
 * CSS Custom Properties
 */
export const RVN_BORDER_VARS = {
  '--rvn-border-width': RVN_BORDERS.widthPrimary,
  '--rvn-border': RVN_BORDERS.primary,
  '--rvn-border-card': RVN_BORDERS.card,
  '--rvn-border-table': RVN_BORDERS.table,
  '--rvn-shadow': RVN_SHADOWS.default,
  '--rvn-shadow-lg': RVN_SHADOWS.lg,
  '--rvn-radius': RVN_BORDERS.radius,
} as const

/**
 * Crosshair corner decoration positions
 * Used on map frames and tactical displays
 */
export const RVN_CROSSHAIR = {
  size: '20px',
  thickness: '2px',
  color: '#000000',
  positions: {
    topLeft: { top: '10px', left: '10px' },
    topRight: { top: '10px', right: '10px' },
    bottomLeft: { bottom: '10px', left: '10px' },
    bottomRight: { bottom: '10px', right: '10px' },
  },
} as const

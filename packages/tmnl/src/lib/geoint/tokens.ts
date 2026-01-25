/**
 * GEOINT Design Tokens
 *
 * Design system constants for the All-Source Intelligence Common Operating Picture.
 * Extends TMNL base tokens with domain-specific values.
 *
 * @module geoint/tokens
 */

// =============================================================================
// INTEL SOURCE COLORS
// =============================================================================

/**
 * Color palette for different intelligence sources.
 * Each source has primary (icon/badge), secondary (hover), and muted (background) variants.
 */
export const SOURCE_COLORS = {
  track: {
    primary: '#22c55e',
    secondary: '#4ade80',
    muted: 'rgba(34, 197, 94, 0.2)',
    tailwind: {
      primary: 'text-green-500',
      secondary: 'text-green-400',
      bg: 'bg-green-500/20',
      border: 'border-green-500/30',
    },
  },
  osm: {
    primary: '#3b82f6',
    secondary: '#60a5fa',
    muted: 'rgba(59, 130, 246, 0.2)',
    tailwind: {
      primary: 'text-blue-500',
      secondary: 'text-blue-400',
      bg: 'bg-blue-500/20',
      border: 'border-blue-500/30',
    },
  },
  opensky: {
    primary: '#eab308',
    secondary: '#facc15',
    muted: 'rgba(234, 179, 8, 0.2)',
    tailwind: {
      primary: 'text-yellow-500',
      secondary: 'text-yellow-400',
      bg: 'bg-yellow-500/20',
      border: 'border-yellow-500/30',
    },
  },
  adsb_lol: {
    primary: '#f97316',
    secondary: '#fb923c',
    muted: 'rgba(249, 115, 22, 0.2)',
    tailwind: {
      primary: 'text-orange-500',
      secondary: 'text-orange-400',
      bg: 'bg-orange-500/20',
      border: 'border-orange-500/30',
    },
  },
  planet: {
    primary: '#8b5cf6',
    secondary: '#a78bfa',
    muted: 'rgba(139, 92, 246, 0.2)',
    tailwind: {
      primary: 'text-violet-500',
      secondary: 'text-violet-400',
      bg: 'bg-violet-500/20',
      border: 'border-violet-500/30',
    },
  },
  sentinel: {
    primary: '#06b6d4',
    secondary: '#22d3ee',
    muted: 'rgba(6, 182, 212, 0.2)',
    tailwind: {
      primary: 'text-cyan-500',
      secondary: 'text-cyan-400',
      bg: 'bg-cyan-500/20',
      border: 'border-cyan-500/30',
    },
  },
  weather: {
    primary: '#ec4899',
    secondary: '#f472b6',
    muted: 'rgba(236, 72, 153, 0.2)',
    tailwind: {
      primary: 'text-pink-500',
      secondary: 'text-pink-400',
      bg: 'bg-pink-500/20',
      border: 'border-pink-500/30',
    },
  },
  feature: {
    primary: '#a855f7',
    secondary: '#c084fc',
    muted: 'rgba(168, 85, 247, 0.2)',
    tailwind: {
      primary: 'text-purple-500',
      secondary: 'text-purple-400',
      bg: 'bg-purple-500/20',
      border: 'border-purple-500/30',
    },
  },
  custom: {
    primary: '#64748b',
    secondary: '#94a3b8',
    muted: 'rgba(100, 116, 139, 0.2)',
    tailwind: {
      primary: 'text-slate-500',
      secondary: 'text-slate-400',
      bg: 'bg-slate-500/20',
      border: 'border-slate-500/30',
    },
  },
} as const

export type SourceColorKey = keyof typeof SOURCE_COLORS

// =============================================================================
// CLASSIFICATION COLORS
// =============================================================================

/**
 * NATO-inspired classification colors for entity identification.
 */
export const CLASSIFICATION_COLORS = {
  friendly: {
    primary: '#22c55e',
    muted: 'rgba(34, 197, 94, 0.2)',
    tailwind: { text: 'text-green-500', bg: 'bg-green-500/20' },
  },
  hostile: {
    primary: '#ef4444',
    muted: 'rgba(239, 68, 68, 0.2)',
    tailwind: { text: 'text-red-500', bg: 'bg-red-500/20' },
  },
  neutral: {
    primary: '#eab308',
    muted: 'rgba(234, 179, 8, 0.2)',
    tailwind: { text: 'text-yellow-500', bg: 'bg-yellow-500/20' },
  },
  unknown: {
    primary: '#6b7280',
    muted: 'rgba(107, 114, 128, 0.2)',
    tailwind: { text: 'text-gray-500', bg: 'bg-gray-500/20' },
  },
} as const

// =============================================================================
// STATUS INDICATORS
// =============================================================================

/**
 * Status colors for streaming, loading, and error states.
 */
export const STATUS_COLORS = {
  streaming: {
    primary: '#22c55e',
    pulse: 'rgba(34, 197, 94, 0.5)',
    tailwind: 'text-green-500',
  },
  idle: {
    primary: '#6b7280',
    pulse: 'rgba(107, 114, 128, 0.5)',
    tailwind: 'text-gray-500',
  },
  loading: {
    primary: '#eab308',
    pulse: 'rgba(234, 179, 8, 0.5)',
    tailwind: 'text-yellow-500',
  },
  error: {
    primary: '#ef4444',
    pulse: 'rgba(239, 68, 68, 0.5)',
    tailwind: 'text-red-500',
  },
  success: {
    primary: '#22c55e',
    pulse: 'rgba(34, 197, 94, 0.5)',
    tailwind: 'text-green-500',
  },
} as const

// =============================================================================
// TYPOGRAPHY TOKENS
// =============================================================================

/**
 * Typography tokens following TMNL 12px floor rule.
 * NEVER use text-[10px], text-[9px], etc. - use these tokens.
 */
export const TYPOGRAPHY = {
  /** Minimum readable size (12px) - THE FLOOR */
  xs: 'text-xs', // 12px
  /** Secondary/captions (14px) */
  sm: 'text-sm', // 14px
  /** Body text (16px) */
  base: 'text-base', // 16px
  /** Large text (18px) */
  lg: 'text-lg', // 18px
  /** Headings (20px) */
  xl: 'text-xl', // 20px
  /** Large headings (24px) */
  '2xl': 'text-2xl', // 24px
} as const

/**
 * Tailwind class for ensuring minimum font size.
 * Apply to containers to enforce 12px floor on all descendants.
 */
export const TYPOGRAPHY_FLOOR_CLASS = '[&_*]:min-[font-size:12px]'

// =============================================================================
// SPACING TOKENS
// =============================================================================

/**
 * Consistent spacing values for GEOINT UI components.
 */
export const SPACING = {
  /** Outer panel padding */
  panel: '16px',
  /** Card internal padding */
  card: '12px',
  /** List item padding */
  item: '8px',
  /** Tight spacing (badges, inline) */
  tight: '4px',
  /** Gap between items in a list */
  listGap: '8px',
  /** Gap between sections */
  sectionGap: '16px',
} as const

// =============================================================================
// BORDER RADIUS TOKENS
// =============================================================================

/**
 * Border radius values for GEOINT UI components.
 */
export const RADIUS = {
  /** Large panels and modals */
  panel: '12px',
  /** Cards and containers */
  card: '8px',
  /** Buttons and inputs */
  button: '6px',
  /** Badges and tags */
  badge: '4px',
  /** Circular elements */
  full: '9999px',
} as const

// =============================================================================
// SHADOW TOKENS
// =============================================================================

/**
 * Shadow values for elevation in GEOINT UI.
 */
export const SHADOW = {
  /** Main panel shadow */
  panel: '0 4px 24px rgba(0, 0, 0, 0.4)',
  /** Card shadow */
  card: '0 2px 8px rgba(0, 0, 0, 0.2)',
  /** Floating elements (dropdowns, tooltips) */
  floating: '0 8px 32px rgba(0, 0, 0, 0.5)',
  /** Subtle elevation */
  subtle: '0 1px 4px rgba(0, 0, 0, 0.1)',
  /** Inner shadow for inset elements */
  inset: 'inset 0 1px 2px rgba(0, 0, 0, 0.1)',
} as const

// =============================================================================
// TIMING TOKENS
// =============================================================================

/**
 * Animation timing values (in milliseconds).
 */
export const TIMING = {
  /** Fast micro-interactions */
  fast: 150,
  /** Normal transitions */
  normal: 250,
  /** Slow, deliberate animations */
  slow: 400,
  /** Panel reveal/hide */
  panel: 300,
  /** Stagger delay base */
  stagger: 50,
  /** Search debounce */
  debounce: 300,
  /** Streaming poll interval */
  poll: 5000,
} as const

// =============================================================================
// EASING TOKENS
// =============================================================================

/**
 * Easing functions for animations.
 */
export const EASING = {
  /** Standard ease out for enters */
  out: 'cubic-bezier(0.33, 1, 0.68, 1)',
  /** Standard ease in for exits */
  in: 'cubic-bezier(0.32, 0, 0.67, 0)',
  /** Smooth ease in-out */
  inOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
  /** Bouncy for emphasis */
  bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  /** Anime.js equivalents */
  anime: {
    out: 'easeOutCubic',
    in: 'easeInCubic',
    inOut: 'easeInOutCubic',
    bounce: 'easeOutBack',
    elastic: 'easeOutElastic(1, 0.5)',
    spring: 'spring(1, 80, 10, 0)',
    breathing: 'easeInOutSine',
  },
} as const

// =============================================================================
// VIRTUALIZATION TOKENS
// =============================================================================

/**
 * Configuration for virtualized lists.
 */
export const VIRTUALIZATION = {
  /** Estimated height for result items */
  resultItemHeight: 72,
  /** Estimated height for compact result items */
  resultItemHeightCompact: 48,
  /** Number of items to render outside viewport */
  overscan: 5,
  /** Threshold for enabling virtualization */
  virtualizationThreshold: 50,
} as const

// =============================================================================
// LAYOUT BREAKPOINTS
// =============================================================================

/**
 * Responsive breakpoints for layout variants.
 */
export const BREAKPOINTS = {
  /** Mobile: single column */
  sm: 640,
  /** Tablet: 2 columns */
  md: 768,
  /** Desktop: 3 columns */
  lg: 1024,
  /** Large desktop: expanded panels */
  xl: 1280,
  /** Ultra-wide: command center mode */
  '2xl': 1536,
} as const

// =============================================================================
// PANEL DIMENSIONS
// =============================================================================

/**
 * Fixed dimensions for dashboard panels.
 */
export const PANEL_DIMENSIONS = {
  /** Left sidebar width (search, layers) */
  sidebar: {
    collapsed: 48,
    default: 320,
    expanded: 400,
  },
  /** Right panel width (results, details) */
  intelPanel: {
    collapsed: 48,
    default: 380,
    expanded: 500,
  },
  /** Bottom drawer height */
  drawer: {
    collapsed: 48,
    peek: 200,
    default: 300,
    expanded: 500,
  },
} as const

// =============================================================================
// LAYOUT PRESETS (Responsive Dashboard Support)
// =============================================================================

/**
 * Layout presets for responsive dashboard sizing.
 * Each preset defines dimensions for sidebar, intel panel, and timeline.
 *
 * - `full`: All panels expanded (1200px+ containers)
 * - `compact`: Narrower panels (900px+ containers)
 * - `minimal`: Collapsed panels, map-focused (600px+ containers)
 * - `map-focus`: Map only with floating mini-panels (<600px)
 *
 * @example
 * ```tsx
 * const preset = LAYOUT_PRESETS[computedPreset]
 * const sidebarWidth = preset.sidebar.collapsed ? 48 : preset.sidebar.width
 * ```
 */
export const LAYOUT_PRESETS = {
  full: {
    sidebar: { width: 320, collapsed: false, hidden: false },
    intel: { width: 380, collapsed: false, hidden: false, floating: false },
    timeline: { height: 300, collapsed: false, hidden: false, floating: false },
    minContainerWidth: 1200,
  },
  compact: {
    sidebar: { width: 240, collapsed: false, hidden: false },
    intel: { width: 280, collapsed: false, hidden: false, floating: false },
    timeline: { height: 200, collapsed: false, hidden: false, floating: false },
    minContainerWidth: 900,
  },
  minimal: {
    sidebar: { width: 48, collapsed: true, hidden: false },
    intel: { width: 48, collapsed: true, hidden: false, floating: false },
    timeline: { height: 48, collapsed: true, hidden: false, floating: false },
    minContainerWidth: 600,
  },
  'map-focus': {
    sidebar: { width: 0, collapsed: true, hidden: true },
    intel: { width: 320, collapsed: false, hidden: false, floating: true },
    timeline: { height: 80, collapsed: false, hidden: false, floating: true },
    minContainerWidth: 400,
  },
} as const

export type LayoutPreset = keyof typeof LAYOUT_PRESETS

/**
 * Compute the appropriate preset based on container width.
 *
 * @param width - Container width in pixels
 * @returns The preset name that fits the container
 */
export function computePresetFromWidth(width: number): LayoutPreset {
  if (width >= 1200) return 'full'
  if (width >= 900) return 'compact'
  if (width >= 600) return 'minimal'
  return 'map-focus'
}

// =============================================================================
// Z-INDEX SCALE
// =============================================================================

/**
 * Z-index values for layering.
 */
export const Z_INDEX = {
  /** Base map */
  map: 0,
  /** Map overlays (deck.gl layers) */
  mapOverlay: 10,
  /** Side panels */
  panel: 100,
  /** Floating elements */
  floating: 200,
  /** Dropdowns and menus */
  dropdown: 300,
  /** Tooltips */
  tooltip: 400,
  /** Modals */
  modal: 500,
  /** Toast notifications */
  toast: 600,
} as const

// =============================================================================
// COMPOSITE TOKENS
// =============================================================================

/**
 * Pre-composed token sets for common patterns.
 */
export const COMPOSITE = {
  /** Panel container styles */
  panelBase: {
    padding: SPACING.panel,
    borderRadius: RADIUS.panel,
    shadow: SHADOW.panel,
  },
  /** Card container styles */
  cardBase: {
    padding: SPACING.card,
    borderRadius: RADIUS.card,
    shadow: SHADOW.card,
  },
  /** Result item styles */
  resultItem: {
    height: VIRTUALIZATION.resultItemHeight,
    padding: SPACING.item,
    borderRadius: RADIUS.card,
  },
  /** Transition preset */
  transition: {
    duration: `${TIMING.normal}ms`,
    easing: EASING.out,
  },
} as const

// =============================================================================
// ANIMATION PRESETS (Anime.js v4)
// =============================================================================

/**
 * Pre-configured animation presets for common UI patterns.
 * Use with anime.js v4: animate(target, ANIMATIONS.fadeIn)
 */
export const ANIMATIONS = {
  // -------------------------------------------------------------------------
  // Enter animations
  // -------------------------------------------------------------------------

  /** Fade in from transparent */
  fadeIn: {
    opacity: [0, 1],
    duration: TIMING.normal,
    easing: EASING.anime.out,
  },

  /** Slide in from bottom */
  slideInUp: {
    translateY: [20, 0],
    opacity: [0, 1],
    duration: TIMING.normal,
    easing: EASING.anime.out,
  },

  /** Slide in from right */
  slideInRight: {
    translateX: [20, 0],
    opacity: [0, 1],
    duration: TIMING.normal,
    easing: EASING.anime.out,
  },

  /** Scale in with bounce */
  scaleIn: {
    scale: [0.95, 1],
    opacity: [0, 1],
    duration: TIMING.normal,
    easing: EASING.anime.bounce,
  },

  /** Pop in for emphasis (radial dial, tooltips) */
  popIn: {
    scale: [0, 1],
    opacity: [0, 1],
    duration: TIMING.normal,
    easing: EASING.anime.bounce,
  },

  // -------------------------------------------------------------------------
  // Exit animations
  // -------------------------------------------------------------------------

  /** Fade out */
  fadeOut: {
    opacity: [1, 0],
    duration: TIMING.fast,
    easing: EASING.anime.in,
  },

  /** Slide out downward */
  slideOutDown: {
    translateY: [0, 20],
    opacity: [1, 0],
    duration: TIMING.fast,
    easing: EASING.anime.in,
  },

  /** Scale out */
  scaleOut: {
    scale: [1, 0.95],
    opacity: [1, 0],
    duration: TIMING.fast,
    easing: EASING.anime.in,
  },

  // -------------------------------------------------------------------------
  // Feedback animations
  // -------------------------------------------------------------------------

  /** Pulse attention (status indicators) */
  pulse: {
    scale: [1, 1.05, 1],
    opacity: [1, 0.8, 1],
    duration: TIMING.slow,
    easing: EASING.anime.inOut,
    loop: true,
  },

  /** Shake for error */
  shake: {
    translateX: [0, -4, 4, -4, 4, 0],
    duration: TIMING.slow,
    easing: EASING.anime.out,
  },

  /** Wobble for attention */
  wobble: {
    rotate: [0, -3, 3, -3, 0],
    duration: TIMING.slow,
    easing: EASING.anime.elastic,
  },

  /** Highlight selection */
  highlight: {
    scale: [1, 1.02, 1],
    duration: TIMING.fast,
    easing: EASING.anime.out,
  },

  // -------------------------------------------------------------------------
  // Panel animations
  // -------------------------------------------------------------------------

  /** Panel expand from collapsed */
  panelExpand: {
    width: ['48px', '320px'],
    opacity: [0.8, 1],
    duration: TIMING.panel,
    easing: EASING.anime.out,
  },

  /** Panel collapse */
  panelCollapse: {
    width: ['320px', '48px'],
    opacity: [1, 0.8],
    duration: TIMING.panel,
    easing: EASING.anime.in,
  },

  /** Drawer slide up */
  drawerOpen: {
    translateY: [200, 0],
    opacity: [0, 1],
    duration: TIMING.panel,
    easing: EASING.anime.out,
  },

  /** Drawer slide down */
  drawerClose: {
    translateY: [0, 200],
    opacity: [1, 0],
    duration: TIMING.panel,
    easing: EASING.anime.in,
  },

  // -------------------------------------------------------------------------
  // Map entity animations
  // -------------------------------------------------------------------------

  /** Entity appear on map */
  entityAppear: {
    scale: [0, 1],
    opacity: [0, 1],
    duration: TIMING.normal,
    easing: EASING.anime.bounce,
  },

  /** Entity track update (smooth position) */
  entityMove: {
    duration: TIMING.slow,
    easing: EASING.anime.out,
  },

  /** Entity selection ring */
  selectionRing: {
    scale: [0.8, 1],
    opacity: [0.5, 1],
    borderWidth: [2, 3],
    duration: TIMING.fast,
    easing: EASING.anime.out,
  },

  // -------------------------------------------------------------------------
  // List item stagger config
  // -------------------------------------------------------------------------

  /** Stagger config for list items */
  staggerList: {
    delay: (_el: Element, i: number) => i * TIMING.stagger,
    duration: TIMING.normal,
    easing: EASING.anime.out,
  },

  /** Stagger config for grid items */
  staggerGrid: {
    delay: (el: Element, i: number, total: number) => {
      const cols = Math.ceil(Math.sqrt(total))
      const row = Math.floor(i / cols)
      const col = i % cols
      return (row + col) * TIMING.stagger
    },
    duration: TIMING.normal,
    easing: EASING.anime.out,
  },
} as const

/**
 * Animation utilities for common patterns.
 */
export const animationUtils = {
  /** Create stagger animation for children */
  staggerChildren: (
    parent: Element,
    props: Partial<typeof ANIMATIONS.fadeIn>,
    staggerMs: number = TIMING.stagger
  ) => ({
    targets: parent.children,
    ...props,
    delay: (el: Element, i: number) => i * staggerMs,
  }),

  /** Create spring-based animation */
  spring: (props: Record<string, unknown>) => ({
    ...props,
    easing: EASING.anime.spring,
  }),

  /** Create elastic animation */
  elastic: (props: Record<string, unknown>) => ({
    ...props,
    easing: EASING.anime.elastic,
  }),
}

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type IntelSource = keyof typeof SOURCE_COLORS
export type Classification = keyof typeof CLASSIFICATION_COLORS
export type Status = keyof typeof STATUS_COLORS
export type AnimationPreset = keyof typeof ANIMATIONS

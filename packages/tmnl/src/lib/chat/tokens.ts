/**
 * TMNL Chat Design Tokens
 *
 * Extends TMNL_TOKENS for chat-specific concerns.
 * Pure black aesthetic — no brutalist DNA.
 */

export const CHAT_TOKENS = {
  /** Composer surface — flush borderless inline */
  composer: {
    bg: 'bg-transparent',
    border: 'border-t border-neutral-800/40',
  },

  /** Text input area */
  input: {
    text: 'text-white',
    placeholder: 'placeholder:text-neutral-500',
    font: 'font-mono',
    bg: 'bg-transparent',
  },

  /** Toolbar region */
  toolbar: {
    border: 'border-t border-neutral-800/60',
    gap: 'gap-1.5',
  },

  /** Interactive buttons */
  button: {
    base: 'border-none cursor-pointer transition-all duration-150',
    idle: 'text-neutral-500 bg-transparent',
    hover: 'hover:text-neutral-300',
    active: 'text-white bg-neutral-800',
    disabled: 'opacity-40 cursor-not-allowed',
  },

  /** Send button accent */
  send: {
    ready: 'bg-cyan-500 text-black hover:bg-cyan-400',
    idle: 'bg-neutral-800 text-neutral-600 cursor-not-allowed',
  },

  /** Mode toggle (Terminal / AI) */
  mode: {
    border: 'border border-neutral-700',
    activeSegment: 'bg-neutral-800 text-white',
    inactiveSegment: 'bg-transparent text-neutral-500 hover:text-neutral-300',
  },

  /** Context chips */
  chip: {
    hashtag: 'text-amber-400 bg-amber-500/10 border border-amber-500/25',
    context: 'text-cyan-400 bg-cyan-500/10 border border-cyan-500/25',
    pending: 'text-neutral-500 bg-neutral-800/50 border border-dashed border-neutral-700',
    disabled: 'text-neutral-600 bg-neutral-900 border border-neutral-800',
  },

  /** Thinking level */
  thinking: {
    active: 'text-violet-400 bg-violet-500/10',
    idle: 'text-neutral-500 bg-transparent hover:text-neutral-300',
  },
  // ═══════════════════════════════════════════════════════
  // Thread spacing — 8pt grid
  // ═══════════════════════════════════════════════════════

  /** Thread-level spacing */
  thread: {
    /** Gap between conversation turns (role change) — visual paragraphing */
    turnGap: 'mt-5',        // 20px
    /** Gap between consecutive same-role messages */
    sameRoleGap: 'mt-1',    // 4px
    /** Thread horizontal padding */
    padX: 'px-4',           // 16px
  },

  /** Per-role message constraints */
  message: {
    /** User: right-aligned, tighter padding, no icon */
    user: {
      alignment: 'ml-auto',
      maxWidth: 'max-w-[80%]',
      padding: 'px-4 py-2.5',
    },
    /** Assistant: left-aligned, full fidelity */
    assistant: {
      alignment: 'mr-auto',
      maxWidth: 'max-w-[85%]',
      padding: 'px-4 py-3',
    },
    /** Tool: left-aligned like assistant */
    tool: {
      alignment: 'mr-auto',
      maxWidth: 'max-w-[85%]',
      padding: 'px-4 py-3',
    },
    /** System: edge case fallback (normally in header bar) */
    system: {
      alignment: 'mx-auto',
      maxWidth: 'max-w-[90%]',
      padding: 'px-4 py-2',
    },
  },
} as const

// =============================================================================
// Responsive Message Tokens — keyed by ThreadWidthTier
// =============================================================================

/** Width tier discriminant — mirrors thread-view.tsx ThreadWidthTier */
export type ChatWidthTier = 'compact' | 'squeeze' | 'full'

/**
 * Tier-aware max-width per role.
 * compact: full width (no cap — every pixel counts)
 * squeeze: relaxed percentages
 * full: original design intent
 */
export const RESPONSIVE_MAX_W: Record<'user' | 'assistant' | 'tool' | 'system', Record<ChatWidthTier, string>> = {
  user:      { compact: 'max-w-full', squeeze: 'max-w-[90%]', full: 'max-w-[80%]' },
  assistant: { compact: 'max-w-full', squeeze: 'max-w-[95%]', full: 'max-w-[85%]' },
  tool:      { compact: 'max-w-full', squeeze: 'max-w-[95%]', full: 'max-w-[85%]' },
  system:    { compact: 'max-w-full', squeeze: 'max-w-[95%]', full: 'max-w-[90%]' },
} as const

/**
 * Tier-aware message padding per role.
 * compact: tighter horizontal, slightly tighter vertical
 * squeeze: intermediate
 * full: original design intent
 */
export const RESPONSIVE_MSG_PAD: Record<'user' | 'assistant' | 'tool' | 'system', Record<ChatWidthTier, string>> = {
  user:      { compact: 'px-2 py-2',   squeeze: 'px-3 py-2',   full: 'px-4 py-2.5' },
  assistant: { compact: 'px-2 py-2',   squeeze: 'px-3 py-2.5', full: 'px-4 py-3' },
  tool:      { compact: 'px-2 py-2',   squeeze: 'px-3 py-2.5', full: 'px-4 py-3' },
  system:    { compact: 'px-2 py-1.5', squeeze: 'px-3 py-2',   full: 'px-4 py-2' },
} as const

// =============================================================================
// Composer Sizing Tokens — keyed by ChatWidthTier
// =============================================================================

/**
 * Tier-aware composer primitive dimensions.
 * Drives progressive collapse at narrow widths.
 */
export const COMPOSER_SIZING: Record<ChatWidthTier, {
  textarea:   string
  minH:       number
  maxH:       number
  toolbar:    string
  toolbarGap: string
  sendBtn:    string
  actionBtn:  string
  sendIcon:   number
  actionIcon: number
  chipPad:    string
}> = {
  compact: {
    textarea:   'px-2 py-1',
    minH:       36,
    maxH:       120,
    toolbar:    'px-1.5 py-1 min-h-[28px]',
    toolbarGap: 'gap-1',
    sendBtn:    'w-7 h-7 rounded-md',
    actionBtn:  'w-6 h-6 rounded',
    sendIcon:   14,
    actionIcon: 12,
    chipPad:    'px-1.5 py-0.5 gap-1',
  },
  squeeze: {
    textarea:   'px-2 py-1.5',
    minH:       40,
    maxH:       160,
    toolbar:    'px-2 py-1 min-h-[32px]',
    toolbarGap: 'gap-1',
    sendBtn:    'w-8 h-8 rounded-lg',
    actionBtn:  'w-6 h-6 rounded-md',
    sendIcon:   14,
    actionIcon: 13,
    chipPad:    'px-2 py-0.5 gap-1.5',
  },
  full: {
    textarea:   'px-3 py-2',
    minH:       48,
    maxH:       200,
    toolbar:    'px-2 py-1.5 min-h-[36px]',
    toolbarGap: 'gap-1.5',
    sendBtn:    'w-9 h-9 rounded-lg',
    actionBtn:  'w-7 h-7 rounded-md',
    sendIcon:   16,
    actionIcon: 14,
    chipPad:    'px-2 py-1 gap-2',
  },
} as const

/**
 * Progressive overflow priority — higher index = first to collapse into ··· menu.
 * Index 0 (Send) never overflows.
 *
 * Removed (ghost/mock-only): voice, attach, command, mention, divider
 */
export const COMPOSER_OVERFLOW_PRIORITY = [
  'send',         // 0 — never overflows
  'mode-toggle',  // 1
  'thinking',     // 2
  'cancel',       // 3
  'reconnect',    // 4 — adapter.reconnect()
  'clear',        // 5 — adapter.clear()
] as const

export type ComposerActionId = typeof COMPOSER_OVERFLOW_PRIORITY[number]

/**
 * Actions visible inline per tier (everything else goes to overflow menu).
 * Derived from COMPOSER_OVERFLOW_PRIORITY.
 */
export const COMPOSER_INLINE_ACTIONS: Record<ChatWidthTier, ReadonlySet<ComposerActionId>> = {
  compact: new Set(['send']),
  squeeze: new Set(['send', 'mode-toggle', 'thinking', 'cancel', 'reconnect']),
  full:    new Set(COMPOSER_OVERFLOW_PRIORITY),
} as const

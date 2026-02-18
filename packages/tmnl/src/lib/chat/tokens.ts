/**
 * TMNL Chat Design Tokens
 *
 * Extends TMNL_TOKENS for chat-specific concerns.
 * Pure black aesthetic — no brutalist DNA.
 */

export const CHAT_TOKENS = {
  /** Composer surface */
  composer: {
    bg: 'bg-black/40',
    bgHover: 'hover:bg-black/50',
    border: 'border-neutral-800',
    borderHover: 'hover:border-neutral-600',
    borderFocus: 'focus-within:border-neutral-500',
    backdrop: 'backdrop-blur-xl',
    radius: 'rounded-xl',
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
} as const

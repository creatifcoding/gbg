/**
 * ModelSelectorChip — morphing pill for model selection.
 *
 * Inspired by ContextualToolbar's morphing container pattern:
 * - Collapsed: compact pill showing current model name
 * - Open: pill expands, popover drops with search + model list
 * - Spring animation on morph, iOS easing on popover
 * - scale(0.97) press microinteraction
 *
 * Uses Radix Popover for accessible dropdown with keyboard nav.
 *
 * @module morphchat/components/model-selector-chip
 */

import * as React from 'react'
import { motion, AnimatePresence } from 'motion/react'
import * as Popover from '@radix-ui/react-popover'
import { cn } from '@/lib/utils'

// =============================================================================
// Types
// =============================================================================

export interface ModelOption {
  /** Model identifier (e.g., 'gpt-5.3-codex') */
  readonly id: string
  /** Display name (e.g., 'GPT-5.3 Codex') */
  readonly label: string
  /** Provider name (e.g., 'OpenAI') */
  readonly provider: string
  /** Optional description */
  readonly description?: string
  /** Provider accent color */
  readonly color?: string
}

export interface ModelSelectorChipProps {
  /** Currently selected model ID */
  readonly selectedModelId: string | null
  /** Available models */
  readonly models: ReadonlyArray<ModelOption>
  /** Loading state (fetching model list) */
  readonly loading?: boolean
  /** Callback when model is selected */
  readonly onSelect: (modelId: string) => void
  /** Additional class */
  readonly className?: string
}

// =============================================================================
// Animation Config
// =============================================================================

/** Snappy spring for pill morph — matches ContextualToolbar */
const PILL_SPRING = {
  type: 'spring' as const,
  stiffness: 500,
  damping: 35,
  mass: 0.8,
}

/** iOS-style easing for popover */
const IOS_EASE = [0.32, 0.72, 0, 1] as const

/** Popover enter/exit */
const POPOVER_TRANSITION = { duration: 0.2, ease: IOS_EASE }

// =============================================================================
// Provider Color Map
// =============================================================================

const PROVIDER_COLORS: Record<string, string> = {
  openai: '#10b981',     // emerald
  anthropic: '#f59e0b',  // amber
  google: '#3b82f6',     // blue
  meta: '#8b5cf6',       // violet
  mistral: '#ef4444',    // red
  default: '#22d3ee',    // cyan
}

function providerColor(provider: string): string {
  return PROVIDER_COLORS[provider.toLowerCase()] ?? PROVIDER_COLORS.default
}

// =============================================================================
// Icons
// =============================================================================

function ChipIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <path d="M15 2v2" /><path d="M15 20v2" />
      <path d="M2 15h2" /><path d="M20 15h2" />
      <path d="M9 2v2" /><path d="M9 20v2" />
      <path d="M2 9h2" /><path d="M20 9h2" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <motion.svg
      width="10" height="10" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      animate={{ rotate: open ? 180 : 0 }}
      transition={{ duration: 0.15 }}
    >
      <polyline points="6 9 12 15 18 9" />
    </motion.svg>
  )
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

// =============================================================================
// Model Item
// =============================================================================

function ModelItem({
  model,
  selected,
  onSelect,
}: {
  model: ModelOption
  selected: boolean
  onSelect: () => void
}) {
  const accent = model.color ?? providerColor(model.provider)

  return (
    <motion.button
      onClick={onSelect}
      whileTap={{ scale: 0.97 }}
      className={cn(
        'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left',
        'transition-colors duration-150',
        'outline-none focus-visible:ring-1 focus-visible:ring-cyan-500/50',
        selected
          ? 'bg-neutral-800/80'
          : 'hover:bg-neutral-800/40',
      )}
      data-slot="model-option"
    >
      {/* Provider dot */}
      <div
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: accent, boxShadow: `0 0 4px ${accent}40` }}
      />

      {/* Label + provider */}
      <div className="flex-1 min-w-0">
        <div
          className="font-mono text-neutral-200 truncate"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {model.label}
        </div>
        {model.description && (
          <div
            className="text-neutral-600 truncate"
            style={{ fontSize: '10px' }}
          >
            {model.description}
          </div>
        )}
      </div>

      {/* Provider badge */}
      <span
        className="shrink-0 font-mono uppercase tracking-wider"
        style={{
          fontSize: '9px',
          color: accent,
          opacity: 0.7,
        }}
      >
        {model.provider}
      </span>

      {/* Check */}
      {selected && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="shrink-0 text-cyan-400"
        >
          <CheckIcon />
        </motion.div>
      )}
    </motion.button>
  )
}

// =============================================================================
// ModelSelectorChip
// =============================================================================

export function ModelSelectorChip({
  selectedModelId,
  models,
  loading = false,
  onSelect,
  className,
}: ModelSelectorChipProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const searchRef = React.useRef<HTMLInputElement>(null)

  // Resolve selected model
  const selectedModel = React.useMemo(
    () => models.find((m) => m.id === selectedModelId),
    [models, selectedModelId],
  )

  // Filter models by search
  const filtered = React.useMemo(() => {
    if (!search.trim()) return models
    const q = search.toLowerCase()
    return models.filter(
      (m) =>
        m.id.toLowerCase().includes(q) ||
        m.label.toLowerCase().includes(q) ||
        m.provider.toLowerCase().includes(q) ||
        m.description?.toLowerCase().includes(q),
    )
  }, [models, search])

  // Clear search on close
  React.useEffect(() => {
    if (!open) setSearch('')
  }, [open])

  // Focus search on open
  React.useEffect(() => {
    if (open) {
      requestAnimationFrame(() => searchRef.current?.focus())
    }
  }, [open])

  const handleSelect = React.useCallback(
    (modelId: string) => {
      onSelect(modelId)
      setOpen(false)
    },
    [onSelect],
  )

  const displayName = selectedModel?.label ?? selectedModelId ?? 'No model'
  const accent = selectedModel
    ? (selectedModel.color ?? providerColor(selectedModel.provider))
    : '#22d3ee'

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      {/* ── Morphing Pill Trigger ── */}
      <Popover.Trigger asChild>
        <motion.button
          layout
          layoutId="model-chip-pill"
          transition={PILL_SPRING}
          whileTap={{ scale: 0.97 }}
          className={cn(
            'flex items-center gap-1.5 rounded-md',
            'border border-neutral-800/50 bg-neutral-900/80',
            'backdrop-blur-sm cursor-pointer',
            'transition-colors duration-150',
            'hover:border-neutral-700/50 hover:bg-neutral-800/60',
            'outline-none focus-visible:ring-1 focus-visible:ring-cyan-500/50',
            open && 'border-neutral-700/80 bg-neutral-800/80',
            className,
          )}
          style={{ padding: '4px 8px' }}
          data-slot="model-chip"
        >
          {/* Provider dot */}
          <motion.div
            layout
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ backgroundColor: accent, boxShadow: `0 0 4px ${accent}40` }}
          />

          {/* Model name */}
          <motion.span
            layout
            className="font-mono text-neutral-300 truncate"
            style={{
              fontSize: 'var(--tmnl-text-xs, 12px)',
              maxWidth: open ? 160 : 120,
            }}
          >
            {loading ? 'Loading…' : displayName}
          </motion.span>

          {/* Chevron */}
          <ChevronIcon open={open} />
        </motion.button>
      </Popover.Trigger>

      {/* ── Popover Dropdown ── */}
      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()} // we handle focus manually
          asChild
        >
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96 }}
            transition={POPOVER_TRANSITION}
            className={cn(
              'z-50 w-[280px]',
              'bg-neutral-950 border border-neutral-800/80 rounded-lg',
              'shadow-lg shadow-black/40',
              'backdrop-blur-xl',
            )}
            data-slot="model-popover"
          >
            {/* Search Bar */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-neutral-800/50">
              <SearchIcon />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search models…"
                className={cn(
                  'flex-1 bg-transparent border-none outline-none',
                  'font-mono text-neutral-200 placeholder:text-neutral-600',
                )}
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                data-slot="model-search"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="text-neutral-600 hover:text-neutral-400 transition-colors"
                  style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                >
                  ×
                </button>
              )}
            </div>

            {/* Model List */}
            <div
              className="max-h-[240px] overflow-y-auto py-1 px-1"
              role="listbox"
              aria-label="Available models"
            >
              <AnimatePresence mode="popLayout">
                {filtered.length === 0 ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="px-3 py-4 text-center text-neutral-600 font-mono"
                    style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                  >
                    No models match "{search}"
                  </motion.div>
                ) : (
                  filtered.map((model) => (
                    <ModelItem
                      key={model.id}
                      model={model}
                      selected={model.id === selectedModelId}
                      onSelect={() => handleSelect(model.id)}
                    />
                  ))
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="px-3 py-1.5 border-t border-neutral-800/50 flex items-center justify-between">
              <span
                className="font-mono text-neutral-700"
                style={{ fontSize: '10px' }}
              >
                {models.length} model{models.length !== 1 ? 's' : ''} available
              </span>
              <span
                className="font-mono text-neutral-700"
                style={{ fontSize: '10px' }}
              >
                applies on next message
              </span>
            </div>
          </motion.div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

ModelSelectorChip.displayName = 'MorphChat.ModelSelectorChip'

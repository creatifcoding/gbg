/**
 * ModelSelector — compound component for the header band model slot.
 *
 * Compound parts:
 *   Root     — Provider + Radix Popover.Root (state, actions, meta)
 *   Trigger  — Morphing pill chip with press microinteraction
 *   Content  — Animated popover container
 *   Search   — Filter input
 *   List     — Scrollable model option list
 *   Item     — Single model option row
 *   Empty    — No-results state
 *   Footer   — Model count + "applies on next message" hint
 *
 * Usage (inside a header band flex row):
 * ```tsx
 * <ModelSelector.Root models={models} selectedId={id} onSelect={setId}>
 *   <ModelSelector.Trigger />
 *   <ModelSelector.Content>
 *     <ModelSelector.Search />
 *     <ModelSelector.List />
 *     <ModelSelector.Footer />
 *   </ModelSelector.Content>
 * </ModelSelector.Root>
 * ```
 *
 * @module chat/shell/header-band/model-selector
 */

import * as React from 'react'
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import * as Popover from '@radix-ui/react-popover'
import { cn } from '@/lib/utils'

// =============================================================================
// Types
// =============================================================================

export interface ModelOption {
  readonly id: string
  readonly label: string
  readonly provider: string
  readonly description?: string
  readonly color?: string
}

interface ContextValue {
  open: boolean
  search: string
  selectedId: string | null
  models: ReadonlyArray<ModelOption>
  filtered: ReadonlyArray<ModelOption>
  selected: ModelOption | undefined
  loading: boolean
  select: (id: string) => void
  setSearch: (q: string) => void
  clearSearch: () => void
  searchRef: React.RefObject<HTMLInputElement | null>
}

// =============================================================================
// Context
// =============================================================================

const Ctx = createContext<ContextValue | null>(null)

function useCtx(): ContextValue {
  const c = use(Ctx)
  if (!c) throw new Error('ModelSelector.* must be inside <ModelSelector.Root>')
  return c
}

// =============================================================================
// Provider Colors
// =============================================================================

const PROVIDER_COLORS: Record<string, string> = {
  openai: '#10b981', anthropic: '#f59e0b', google: '#3b82f6',
  meta: '#8b5cf6', mistral: '#ef4444', cohere: '#06b6d4', default: '#22d3ee',
}

function accent(model: ModelOption | undefined, fallback = '#22d3ee'): string {
  if (!model) return fallback
  return model.color ?? PROVIDER_COLORS[model.provider.toLowerCase()] ?? PROVIDER_COLORS.default
}

// =============================================================================
// Animation Constants
// =============================================================================

const PILL_SPRING = { type: 'spring' as const, stiffness: 500, damping: 35, mass: 0.8 }
const IOS_EASE = [0.32, 0.72, 0, 1] as const
const POPOVER_ANIM = { duration: 0.2, ease: IOS_EASE }

// =============================================================================
// Root
// =============================================================================

export interface ModelSelectorRootProps {
  readonly models: ReadonlyArray<ModelOption>
  readonly selectedId: string | null
  readonly onSelect: (id: string) => void
  readonly loading?: boolean
  readonly children: React.ReactNode
}

function Root({ models, selectedId, onSelect, loading = false, children }: ModelSelectorRootProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  const selected = useMemo(() => models.find((m) => m.id === selectedId), [models, selectedId])

  const filtered = useMemo(() => {
    if (!search.trim()) return models
    const q = search.toLowerCase()
    return models.filter(
      (m) => m.id.toLowerCase().includes(q) || m.label.toLowerCase().includes(q) ||
             m.provider.toLowerCase().includes(q) || m.description?.toLowerCase().includes(q),
    )
  }, [models, search])

  useEffect(() => { if (!open) setSearch('') }, [open])
  useEffect(() => { if (open) requestAnimationFrame(() => searchRef.current?.focus()) }, [open])

  const select = useCallback((id: string) => { onSelect(id); setOpen(false) }, [onSelect])
  const clearSearch = useCallback(() => setSearch(''), [])

  const ctx = useMemo<ContextValue>(
    () => ({ open, search, selectedId, models, filtered, selected, loading, select, setSearch, clearSearch, searchRef }),
    [open, search, selectedId, models, filtered, selected, loading, select, clearSearch],
  )

  return (
    <Ctx value={ctx}>
      <Popover.Root open={open} onOpenChange={setOpen}>
        {children}
      </Popover.Root>
    </Ctx>
  )
}

// =============================================================================
// Trigger — morphing pill
// =============================================================================

function Trigger({ className }: { className?: string }) {
  const { open, selected, selectedId, loading } = useCtx()
  const color = accent(selected)
  const name = selected?.label ?? selectedId ?? 'No model'

  return (
    <Popover.Trigger asChild>
      <motion.button
        layout layoutId="model-chip-pill" transition={PILL_SPRING}
        whileTap={{ scale: 0.97 }}
        className={cn(
          'flex items-center gap-1.5 rounded-md',
          'border border-neutral-800/50 bg-neutral-900/80 backdrop-blur-sm cursor-pointer',
          'transition-colors duration-150',
          'hover:border-neutral-700/50 hover:bg-neutral-800/60',
          'outline-none focus-visible:ring-1 focus-visible:ring-cyan-500/50',
          open && 'border-neutral-700/80 bg-neutral-800/80',
          className,
        )}
        style={{ padding: '4px 8px' }}
        data-slot="model-chip"
      >
        <motion.div layout className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}40` }} />
        <motion.span layout className="font-mono text-neutral-300 truncate"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)', maxWidth: open ? 160 : 120 }}>
          {loading ? 'Loading…' : name}
        </motion.span>
        <motion.svg width="10" height="10" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.15 }}>
          <polyline points="6 9 12 15 18 9" />
        </motion.svg>
      </motion.button>
    </Popover.Trigger>
  )
}

// =============================================================================
// Content — animated popover shell
// =============================================================================

function Content({ children, className, width = 280 }: {
  children: React.ReactNode; className?: string; width?: number
}) {
  return (
    <Popover.Portal>
      <Popover.Content sideOffset={6} align="start"
        onOpenAutoFocus={(e) => e.preventDefault()} asChild>
        <motion.div
          initial={{ opacity: 0, y: -4, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.96 }}
          transition={POPOVER_ANIM}
          className={cn(
            'z-50 bg-neutral-950 border border-neutral-800/80 rounded-lg',
            'shadow-lg shadow-black/40 backdrop-blur-xl', className,
          )}
          style={{ width }}
          data-slot="model-popover"
        >
          {children}
        </motion.div>
      </Popover.Content>
    </Popover.Portal>
  )
}

// =============================================================================
// Search — filter input
// =============================================================================

function Search({ placeholder = 'Search models…' }: { placeholder?: string }) {
  const { search, setSearch, clearSearch, searchRef } = useCtx()
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-neutral-800/50 text-neutral-500">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
      </svg>
      <input ref={searchRef} type="text" value={search}
        onChange={(e) => setSearch(e.target.value)} placeholder={placeholder}
        className="flex-1 bg-transparent border-none outline-none font-mono text-neutral-200 placeholder:text-neutral-600"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }} data-slot="model-search" />
      {search && (
        <button onClick={clearSearch}
          className="text-neutral-600 hover:text-neutral-400 transition-colors"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>×</button>
      )}
    </div>
  )
}

// =============================================================================
// Item — single model row
// =============================================================================

function Item({ model }: { model: ModelOption }) {
  const { selectedId, select } = useCtx()
  const isSelected = model.id === selectedId
  const color = accent(model)

  return (
    <motion.button onClick={() => select(model.id)} whileTap={{ scale: 0.97 }}
      className={cn(
        'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left',
        'transition-colors duration-150 outline-none focus-visible:ring-1 focus-visible:ring-cyan-500/50',
        isSelected ? 'bg-neutral-800/80' : 'hover:bg-neutral-800/40',
      )}
      data-slot="model-option" role="option" aria-selected={isSelected}
    >
      <div className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}40` }} />
      <div className="flex-1 min-w-0">
        <div className="font-mono text-neutral-200 truncate" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          {model.label}
        </div>
        {model.description && (
          <div className="text-neutral-600 truncate" style={{ fontSize: '10px' }}>{model.description}</div>
        )}
      </div>
      <span className="shrink-0 font-mono uppercase tracking-wider" style={{ fontSize: '9px', color, opacity: 0.7 }}>
        {model.provider}
      </span>
      {isSelected && (
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="shrink-0 text-cyan-400">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </motion.div>
      )}
    </motion.button>
  )
}

// =============================================================================
// List — scrollable model list (auto-renders filtered items)
// =============================================================================

function List({ children }: { children?: React.ReactNode }) {
  const { filtered, search } = useCtx()

  return (
    <div className="max-h-[240px] overflow-y-auto py-1 px-1" role="listbox" aria-label="Available models">
      {children ?? (
        <AnimatePresence mode="popLayout">
          {filtered.length === 0 ? (
            <Empty key="empty">No models match "{search}"</Empty>
          ) : (
            filtered.map((m) => <Item key={m.id} model={m} />)
          )}
        </AnimatePresence>
      )}
    </div>
  )
}

// =============================================================================
// Empty — no-results state
// =============================================================================

function Empty({ children }: { children?: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="px-3 py-4 text-center text-neutral-600 font-mono"
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }} data-slot="model-empty">
      {children ?? 'No models found'}
    </motion.div>
  )
}

// =============================================================================
// Footer — count + hint
// =============================================================================

function Footer({ hint = 'applies on next message' }: { hint?: string }) {
  const { models } = useCtx()
  return (
    <div className="px-3 py-1.5 border-t border-neutral-800/50 flex items-center justify-between">
      <span className="font-mono text-neutral-700" style={{ fontSize: '10px' }}>
        {models.length} model{models.length !== 1 ? 's' : ''}
      </span>
      <span className="font-mono text-neutral-700" style={{ fontSize: '10px' }}>{hint}</span>
    </div>
  )
}

// =============================================================================
// Compound Export
// =============================================================================

export const ModelSelector = Object.assign(Root, {
  Root,
  Trigger,
  Content,
  Search,
  List,
  Item,
  Empty,
  Footer,
})

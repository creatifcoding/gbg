/**
 * ModelSelector — compound component with Full Capsule Morph trigger
 * and Frosted Glass + Accent Stripe popover.
 *
 * Trigger morphs between 4 states (idle/loading/selected/error)
 * with capsule fade-in on hover, accent-tinted open state.
 *
 * Popover: frosted glass slab with backdrop-blur, accent stripe +
 * glow hybrid rows, inline ghost search, quiet stats footer.
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
  error: string | null
  justSelected: boolean
  select: (id: string) => void
  setSearch: (q: string) => void
  clearSearch: () => void
  retry: (() => void) | null
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

/** Convert hex to rgba string */
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

// =============================================================================
// Constants
// =============================================================================

const IOS_EASE = [0.32, 0.72, 0, 1] as const
const POPOVER_ANIM = { duration: 0.12, ease: IOS_EASE }
const REVEAL_MS = 150
const REVEAL_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'
const SELECTED_FLASH_MS = 1500

// =============================================================================
// Root
// =============================================================================

export interface ModelSelectorRootProps {
  readonly models: ReadonlyArray<ModelOption>
  readonly selectedId: string | null
  readonly onSelect: (id: string) => void
  readonly loading?: boolean
  readonly error?: string | null
  readonly onRetry?: (() => void) | null
  readonly children: React.ReactNode
}

function Root({
  models, selectedId, onSelect, loading = false,
  error: errorProp = null, onRetry = null, children,
}: ModelSelectorRootProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [justSelected, setJustSelected] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const flashTimerRef = useRef<ReturnType<typeof setTimeout>>()

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
  useEffect(() => () => { clearTimeout(flashTimerRef.current) }, [])

  const select = useCallback((id: string) => {
    onSelect(id)
    setOpen(false)
    setJustSelected(true)
    clearTimeout(flashTimerRef.current)
    flashTimerRef.current = setTimeout(() => setJustSelected(false), SELECTED_FLASH_MS)
  }, [onSelect])

  const clearSearch = useCallback(() => setSearch(''), [])

  const ctx = useMemo<ContextValue>(
    () => ({
      open, search, selectedId, models, filtered, selected, loading,
      error: errorProp, justSelected, select, setSearch, clearSearch,
      retry: onRetry, searchRef,
    }),
    [open, search, selectedId, models, filtered, selected, loading, errorProp, justSelected, select, clearSearch, onRetry],
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
// Trigger — Full Capsule Morph
//
// States:
//   idle      → ghost text, invisible capsule (border/bg transparent)
//   hover     → capsule materializes (neutral border/bg fade in)
//   open      → accent-tinted capsule, chevron inverted
//   loading   → amber segmented capsule: [spinner | Loading models…]
//   selected  → green capsule flash: [● name ✓] → auto-fades to ghost
//   error     → red segmented capsule: [● | error | Retry]
// =============================================================================

function Trigger({ className }: { className?: string }) {
  const { open, selected, selectedId, loading, error, justSelected, retry } = useCtx()
  const color = accent(selected)
  const name = selected?.label ?? selectedId ?? 'No model'

  type TriggerState = 'idle' | 'loading' | 'selected' | 'error'
  const state: TriggerState =
    error ? 'error' :
    loading ? 'loading' :
    justSelected ? 'selected' :
    'idle'

  const borderColor =
    state === 'error'    ? 'rgba(239,68,68,0.2)' :
    state === 'loading'  ? 'rgba(245,158,11,0.2)' :
    state === 'selected' ? 'rgba(52,211,153,0.25)' :
    open                 ? `${color}26` :
    'transparent'

  const bgColor =
    state === 'error'    ? 'rgba(239,68,68,0.03)' :
    state === 'loading'  ? 'rgba(245,158,11,0.03)' :
    state === 'selected' ? 'rgba(52,211,153,0.04)' :
    open                 ? `${color}0a` :
    'transparent'

  return (
    <Popover.Trigger asChild>
      <button
        type="button"
        data-slot="model-trigger"
        data-state={state}
        className={cn(
          'inline-flex items-center font-mono cursor-pointer',
          'rounded-[5px] outline-none',
          'active:scale-[0.96]',
          state === 'idle' && !open && [
            'hover:border-[rgba(115,115,115,0.15)]',
            'hover:bg-[rgba(115,115,115,0.04)]',
            'hover:[&_[data-dot]]:opacity-80',
            'hover:[&_[data-name]]:text-neutral-300',
            'hover:[&_[data-chevron]]:opacity-60',
          ],
          className,
        )}
        style={{
          padding: '2px 8px',
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor,
          background: bgColor,
          transition: [
            `border-color ${REVEAL_MS}ms ${REVEAL_EASE}`,
            `background ${REVEAL_MS}ms ${REVEAL_EASE}`,
            `transform 500ms cubic-bezier(0.22, 1, 0.36, 1)`,
          ].join(', '),
        }}
      >
        {state === 'loading' && (
          <>
            <span
              className="shrink-0 rounded-full animate-spin"
              style={{
                width: 8, height: 8,
                border: '1.5px solid #f59e0b',
                borderTopColor: 'transparent',
                marginRight: 6,
              }}
            />
            <span
              className="font-mono whitespace-nowrap"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)', color: '#fbbf24' }}
            >
              Loading models…
            </span>
          </>
        )}

        {state === 'error' && (
          <>
            <span
              className="w-[5px] h-[5px] rounded-full shrink-0"
              style={{ background: '#ef4444', marginRight: 6 }}
            />
            <span
              className="font-mono whitespace-nowrap"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)', color: '#fca5a5' }}
            >
              {error}
            </span>
            {retry && (
              <>
                <span
                  className="w-px self-stretch my-0.5 shrink-0 mx-2"
                  style={{ background: 'rgba(239,68,68,0.1)' }}
                />
                <span
                  className="font-mono whitespace-nowrap cursor-pointer hover:text-cyan-300 transition-colors duration-150"
                  style={{ fontSize: 'var(--tmnl-text-xs, 12px)', color: '#67e8f9' }}
                  onClick={(e) => { e.stopPropagation(); retry() }}
                  role="button"
                  tabIndex={0}
                >
                  Retry
                </span>
              </>
            )}
          </>
        )}

        {(state === 'idle' || state === 'selected') && (
          <>
            <span
              data-dot
              className="rounded-full shrink-0"
              style={{
                width: state === 'selected' ? 5 : 4,
                height: state === 'selected' ? 5 : 4,
                backgroundColor: state === 'selected' ? '#34d399' : color,
                opacity: state === 'selected' ? 1 : open ? 1 : 0.6,
                boxShadow: state === 'selected' ? '0 0 6px rgba(52,211,153,0.4)' : undefined,
                marginRight: 6,
                transition: `all ${REVEAL_MS}ms ${REVEAL_EASE}`,
              }}
            />
            <span
              data-name
              className="truncate font-mono"
              style={{
                fontSize: 'var(--tmnl-text-xs, 12px)',
                maxWidth: 180,
                color:
                  state === 'selected' ? '#a3a3a3' :
                  open ? '#d4d4d4' :
                  undefined,
                transition: `color ${REVEAL_MS}ms ${REVEAL_EASE}`,
              }}
            >
              {name}
            </span>
            {state === 'selected' ? (
              <svg
                width="10" height="10" viewBox="0 0 24 24" fill="none"
                stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                className="shrink-0 ml-1"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg
                data-chevron
                width="8" height="8" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className="shrink-0 ml-1"
                style={{
                  opacity: open ? 0.8 : 0.4,
                  transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: `opacity ${REVEAL_MS}ms ${REVEAL_EASE}, transform ${REVEAL_MS}ms ${REVEAL_EASE}`,
                }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            )}
          </>
        )}
      </button>
    </Popover.Trigger>
  )
}

// =============================================================================
// Content — Frosted Glass Slab
//
// Near-black frosted glass with subtle backdrop-blur bleed.
// rounded-lg (8px), white/[0.06] border, deep shadow, inset white/[0.03] ring.
// =============================================================================

function Content({ children, className, width = 260 }: {
  children: React.ReactNode; className?: string; width?: number
}) {
  return (
    <Popover.Portal>
      <Popover.Content sideOffset={6} align="end"
        onOpenAutoFocus={(e) => e.preventDefault()} asChild>
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={POPOVER_ANIM}
          className={cn(
            'z-50 overflow-hidden',
            className,
          )}
          style={{
            width,
            borderRadius: 4,
            background: 'rgba(2, 2, 4, 0.98)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            boxShadow: [
              '0 8px 32px rgba(0, 0, 0, 0.6)',
              'inset 0 0 0 1px rgba(255, 255, 255, 0.03)',
            ].join(', '),
          }}
          data-slot="model-popover"
        >
          {children}
        </motion.div>
      </Popover.Content>
    </Popover.Portal>
  )
}

// =============================================================================
// Search — Inline Ghost
// =============================================================================

function Search({ placeholder = 'Search models…' }: { placeholder?: string }) {
  const { search, setSearch, clearSearch, searchRef } = useCtx()
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-white/[0.03]">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-600 shrink-0">
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
      </svg>
      <input ref={searchRef} type="text" value={search}
        onChange={(e) => setSearch(e.target.value)} placeholder={placeholder}
        className="flex-1 bg-transparent border-none outline-none font-mono text-neutral-200 placeholder:text-neutral-700"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }} data-slot="model-search" />
      {search && (
        <button onClick={clearSearch}
          className="text-neutral-700 hover:text-neutral-400 transition-colors duration-150"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>×</button>
      )}
    </div>
  )
}

// =============================================================================
// Item — Accent Stripe + Glow Hybrid
//
// 2px left accent stripe + faint accent gradient bleed from the dot.
// Dot glows on hover/selected. Checkmark in accent color.
// =============================================================================

function Item({ model }: { model: ModelOption }) {
  const { selectedId, select } = useCtx()
  const isSelected = model.id === selectedId
  const color = accent(model)
  const [hovered, setHovered] = useState(false)

  const showStripe = isSelected || hovered
  const showGlow = isSelected || hovered

  return (
    <button
      onClick={() => select(model.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        'w-full flex items-center gap-2 px-2.5 py-1.5 text-left',
        'outline-none cursor-pointer',
        'focus-visible:bg-white/[0.04]',
      )}
      style={{
        borderLeft: `2px solid ${showStripe ? color : 'transparent'}`,
        background: showStripe
          ? `linear-gradient(90deg, ${hexToRgba(color, 0.05)} 0%, transparent 25%)`
          : 'transparent',
        transition: [
          `border-color 100ms ${REVEAL_EASE}`,
          `background 100ms ${REVEAL_EASE}`,
        ].join(', '),
      }}
      data-slot="model-option" role="option" aria-selected={isSelected}
    >
      {/* Provider dot with conditional glow */}
      <div
        className="w-[5px] h-[5px] rounded-full shrink-0"
        style={{
          backgroundColor: color,
          opacity: showGlow ? 1 : 0.5,
          boxShadow: showGlow ? `0 0 6px ${hexToRgba(color, 0.35)}` : 'none',
          transition: `all 100ms ${REVEAL_EASE}`,
        }}
      />

      {/* Model info */}
      <div className="flex-1 min-w-0">
        <div
          className="font-mono truncate"
          style={{
            fontSize: 'var(--tmnl-text-xs, 12px)',
            color: showStripe ? '#d4d4d4' : '#737373',
            transition: `color 100ms ${REVEAL_EASE}`,
          }}
        >
          {model.label}
        </div>
        {model.description && (
          <div className="text-neutral-700 truncate" style={{ fontSize: '10px' }}>{model.description}</div>
        )}
      </div>

      {/* Provider tag */}
      <span
        className="shrink-0 font-mono uppercase tracking-wider"
        style={{ fontSize: '9px', color, opacity: 0.4 }}
      >
        {model.provider}
      </span>

      {/* Checkmark in accent color */}
      {isSelected && (
        <div className="shrink-0">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
            stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      )}
    </button>
  )
}

// =============================================================================
// List
// =============================================================================

function List({ children }: { children?: React.ReactNode }) {
  const { filtered, search } = useCtx()

  return (
    <div className="max-h-[220px] overflow-y-auto py-0.5 scrollbar-none" role="listbox" aria-label="Available models"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
      {children ?? (
        <AnimatePresence mode="popLayout">
          {filtered.length === 0 ? (
            <Empty key="empty">No models match &ldquo;{search}&rdquo;</Empty>
          ) : (
            filtered.map((m) => <Item key={m.id} model={m} />)
          )}
        </AnimatePresence>
      )}
    </div>
  )
}

// =============================================================================
// Empty
// =============================================================================

function Empty({ children }: { children?: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="px-2.5 py-3 text-center text-neutral-700 font-mono"
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }} data-slot="model-empty">
      {children ?? 'No models found'}
    </motion.div>
  )
}

// =============================================================================
// Footer — Quiet Stats
// =============================================================================

function Footer({ hint = 'applies on next message' }: { hint?: string }) {
  const { models } = useCtx()
  return (
    <div className="px-2.5 py-1 border-t border-white/[0.03] flex items-center justify-between">
      <span className="font-mono text-neutral-800" style={{ fontSize: '10px' }}>
        {models.length} model{models.length !== 1 ? 's' : ''}
      </span>
      <span className="font-mono text-neutral-800" style={{ fontSize: '10px' }}>{hint}</span>
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

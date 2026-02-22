/**
 * ScrollStrip Proof-of-Concept — react-virtuoso horizontal mode.
 *
 * Validates:
 * 1. Horizontal scrolling with variable-width columns
 * 2. scrollToIndex({ align: 'center', behavior: 'smooth' })
 * 3. Custom Scroller component
 * 4. getState() / restoreStateFrom
 * 5. Preset column widths
 *
 * Mount at /testbed/scroll-strip to test.
 *
 * @module floating/layout/ScrollStrip.poc
 */

import { memo, useCallback, useEffect, useRef, useState, forwardRef } from 'react'
import { Virtuoso, type VirtuosoHandle, type StateSnapshot } from 'react-virtuoso'
import { PANEL } from '../tokens'

// ---------------------------------------------------------------------------
// Column width presets (% of viewport)
// ---------------------------------------------------------------------------

const WIDTH_PRESETS = {
  narrow: 0.3,
  half: 0.5,
  wide: 0.7,
  full: 1.0,
} as const

type ColumnWidth = keyof typeof WIDTH_PRESETS
const PRESET_CYCLE: ColumnWidth[] = ['narrow', 'half', 'wide', 'full']

// ---------------------------------------------------------------------------
// Demo data
// ---------------------------------------------------------------------------

interface DemoColumn {
  id: string
  label: string
  width: ColumnWidth
  color: string
}

const DEMO_COLORS = [
  'oklch(0.35 0.04 180)',
  'oklch(0.35 0.04 220)',
  'oklch(0.35 0.04 260)',
  'oklch(0.35 0.04 300)',
  'oklch(0.35 0.04 340)',
  'oklch(0.35 0.04 30)',
  'oklch(0.35 0.04 60)',
  'oklch(0.35 0.04 90)',
  'oklch(0.35 0.04 120)',
  'oklch(0.35 0.04 150)',
]

function makeColumns(count: number): DemoColumn[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `col-${i}`,
    label: `Panel ${i + 1}`,
    width: PRESET_CYCLE[i % PRESET_CYCLE.length],
    color: DEMO_COLORS[i % DEMO_COLORS.length],
  }))
}

// ---------------------------------------------------------------------------
// Custom Scroller — receives react-virtuoso's style + children
// ---------------------------------------------------------------------------

const StripScroller = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function StripScroller({ style, children, ...props }, ref) {
    return (
      <div
        ref={ref}
        {...props}
        style={{
          ...style,
          overflowX: 'auto',
          overflowY: 'hidden',
          // Hide scrollbar for clean aesthetic (still scrollable)
          scrollbarWidth: 'none',
          background: PANEL.bg,
        }}
        data-scroll-strip-scroller
      >
        {children}
      </div>
    )
  }
)

// ---------------------------------------------------------------------------
// Column item renderer
// ---------------------------------------------------------------------------

const ColumnItem = memo(function ColumnItem({
  column,
  index,
  isFocused,
  onCycleWidth,
}: {
  column: DemoColumn
  index: number
  isFocused: boolean
  onCycleWidth: (index: number) => void
}) {
  return (
    <div
      data-column-id={column.id}
      data-column-width={column.width}
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: column.color,
        borderRight: `1px solid ${PANEL.border}`,
        borderLeft: index === 0 ? `1px solid ${PANEL.border}` : undefined,
        outline: isFocused ? `2px solid ${PANEL.accentCyan}` : 'none',
        outlineOffset: -2,
        transition: 'outline 150ms ease-out',
        position: 'relative',
      }}
    >
      {/* Header */}
      <div
        style={{
          height: 36,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingInline: 12,
          background: PANEL.headerBg,
          borderBottom: `1px solid ${PANEL.border}`,
          fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
          fontSize: 'var(--tmnl-text-sm, 14px)',
          color: PANEL.textStrong,
        }}
      >
        <span>{column.label}</span>
        <button
          onClick={() => onCycleWidth(index)}
          style={{
            background: 'none',
            border: `1px solid ${PANEL.border}`,
            borderRadius: 4,
            color: PANEL.accentCyan,
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 'var(--tmnl-text-xs, 12px)',
            paddingInline: 8,
            paddingBlock: 2,
          }}
        >
          {column.width}
        </button>
      </div>

      {/* Content area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
          fontSize: 'var(--tmnl-text-base, 16px)',
          color: PANEL.textMuted,
        }}
      >
        Column {index + 1} ({column.width})
      </div>
    </div>
  )
})

// ---------------------------------------------------------------------------
// ScrollStrip POC
// ---------------------------------------------------------------------------

export const ScrollStripPOC = memo(function ScrollStripPOC() {
  const [columns, setColumns] = useState(() => makeColumns(10))
  const [focusedIndex, setFocusedIndex] = useState(0)
  const [savedState, setSavedState] = useState<StateSnapshot | null>(null)
  const [containerWidth, setContainerWidth] = useState(1200)
  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Measure container width
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Column width in pixels
  const getColumnWidth = useCallback(
    (index: number) => {
      const col = columns[index]
      if (!col) return containerWidth * 0.5
      return Math.round(containerWidth * WIDTH_PRESETS[col.width])
    },
    [columns, containerWidth]
  )

  // Cycle width preset
  const cycleWidth = useCallback((index: number) => {
    setColumns(prev => prev.map((col, i) => {
      if (i !== index) return col
      const currentIdx = PRESET_CYCLE.indexOf(col.width)
      const nextWidth = PRESET_CYCLE[(currentIdx + 1) % PRESET_CYCLE.length]
      return { ...col, width: nextWidth }
    }))
  }, [])

  // Scroll to focused panel (centered)
  const scrollToFocused = useCallback((index: number) => {
    virtuosoRef.current?.scrollToIndex({
      index,
      align: 'center',
      behavior: 'smooth',
    })
  }, [])

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.altKey) return

      switch (e.key) {
        case 'h':
        case 'ArrowLeft': {
          if (e.shiftKey) {
            // Swap left — O(1) array swap
            setColumns(prev => {
              if (focusedIndex <= 0) return prev
              const next = [...prev]
              ;[next[focusedIndex], next[focusedIndex - 1]] = [next[focusedIndex - 1], next[focusedIndex]]
              return next
            })
            setFocusedIndex(prev => Math.max(0, prev - 1))
          } else {
            // Focus left
            setFocusedIndex(prev => Math.max(0, prev - 1))
          }
          e.preventDefault()
          break
        }
        case 'l':
        case 'ArrowRight': {
          if (e.shiftKey) {
            // Swap right — O(1) array swap
            setColumns(prev => {
              if (focusedIndex >= prev.length - 1) return prev
              const next = [...prev]
              ;[next[focusedIndex], next[focusedIndex + 1]] = [next[focusedIndex + 1], next[focusedIndex]]
              return next
            })
            setFocusedIndex(prev => Math.min(columns.length - 1, prev + 1))
          } else {
            // Focus right
            setFocusedIndex(prev => Math.min(columns.length - 1, prev + 1))
          }
          e.preventDefault()
          break
        }
        case 'd': {
          // Cycle column width (Alt+D)
          cycleWidth(focusedIndex)
          e.preventDefault()
          break
        }
        case 'Enter': {
          // Spawn column after focused
          const newCol: DemoColumn = {
            id: `col-${Date.now()}`,
            label: `Panel ${columns.length + 1}`,
            width: 'half',
            color: DEMO_COLORS[columns.length % DEMO_COLORS.length],
          }
          setColumns(prev => [
            ...prev.slice(0, focusedIndex + 1),
            newCol,
            ...prev.slice(focusedIndex + 1),
          ])
          setFocusedIndex(prev => prev + 1)
          e.preventDefault()
          break
        }
        case 'q': {
          // Close focused column
          if (columns.length <= 1) break
          setColumns(prev => prev.filter((_, i) => i !== focusedIndex))
          setFocusedIndex(prev => Math.min(prev, columns.length - 2))
          e.preventDefault()
          break
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [focusedIndex, columns.length, cycleWidth])

  // Auto-scroll on focus change
  useEffect(() => {
    scrollToFocused(focusedIndex)
  }, [focusedIndex, scrollToFocused])

  // State save/restore
  const handleSaveState = useCallback(() => {
    virtuosoRef.current?.getState(snapshot => {
      setSavedState(snapshot)
      console.log('[ScrollStrip POC] State saved:', snapshot)
    })
  }, [])

  const handleAddColumns = useCallback(() => {
    const count = columns.length
    setColumns(prev => [...prev, ...makeColumns(5).map((c, i) => ({
      ...c,
      id: `col-${count + i}`,
      label: `Panel ${count + i + 1}`,
    }))])
  }, [columns.length])

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: PANEL.bg,
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          height: 40,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          paddingInline: 12,
          background: PANEL.headerBg,
          borderBottom: `1px solid ${PANEL.border}`,
        }}
      >
        <span style={{ color: PANEL.accentCyan, fontSize: 'var(--tmnl-text-sm, 14px)', fontWeight: 600 }}>
          SCROLL STRIP POC
        </span>
        <span style={{ color: PANEL.textMuted, fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          {columns.length} columns | focus: {focusedIndex + 1} | width: {containerWidth}px
        </span>
        <div style={{ flex: 1 }} />
        <PocButton onClick={handleAddColumns}>+5 Columns</PocButton>
        <PocButton onClick={handleSaveState}>Save State</PocButton>
        <PocButton onClick={() => savedState && console.log('[ScrollStrip POC] Would restore:', savedState)}>
          Restore
        </PocButton>
      </div>

      {/* Hint bar */}
      <div
        style={{
          height: 24,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          paddingInline: 12,
          background: PANEL.headerBg,
          borderBottom: `1px solid ${PANEL.border}`,
          fontSize: 'var(--tmnl-text-xs, 12px)',
          color: PANEL.textMuted,
        }}
      >
        <span>Alt+H/L focus</span>
        <span>Alt+Shift+H/L swap</span>
        <span>Alt+D cycle width</span>
        <span>Alt+Enter spawn</span>
        <span>Alt+Q close</span>
      </div>

      {/* Virtuoso strip */}
      <div style={{ flex: 1, position: 'relative' }}>
        <Virtuoso
          ref={virtuosoRef}
          horizontalDirection
          totalCount={columns.length}
          overscan={200}
          components={{
            Scroller: StripScroller,
          }}
          itemContent={(index) => (
            <div
              style={{
                width: getColumnWidth(index),
                height: '100%',
                flexShrink: 0,
              }}
            >
              <ColumnItem
                column={columns[index]}
                index={index}
                isFocused={index === focusedIndex}
                onCycleWidth={cycleWidth}
              />
            </div>
          )}
          style={{ height: '100%', width: '100%' }}
          restoreStateFrom={savedState ?? undefined}
        />
      </div>

      {/* Status bar */}
      <div
        style={{
          height: 24,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          paddingInline: 12,
          background: PANEL.headerBg,
          borderTop: `1px solid ${PANEL.border}`,
          fontSize: 'var(--tmnl-text-xs, 12px)',
          color: PANEL.textMuted,
        }}
      >
        <span>
          <span style={{ color: PANEL.textStrong }}>{columns.length}</span> columns
        </span>
        <span>|</span>
        <span>
          focus: <span style={{ color: PANEL.accentCyan }}>{columns[focusedIndex]?.label ?? 'none'}</span>
        </span>
        <span>|</span>
        <span>
          width: <span style={{ color: PANEL.textStrong }}>{columns[focusedIndex]?.width ?? '-'}</span>
        </span>
        {savedState && (
          <>
            <span>|</span>
            <span style={{ color: PANEL.accentCyan }}>state saved ✓</span>
          </>
        )}
      </div>
    </div>
  )
})

// ---------------------------------------------------------------------------
// Tiny button
// ---------------------------------------------------------------------------

function PocButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none',
        border: `1px solid ${PANEL.border}`,
        borderRadius: 4,
        color: PANEL.textStrong,
        cursor: 'pointer',
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
        fontSize: 'var(--tmnl-text-xs, 12px)',
        paddingInline: 10,
        paddingBlock: 3,
      }}
    >
      {children}
    </button>
  )
}

export default ScrollStripPOC

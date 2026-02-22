/**
 * ScrollStrip — Niri-inspired infinite horizontal panel strip.
 *
 * Reads from stx.data.strip observable — all mutations go through
 * stx/strip.ts (O(1) index-aware operations).
 *
 * Features:
 *   - react-virtuoso horizontal mode with custom Scroller/List (ref-forwarded)
 *   - Preset column widths: narrow (30%), half (50%), wide (70%), full (100%)
 *   - Snap-to-focus: spring scroll centers focused column via rAF
 *   - Keyboard: Alt+H/L focus, Alt+Shift+H/L swap, Alt+D width, Alt+Enter spawn, Alt+Q close
 *   - All state lives in stx — no local useState bridge
 *
 * @module floating/layout/ScrollStrip
 */

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  forwardRef,
  type ReactNode,
} from 'react'
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso'
import { PANEL } from '../tokens'
import { getFloatingStx } from '../stx/instance'
import {

  cycleFocusedWidth,
  toggleFocusedCollapsed,
  toggleColumnCollapsed,
} from '../stx/actions'
import { useSelector } from '@/lib/stx'
import type { Column, ColumnWidth } from '../types/strip'
import { WIDTH_PRESETS, getColumnPanelId, getColumnPanelIds, COLLAPSED_COLUMN_WIDTH } from '../types/strip'
import { isLeaf } from '../layout/split-tree/types'
import { panelRegistry } from '../panel-registry'

// =============================================================================
// Custom Scroller — scrollbar-hidden, TMNL-themed, ref-forwarded
// =============================================================================

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

// List wrapper — ref-forwarded, flex row for full-height children
const StripList = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function StripList({ style, children, ...props }, ref) {
    return (
      <div
        ref={ref}
        {...props}
        style={{
          ...style,
          display: 'flex',
          flexDirection: 'row',
          height: '100%',
        }}
        data-scroll-strip-list
      >
        {children}
      </div>
    )
  }
)

// =============================================================================
// Column Cell — renders a single panel column
// =============================================================================

// =============================================================================
// ColumnTreeRenderer — renders a SplitNode tree within a column
// Uses the same recursive CSS Grid approach as SplitContainer.
// =============================================================================

import type { SplitNode, SplitBranch } from '../layout/split-tree/types'
import { isSplit } from '../layout/split-tree/types'
import { flattenSameDirection, moveSeparator, collectPanelIds } from '../layout/split-tree'
import { WORKSPACE_SENTINEL } from '../stx/constants'

const ColumnTreeRenderer = memo(function ColumnTreeRenderer({
  tree,
  renderPanel,
  focusedPanelId,
  columnIndex,
  onResize,
  collapsedPanels,
}: {
  tree: SplitNode
  renderPanel: (panelId: string) => ReactNode
  focusedPanelId: string | null
  columnIndex: number
  onResize: (panelId: string, delta: number, totalSize: number) => void
  collapsedPanels: Set<string>
}) {
  if (isLeaf(tree)) {
    if (tree.panelId === WORKSPACE_SENTINEL) return null
    const isFocused = tree.panelId === focusedPanelId
    return (
      <div
        data-panel-reticle={isFocused || undefined}
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          boxShadow: isFocused ? PANEL.reticleGlow : PANEL.reticleNone,
          transition: PANEL.reticleTransition,
        }}
      >
        {/* Top accent beam — gradient line */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background: isFocused ? PANEL.reticleAccent : 'transparent',
            transition: 'opacity 200ms ease-out',
            opacity: isFocused ? 1 : 0,
            zIndex: 2,
          }}
        />
        {renderPanel(tree.panelId)}
      </div>
    )
  }
  return (
    <ColumnGridLevel
      node={tree}
      renderPanel={renderPanel}
      focusedPanelId={focusedPanelId}
      columnIndex={columnIndex}
      onResize={onResize}
      collapsedPanels={collapsedPanels}
      path="col"
    />
  )
})

/** Recursive grid level within a column */
/**
 * Compute effective fractional widths from a binary tree's nested ratios.
 * flattenSameDirection loses ratio info, so we walk the tree to reconstruct.
 */
function computeItemFractions(node: SplitBranch): number[] {
  const fracs: number[] = []
  function walk(n: SplitNode, weight: number) {
    if (isLeaf(n)) { fracs.push(weight); return }
    const b = n as SplitBranch
    if (b.direction === node.direction) {
      walk(b.children[0], weight * b.ratio)
      walk(b.children[1], weight * (1 - b.ratio))
    } else {
      fracs.push(weight) // cross-direction = single slot
    }
  }
  walk(node.children[0], node.ratio)
  walk(node.children[1], 1 - node.ratio)
  return fracs
}

/**
 * Collapsed branch strip — renders when ALL leaves in a sub-branch are collapsed.
 * Displays flat label grid matching tree mode's all-collapsed appearance.
 *
 * Inside vertical parent → 36px row, items laid out HORIZONTALLY (each gets 1fr column)
 * Inside horizontal parent → 36px column, items laid out VERTICALLY (each gets 1fr row)
 */
/**
 * Recursively renders a collapsed SplitBranch preserving tree structure.
 *
 * Text orientation is determined ONCE at the top level by the constrained axis,
 * then propagated unchanged to all descendants:
 *   - Parent vertical → branch = 36px ROW → height constrained → horizontal text
 *   - Parent horizontal → branch = 36px COLUMN → width constrained → vertical text
 */
const CollapsedBranchStrip = memo(function CollapsedBranchStrip({
  node,
  isRow,
  focusedPanelId,
  useVerticalText,
}: {
  node: SplitBranch
  isRow: boolean // parent direction is horizontal (row)
  focusedPanelId: string | null
  useVerticalText?: boolean // propagated from top-level, determined by constrained axis
}) {
  // Top-level: determine text orientation from constrained axis
  // Parent vertical → 36px row → height constrained → horizontal text (false)
  // Parent horizontal → 36px column → width constrained → vertical text (true)
  const verticalText = useVerticalText ?? isRow

  // Branch's own direction determines how its children are laid out
  const isHorizontalBranch = node.direction === 'horizontal'
  const childCount = 2 // SplitBranch always has left + right
  const gridTemplate = Array(childCount).fill('1fr').join(' ')

  const renderChild = (child: SplitNode, key: string) => {
    if (isLeaf(child)) {
      return (
        <CollapsedPanelStrip
          key={key}
          panelId={child.panelId}
          isFocused={child.panelId === focusedPanelId}
          isRow={isHorizontalBranch}
          allSiblingsCollapsed={true}
          forceVerticalText={verticalText}
        />
      )
    } else {
      return (
        <CollapsedBranchStrip
          key={key}
          node={child as SplitBranch}
          isRow={isHorizontalBranch}
          focusedPanelId={focusedPanelId}
          useVerticalText={verticalText}
        />
      )
    }
  }

  return (
    <div
      data-collapsed-branch
      style={{
        display: 'grid',
        ...(isHorizontalBranch
          ? { gridTemplateColumns: gridTemplate, gridTemplateRows: '1fr' }
          : { gridTemplateRows: gridTemplate, gridTemplateColumns: '1fr' }
        ),
        overflow: 'hidden',
        width: '100%',
        height: '100%',
        minWidth: 0,
        minHeight: 0,
      }}
    >
      {renderChild(node.children[0], 'child-0')}
      {renderChild(node.children[1], 'child-1')}
    </div>
  )
})

/**
 * Collapsed panel within a column — matches CollapsedTiledStrip gold standard.
 * Vertical split → horizontal bar (text horizontal, left-aligned)
 * Horizontal split → vertical bar (text vertical, rotated)
 */
const CollapsedPanelStrip = memo(function CollapsedPanelStrip({
  panelId,
  isFocused,
  isRow,
  allSiblingsCollapsed = false,
  forceVerticalText,
}: {
  panelId: string
  isFocused: boolean
  isRow: boolean
  allSiblingsCollapsed?: boolean
  forceVerticalText?: boolean // override from CollapsedBranchStrip (propagated constraint)
}) {
  const title = useSelector(() => getFloatingStx().data.panels.get(panelId)?.title.get() ?? panelId)
  const accent = useSelector(() => getFloatingStx().data.panels.get(panelId)?.accent.get())
  const handleExpand = useCallback(() => {
    const stx = getFloatingStx()
    stx.data.panels.get(panelId)?.isCollapsed.set(false)
    stx.data.activePanel.set(panelId)
  }, [panelId])

  // Text orientation: forceVerticalText overrides when propagated from collapsed branch.
  // Otherwise, local logic based on cell SHAPE:
  //   vertical split + all collapsed → tall cells (1fr height) → vertical text
  //   vertical split + mixed → short 36px rows → horizontal text
  //   horizontal split + all collapsed → wide cells (1fr width, 36px from parent) → horizontal text
  //   horizontal split + mixed → narrow 36px columns → vertical text
  const isVerticalSplit = !isRow
  const useVerticalText = forceVerticalText ?? (isVerticalSplit === allSiblingsCollapsed)

  return (
    <div
      data-panel-id={panelId}
      data-panel-collapsed
      onClick={handleExpand}
      className="group/strip"
      title={`Expand ${title}`}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: useVerticalText ? 'center' : 'flex-start',
        background: PANEL.bg,
        border: `1px solid ${PANEL.border}`,
        ...(useVerticalText
          ? { borderLeft: accent ? `2px solid ${accent}` : `1px solid ${PANEL.border}` }
          : { borderTop: accent ? `2px solid ${accent}` : `1px solid ${PANEL.border}`, paddingLeft: 12 }
        ),
        cursor: 'pointer',
        overflow: 'hidden',
        boxShadow: isFocused ? PANEL.reticleGlow : PANEL.reticleNone,
        transition: 'background 150ms ease-out, box-shadow 150ms ease-out',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.background = PANEL.surfaceHover
        el.style.boxShadow = isFocused
          ? PANEL.reticleGlow
          : `inset 0 0 0 1px rgba(255,255,255,0.04)`
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.background = PANEL.bg
        el.style.boxShadow = isFocused ? PANEL.reticleGlow : PANEL.reticleNone
      }}
    >
      <span
        style={{
          ...(useVerticalText
            ? { writingMode: 'vertical-rl', transform: 'rotate(180deg)' }
            : {}
          ),
          fontFamily: PANEL.fontMono,
          fontSize: 'var(--tmnl-text-xs, 12px)',
          fontWeight: 500,
          color: PANEL.text,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          userSelect: 'none',
        }}
      >
        {title}
      </span>
    </div>
  )
})

/** Intra-column separator — 0px idle, 4px on hover, draggable */
const IntraColumnSeparator = memo(function IntraColumnSeparator({
  isRow,
  columnIndex,
  panelIdBefore,
  onResize,
}: {
  isRow: boolean
  columnIndex: number
  panelIdBefore: string
  onResize: (panelId: string, delta: number, totalSize: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const el = ref.current
    if (!el) return
    el.setPointerCapture(e.pointerId)
    setDragging(true)

    const parentEl = el.parentElement
    if (!parentEl) return
    const parentRect = parentEl.getBoundingClientRect()
    const totalSize = isRow ? parentRect.width : parentRect.height
    const startPos = isRow ? e.clientX : e.clientY

    const move = (ev: PointerEvent) => {
      const currentPos = isRow ? ev.clientX : ev.clientY
      const delta = currentPos - startPos
      onResize(panelIdBefore, delta, totalSize)
    }
    const up = (ev: PointerEvent) => {
      el.releasePointerCapture(ev.pointerId)
      setDragging(false)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }, [isRow, panelIdBefore, onResize])

  return (
    <div
      ref={ref}
      data-intra-separator
      onPointerDown={handlePointerDown}
      style={{
        position: 'relative',
        [isRow ? 'width' : 'height']: 0,
        [isRow ? 'minWidth' : 'minHeight']: 0,
        cursor: isRow ? 'col-resize' : 'row-resize',
        zIndex: 3,
        // Hit area via pseudo-element margins
        [isRow ? 'marginLeft' : 'marginTop']: -3,
        [isRow ? 'marginRight' : 'marginBottom']: -3,
        [isRow ? 'paddingLeft' : 'paddingTop']: 3,
        [isRow ? 'paddingRight' : 'paddingBottom']: 3,
        background: dragging ? PANEL.accentCyan : 'transparent',
        transition: 'background 150ms ease-out',
      }}
    />
  )
})

const ColumnGridLevel = memo(function ColumnGridLevel({
  node,
  renderPanel,
  focusedPanelId,
  columnIndex,
  onResize,
  collapsedPanels,
  path,
}: {
  node: SplitBranch
  renderPanel: (panelId: string) => ReactNode
  focusedPanelId: string | null
  columnIndex: number
  onResize: (panelId: string, delta: number, totalSize: number) => void
  collapsedPanels: Set<string>
  path: string
}) {
  const isRow = node.direction === 'horizontal'
  const items = flattenSameDirection(node)
  const fracs = computeItemFractions(node)

  // Check if each item is collapsed (leaf or all-collapsed branch)
  function isItemCollapsed(item: SplitNode): boolean {
    if (isLeaf(item)) return collapsedPanels.has(item.panelId)
    // Branch: all descendant leaves collapsed?
    const ids = collectPanelIds(item).filter(id => id !== WORKSPACE_SENTINEL)
    return ids.length > 0 && ids.every(id => collapsedPanels.has(id))
  }

  const hasAnyCollapsed = items.some(isItemCollapsed)
  const allCollapsed = items.every(isItemCollapsed)

  // Build grid template matching SplitContainer gold standard:
  // - No collapse: use ratio fractions (Nfr)
  // - Some collapsed: collapsed=36px, expanded=1fr (fill remaining)
  // - All collapsed: everyone gets 1fr (equal share)
  const tracks: string[] = []
  for (let i = 0; i < items.length; i++) {
    if (i > 0) tracks.push('0px') // separator track
    const collapsed = isItemCollapsed(items[i])
    if (!hasAnyCollapsed) {
      tracks.push(`${fracs[i]}fr`) // ratio-aware
    } else if (allCollapsed) {
      tracks.push('1fr') // equal share
    } else {
      tracks.push(collapsed ? '36px' : '1fr') // collapsed=fixed, expanded=fill
    }
  }
  const template = tracks.join(' ')

  // Collect first leaf panelId per item for separator targeting
  function firstLeafId(n: SplitNode): string {
    if (isLeaf(n)) return n.panelId
    return firstLeafId((n as SplitBranch).children[0])
  }

  return (
    <div
      data-column-grid
      data-column-grid-direction={node.direction}
      style={{
        display: 'grid',
        ...(isRow
          ? { gridTemplateColumns: template, gridTemplateRows: '1fr' }
          : { gridTemplateRows: template, gridTemplateColumns: '1fr' }
        ),
        overflow: 'hidden',
        width: '100%',
        height: '100%',
        minWidth: 0,
        minHeight: 0,
        transition: isRow
          ? 'grid-template-columns 150ms ease-out'
          : 'grid-template-rows 150ms ease-out',
      }}
    >
      {items.flatMap((item, i) => {
        const elements: ReactNode[] = []

        // Separator before each item (except first)
        if (i > 0) {
          const prevLeaf = firstLeafId(items[i - 1])
          elements.push(
            <IntraColumnSeparator
              key={`sep-${path}-${i}`}
              isRow={isRow}
              columnIndex={columnIndex}
              panelIdBefore={prevLeaf}
              onResize={onResize}
            />
          )
        }

        if (isLeaf(item)) {
          if (item.panelId === WORKSPACE_SENTINEL) {
            elements.push(<div key={`sentinel-${i}`} />)
          } else {
            const isFocused = item.panelId === focusedPanelId
            const isCollapsed = collapsedPanels.has(item.panelId)

            if (isCollapsed) {
              // Collapsed panel → strip with title
              elements.push(
                <CollapsedPanelStrip
                  key={item.panelId}
                  panelId={item.panelId}
                  isFocused={isFocused}
                  isRow={isRow}
                  allSiblingsCollapsed={allCollapsed}
                />
              )
            } else {
              elements.push(
                <div
                  key={item.panelId}
                  data-panel-reticle={isFocused || undefined}
                  style={{
                    overflow: 'hidden',
                    position: 'relative',
                    minWidth: 0,
                    minHeight: 0,
                    boxShadow: isFocused ? PANEL.reticleGlow : PANEL.reticleNone,
                    transition: PANEL.reticleTransition,
                  }}
                >
                  {/* Top accent beam */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 2,
                      background: isFocused ? PANEL.reticleAccent : 'transparent',
                      transition: 'opacity 200ms ease-out',
                      opacity: isFocused ? 1 : 0,
                      zIndex: 2,
                    }}
                  />
                  {renderPanel(item.panelId)}
                </div>
              )
            }
          }
        } else {
          // Nested branch
          const branchCollapsed = isItemCollapsed(item)
          if (branchCollapsed) {
            // All leaves collapsed → render recursive collapsed tree (preserves structure)
            elements.push(
              <CollapsedBranchStrip
                key={`branch-collapsed-${path}-${i}`}
                node={item as SplitBranch}
                isRow={isRow}
                focusedPanelId={focusedPanelId}
              />
            )
          } else {
            // Some expanded → recurse normally
            elements.push(
              <ColumnGridLevel
                key={`branch-${path}-${i}`}
                node={item as SplitBranch}
                renderPanel={renderPanel}
                focusedPanelId={focusedPanelId}
                columnIndex={columnIndex}
                onResize={onResize}
                collapsedPanels={collapsedPanels}
                path={`${path}-${i}`}
              />
            )
          }
        }
        return elements
      })}
    </div>
  )
})

// =============================================================================
// Collapsed Column Strip — thin 36px vertical strip with rotated title
// =============================================================================

/**
 * Collapsed column strip — 36px wide, renders column's SplitNode tree
 * in all-collapsed state. Preserves h/v split structure so it matches
 * tree mode's layout but compressed to 36px width.
 */
const CollapsedColumnStrip = memo(function CollapsedColumnStrip({
  column,
  index,
  isFocused,
  onExpand,
}: {
  column: Column
  index: number
  isFocused: boolean
  onExpand: () => void
}) {
  const panelIds = getColumnPanelIds(column)
  const accent = useSelector(() => {
    const panel = getFloatingStx().data.panels.get(panelIds[0])?.get()
    return panel?.accent
  })

  return (
    <div
      data-strip-column-index={index}
      data-strip-column-collapsed
      data-strip-column-focused={isFocused || undefined}
      onClick={onExpand}
      style={{
        width: COLLAPSED_COLUMN_WIDTH,
        height: '100%',
        background: PANEL.bg,
        borderRight: `1px solid ${PANEL.border}`,
        borderLeft: accent
          ? `2px solid ${accent}`
          : `1px solid ${PANEL.border}`,
        cursor: 'pointer',
        overflow: 'hidden',
        boxShadow: isFocused ? PANEL.reticleGlow : PANEL.reticleNone,
        transition: `background 150ms ease-out, ${PANEL.reticleTransition}`,
      }}
      title={`Expand column (${panelIds.length} panels)`}
    >
      {isLeaf(column.tree) ? (
        <CollapsedPanelStrip
          panelId={column.tree.panelId}
          isFocused={isFocused}
          isRow={false}
          allSiblingsCollapsed={true}
          forceVerticalText={true}
        />
      ) : (
        <CollapsedBranchStrip
          node={column.tree as SplitBranch}
          isRow={false}
          focusedPanelId={null}
          useVerticalText={true}
        />
      )}
    </div>
  )
})

// =============================================================================
// Column Cell — renders expanded panel or collapsed strip
// =============================================================================

const StripColumnCell = memo(function StripColumnCell({
  column,
  index,
  isFocused,
  focusedPanelId,
  renderPanel,
  onToggleCollapse,
}: {
  column: Column
  index: number
  isFocused: boolean
  focusedPanelId: string | null
  renderPanel: (panelId: string) => ReactNode
  onToggleCollapse: (index: number) => void
}) {
  const handleExpand = useCallback(() => onToggleCollapse(index), [onToggleCollapse, index])

  // Collapsed panels set — read from stx per panel
  const collapsedPanels = useSelector(() => {
    const stx = getFloatingStx()
    const ids = getColumnPanelIds(column)
    const set = new Set<string>()
    for (const id of ids) {
      if (stx.data.panels.get(id)?.isCollapsed.get()) set.add(id)
    }
    return set
  })

  // Resize handler — mutates the column's tree ratio via moveSeparator
  const handleResize = useCallback((panelId: string, delta: number, totalSize: number) => {
    const stx = getFloatingStx()
    const strip = stx.data.strip.peek()
    if (index < 0 || index >= strip.columns.length) return
    const col = strip.columns[index]
    const newTree = moveSeparator(col.tree, panelId, delta, totalSize)
    if (newTree !== col.tree) {
      const cols = [...strip.columns]
      cols[index] = { ...col, tree: newTree }
      stx.data.strip.set({ ...strip, columns: cols })
    }
  }, [index])

  // ── Collapsed state → thin vertical strip ──────────────────────────
  if (column.isCollapsed) {
    return (
      <CollapsedColumnStrip
        column={column}
        index={index}
        isFocused={isFocused}
        onExpand={handleExpand}
      />
    )
  }

  // ── Column shell ────────────────────────────────────────────────────
  const tree = column.tree
  const isSingleLeaf = isLeaf(tree)

  return (
    <div
      data-strip-column-index={index}
      data-strip-column-width={column.width}
      data-strip-column-focused={isFocused || undefined}
      data-strip-column-type={isSingleLeaf ? 'single' : 'tree'}
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: PANEL.bg,
        borderRight: `1px solid ${PANEL.border}`,
        borderLeft: index === 0 ? `1px solid ${PANEL.border}` : undefined,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Column content — per-panel reticle glow handled inside tree */}
      <div style={{
        flex: 1,
        overflow: 'hidden',
        position: 'relative',
        minHeight: 0,
        contentVisibility: isFocused ? 'visible' : 'auto',
        containIntrinsicSize: 'auto 500px',
      } as React.CSSProperties}>
        <ColumnTreeRenderer tree={tree} renderPanel={renderPanel} focusedPanelId={focusedPanelId} columnIndex={index} onResize={handleResize} collapsedPanels={collapsedPanels} />
      </div>
    </div>
  )
})

// =============================================================================
// Strip Status Bar
// =============================================================================

const StripStatus = memo(function StripStatus({
  columnCount,
  focusedIndex,
  focusedWidth,
}: {
  columnCount: number
  focusedIndex: number
  focusedWidth: ColumnWidth | null
}) {
  return (
    <div
      data-strip-status
      style={{
        height: 24,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        paddingInline: 12,
        background: PANEL.headerBg,
        borderTop: `1px solid ${PANEL.border}`,
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
        fontSize: 'var(--tmnl-text-xs, 12px)',
        color: PANEL.textMuted,
      }}
    >
      <span>
        <span style={{ color: PANEL.textStrong }}>{columnCount}</span> columns
      </span>
      <span style={{ color: PANEL.border, fontSize: 10 }}>│</span>
      <span>
        focus:{' '}
        <span style={{ color: PANEL.accentCyan }}>
          {focusedIndex >= 0 ? focusedIndex + 1 : '—'}
        </span>
      </span>
      {focusedWidth && (
        <>
          <span style={{ color: PANEL.border, fontSize: 10 }}>│</span>
          <span>
            width: <span style={{ color: PANEL.textStrong }}>{focusedWidth}</span>
          </span>
        </>
      )}

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: PANEL.textMuted, opacity: 0.6 }}>
          Alt+H/L focus · Alt+Shift+H/L swap · Alt+D width · Alt+W collapse · Alt+Enter spawn
        </span>
      </div>
    </div>
  )
})

// =============================================================================
// ScrollStrip — main component, reads from stx.data.strip
// =============================================================================

export interface ScrollStripProps {
  renderPanel: (panelId: string) => ReactNode
}

export const ScrollStrip = memo(function ScrollStrip({ renderPanel }: ScrollStripProps) {
  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(1200)
  const springRef = useRef<number>(0)

  // ── Subscribe to strip state from stx ──────────────────────────────────
  const columns = useSelector(() => getFloatingStx().data.strip.columns.get())
  const focusedIndex = useSelector(() => getFloatingStx().data.strip.focusedIndex.get())
  const activePanel = useSelector(() => getFloatingStx().data.activePanel.get())

  // ── Measure container width ────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ── Column pixel width from preset (or COLLAPSED_COLUMN_WIDTH) ──────
  const getColumnWidth = useCallback(
    (index: number) => {
      const col = columns[index]
      if (!col) return containerWidth * 0.5
      if (col.isCollapsed) return COLLAPSED_COLUMN_WIDTH
      // widthPct override (set by promotion) takes priority over preset
      if (col.widthPct > 0) return Math.round(containerWidth * col.widthPct)
      return Math.round(containerWidth * WIDTH_PRESETS[col.width])
    },
    [columns, containerWidth],
  )

  // ── Spring scroll to focused column ───────────────────────────────────
  // Drives scroller.scrollLeft via rAF spring (not Virtuoso behavior API,
  // which only supports 'smooth'|'auto' on standard Virtuoso).
  const scrollToFocused = useCallback(
    (index: number) => {
      if (index < 0) return

      if (springRef.current) cancelAnimationFrame(springRef.current)

      const scroller = containerRef.current?.querySelector(
        '[data-scroll-strip-scroller]',
      ) as HTMLElement | null
      if (!scroller) {
        virtuosoRef.current?.scrollToIndex({ index, align: 'center', behavior: 'smooth' })
        return
      }

      // Compute target left to center the column
      let targetLeft = 0
      for (let i = 0; i < index; i++) targetLeft += getColumnWidth(i)
      const colWidth = getColumnWidth(index)
      const viewportWidth = scroller.clientWidth
      targetLeft = targetLeft + colWidth / 2 - viewportWidth / 2
      targetLeft = Math.max(0, Math.min(targetLeft, scroller.scrollWidth - viewportWidth))

      // Spring: stiffness 300, damping 28 → ~200ms settle
      const stiffness = 300
      const damping = 28
      let velocity = 0
      let current = scroller.scrollLeft
      const target = targetLeft

      function tick() {
        const displacement = current - target
        const springForce = -stiffness * displacement
        const dampingForce = -damping * velocity
        velocity += (springForce + dampingForce) * (1 / 60)
        current += velocity * (1 / 60)

        scroller!.scrollLeft = current

        if (Math.abs(displacement) < 0.5 && Math.abs(velocity) < 0.5) {
          scroller!.scrollLeft = target
          return
        }
        springRef.current = requestAnimationFrame(tick)
      }

      springRef.current = requestAnimationFrame(tick)
    },
    [getColumnWidth],
  )

  // Cleanup spring on unmount
  useEffect(() => () => {
    if (springRef.current) cancelAnimationFrame(springRef.current)
  }, [])

  // Auto-scroll on focus change
  useEffect(() => {
    scrollToFocused(focusedIndex)
  }, [focusedIndex, scrollToFocused])

  // ── Alt+drag / middle-click drag to pan ─────────────────────────────
  const panRef = useRef<{ active: boolean; startX: number; startScroll: number }>({
    active: false, startX: 0, startScroll: 0,
  })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const scroller = el.querySelector('[data-scroll-strip-scroller]') as HTMLElement | null
    if (!scroller) return

    const onDown = (e: PointerEvent) => {
      // Alt+left-click OR middle-click (button 1)
      if ((e.altKey && e.button === 0) || e.button === 1) {
        e.preventDefault()
        // Cancel any running spring scroll
        if (springRef.current) cancelAnimationFrame(springRef.current)
        panRef.current = { active: true, startX: e.clientX, startScroll: scroller.scrollLeft }
        scroller.setPointerCapture(e.pointerId)
        scroller.style.cursor = 'grabbing'
      }
    }

    const onMove = (e: PointerEvent) => {
      if (!panRef.current.active) return
      const dx = e.clientX - panRef.current.startX
      scroller.scrollLeft = panRef.current.startScroll - dx
    }

    const onUp = (e: PointerEvent) => {
      if (!panRef.current.active) return
      panRef.current.active = false
      scroller.releasePointerCapture(e.pointerId)
      scroller.style.cursor = ''
    }

    scroller.addEventListener('pointerdown', onDown)
    scroller.addEventListener('pointermove', onMove)
    scroller.addEventListener('pointerup', onUp)
    scroller.addEventListener('pointercancel', onUp)

    return () => {
      scroller.removeEventListener('pointerdown', onDown)
      scroller.removeEventListener('pointermove', onMove)
      scroller.removeEventListener('pointerup', onUp)
      scroller.removeEventListener('pointercancel', onUp)
    }
  }, [])

  // ── Keyboard navigation — all mutations go through stx/strip.ts ───────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.altKey) return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      const key = e.key.toLowerCase()

      switch (key) {
        // H/L/J/K focus + swap are handled by useKeyboardNav (two-tier nav)
        // Split/Spawn/Close also in useKeyboardNav — no duplication.

        case 'd':
          if (!e.shiftKey) {
            e.preventDefault()
            cycleFocusedWidth()
          }
          break

        // 'w' handled by useKeyboardNav (smart panel vs column collapse)
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ── Collapse toggle handler ─────────────────────────────────────────
  const handleToggleCollapse = useCallback((index: number) => {
    toggleColumnCollapsed(index)
  }, [])

  // ── State preservation: compute overscan from stateTier ─────────────
  // If ANY column has a `full`-tier visitor, use massive overscan to keep
  // all columns mounted. With typical panel counts (3-15), this is fine.
  // Virtualization's unmount behavior only matters at 50+ items.
  const hasFullTierPanels = columns.some(col => {
    const panelId = getColumnPanelId(col)
    const stx = getFloatingStx()
    const panel = stx.data.panels.get(panelId)?.peek()
    if (!panel?.visitorId) return false
    const entry = panelRegistry.get(panel.visitorId)
    return entry?.stateTier === 'full'
  })
  // 99999px overscan = effectively "keep everything mounted"
  // 400px = normal virtualization (unmount offscreen)
  const overscan = hasFullTierPanels ? 99999 : 400

  // ── Derived state ─────────────────────────────────────────────────────
  const focusedWidth = columns[focusedIndex]?.width ?? null

  // ── Render ────────────────────────────────────────────────────────────
  if (columns.length === 0) return null

  return (
    <div
      ref={containerRef}
      data-scroll-strip
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: PANEL.bg,
      }}
    >
      <div style={{ flex: 1, position: 'relative' }}>
        <Virtuoso
          ref={virtuosoRef}
          horizontalDirection
          totalCount={columns.length}
          overscan={overscan}
          components={{ Scroller: StripScroller, List: StripList }}
          itemContent={(index) => (
            <div
              style={{
                width: getColumnWidth(index),
                height: '100%',
                flexShrink: 0,
              }}
            >
              <StripColumnCell
                column={columns[index]}
                index={index}
                isFocused={index === focusedIndex}
                focusedPanelId={activePanel}
                renderPanel={renderPanel}
                onToggleCollapse={handleToggleCollapse}
              />
            </div>
          )}
          style={{ height: '100%', width: '100%' }}
        />
      </div>

      <StripStatus
        columnCount={columns.length}
        focusedIndex={focusedIndex}
        focusedWidth={focusedWidth}
      />
    </div>
  )
})

export default ScrollStrip

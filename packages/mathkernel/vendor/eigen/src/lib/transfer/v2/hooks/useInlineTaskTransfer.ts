/**
 * useInlineTaskTransfer — THE compound hook.
 *
 * One call. Everything encapsulated. Zero prop threading.
 * getRowTransferProps(taskId) is a factory function, not a hook —
 * safe to call per-row in render.
 *
 * See: src/lib/transfer/docs/redesign/05-transfer-hook-consolidation.md
 *
 * @since v2
 */
import { useCallback, useMemo, type RefObject } from 'react'
import { useTransferScope } from './useTransferScope'
import { useTokenMap } from './useTokenMap'
import { useDragHandlers } from './useDragHandlers'
import { useClipboardHandlers } from './useClipboardHandlers'
import { useKeyboardBindings } from './useKeyboardBindings'
import type { TransferToken } from '../schemas'
import type { TransferScopeConfig } from '../TransferScope'

// ── Config ───────────────────────────────────────────────────

export interface InlineTaskTransferConfig {
  /** Thread identifier (scopes the transfer surface) */
  readonly threadId: string

  /** Tasks in this thread */
  readonly tasks: ReadonlyArray<{
    readonly id: string
    readonly label?: string
    readonly status?: string
  }>

  /** Label for cluster drags */
  readonly clusterLabel?: string

  /** Shell root ref for keyboard scoping */
  readonly shellRef: RefObject<HTMLElement | null>
}

// ── Row Props ────────────────────────────────────────────────

export interface InlineTaskRowTransferProps {
  readonly isDragging: boolean
  readonly isSelected: boolean
  readonly draggable: boolean
  readonly onDragStart: (e: React.DragEvent) => void
  readonly onDragEnd: () => void
  readonly onSelectToggle: () => void
  readonly onCopy: () => void
}

// ── Handle ───────────────────────────────────────────────────

export interface InlineTaskTransferHandle {
  readonly getRowTransferProps: (taskId: string) => InlineTaskRowTransferProps
  readonly clusterDragProps: {
    readonly draggable: boolean
    readonly onDragStart: (e: React.DragEvent) => void
    readonly onDragEnd: () => void
  }
  readonly copyCluster: () => void
  readonly copySelection: () => void
  readonly toggleSelect: (taskId: string) => void
  readonly clearSelection: () => void
  readonly isDragging: boolean
  readonly dragCount: number
  readonly selectedIds: ReadonlySet<string>
}

// ── Compound Hook ────────────────────────────────────────────

export function useInlineTaskTransfer(
  config: InlineTaskTransferConfig,
): InlineTaskTransferHandle {
  const surfaceId = `inline-task-${config.threadId}`
  const surface = useMemo(
    () => ({
      surfaceId,
      sourceId: config.threadId,
      sourceLabel: 'Inline Tasks',
    }),
    [surfaceId, config.threadId],
  )

  // Scope config — source-only surface (accept nothing)
  const scopeConfig = useMemo<TransferScopeConfig>(
    () => ({
      surfaceId,
      sourceKinds: ['task', 'task-cluster'],
      acceptKinds: [],
      lift: (selection) => {
        const tokens: TransferToken[] = []
        for (const id of selection) {
          const t = tokenMap.get(id)
          if (t) tokens.push(t)
        }
        return tokens
      },
      evaluate: (token) => ({
        _tag: 'TransferReject' as const,
        targetId: surfaceId,
        reason: 'source-only surface',
      }),
      lower: () => {
        throw new Error('source-only surface does not accept drops')
      },
    }),
    [surfaceId],
  )

  const { session, selection, setSession, setSelection } = useTransferScope(scopeConfig)

  const { tokenMap, clusterToken } = useTokenMap({
    tasks: config.tasks,
    surface,
    clusterLabel: config.clusterLabel,
  })

  const { startDrag, endDrag } = useDragHandlers({ setSession })

  const { copySingle, copySelection, copyCluster } = useClipboardHandlers({
    tokenMap,
    selection,
    setClipboard: () => {}, // clipboard atom writes handled internally
  })

  const toggleSelect = useCallback(
    (taskId: string) => {
      setSelection((prev: ReadonlySet<string>) => {
        const next = new Set(prev)
        if (next.has(taskId)) next.delete(taskId)
        else next.add(taskId)
        return next
      })
    },
    [setSelection],
  )

  const clearSelection = useCallback(() => {
    setSelection(new Set())
  }, [setSelection])

  const allTaskIds = useMemo(
    () => config.tasks.map((t) => t.id),
    [config.tasks],
  )

  useKeyboardBindings({
    shellRef: config.shellRef,
    selection,
    allTaskIds,
    copySelection,
    setSelection,
  })

  // ── Factory function (not a hook) ──────────────────────────

  const isDragging = session !== null
  const dragCount = session?.tokens.length ?? 0

  const getRowTransferProps = useCallback(
    (taskId: string): InlineTaskRowTransferProps => {
      const token = tokenMap.get(taskId)
      const rowIsDragging =
        session !== null &&
        session.tokens.some(
          (t) => t.ref._tag === 'TaskRef' && t.ref.taskId === taskId,
        )
      const isSelected = selection.has(taskId)

      return {
        isDragging: rowIsDragging,
        isSelected,
        draggable: true,
        onDragStart: (e: React.DragEvent) => {
          if (!token) return
          const tokens =
            isSelected && selection.size > 1
              ? Array.from(selection)
                  .map((id) => tokenMap.get(id))
                  .filter((t): t is TransferToken => t !== undefined)
              : [token]
          startDrag(e, tokens)
        },
        onDragEnd: endDrag,
        onSelectToggle: () => toggleSelect(taskId),
        onCopy: () => copySingle(taskId),
      }
    },
    [tokenMap, session, selection, startDrag, endDrag, toggleSelect, copySingle],
  )

  // ── Cluster drag props ─────────────────────────────────────

  const clusterDragProps = useMemo(
    () => ({
      draggable: true as const,
      onDragStart: (e: React.DragEvent) => startDrag(e, [clusterToken]),
      onDragEnd: endDrag,
    }),
    [clusterToken, startDrag, endDrag],
  )

  return {
    getRowTransferProps,
    clusterDragProps,
    copyCluster,
    copySelection,
    toggleSelect,
    clearSelection,
    isDragging,
    dragCount,
    selectedIds: selection,
  }
}

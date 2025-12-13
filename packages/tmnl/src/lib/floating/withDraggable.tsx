/**
 * withDraggable HOC
 *
 * Pure behavior wrapper - adds drag/sort + float capability to ANY component.
 * Does NOT add styling - that's the wrapped component's job.
 * Works WITH CSS Grid via @dnd-kit/sortable.
 * Double-click to pop out as floating panel.
 * All state in stx.
 *
 * @example
 * ```tsx
 * import { TestCard } from '@/components/testbed/shared'
 *
 * const DraggableCard = withDraggable(TestCard, {
 *   float: { enabled: true, title: 'My Card' },
 * })
 *
 * <SortableContext items={ids}>
 *   <div className="grid grid-cols-3 gap-4">
 *     <DraggableCard id="card-1" title="Card A">Content</DraggableCard>
 *   </div>
 * </SortableContext>
 * ```
 *
 * @module
 */

import {
  useCallback,
  forwardRef,
  type ComponentType,
  type ReactNode,
  type CSSProperties,
} from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import {
  getFloatingStx,
  registerPanel,
  unregisterPanel,
} from './floating-stx'
import { useSelector } from '@/lib/stx'
import { FloatingPanel } from './FloatingPanel'
import type { Dimensions } from './types'

// =============================================================================
// Types
// =============================================================================

interface FloatConfig {
  enabled: boolean
  title?: string
}

export interface DraggableConfig {
  /** Enable float on double-click */
  float?: FloatConfig | boolean
  /** Float dimensions */
  floatDimensions?: Dimensions
}

export interface DraggableInjectedProps {
  /** Sortable ref - attach to draggable element */
  sortableRef: (node: HTMLElement | null) => void
  /** Sortable attributes - spread on draggable element */
  sortableAttributes: Record<string, unknown>
  /** Sortable listeners - spread on drag handle */
  sortableListeners: Record<string, unknown> | undefined
  /** Style with transform for drag animation */
  sortableStyle: CSSProperties
  /** Whether currently being dragged */
  isDragging: boolean
  /** Whether this item is floating */
  isFloating: boolean
  /** Double-click handler to float */
  onDoubleClickToFloat: () => void
}

export interface DraggableProps {
  id: string
  children?: ReactNode
  className?: string
  style?: CSSProperties
  onFloat?: () => void
  onDock?: () => void
}

// =============================================================================
// HOC
// =============================================================================

export function withDraggable<P extends object>(
  WrappedComponent: ComponentType<P>,
  config: DraggableConfig = {}
) {
  const { float = false, floatDimensions = { width: 400, height: 300 } } = config

  // Normalize float config
  const floatConfig: FloatConfig | null = float === true
    ? { enabled: true }
    : float === false ? null : float

  // Return enhanced component
  function DraggableComponent({
    id,
    children,
    className = '',
    style,
    onFloat,
    onDock,
    ...restProps
  }: DraggableProps & Omit<P, keyof DraggableProps>) {
    // STX state - check if this card is floating
    const stx = getFloatingStx()
    const panelsMap = useSelector(stx.data.panels, (p) => p)
    const isFloating = panelsMap.has(id)

    // @dnd-kit sortable (works with CSS Grid)
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id, disabled: isFloating })

    // Style for drag transform (works with grid)
    // When dragging: hide original, DragOverlay shows the ghost
    const sortableStyle: CSSProperties = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.4 : 1,
      zIndex: isDragging ? 100 : 'auto',
      cursor: isDragging ? 'grabbing' : 'grab',
      userSelect: 'none',
      // Placeholder effect when dragging
      ...(isDragging && {
        boxShadow: 'inset 0 0 0 2px rgba(0, 162, 255, 0.3)',
        borderRadius: '8px',
      }),
      ...style,
    }

    // Double-click to float
    const handleDoubleClick = useCallback(() => {
      if (!floatConfig?.enabled || isFloating) return

      // Get element position for floating panel
      const rect = document.getElementById(`draggable-${id}`)?.getBoundingClientRect()
      const position = rect
        ? { x: rect.left, y: rect.top }
        : { x: 100, y: 100 }

      registerPanel({
        id,
        title: floatConfig.title ?? id,
        initialPosition: position,
        initialDimensions: floatDimensions,
      })

      onFloat?.()
    }, [id, isFloating, onFloat])

    // Dock handler (from floating back to grid)
    const handleDock = useCallback(() => {
      unregisterPanel(id)
      onDock?.()
    }, [id, onDock])

    // Render as FloatingPanel if floating
    if (isFloating) {
      const panel = panelsMap.get(id)
      if (panel) {
        return (
          <FloatingPanel
            id={id}
            title={floatConfig?.title ?? id}
            onClose={handleDock}
            onToggleMode={handleDock}
          >
            <WrappedComponent {...(restProps as P)}>
              {children}
            </WrappedComponent>
          </FloatingPanel>
        )
      }
    }

    // Render in grid - pure behavior, no styling wrapper
    return (
      <div
        id={`draggable-${id}`}
        ref={setNodeRef}
        style={sortableStyle}
        className={className}
        onDoubleClick={handleDoubleClick}
        {...attributes}
        {...listeners}
      >
        <WrappedComponent {...(restProps as P)}>
          {children}
        </WrappedComponent>
      </div>
    )
  }

  DraggableComponent.displayName = `withDraggable(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`

  return DraggableComponent
}

export default withDraggable

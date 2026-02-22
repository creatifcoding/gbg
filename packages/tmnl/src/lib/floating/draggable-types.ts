/**
 * Draggable HOC types.
 *
 * @module floating/draggable-types
 */

import type { CSSProperties, ReactNode } from 'react'
import type { Dimensions } from './types'

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
  sortableRef: (node: HTMLElement | null) => void
  sortableAttributes: Record<string, unknown>
  sortableListeners: Record<string, unknown> | undefined
  sortableStyle: CSSProperties
  isDragging: boolean
  isFloating: boolean
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

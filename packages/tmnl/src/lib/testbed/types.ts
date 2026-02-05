/**
 * Testbed Types
 *
 * Shared type definitions for the component testbed system.
 */

import type { ReactNode, CSSProperties } from 'react'

// =============================================================================
// Design Action Types
// =============================================================================

/**
 * Design action emitted from AI chat when suggesting changes
 */
export interface DesignAction {
  type: 'style' | 'prop' | 'reset'
  componentId: string
  payload: Record<string, unknown>
}

// =============================================================================
// Prop Documentation
// =============================================================================

/**
 * Documentation for a single prop
 */
export interface PropDoc {
  /** Prop name */
  name: string
  /** TypeScript type as string */
  type: string
  /** Default value (as string) */
  default?: string
  /** Human-readable description */
  description?: string
  /** Whether the prop is required */
  required?: boolean
}

// =============================================================================
// ComponentBox Props
// =============================================================================

/**
 * Enhanced ComponentBox props
 */
export interface ComponentBoxProps {
  /**
   * Unique identifier for source extraction.
   * If not provided, derived from label.
   */
  id?: string

  /**
   * Display label (required)
   */
  label: string

  /**
   * Component description (supports markdown)
   */
  description?: string

  /**
   * Prop documentation
   */
  propDocs?: PropDoc[]

  /**
   * The component to render
   */
  children: ReactNode

  /**
   * Source code (injected by plugin or manual override)
   * If not provided, uses source-registry lookup.
   */
  source?: string

  /**
   * Allow opening in isolation modal
   * @default true
   */
  isolatable?: boolean

  /**
   * Show source code section
   * @default true
   */
  showSource?: boolean

  /**
   * Custom styles for the container
   */
  style?: CSSProperties

  /**
   * Additional className
   */
  className?: string

  /**
   * Min width for the component box
   * @default 200
   */
  minWidth?: number
}

// =============================================================================
// Isolation Modal Props
// =============================================================================

/**
 * Props for the isolation modal
 */
export interface IsolationModalProps {
  /** Whether the modal is open */
  open: boolean
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void
  /** Component label */
  label: string
  /** Component description */
  description?: string
  /** Prop documentation */
  propDocs?: PropDoc[]
  /** Source code */
  source?: string
  /** The component to render */
  children: ReactNode
  /** Callback when design action is emitted from AI chat */
  onDesignAction?: (action: DesignAction) => void
}

// =============================================================================
// Source Viewer Props
// =============================================================================

/**
 * Props for the source code viewer
 */
export interface SourceViewerProps {
  /** Source code to display */
  source: string
  /** Language for syntax highlighting */
  language?: 'tsx' | 'jsx' | 'typescript' | 'javascript'
  /** Whether source is initially collapsed */
  collapsed?: boolean
  /** Max height before scrolling */
  maxHeight?: number
  /** Additional className */
  className?: string
}

// =============================================================================
// Design Override Types
// =============================================================================

/**
 * Style override for a component
 */
export interface StyleOverride {
  componentId: string
  styles: CSSProperties
}

/**
 * Prop override for a component
 */
export interface PropOverride {
  componentId: string
  propName: string
  value: unknown
}

/**
 * Design mode state
 */
export interface DesignModeState {
  /** Whether design mode is active */
  active: boolean
  /** Style overrides keyed by componentId */
  styleOverrides: Map<string, CSSProperties>
  /** Prop overrides keyed by `${componentId}:${propName}` */
  propOverrides: Map<string, unknown>
  /** Currently selected component */
  selectedComponentId: string | null
}

// =============================================================================
// Testbed Context Types
// =============================================================================

/**
 * Component registration in the testbed
 */
export interface RegisteredComponent {
  id: string
  label: string
  description?: string
  propDocs?: PropDoc[]
  source?: string
  ref?: HTMLElement
}

/**
 * Testbed context value
 */
export interface TestbedContextValue {
  /** Registered components */
  components: Map<string, RegisteredComponent>
  /** Register a component */
  registerComponent: (component: RegisteredComponent) => void
  /** Unregister a component */
  unregisterComponent: (id: string) => void
  /** Design mode state */
  designMode: DesignModeState
  /** Set design mode active */
  setDesignModeActive: (active: boolean) => void
  /** Apply style override */
  applyStyleOverride: (componentId: string, styles: CSSProperties) => void
  /** Apply prop override */
  applyPropOverride: (componentId: string, propName: string, value: unknown) => void
  /** Clear overrides for a component */
  clearOverrides: (componentId: string) => void
  /** Clear all overrides */
  clearAllOverrides: () => void
  /** Select a component */
  selectComponent: (componentId: string | null) => void
}

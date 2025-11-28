import type { Actor } from 'xstate';

/**
 * Pointer events behavior for layers
 */
export type PointerEventsBehavior =
  | 'auto' // Layer captures all pointer events
  | 'none' // Layer ignores all pointer events (pass through)
  | 'pass-through'; // Smart: container is none, children are auto

/**
 * Position mode for layers - supports multiple coordinate systems
 *
 * TODO: Implement viewport-relative positioning calculations
 * TODO: Add support for anchor points (top-left, center, etc.)
 *
 * NOTE: 'relative' is the default for backward compatibility
 * NOTE: 'fixed' and 'absolute' require parent context awareness
 */
export type PositionMode =
  | 'relative' // Default: positioned relative to normal flow
  | 'absolute' // Positioned relative to nearest positioned ancestor
  | 'fixed' // Positioned relative to viewport (full-screen layers)
  | 'sticky'; // Hybrid: relative until scroll threshold, then fixed

/**
 * Layer configuration for factory
 *
 * NOTE: All optional fields have sensible defaults applied by LayerFactory
 */
export interface LayerConfig {
  name: string;
  zIndex: number;
  visible?: boolean;
  opacity?: number;
  locked?: boolean;
  pointerEvents?: PointerEventsBehavior;
  metadata?: Record<string, unknown>;

  /**
   * Position mode for the layer wrapper
   *
   * TODO: Implement inset/offset properties for absolute/fixed modes
   * NOTE: Defaults to 'relative' for backward compatibility
   */
  positionMode?: PositionMode;

  /**
   * Whether to enable click capture on pass-through layers
   * When true, creates an inner wrapper with pointer-events: auto
   *
   * TODO: Consider making this the default behavior for pass-through
   * NOTE: This is a hotfix for click event capturing issues
   */
  captureClicks?: boolean;
}

/**
 * Layer instance with state machine
 *
 * NOTE: All properties are readonly to enforce immutability
 * NOTE: Updates should go through LayerManager operations
 */
export interface LayerInstance {
  readonly id: string;
  readonly name: string;
  readonly zIndex: number;
  readonly visible: boolean;
  readonly opacity: number;
  readonly locked: boolean;
  readonly pointerEvents: PointerEventsBehavior;
  readonly metadata: Record<string, unknown>;
  readonly machine: Actor<any>; // XState actor

  /**
   * Position mode for this layer
   * NOTE: Defaults to 'relative' if not specified during creation
   */
  readonly positionMode: PositionMode;

  /**
   * Whether click capture is enabled for pass-through mode
   * NOTE: Only relevant when pointerEvents is 'pass-through'
   */
  readonly captureClicks: boolean;
}

/**
 * Layer manager operations
 */
export interface LayerManagerOps {
  readonly getAllLayers: () => ReadonlyArray<LayerInstance>;
  readonly getLayer: (id: string) => LayerInstance | undefined;
  readonly addLayer: (layer: LayerInstance) => void;
  readonly removeLayer: (id: string) => void;
  readonly bringToFront: (id: string) => void;
  readonly sendToBack: (id: string) => void;
  readonly setVisible: (id: string, visible: boolean) => void;
  readonly setOpacity: (id: string, opacity: number) => void;
  readonly setLocked: (id: string, locked: boolean) => void;
  readonly setPointerEvents: (
    id: string,
    behavior: PointerEventsBehavior
  ) => void;
}

/**
 * ID generation strategies
 */
export type IdStrategy = 'nanoid' | 'uuid' | 'custom';

export interface IdGeneratorConfig {
  strategy: IdStrategy;
  customGenerator?: () => string;
}

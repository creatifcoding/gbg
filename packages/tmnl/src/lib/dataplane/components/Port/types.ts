/**
 * Effect Schema types for Port compound component
 *
 * Follows Schema Discipline — NO RAW TYPES
 * - Schema.Literal for enums
 * - Schema.TaggedStruct for discriminated events
 * - Schema.Struct for interfaces
 * - Export both Schema and Type
 */

import { Schema } from 'effect';
import { PortDirection, PortDataType } from '../../schemas/link';

// Re-export schema types for convenience
export { PortDirection, PortDataType };
export type PortDirection = typeof PortDirection.Type;
export type PortDataType = typeof PortDataType.Type;

// ============================================================================
// Size Variants
// ============================================================================

/**
 * Port visual size presets
 * - compact: 24×24px
 * - default: 32×32px
 * - large: 48×48px
 */
export const PortSize = Schema.Literal('compact', 'default', 'large');
export type PortSize = typeof PortSize.Type;

/**
 * Size dimensions lookup table
 */
export const PORT_SIZE_DIMENSIONS: Record<PortSize, { width: number; height: number }> = {
  compact: { width: 24, height: 24 },
  default: { width: 32, height: 32 },
  large: { width: 48, height: 48 },
};

// ============================================================================
// Visual State Machine States
// ============================================================================

/**
 * Port visual states (maps to XState machine states)
 * - collapsed: initial compact view
 * - hovered: slight scale, glow
 * - expanded: sidebar visible
 * - linking: pulsing indicator
 */
export const PortVisualState = Schema.Literal(
  'collapsed',
  'hovered',
  'expanded',
  'linking'
);
export type PortVisualState = typeof PortVisualState.Type;

// ============================================================================
// Tab System
// ============================================================================

/**
 * Default port sidebar tabs
 * - info: Connection status, metadata
 * - config: Port-specific settings
 */
export const PortTabId = Schema.Literal('info', 'config');
export type PortTabId = typeof PortTabId.Type;

// ============================================================================
// Event System (Discriminated Union)
// ============================================================================

/**
 * Hover event - no payload
 */
export const PortEventHover = Schema.TaggedStruct('Hover', {});
export type PortEventHover = typeof PortEventHover.Type;

/**
 * Unhover event - no payload
 */
export const PortEventUnhover = Schema.TaggedStruct('Unhover', {});
export type PortEventUnhover = typeof PortEventUnhover.Type;

/**
 * Expand event - no payload
 */
export const PortEventExpand = Schema.TaggedStruct('Expand', {});
export type PortEventExpand = typeof PortEventExpand.Type;

/**
 * Collapse event - no payload
 */
export const PortEventCollapse = Schema.TaggedStruct('Collapse', {});
export type PortEventCollapse = typeof PortEventCollapse.Type;

/**
 * StartLinking event - no payload
 */
export const PortEventStartLinking = Schema.TaggedStruct('StartLinking', {});
export type PortEventStartLinking = typeof PortEventStartLinking.Type;

/**
 * CancelLink event - no payload
 */
export const PortEventCancelLink = Schema.TaggedStruct('CancelLink', {});
export type PortEventCancelLink = typeof PortEventCancelLink.Type;

/**
 * LinkComplete event - includes target port ID
 */
export const PortEventLinkComplete = Schema.TaggedStruct('LinkComplete', {
  targetPortId: Schema.String,
});
export type PortEventLinkComplete = typeof PortEventLinkComplete.Type;

/**
 * SelectTab event - includes tab ID
 */
export const PortEventSelectTab = Schema.TaggedStruct('SelectTab', {
  tabId: PortTabId,
});
export type PortEventSelectTab = typeof PortEventSelectTab.Type;

/**
 * PortEvent - Discriminated union of all port events
 */
export const PortEvent = Schema.Union(
  PortEventHover,
  PortEventUnhover,
  PortEventExpand,
  PortEventCollapse,
  PortEventStartLinking,
  PortEventCancelLink,
  PortEventLinkComplete,
  PortEventSelectTab
);
export type PortEvent = typeof PortEvent.Type;

// ============================================================================
// React Context
// ============================================================================

/**
 * Send function type - dispatches PortEvent
 * Note: Functions can't be schema-validated at runtime; use Schema.declare
 */
type PortSendFn = (event: PortEvent) => void;

const PortSendFnSchema = Schema.declare(
  (input): input is PortSendFn => typeof input === 'function'
);

/**
 * PortContextValue - Shared state via React Context
 *
 * Used by compound components to access:
 * - portId: Unique identifier
 * - size: Current size variant
 * - send: Event dispatcher function
 */
export const PortContextValue = Schema.Struct({
  portId: Schema.String,
  size: PortSize,
  send: PortSendFnSchema,
});
export type PortContextValue = typeof PortContextValue.Type;

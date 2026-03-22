/**
 * Canvas Schemas - Barrel Export
 *
 * Public exports for canvas persistence schemas.
 *
 * @module canvas/schemas
 */

// =============================================================================
// Canvas Core Schemas
// =============================================================================

export {
  // Branded types
  CanvasId,
  SubdocId,
  IdentityId,
  // Enums
  CanvasStatus,
  CanvasVisibility,
  SubdocType,
  // Core schemas
  SubdocMetadata,
  CanvasMetadata,
  CreateCanvasPayload,
  UpdateCanvasPayload,
  // Events
  CanvasCreatedEvent,
  CanvasUpdatedEvent,
  CanvasDeletedEvent,
  SubdocCreatedEvent,
  SubdocDeletedEvent,
  CanvasEvent,
  // Utilities
  generateCanvasId,
  generateSubdocId,
  createInitialCanvasMetadata,
  createInitialSubdocMetadata,
} from './canvas';

// Type exports
export type {
  CanvasId as CanvasIdType,
  SubdocId as SubdocIdType,
  IdentityId as IdentityIdType,
  CanvasStatus as CanvasStatusType,
  CanvasVisibility as CanvasVisibilityType,
  SubdocType as SubdocTypeType,
  SubdocMetadata as SubdocMetadataType,
  CanvasMetadata as CanvasMetadataType,
  CreateCanvasPayload as CreateCanvasPayloadType,
  UpdateCanvasPayload as UpdateCanvasPayloadType,
  CanvasCreatedEvent as CanvasCreatedEventType,
  CanvasUpdatedEvent as CanvasUpdatedEventType,
  CanvasDeletedEvent as CanvasDeletedEventType,
  SubdocCreatedEvent as SubdocCreatedEventType,
  SubdocDeletedEvent as SubdocDeletedEventType,
  CanvasEvent as CanvasEventType,
} from './canvas';

// =============================================================================
// Shape Schemas
// =============================================================================

export {
  // EditorPanel shape
  EditorPanelShapeProps,
  EditorPanelShapeDefaultProps,
  // Future shapes
  CodePanelShapeProps,
  DataGridShapeProps,
  // Union
  CustomShapeProps,
} from './shapes';

// Type exports
export type {
  EditorPanelShapeProps as EditorPanelShapePropsType,
  CodePanelShapeProps as CodePanelShapePropsType,
  DataGridShapeProps as DataGridShapePropsType,
  CustomShapeProps as CustomShapePropsType,
} from './shapes';

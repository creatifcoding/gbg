/**
 * Editor v3 Extensions
 *
 * Tiptap extensions for Effect integration.
 *
 * @module editor/v3/extensions
 */

export { EffectBridge } from './EffectBridge';
export type { EffectBridgeOptions } from './EffectBridge';

export {
  CollaborationBridge,
  collaborationStyles,
  // Re-exported from services for convenience
  generateUserColor,
} from './CollaborationBridge';
export type {
  CollaborationBridgeOptions,
  // Re-exported from services for convenience
  CollaborationUser,
} from './CollaborationBridge';

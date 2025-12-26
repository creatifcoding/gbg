/**
 * Editor v3 Services
 *
 * Effect.Service implementations for editor functionality.
 *
 * @module editor/v3/services
 */

export {
  EditorService,
  EditorServiceLive,
  EditorNotReady,
} from './EditorService';
export type { EditorServiceShape } from './EditorService';

export {
  CollaborationService,
  CollaborationServiceLive,
  CollaborationServiceCustom,
  CollaborationConfigTag,
  generateUserColor,
} from './CollaborationService';
export type {
  CollaborationServiceShape,
  CollaborationConfig,
  ConnectionStatus,
  CollaborationUser,
} from './CollaborationService';

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

export {
  DocumentRegistryService,
  DocumentRegistryServiceLive,
  DocumentNotFoundError,
  DocumentVersionConflictError,
  DocumentRegistryError,
} from './DocumentRegistryService';
export type { DocumentRegistryServiceShape } from './DocumentRegistryService';

export {
  MarkdownService,
  MarkdownServiceLive,
  MarkdownServiceCustom,
  MarkdownConfigTag,
  MarkdownParseError,
  MarkdownSerializeError,
} from './MarkdownService';
export type { MarkdownServiceShape, MarkdownConfig } from './MarkdownService';

export {
  FileDocumentMappingService,
  FileDocumentMappingServiceLive,
  FileMappingError,
  FileMappingNotFoundError,
  FilePath,
  FileSyncStatus,
  FileMapping,
  FileMappingPayload,
  pathToKey,
  keyToPath,
} from './FileDocumentMappingService';
export type { FileDocumentMappingServiceShape } from './FileDocumentMappingService';

export {
  FileDocumentService,
  FileDocumentServiceLive,
  FileDocumentError,
  FileNotFoundError,
  FileConflictError,
} from './FileDocumentService';
export type {
  FileDocumentServiceShape,
  FileLoadResult,
  FileSaveResult,
  FileProgressInfo,
  FileConflict,
  ConflictResolution,
} from './FileDocumentService';

export {
  FileIndexingService,
  FileIndexingServiceLive,
  FileIndexingError,
  TraversalError,
} from './FileIndexingService';
export type {
  FileIndexingServiceShape,
  TraversalOptions,
  IndexingOptions,
  DiscoveredFile,
  IndexedFile,
  IndexingProgress,
  IndexingResult,
  IndexingError,
} from './FileIndexingService';

/**
 * FileBrowser Services
 *
 * Three-layer service architecture:
 * - Layer 1: FileAccessService (Tauri IPC)
 * - Layer 2: FileAnalysisService (type detection, hashing)
 * - Layer 3: FileActionsService (copy/move/delete orchestration)
 *
 * @module file-browser/services
 */

export {
  FileAccessService,
  FileAccessServiceMock,
  FileAccessServiceLive,
  type FileAccessImpl,
} from './FileAccessService'

export {
  FileAnalysisService,
  FileAnalysisServiceLive,
  type FileAnalysisImpl,
} from './FileAnalysisService'

export {
  FileActionsService,
  FileActionsServiceLive,
  type FileActionsImpl,
  type OperationProgress,
} from './FileActionsService'

// Re-export schema types for convenience
export type {
  MagicBytesInfo,
  FileHash,
  HashAlgorithm,
  FileStructure,
  StructureFormat,
} from '../schemas/file-metadata'

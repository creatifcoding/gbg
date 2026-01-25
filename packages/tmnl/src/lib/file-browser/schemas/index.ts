/**
 * FileBrowser Schemas
 *
 * Effect Schema definitions for file browser domain.
 *
 * @module file-browser/schemas
 */

// File Entry
export {
  FileType,
  FilePermissions,
  FileEntry,
  DirectoryContents,
  SortField,
  SortDirection,
  SortOrder,
} from './file-entry'
export type {
  FileType as FileTypeType,
  FilePermissions as FilePermissionsType,
  SortField as SortFieldType,
  SortDirection as SortDirectionType,
  SortOrder as SortOrderType,
} from './file-entry'

// File Metadata
export {
  HashAlgorithm,
  FileHash,
  EncryptionStatus,
  EncryptionInfo,
  StructureFormat,
  FileStructure,
  MagicBytesInfo,
  FileMetadata,
} from './file-metadata'
export type {
  HashAlgorithm as HashAlgorithmType,
  FileHash as FileHashType,
  EncryptionStatus as EncryptionStatusType,
  EncryptionInfo as EncryptionInfoType,
  StructureFormat as StructureFormatType,
  FileStructure as FileStructureType,
  MagicBytesInfo as MagicBytesInfoType,
} from './file-metadata'

// File Operation
export {
  OperationType,
  OperationPhase,
  OperationProgress,
  OperationError,
  FileOperation,
  OperationResult,
} from './file-operation'
export type {
  OperationType as OperationTypeType,
  OperationPhase as OperationPhaseType,
  OperationProgress as OperationProgressType,
  OperationError as OperationErrorType,
  OperationResult as OperationResultType,
} from './file-operation'

/**
 * FileIndex Module
 *
 * File discovery and indexing for markdown files.
 * Scans directories recursively, respects .tmnlignore patterns.
 *
 * @module file-index
 */

// Services
export {
  FileIndexService,
  FileIndexServiceLive,
} from './services/FileIndexService';
export type {
  FileIndexServiceShape,
  IndexedFile,
  IndexScanResult,
  IndexState,
} from './services/FileIndexService';

export { IgnoreService, IgnoreServiceLive } from './services/IgnoreService';
export type {
  IgnoreServiceShape,
  IgnorePattern,
  IgnoreCheckResult,
} from './services/IgnoreService';

// Atoms
export {
  // State atoms
  indexedFilesAtom,
  scanStatusAtom,
  scanStatsAtom,
  scanErrorAtom,
  rootPathAtom,
  // Derived atoms
  isScanningAtom,
  hasFilesAtom,
  fileCountAtom,
  filesByExtensionAtom,
  // Factory
  makeFileIndexOps,
  FileIndexLayerBase,
  fileIndexState,
} from './atoms';
export type { ScanStatus, ScanStats, ScanResult } from './atoms';

// Hooks
export { useFileIndex } from './hooks/useFileIndex';
export type {
  UseFileIndexOptions,
  UseFileIndexResult,
} from './hooks/useFileIndex';

// Components
export { VirtualFileList } from './components/VirtualFileList';
export type { VirtualFileListProps } from './components/VirtualFileList';

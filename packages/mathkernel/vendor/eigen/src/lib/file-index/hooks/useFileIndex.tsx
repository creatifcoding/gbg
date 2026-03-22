/**
 * useFileIndex Hook
 *
 * React hook for consuming file index state and operations.
 *
 * @module file-index/hooks/useFileIndex
 */

import { useCallback, useMemo, useEffect } from 'react';
import { useAtomValue } from '@effect-atom/atom-react';
import { Registry } from '@effect-atom/atom';
import * as Layer from 'effect/Layer';

import {
  indexedFilesAtom,
  scanStatusAtom,
  scanStatsAtom,
  scanErrorAtom,
  rootPathAtom,
  isScanningAtom,
  hasFilesAtom,
  fileCountAtom,
  makeFileIndexOps,
  FileIndexLayerBase,
  type IndexedFile,
  type ScanStatus,
  type ScanStats,
  type ScanResult,
} from '../atoms';
import { FileAccessService } from '@/lib/file-browser/services/FileAccessService';

// =============================================================================
// Types
// =============================================================================

export interface UseFileIndexOptions {
  /**
   * Registry for atom operations.
   * Required to update atoms after scan.
   */
  registry: Registry.Registry;

  /**
   * Layer providing FileAccessService.
   * Required because FileIndexService depends on it.
   */
  fileAccessLayer: Layer.Layer<FileAccessService>;

  /**
   * Auto-scan this directory on mount.
   * If provided, will trigger a scan immediately.
   */
  initialRootPath?: string;

  /**
   * Whether to auto-scan on mount.
   * Default: false
   */
  autoScan?: boolean;
}

export interface UseFileIndexResult {
  // State
  files: readonly IndexedFile[];
  status: ScanStatus;
  stats: ScanStats;
  error: string | null;
  rootPath: string | null;

  // Derived
  isScanning: boolean;
  hasFiles: boolean;
  fileCount: number;

  // Operations
  scan: (rootPath: string) => Promise<ScanResult>;
  rescan: () => Promise<ScanResult | null>;
  clear: () => Promise<void>;
}

// =============================================================================
// Hook
// =============================================================================

/**
 * React hook for file indexing.
 *
 * Usage:
 * ```tsx
 * import { useFileIndex } from '@/lib/file-index/hooks/useFileIndex';
 * import { panelRegistry } from './panel-stx';
 * import { FileAccessServiceLive } from '@/lib/file-browser/services';
 *
 * function MyComponent() {
 *   const { files, isScanning, scan } = useFileIndex({
 *     registry: panelRegistry,
 *     fileAccessLayer: FileAccessServiceLive,
 *     initialRootPath: '/home/user/docs',
 *     autoScan: true,
 *   });
 *
 *   return (
 *     <ul>
 *       {files.map(f => <li key={f.path}>{f.name}</li>)}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useFileIndex({
  registry,
  fileAccessLayer,
  initialRootPath,
  autoScan = false,
}: UseFileIndexOptions): UseFileIndexResult {
  // Read state atoms
  const files = useAtomValue(indexedFilesAtom);
  const status = useAtomValue(scanStatusAtom);
  const stats = useAtomValue(scanStatsAtom);
  const error = useAtomValue(scanErrorAtom);
  const rootPath = useAtomValue(rootPathAtom);

  // Derived state
  const isScanning = useAtomValue(isScanningAtom);
  const hasFiles = useAtomValue(hasFilesAtom);
  const fileCount = useAtomValue(fileCountAtom);

  // Create operations bound to the registry and layer
  const ops = useMemo(() => {
    // Compose the complete layer: FileIndexLayerBase needs FileAccessService
    // fileAccessLayer provides FileAccessService
    // Result: fully resolved layer with no requirements
    const completeLayer = FileIndexLayerBase.pipe(
      Layer.provide(fileAccessLayer)
    );

    return makeFileIndexOps(registry, completeLayer);
  }, [registry, fileAccessLayer]);

  // Wrap operations in stable callbacks
  const scan = useCallback((path: string) => ops.scan(path), [ops]);

  const rescan = useCallback(() => ops.rescan(), [ops]);

  const clear = useCallback(() => ops.clear(), [ops]);

  // Auto-scan on mount if configured
  useEffect(() => {
    if (autoScan && initialRootPath) {
      scan(initialRootPath).catch((err) => {
        console.error('[useFileIndex] Auto-scan failed:', err);
      });
    }
  }, [autoScan, initialRootPath, scan]);

  return {
    // State
    files,
    status,
    stats,
    error,
    rootPath,

    // Derived
    isScanning,
    hasFiles,
    fileCount,

    // Operations
    scan,
    rescan,
    clear,
  };
}

// =============================================================================
// Convenience Export
// =============================================================================

export default useFileIndex;

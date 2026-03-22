/**
 * FileIndex Atoms (Pull-Based Streaming Pattern)
 *
 * Implements the canonical effect-atom pattern for virtualized lists:
 * - Atom.pull for streaming file discovery
 * - Atom.family for per-file state isolation
 * - Atom.optimistic for responsive UI updates
 *
 * Architecture:
 * ```
 * FileIndexService.scanStream() → Stream<ScanProgress>
 *        ↓
 * Atom.pull(stream) → PullResult<IndexedFile[]>
 *        ↓
 * Atom.family(path) → Per-file atoms for selection/hover state
 *        ↓
 * TanStack Virtual → Renders only visible rows
 * ```
 *
 * @module file-index/atoms
 */

import { Atom } from '@effect-atom/atom-react';
import { Registry } from '@effect-atom/atom';
import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import * as Layer from 'effect/Layer';

import {
  FileIndexService,
  type IndexedFile,
  type IndexState,
  type ScanProgress,
} from '../services/FileIndexService';
import { IgnoreService } from '../services/IgnoreService';

// =============================================================================
// Types
// =============================================================================

export type { IndexedFile, IndexState };

/**
 * Scan status
 */
export type ScanStatus = 'idle' | 'scanning' | 'complete' | 'error';

/**
 * Scan statistics
 */
export interface ScanStats {
  readonly filesFound: number;
  readonly durationMs: number;
  readonly lastScanAt: Date | null;
}

/**
 * Scan result
 */
export interface ScanResult {
  readonly files: readonly IndexedFile[];
  readonly durationMs: number;
}

/**
 * Per-file UI state (for selection, hover, etc.)
 */
export interface FileItemState {
  readonly file: IndexedFile;
  readonly isSelected: boolean;
  readonly isHovered: boolean;
  readonly isExpanded: boolean;
}

// =============================================================================
// Service Layer (for runtime composition)
// =============================================================================

/**
 * Base FileIndex layer (without FileAccessService).
 * FileAccessService must be provided when composing.
 */
export const FileIndexLayerBase = Layer.mergeAll(
  FileIndexService.Default,
  IgnoreService.Default
);

// =============================================================================
// Core State Atoms
// =============================================================================

/**
 * Root Path Atom
 *
 * The directory being indexed (null if not set)
 */
export const rootPathAtom = Atom.make<string | null>(null);

/**
 * Scan Status Atom
 *
 * Current scan status: idle | scanning | complete | error
 */
export const scanStatusAtom = Atom.make<ScanStatus>('idle');

/**
 * Scan Error Atom
 *
 * Error message from last failed scan (null if no error)
 */
export const scanErrorAtom = Atom.make<string | null>(null);

/**
 * Scan Stats Atom
 *
 * Metrics: files found, duration, last scan timestamp
 */
export const scanStatsAtom = Atom.make<ScanStats>({
  filesFound: 0,
  durationMs: 0,
  lastScanAt: null,
});

/**
 * Indexed Files Atom
 *
 * All discovered markdown files from the last scan.
 * Updated progressively as scan discovers files.
 */
export const indexedFilesAtom = Atom.make<readonly IndexedFile[]>([]);

/**
 * Selected File Path Atom
 *
 * Currently selected file path (for single selection)
 */
export const selectedFilePathAtom = Atom.make<string | null>(null);

/**
 * Selected File Paths Atom
 *
 * Currently selected file paths (for multi-selection)
 */
export const selectedFilePathsAtom = Atom.make<ReadonlySet<string>>(
  new Set<string>()
);

// =============================================================================
// Per-File State (Atom.family)
// =============================================================================

/**
 * Per-file state atom family.
 *
 * Each file gets its own atom for UI state (selection, hover, etc.).
 * This enables efficient updates - only the affected file re-renders.
 *
 * Usage:
 * ```tsx
 * const fileState = useAtomValue(fileItemAtom(file.path))
 * ```
 */
export const fileItemStateAtom = Atom.family((path: string) =>
  Atom.make((get) => {
    const files = get(indexedFilesAtom);
    const selectedPath = get(selectedFilePathAtom);
    const selectedPaths = get(selectedFilePathsAtom);

    const file = files.find((f) => f.path === path);
    if (!file) {
      return null;
    }

    return {
      file,
      isSelected: selectedPath === path || selectedPaths.has(path),
      isHovered: false, // Managed by component
      isExpanded: false, // For future tree view
    } satisfies FileItemState;
  })
);

// =============================================================================
// Derived Atoms
// =============================================================================

/**
 * Is Scanning Atom
 *
 * Derived from status: true when scanning
 */
export const isScanningAtom = Atom.make((get) => {
  const status = get(scanStatusAtom);
  return status === 'scanning';
});

/**
 * Has Files Atom
 *
 * Derived from files: true when files exist
 */
export const hasFilesAtom = Atom.make((get) => {
  const files = get(indexedFilesAtom);
  return files.length > 0;
});

/**
 * File Count Atom
 *
 * Derived from files: current file count
 */
export const fileCountAtom = Atom.make((get) => {
  const files = get(indexedFilesAtom);
  return files.length;
});

/**
 * Files By Extension Atom
 *
 * Derived: group files by extension
 */
export const filesByExtensionAtom = Atom.make((get) => {
  const files = get(indexedFilesAtom);
  const mdFiles = files.filter((f) => f.extension === 'md');
  const mdxFiles = files.filter((f) => f.extension === 'mdx');
  return { md: mdFiles.length, mdx: mdxFiles.length };
});

/**
 * Selected File Atom
 *
 * The currently selected IndexedFile (derived from path)
 */
export const selectedFileAtom = Atom.make((get) => {
  const path = get(selectedFilePathAtom);
  if (!path) return null;

  const files = get(indexedFilesAtom);
  return files.find((f) => f.path === path) ?? null;
});

// =============================================================================
// Pull-Based Streaming Atom Factory
// =============================================================================

/**
 * Create a pull-based file stream atom.
 *
 * This is the canonical pattern for streaming data into a virtualized list.
 * The stream emits batches of files, which are accumulated and exposed
 * via the PullResult type.
 *
 * Usage:
 * ```tsx
 * const filePullAtom = createFilePullAtom(fileIndexLayer)
 *
 * function FileList() {
 *   const [result, pull] = useAtom(filePullAtom('/path/to/docs'))
 *
 *   return Result.builder(result)
 *     .onInitial(() => <button onClick={() => pull()}>Start Scan</button>)
 *     .onSuccess(({ items }, { waiting }) => (
 *       <VirtualList items={items} loading={waiting} />
 *     ))
 *     .render()
 * }
 * ```
 */
export function createFilePullAtom(
  layer: Layer.Layer<FileIndexService | IgnoreService, unknown, never>
) {
  /**
   * Create a stream that emits IndexedFile items for a given root path.
   * Uses Stream.unwrap to handle the effectful setup.
   */
  const createScanStream = (
    rootPath: string
  ): Stream.Stream<IndexedFile, Error> =>
    Stream.unwrap(
      Effect.gen(function* () {
        const indexService = yield* FileIndexService;

        // Load .tmnlignore if present
        yield* indexService.loadIgnoreFile(rootPath);

        // Map ScanProgress to individual files
        return indexService
          .scanStream(rootPath)
          .pipe(
            Stream.flatMap((progress) =>
              Stream.fromIterable(progress.currentBatch)
            )
          );
      }).pipe(
        Effect.provide(layer),
        Effect.catchAll((e) =>
          Effect.succeed(Stream.fail(new Error(String(e))))
        )
      )
    );

  /**
   * Family of pull atoms keyed by root path.
   * Each path gets its own streaming atom.
   */
  return Atom.family((rootPath: string) =>
    Atom.pull(createScanStream(rootPath))
  );
}

// =============================================================================
// Selection Operations
// =============================================================================

/**
 * Selection operations for file list.
 */
export const fileSelectionOps = {
  /**
   * Select a single file (clears multi-selection).
   */
  select: (registry: Registry.Registry, path: string) => {
    registry.set(selectedFilePathAtom, path);
    registry.set(selectedFilePathsAtom, new Set([path]));
  },

  /**
   * Toggle selection of a file (for multi-select with Ctrl/Cmd).
   */
  toggleSelect: (registry: Registry.Registry, path: string) => {
    const current = registry.get(selectedFilePathsAtom);
    const newSet = new Set(current);

    if (newSet.has(path)) {
      newSet.delete(path);
    } else {
      newSet.add(path);
    }

    registry.set(selectedFilePathsAtom, newSet);

    // Update single selection to last toggled
    if (newSet.size === 1) {
      registry.set(selectedFilePathAtom, path);
    } else if (newSet.size === 0) {
      registry.set(selectedFilePathAtom, null);
    }
  },

  /**
   * Clear all selection.
   */
  clearSelection: (registry: Registry.Registry) => {
    registry.set(selectedFilePathAtom, null);
    registry.set(selectedFilePathsAtom, new Set());
  },

  /**
   * Select a range of files (for Shift+Click).
   */
  selectRange: (
    registry: Registry.Registry,
    fromPath: string,
    toPath: string
  ) => {
    const files = registry.get(indexedFilesAtom);
    const fromIndex = files.findIndex((f) => f.path === fromPath);
    const toIndex = files.findIndex((f) => f.path === toPath);

    if (fromIndex === -1 || toIndex === -1) return;

    const start = Math.min(fromIndex, toIndex);
    const end = Math.max(fromIndex, toIndex);

    const pathsInRange = files.slice(start, end + 1).map((f) => f.path);

    registry.set(selectedFilePathsAtom, new Set(pathsInRange));
    registry.set(selectedFilePathAtom, toPath);
  },
};

// =============================================================================
// Operation Atoms Factory (Legacy API - for backwards compatibility)
// =============================================================================

/**
 * Create scan operations bound to a specific layer and registry.
 *
 * Since FileIndexService depends on FileAccessService,
 * the caller must provide a complete layer.
 *
 * Usage:
 * ```ts
 * const fileIndexLayer = FileIndexLayerBase.pipe(Layer.provide(FileAccessServiceLive))
 * const ops = makeFileIndexOps(panelRegistry, fileIndexLayer)
 * await ops.scan('/path/to/docs')
 * ```
 */
export function makeFileIndexOps(
  registry: Registry.Registry,
  layer: Layer.Layer<FileIndexService | IgnoreService, unknown, never>
) {
  /**
   * Run an Effect with the provided layer.
   */
  const runEffect = <A, E>(
    effect: Effect.Effect<A, E, FileIndexService | IgnoreService>
  ): Promise<A> => Effect.runPromise(effect.pipe(Effect.provide(layer)));

  /**
   * Scan a directory for markdown files.
   *
   * Updates atoms progressively as files are discovered.
   */
  const scan = async (rootPath: string): Promise<ScanResult> => {
    console.log('[FileIndex.scan] Starting scan', { rootPath });

    // Reset state
    registry.set(indexedFilesAtom, []);
    registry.set(scanStatusAtom, 'scanning');
    registry.set(scanErrorAtom, null);
    registry.set(rootPathAtom, rootPath);
    fileSelectionOps.clearSelection(registry);

    const startTime = Date.now();

    try {
      const result = await runEffect(
        Effect.gen(function* () {
          const indexService = yield* FileIndexService;

          // Load .tmnlignore if present
          yield* indexService.loadIgnoreFile(rootPath);

          // Progressive scan: collect files as batches arrive
          const allFiles: IndexedFile[] = [];

          yield* Stream.runForEach(
            indexService.scanStream(rootPath),
            (progress: ScanProgress) =>
              Effect.sync(() => {
                // Append batch to accumulated files
                allFiles.push(...progress.currentBatch);

                // Schedule UI update via requestAnimationFrame to avoid blocking
                requestAnimationFrame(() => {
                  registry.set(indexedFilesAtom, [...allFiles]);
                  registry.set(scanStatsAtom, {
                    filesFound: progress.filesFound,
                    durationMs: Date.now() - startTime,
                    lastScanAt: new Date(),
                  });
                });
              })
          );

          return allFiles;
        })
      );

      // Final update
      const durationMs = Date.now() - startTime;
      console.log('[FileIndex.scan] Complete:', {
        fileCount: result.length,
        durationMs,
      });

      registry.set(indexedFilesAtom, result);
      registry.set(scanStatusAtom, 'complete');
      registry.set(scanStatsAtom, {
        filesFound: result.length,
        durationMs,
        lastScanAt: new Date(),
      });

      return { files: result, durationMs };
    } catch (error) {
      console.error('[FileIndex.scan] Error:', error);
      registry.set(scanStatusAtom, 'error');
      registry.set(scanErrorAtom, String(error));
      throw error;
    }
  };

  /**
   * Clear the index.
   *
   * Resets all atoms to initial state.
   */
  const clear = async (): Promise<void> => {
    console.log('[FileIndex.clear] Clearing index');

    registry.set(indexedFilesAtom, []);
    registry.set(scanStatusAtom, 'idle');
    registry.set(scanErrorAtom, null);
    registry.set(rootPathAtom, null);
    registry.set(scanStatsAtom, {
      filesFound: 0,
      durationMs: 0,
      lastScanAt: null,
    });
    fileSelectionOps.clearSelection(registry);

    await runEffect(
      Effect.gen(function* () {
        const indexService = yield* FileIndexService;
        yield* indexService.clear();
      })
    );
  };

  /**
   * Rescan the current root path.
   *
   * Convenience method to re-scan without specifying path.
   */
  const rescan = async (): Promise<ScanResult | null> => {
    const currentRoot = registry.get(rootPathAtom);
    if (!currentRoot) {
      console.warn('[FileIndex.rescan] No root path set');
      return null;
    }

    return scan(currentRoot);
  };

  return {
    scan,
    clear,
    rescan,
    // Selection operations
    select: (path: string) => fileSelectionOps.select(registry, path),
    toggleSelect: (path: string) =>
      fileSelectionOps.toggleSelect(registry, path),
    clearSelection: () => fileSelectionOps.clearSelection(registry),
    selectRange: (fromPath: string, toPath: string) =>
      fileSelectionOps.selectRange(registry, fromPath, toPath),
  };
}

// =============================================================================
// Convenience Exports
// =============================================================================

/**
 * All state atoms bundled for easy import
 */
export const fileIndexState = {
  indexedFiles: indexedFilesAtom,
  scanStatus: scanStatusAtom,
  scanStats: scanStatsAtom,
  scanError: scanErrorAtom,
  rootPath: rootPathAtom,
  isScanning: isScanningAtom,
  hasFiles: hasFilesAtom,
  fileCount: fileCountAtom,
  filesByExtension: filesByExtensionAtom,
  selectedFilePath: selectedFilePathAtom,
  selectedFilePaths: selectedFilePathsAtom,
  selectedFile: selectedFileAtom,
};

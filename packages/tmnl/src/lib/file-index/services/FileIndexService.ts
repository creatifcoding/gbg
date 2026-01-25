/**
 * FileIndexService
 *
 * Effect.Service for scanning directories and indexing markdown files.
 * Uses Tauri's fs_scan_directory with ignore patterns from IgnoreService.
 *
 * Architecture:
 * 1. IgnoreService loads .tmnlignore + defaults → getRawPatterns()
 * 2. FileAccessService.scanDirectory sends patterns to Tauri
 * 3. Tauri's `ignore` crate filters at the Rust level (fast!)
 * 4. Results stream back in chunks for progressive UI updates
 *
 * @module file-index/services/FileIndexService
 */

import { Effect, Stream, Ref, Chunk, pipe } from 'effect';
import type { FileEntry } from '@/lib/file-browser/schemas';
import { FileAccessService } from '@/lib/file-browser/services/FileAccessService';
import { IgnoreService } from './IgnoreService';

// =============================================================================
// Types
// =============================================================================

/**
 * Indexed file entry with metadata.
 */
export interface IndexedFile {
  readonly path: string;
  readonly name: string;
  readonly extension: 'md' | 'mdx';
  readonly modifiedAt: number;
  readonly size: number;
  readonly relativePath: string;
}

/**
 * Index scan result.
 */
export interface IndexScanResult {
  readonly files: readonly IndexedFile[];
  readonly totalScanned: number;
  readonly durationMs: number;
}

/**
 * Index state.
 */
export interface IndexState {
  readonly rootPath: string | null;
  readonly files: readonly IndexedFile[];
  readonly lastScanAt: Date | null;
  readonly isScanning: boolean;
  readonly error: string | null;
}

/**
 * Scan progress for streaming updates.
 */
export interface ScanProgress {
  readonly filesFound: number;
  readonly currentBatch: readonly IndexedFile[];
}

const initialState: IndexState = {
  rootPath: null,
  files: [],
  lastScanAt: null,
  isScanning: false,
  error: null,
};

// =============================================================================
// Constants
// =============================================================================

/** Chunk size for streaming results to UI */
const STREAM_CHUNK_SIZE = 50;

// =============================================================================
// Helpers
// =============================================================================

/**
 * Check if file extension is markdown.
 */
function isMarkdownFile(entry: FileEntry): boolean {
  const ext = entry.extension?.toLowerCase();
  return ext === 'md' || ext === 'mdx';
}

/**
 * Convert FileEntry to IndexedFile.
 */
function toIndexedFile(entry: FileEntry, rootPath: string): IndexedFile {
  const relativePath = entry.path.startsWith(rootPath)
    ? entry.path.slice(rootPath.length).replace(/^\//, '')
    : entry.path;

  return {
    path: entry.path,
    name: entry.name,
    extension: (entry.extension?.toLowerCase() ?? 'md') as 'md' | 'mdx',
    modifiedAt: entry.modifiedAt,
    size: entry.size,
    relativePath,
  };
}

// =============================================================================
// Service Interface
// =============================================================================

export interface FileIndexServiceShape {
  /**
   * Scan a directory recursively for markdown files.
   * Uses Tauri's fs_scan_directory with ignore patterns.
   */
  readonly scan: (rootPath: string) => Effect.Effect<IndexScanResult, Error>;

  /**
   * Scan with progress stream.
   * Emits chunks of files as they are processed for progressive UI updates.
   * Uses Stream.rechunk for batching.
   */
  readonly scanStream: (rootPath: string) => Stream.Stream<ScanProgress, Error>;

  /**
   * Get current index state.
   */
  readonly getState: () => Effect.Effect<IndexState>;

  /**
   * Get indexed files (shortcut).
   */
  readonly getFiles: () => Effect.Effect<readonly IndexedFile[]>;

  /**
   * Clear the index.
   */
  readonly clear: () => Effect.Effect<void>;

  /**
   * Load .tmnlignore from root path.
   */
  readonly loadIgnoreFile: (rootPath: string) => Effect.Effect<boolean, Error>;
}

// =============================================================================
// Service Implementation
// =============================================================================

export class FileIndexService extends Effect.Service<FileIndexService>()(
  'tmnl/file-index/FileIndexService',
  {
    effect: Effect.gen(function* () {
      const fileAccess = yield* FileAccessService;
      const ignoreService = yield* IgnoreService;

      // Internal state
      const stateRef = yield* Ref.make<IndexState>(initialState);

      // --- LOAD IGNORE FILE ---
      const loadIgnoreFile = (
        rootPath: string
      ): Effect.Effect<boolean, Error> =>
        Effect.gen(function* () {
          const ignorePath = `${rootPath}/.tmnlignore`;

          const exists = yield* fileAccess.exists(ignorePath);
          if (!exists) {
            yield* Effect.log(
              `[FileIndexService] No .tmnlignore found at ${ignorePath}`
            );
            return false;
          }

          const content = yield* fileAccess.readFileText(ignorePath);
          yield* ignoreService.loadFromFile(content);
          yield* Effect.log(
            `[FileIndexService] Loaded .tmnlignore from ${ignorePath}`
          );
          return true;
        }).pipe(
          Effect.catchAll((error) =>
            Effect.gen(function* () {
              yield* Effect.logWarning(
                `[FileIndexService] Failed to load .tmnlignore: ${error}`
              );
              return false;
            })
          )
        );

      // --- SCAN STREAM (Progressive) ---
      const scanStream = (
        rootPath: string
      ): Stream.Stream<ScanProgress, Error> =>
        pipe(
          // Step 1: Load ignore file
          Stream.fromEffect(loadIgnoreFile(rootPath)),
          // Step 2: Get raw patterns for Tauri
          Stream.flatMap(() =>
            Stream.fromEffect(ignoreService.getRawPatterns())
          ),
          // Step 3: Call Tauri's fs_scan_directory with patterns
          Stream.flatMap((patterns) =>
            Stream.fromEffect(fileAccess.scanDirectory(rootPath, patterns))
          ),
          // Step 4: Filter to markdown files and convert
          Stream.map((entries) =>
            entries
              .filter(isMarkdownFile)
              .map((e) => toIndexedFile(e, rootPath))
          ),
          // Step 5: Chunk the array into batches for progressive UI
          Stream.flatMap((files) => {
            const batches: IndexedFile[][] = [];
            for (let i = 0; i < files.length; i += STREAM_CHUNK_SIZE) {
              batches.push(files.slice(i, i + STREAM_CHUNK_SIZE));
            }
            return Stream.fromIterable(batches);
          }),
          // Step 6: Convert batches to ScanProgress with running total
          Stream.mapAccum(0, (totalSoFar, batch) => {
            const newTotal = totalSoFar + batch.length;
            const progress: ScanProgress = {
              filesFound: newTotal,
              currentBatch: batch,
            };
            return [newTotal, progress];
          })
        );

      // --- SCAN (Collect All) ---
      const scan = (rootPath: string): Effect.Effect<IndexScanResult, Error> =>
        Effect.gen(function* () {
          const startTime = Date.now();

          // Update state: scanning
          yield* Ref.update(stateRef, (s) => ({
            ...s,
            rootPath,
            isScanning: true,
            error: null,
          }));

          // Load ignore patterns
          yield* loadIgnoreFile(rootPath);
          const patterns = yield* ignoreService.getRawPatterns();

          yield* Effect.log(
            `[FileIndexService] Scanning ${rootPath} with ${patterns.length} ignore patterns`
          );

          // Call Tauri with patterns — filtering happens in Rust!
          const allEntries = yield* fileAccess.scanDirectory(
            rootPath,
            patterns
          );

          // Filter to markdown and convert
          const files = allEntries
            .filter(isMarkdownFile)
            .map((e) => toIndexedFile(e, rootPath));

          const durationMs = Date.now() - startTime;

          // Update state: done
          yield* Ref.update(stateRef, (s) => ({
            ...s,
            files,
            lastScanAt: new Date(),
            isScanning: false,
          }));

          yield* Effect.log(
            `[FileIndexService] Found ${files.length} markdown files in ${durationMs}ms (scanned ${allEntries.length} total)`
          );

          return {
            files,
            totalScanned: allEntries.length,
            durationMs,
          };
        }).pipe(
          Effect.catchAll((error) =>
            Effect.gen(function* () {
              yield* Ref.update(stateRef, (s) => ({
                ...s,
                isScanning: false,
                error: String(error),
              }));
              return yield* Effect.fail(
                error instanceof Error ? error : new Error(String(error))
              );
            })
          )
        );

      // --- GET STATE ---
      const getState = (): Effect.Effect<IndexState> => Ref.get(stateRef);

      // --- GET FILES ---
      const getFiles = (): Effect.Effect<readonly IndexedFile[]> =>
        Effect.map(Ref.get(stateRef), (s) => s.files);

      // --- CLEAR ---
      const clear = (): Effect.Effect<void> =>
        Effect.gen(function* () {
          yield* Ref.set(stateRef, initialState);
          yield* ignoreService.reset();
        });

      return {
        scan,
        scanStream,
        getState,
        getFiles,
        clear,
        loadIgnoreFile,
      } satisfies FileIndexServiceShape;
    }),
    dependencies: [IgnoreService.Default],
  }
) {}

// =============================================================================
// Layer Exports
// =============================================================================

export const FileIndexServiceLive = FileIndexService.Default;

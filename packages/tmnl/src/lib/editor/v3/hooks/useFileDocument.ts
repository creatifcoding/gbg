/**
 * useFileDocument Hook
 *
 * React hooks for local file ↔ editor integration.
 * Provides access to file document state atoms and operations.
 *
 * NOTE: File operations require a FileDocumentService layer that includes
 * FileAccessService. Use makeFileDocumentOps() with the appropriate layer
 * for your environment (Tauri, Node.js, etc.).
 *
 * @module editor/v3/hooks/useFileDocument
 */

import { useCallback, useMemo } from 'react';
import { useAtomValue, useAtomSet } from '@effect-atom/atom-react';
import type { Registry } from '@effect-atom/atom';
import { type Layer, HashMap, HashSet, Option } from 'effect';
import type { JSONContent } from '@tiptap/core';

import {
  // Source atoms (writable)
  fileEditorAtom,
  conflictStateAtom,
  // Collection atoms (read-only)
  fileDocumentsAtom,
  dirtyFilesAtom,
  conflictFilesAtom,
  // Derived atoms (read-only)
  currentFilePathAtom,
  fileDocumentsLoadingAtom,
  fileDocumentsErrorAtom,
  currentFileMappingAtom,
  currentFileSyncStatusAtom,
  currentFileDocumentIdAtom,
  currentFileContentAtom,
  fileCountAtom,
  hasCurrentFileAtom,
  isCurrentFileDirtyAtom,
  isCurrentFileConflictAtom,
  fileListAtom,
  dirtyFileListAtom,
  currentConflictAtom,
  conflictResolvingAtom,
  hasActiveConflictAtom,
  // Markdown operations (no FileAccessService required)
  markdownOps,
  // Factory
  makeFileDocumentOps,
  // Types
  type FilePath,
  type FileMapping,
  type FileSyncStatus,
  type FileLoadResult,
  type FileSaveResult,
  type FileConflict,
  type ConflictResolution,
} from '../atoms/fileDocuments';

import { FileDocumentService } from '../services/FileDocumentService';
import type { IdentityId, DocumentId } from '../schemas/document';

// =============================================================================
// Types
// =============================================================================

/**
 * File content cache entry.
 */
interface FileContentEntry {
  readonly markdown: string;
  readonly json: JSONContent;
  readonly loadedAt: Date;
}

export interface UseFileDocumentsResult {
  /** Map of all loaded file mappings (Effect HashMap) */
  fileDocuments: HashMap.HashMap<FilePath, FileMapping>;

  /** List of loaded files (sorted by path) */
  fileList: readonly FileMapping[];

  /** Total count of loaded files */
  fileCount: number;

  /** Whether file operations are loading */
  isLoading: boolean;

  /** Current error message, if any */
  error: string | null;

  /** Set of files with unsaved changes (Effect HashSet) */
  dirtyFiles: HashSet.HashSet<FilePath>;

  /** Set of files with conflicts (Effect HashSet) */
  conflictFiles: HashSet.HashSet<FilePath>;

  /** List of dirty files (sorted by path) */
  dirtyFileList: readonly FileMapping[];

  /** Clear error state */
  clearError: () => void;
}

export interface UseCurrentFileResult {
  /** Current file's path */
  path: FilePath | null;

  /** Current file's mapping */
  mapping: FileMapping | null;

  /** Current file's document ID */
  documentId: DocumentId | null;

  /** Current file's sync status */
  syncStatus: FileSyncStatus | null;

  /** Current file's cached content */
  content: FileContentEntry | null;

  /** Whether a file is currently selected */
  hasFile: boolean;

  /** Whether current file is dirty */
  isDirty: boolean;

  /** Whether current file has a conflict */
  hasConflict: boolean;

  /** Select a file by path (local state only) */
  setCurrentFile: (path: FilePath | null) => void;
}

export interface UseMarkdownOpsResult {
  /** Parse markdown to Tiptap JSON */
  parse: (markdown: string) => Promise<JSONContent>;

  /** Serialize Tiptap JSON to markdown */
  serialize: (json: JSONContent) => Promise<string>;

  /** Normalize markdown (round-trip) */
  normalize: (markdown: string) => Promise<string>;

  /** Check if content looks like markdown */
  isMarkdown: (content: string) => Promise<boolean>;
}

// =============================================================================
// Hooks
// =============================================================================

/**
 * Hook for file document list and collection state.
 *
 * @example
 * ```tsx
 * function FileList() {
 *   const { fileList, dirtyFiles, isLoading } = useFileDocuments()
 *
 *   return (
 *     <ul>
 *       {fileList.map(file => (
 *         <li key={file.path}>
 *           {file.path}
 *           {dirtyFiles.has(file.path) && <span>●</span>}
 *         </li>
 *       ))}
 *     </ul>
 *   )
 * }
 * ```
 */
export function useFileDocuments(): UseFileDocumentsResult {
  const fileDocuments = useAtomValue(fileDocumentsAtom);
  const fileList = useAtomValue(fileListAtom);
  const fileCount = useAtomValue(fileCountAtom);
  const isLoading = useAtomValue(fileDocumentsLoadingAtom);
  const error = useAtomValue(fileDocumentsErrorAtom);
  const dirtyFiles = useAtomValue(dirtyFilesAtom);
  const conflictFiles = useAtomValue(conflictFilesAtom);
  const dirtyFileList = useAtomValue(dirtyFileListAtom);

  const updateEditor = useAtomSet(fileEditorAtom);

  const clearError = useCallback(() => {
    updateEditor((s) => ({ ...s, error: Option.none<string>() }));
  }, [updateEditor]);

  return useMemo(
    () => ({
      fileDocuments,
      fileList,
      fileCount,
      isLoading,
      error,
      dirtyFiles,
      conflictFiles,
      dirtyFileList,
      clearError,
    }),
    [
      fileDocuments,
      fileList,
      fileCount,
      isLoading,
      error,
      dirtyFiles,
      conflictFiles,
      dirtyFileList,
      clearError,
    ]
  );
}

/**
 * Hook for current file state.
 *
 * @example
 * ```tsx
 * function FileHeader() {
 *   const { path, isDirty, hasConflict, setCurrentFile } = useCurrentFile()
 *
 *   if (!path) return <div>No file selected</div>
 *
 *   return (
 *     <h1>
 *       {path}
 *       {isDirty && <span>*</span>}
 *       {hasConflict && <span>⚠️</span>}
 *     </h1>
 *   )
 * }
 * ```
 */
export function useCurrentFile(): UseCurrentFileResult {
  const path = useAtomValue(currentFilePathAtom);
  const mapping = useAtomValue(currentFileMappingAtom);
  const documentId = useAtomValue(currentFileDocumentIdAtom);
  const syncStatus = useAtomValue(currentFileSyncStatusAtom);
  const content = useAtomValue(currentFileContentAtom);
  const hasFile = useAtomValue(hasCurrentFileAtom);
  const isDirty = useAtomValue(isCurrentFileDirtyAtom);
  const hasConflict = useAtomValue(isCurrentFileConflictAtom);

  const updateEditor = useAtomSet(fileEditorAtom);

  const setCurrentFile = useCallback(
    (newPath: FilePath | null) => {
      updateEditor((s) => ({
        ...s,
        currentPath: newPath ? Option.some(newPath) : Option.none<FilePath>(),
      }));
    },
    [updateEditor]
  );

  return useMemo(
    () => ({
      path,
      mapping,
      documentId,
      syncStatus,
      content,
      hasFile,
      isDirty,
      hasConflict,
      setCurrentFile,
    }),
    [
      path,
      mapping,
      documentId,
      syncStatus,
      content,
      hasFile,
      isDirty,
      hasConflict,
      setCurrentFile,
    ]
  );
}

/**
 * Hook for markdown conversion operations.
 * These don't require FileAccessService.
 *
 * @example
 * ```tsx
 * function MarkdownPreview({ content }: { content: string }) {
 *   const { parse } = useMarkdownOps()
 *   const [json, setJson] = useState<JSONContent | null>(null)
 *
 *   useEffect(() => {
 *     parse(content).then(setJson)
 *   }, [content, parse])
 *
 *   return <TiptapEditor content={json} />
 * }
 * ```
 */
export function useMarkdownOps(): UseMarkdownOpsResult {
  const parseOp = useAtomSet(markdownOps.parse, { mode: 'promise' });
  const serializeOp = useAtomSet(markdownOps.serialize, { mode: 'promise' });
  const normalizeOp = useAtomSet(markdownOps.normalize, { mode: 'promise' });
  const isMarkdownOp = useAtomSet(markdownOps.isMarkdown, { mode: 'promise' });

  const parse = useCallback(
    async (markdown: string) => {
      return parseOp({ markdown }) as Promise<JSONContent>;
    },
    [parseOp]
  );

  const serialize = useCallback(
    async (json: JSONContent) => {
      return serializeOp({ json }) as Promise<string>;
    },
    [serializeOp]
  );

  const normalize = useCallback(
    async (markdown: string) => {
      return normalizeOp({ markdown }) as Promise<string>;
    },
    [normalizeOp]
  );

  const isMarkdown = useCallback(
    async (content: string) => {
      return isMarkdownOp({ content }) as Promise<boolean>;
    },
    [isMarkdownOp]
  );

  return useMemo(
    () => ({
      parse,
      serialize,
      normalize,
      isMarkdown,
    }),
    [parse, serialize, normalize, isMarkdown]
  );
}

// =============================================================================
// Registry-Bound Hooks (for custom layer/registry contexts)
// =============================================================================

/**
 * Hook that returns file document operations bound to a specific registry.
 *
 * This hook requires a FileDocumentService layer that includes FileAccessService.
 * Use this in contexts where you have a custom registry and layer.
 *
 * @param registry - The registry to bind operations to
 * @param fileDocumentLayer - Layer providing FileDocumentService and all dependencies
 *
 * @example
 * ```tsx
 * import { panelRegistry } from './panel-stx';
 * import { FileDocumentServiceTauriLayer } from '@/lib/file-browser/layers';
 *
 * function FileManager() {
 *   const fileOps = useFileDocumentOpsWithRegistry(
 *     panelRegistry,
 *     FileDocumentServiceTauriLayer
 *   )
 *
 *   const handleOpen = async (path: string) => {
 *     await fileOps.loadFile(path as FilePath, userId as IdentityId)
 *   }
 *
 *   const handleSave = async () => {
 *     const content = editor.getMarkdown()
 *     await fileOps.saveFile(currentPath, content)
 *   }
 *
 *   return (
 *     <div>
 *       <button onClick={() => handleOpen('/path/to/file.md')}>Open</button>
 *       <button onClick={handleSave}>Save</button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useFileDocumentOpsWithRegistry<E, R>(
  registry: Registry.Registry,
  fileDocumentLayer: Layer.Layer<FileDocumentService, E, R>
) {
  const isLoading = useAtomValue(fileDocumentsLoadingAtom);

  // Create bound ops - memoized to prevent recreation on every render
  const ops = useMemo(
    () => makeFileDocumentOps(registry, fileDocumentLayer),
    [registry, fileDocumentLayer]
  );

  const loadFile = useCallback(
    async (path: FilePath, identity: IdentityId): Promise<FileLoadResult> => {
      return ops.loadFile(path, identity);
    },
    [ops]
  );

  const saveFile = useCallback(
    async (path: FilePath, markdown: string): Promise<FileSaveResult> => {
      return ops.saveFile(path, markdown);
    },
    [ops]
  );

  const reloadFile = useCallback(
    async (path: FilePath): Promise<FileLoadResult> => {
      return ops.reloadFile(path);
    },
    [ops]
  );

  const markDirty = useCallback(
    async (path: FilePath): Promise<FileMapping> => {
      return ops.markDirty(path);
    },
    [ops]
  );

  const checkExternalChanges = useCallback(
    async (path: FilePath): Promise<boolean> => {
      return ops.checkExternalChanges(path);
    },
    [ops]
  );

  const getConflict = useCallback(
    async (
      path: FilePath,
      localContent: string
    ): Promise<FileConflict | null> => {
      return ops.getConflict(path, localContent);
    },
    [ops]
  );

  const resolveConflict = useCallback(
    async (
      path: FilePath,
      resolution: ConflictResolution,
      localContent: string,
      newPath?: FilePath
    ): Promise<FileLoadResult | FileSaveResult> => {
      return ops.resolveConflict(path, resolution, localContent, newPath);
    },
    [ops]
  );

  const getSyncStatus = useCallback(
    async (path: FilePath): Promise<FileSyncStatus | null> => {
      return ops.getSyncStatus(path);
    },
    [ops]
  );

  const setCurrent = useCallback(
    (path: FilePath | null) => {
      ops.setCurrent(path);
    },
    [ops]
  );

  const closeFile = useCallback(
    (path: FilePath) => {
      ops.closeFile(path);
    },
    [ops]
  );

  const clearError = useCallback(() => {
    ops.clearError();
  }, [ops]);

  const isLoaded = useCallback(
    (path: FilePath): boolean => {
      return ops.isLoaded(path);
    },
    [ops]
  );

  const getMapping = useCallback(
    (path: FilePath): FileMapping | null => {
      return ops.getMapping(path);
    },
    [ops]
  );

  const getContent = useCallback(
    (path: FilePath): FileContentEntry | null => {
      return ops.getContent(path);
    },
    [ops]
  );

  return useMemo(
    () => ({
      // Async operations (require FileAccessService)
      loadFile,
      saveFile,
      reloadFile,
      markDirty,
      checkExternalChanges,
      getConflict,
      resolveConflict,
      getSyncStatus,

      // Sync operations (local state only)
      setCurrent,
      closeFile,
      clearError,
      isLoaded,
      getMapping,
      getContent,

      // Loading state
      isLoading,
    }),
    [
      loadFile,
      saveFile,
      reloadFile,
      markDirty,
      checkExternalChanges,
      getConflict,
      resolveConflict,
      getSyncStatus,
      setCurrent,
      closeFile,
      clearError,
      isLoaded,
      getMapping,
      getContent,
      isLoading,
    ]
  );
}

/**
 * Combined hook for full file document functionality.
 *
 * @param registry - The registry to bind operations to
 * @param fileDocumentLayer - Layer providing FileDocumentService
 *
 * @example
 * ```tsx
 * function FileEditor() {
 *   const {
 *     currentFile,
 *     fileList,
 *     isLoading,
 *     isDirty,
 *     loadFile,
 *     saveFile,
 *     setCurrentFile,
 *   } = useFileDocumentManager(panelRegistry, FileDocumentLayer)
 *
 *   // ... use all file document features
 * }
 * ```
 */
export function useFileDocumentManager<E, R>(
  registry: Registry.Registry,
  fileDocumentLayer: Layer.Layer<FileDocumentService, E, R>
) {
  const files = useFileDocuments();
  const current = useCurrentFile();
  const markdown = useMarkdownOps();
  const ops = useFileDocumentOpsWithRegistry(registry, fileDocumentLayer);

  return useMemo(
    () => ({
      // From useFileDocuments
      fileDocuments: files.fileDocuments,
      fileList: files.fileList,
      fileCount: files.fileCount,
      dirtyFiles: files.dirtyFiles,
      conflictFiles: files.conflictFiles,
      dirtyFileList: files.dirtyFileList,

      // From useCurrentFile
      currentPath: current.path,
      currentMapping: current.mapping,
      currentDocumentId: current.documentId,
      currentSyncStatus: current.syncStatus,
      currentContent: current.content,
      hasCurrentFile: current.hasFile,
      isCurrentDirty: current.isDirty,
      hasCurrentConflict: current.hasConflict,
      setCurrentFile: current.setCurrentFile,

      // From useMarkdownOps
      parseMarkdown: markdown.parse,
      serializeMarkdown: markdown.serialize,
      normalizeMarkdown: markdown.normalize,
      isMarkdown: markdown.isMarkdown,

      // From useFileDocumentOpsWithRegistry
      loadFile: ops.loadFile,
      saveFile: ops.saveFile,
      reloadFile: ops.reloadFile,
      markDirty: ops.markDirty,
      checkExternalChanges: ops.checkExternalChanges,
      getConflict: ops.getConflict,
      resolveConflict: ops.resolveConflict,
      getSyncStatus: ops.getSyncStatus,
      closeFile: ops.closeFile,
      isLoaded: ops.isLoaded,
      getMapping: ops.getMapping,
      getContent: ops.getContent,

      // Combined loading state
      isLoading: files.isLoading || ops.isLoading,
      error: files.error,
      clearError: files.clearError,
    }),
    [files, current, markdown, ops]
  );
}

// =============================================================================
// Conflict Management Hook
// =============================================================================

export interface UseFileConflictResult {
  /** Currently active conflict awaiting resolution */
  conflict: FileConflict | null;

  /** Whether there's an active conflict */
  hasConflict: boolean;

  /** Whether resolution is in progress */
  isResolving: boolean;

  /** Show the conflict dialog for a specific conflict */
  showConflict: (conflict: FileConflict) => void;

  /** Dismiss the conflict dialog without resolving */
  dismissConflict: () => void;

  /** Set resolving state */
  setResolving: (resolving: boolean) => void;
}

/**
 * Hook for managing conflict resolution UI state.
 *
 * This hook manages the conflict dialog state separately from the
 * actual conflict resolution logic (which requires FileDocumentService).
 *
 * @example
 * ```tsx
 * function FileEditor() {
 *   const { conflict, isResolving, showConflict, dismissConflict, setResolving } = useFileConflict()
 *   const fileOps = useFileDocumentOpsWithRegistry(registry, layer)
 *
 *   const handleResolve = async (resolution: ConflictResolution, newPath?: FilePath) => {
 *     if (!conflict) return
 *
 *     setResolving(true)
 *     try {
 *       await fileOps.resolveConflict(
 *         conflict.path,
 *         resolution,
 *         conflict.localContent,
 *         newPath
 *       )
 *       dismissConflict()
 *     } finally {
 *       setResolving(false)
 *     }
 *   }
 *
 *   return (
 *     <>
 *       <Editor />
 *       <FileConflictDialog
 *         conflict={conflict}
 *         onResolve={handleResolve}
 *         onDismiss={dismissConflict}
 *         isLoading={isResolving}
 *       />
 *     </>
 *   )
 * }
 * ```
 */
export function useFileConflict(): UseFileConflictResult {
  const conflict = useAtomValue(currentConflictAtom);
  const hasConflict = useAtomValue(hasActiveConflictAtom);
  const isResolving = useAtomValue(conflictResolvingAtom);

  const updateConflictState = useAtomSet(conflictStateAtom);

  const showConflict = useCallback(
    (newConflict: FileConflict) => {
      updateConflictState((s) => ({
        ...s,
        conflict: Option.some(newConflict),
      }));
    },
    [updateConflictState]
  );

  const dismissConflict = useCallback(() => {
    updateConflictState((s) => ({
      ...s,
      conflict: Option.none<FileConflict>(),
    }));
  }, [updateConflictState]);

  const setResolving = useCallback(
    (resolving: boolean) => {
      updateConflictState((s) => ({ ...s, resolving }));
    },
    [updateConflictState]
  );

  return useMemo(
    () => ({
      conflict,
      hasConflict,
      isResolving,
      showConflict,
      dismissConflict,
      setResolving,
    }),
    [
      conflict,
      hasConflict,
      isResolving,
      showConflict,
      dismissConflict,
      setResolving,
    ]
  );
}

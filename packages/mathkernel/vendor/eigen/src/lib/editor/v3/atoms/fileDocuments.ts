/**
 * File Document Atoms (v2 — Culled)
 *
 * Single-state architecture with Atom.family for per-file isolation.
 * Pure Effect pipes. No imperative TypeScript.
 *
 * @module editor/v3/atoms/fileDocuments
 */

import { Atom, Registry } from '@effect-atom/atom';
import type { Writable } from '@effect-atom/atom/Atom';
import { Effect, Layer, Data, Option, pipe, HashMap, HashSet } from 'effect';
import type { JSONContent } from '@tiptap/core';

import {
  MarkdownService,
  MarkdownServiceLive,
} from '../services/MarkdownService';
import {
  type FilePath,
  type FileMapping,
  type FileSyncStatus,
} from '../services/FileDocumentMappingService';
import {
  FileDocumentService,
  type FileLoadResult,
  type FileSaveResult,
  type FileConflict,
  type ConflictResolution,
  FileNotFoundError,
  FileDocumentError,
} from '../services/FileDocumentService';
import type { IdentityId } from '../schemas/document';
import type { SaveState, SaveError } from '../machines/saveMachine';

// =============================================================================
// Re-exports
// =============================================================================

export type {
  FilePath,
  FileMapping,
  FileSyncStatus,
  FileLoadResult,
  FileSaveResult,
  FileConflict,
  ConflictResolution,
};

export { FileNotFoundError, FileDocumentError };

// =============================================================================
// Errors
// =============================================================================

export class FileNotLoadedError extends Data.TaggedError('FileNotLoadedError')<{
  readonly path: FilePath;
}> {
  override get message() {
    return `File not loaded: ${this.path}`;
  }
}

// =============================================================================
// Types
// =============================================================================

export interface FileContentEntry {
  readonly markdown: string;
  readonly json: JSONContent;
  readonly loadedAt: Date;
}

/** Per-file state — lives in Atom.family */
export interface FileState {
  readonly mapping: FileMapping;
  readonly content: FileContentEntry;
}

/** Global editor state — single atom */
export interface FileEditorState {
  readonly currentPath: Option.Option<FilePath>;
  readonly loadedPaths: HashSet.HashSet<FilePath>;
  readonly loading: boolean;
  readonly error: Option.Option<string>;
}

/** Conflict UI state */
export interface ConflictState {
  readonly conflict: Option.Option<FileConflict>;
  readonly resolving: boolean;
}

/** Save UI state (mirrors XState) */
export interface SaveUIState {
  readonly state: SaveState;
  readonly error: Option.Option<SaveError>;
  readonly lastSavedAt: Option.Option<Date>;
  readonly lastResult: Option.Option<FileSaveResult>;
}

// =============================================================================
// STATE ATOMS
// =============================================================================

/**
 * Per-file state atom family.
 * Each file gets isolated state — no Map cloning, automatic GC.
 */
export const fileAtom = Atom.family((path: FilePath) =>
  Atom.make<Option.Option<FileState>>(Option.none())
);

/**
 * Global editor state.
 */
export const fileEditorAtom: Writable<FileEditorState> =
  Atom.make<FileEditorState>({
    currentPath: Option.none<FilePath>(),
    loadedPaths: HashSet.empty<FilePath>(),
    loading: false,
    error: Option.none<string>(),
  });

/**
 * Conflict UI state.
 */
export const conflictStateAtom: Writable<ConflictState> =
  Atom.make<ConflictState>({
    conflict: Option.none<FileConflict>(),
    resolving: false,
  });

/**
 * Save UI state.
 */
export const saveUIAtom: Writable<SaveUIState> = Atom.make<SaveUIState>({
  state: 'idle' as SaveState,
  error: Option.none<SaveError>(),
  lastSavedAt: Option.none<Date>(),
  lastResult: Option.none<FileSaveResult>(),
});

// =============================================================================
// SELECTORS (Pure functions, not atoms)
// =============================================================================

const selectors = {
  /** Get current file's state */
  currentFile: (
    editor: FileEditorState,
    getFileState: (p: FilePath) => Option.Option<FileState>
  ) => pipe(editor.currentPath, Option.flatMap(getFileState)),

  /** Get current file's mapping */
  currentMapping: (
    editor: FileEditorState,
    getFileState: (p: FilePath) => Option.Option<FileState>
  ) =>
    pipe(
      selectors.currentFile(editor, getFileState),
      Option.map((f) => f.mapping)
    ),

  /** Get current file's content */
  currentContent: (
    editor: FileEditorState,
    getFileState: (p: FilePath) => Option.Option<FileState>
  ) =>
    pipe(
      selectors.currentFile(editor, getFileState),
      Option.map((f) => f.content)
    ),

  /** Check if file is dirty */
  isDirty: (fileState: Option.Option<FileState>) =>
    pipe(
      fileState,
      Option.map((f) => f.mapping.syncStatus === 'dirty'),
      Option.getOrElse(() => false)
    ),

  /** Check if file has conflict */
  hasConflict: (fileState: Option.Option<FileState>) =>
    pipe(
      fileState,
      Option.map((f) => f.mapping.syncStatus === 'conflict'),
      Option.getOrElse(() => false)
    ),

  /** Can save current file? */
  canSave: (
    editor: FileEditorState,
    getFileState: (p: FilePath) => Option.Option<FileState>,
    saveUI: SaveUIState
  ) =>
    pipe(
      editor.currentPath,
      Option.flatMap((path) =>
        pipe(
          getFileState(path),
          Option.map((f) => {
            const status = f.mapping.syncStatus;
            return status === 'dirty' && saveUI.state !== 'saving';
          })
        )
      ),
      Option.getOrElse(() => false)
    ),

  /** Get all dirty paths */
  dirtyPaths: (
    loadedPaths: HashSet.HashSet<FilePath>,
    getFileState: (p: FilePath) => Option.Option<FileState>
  ) =>
    pipe(
      loadedPaths,
      HashSet.filter((path) =>
        pipe(
          getFileState(path),
          Option.map((f) => f.mapping.syncStatus === 'dirty'),
          Option.getOrElse(() => false)
        )
      )
    ),

  /** Get all conflict paths */
  conflictPaths: (
    loadedPaths: HashSet.HashSet<FilePath>,
    getFileState: (p: FilePath) => Option.Option<FileState>
  ) =>
    pipe(
      loadedPaths,
      HashSet.filter((path) =>
        pipe(
          getFileState(path),
          Option.map((f) => f.mapping.syncStatus === 'conflict'),
          Option.getOrElse(() => false)
        )
      )
    ),
};

// =============================================================================
// LEGACY COMPAT ATOMS (Derived — for existing consumers)
// =============================================================================

// These exist purely for backward compatibility with useFileDocument.ts
// They derive from the new structure

export const currentFilePathAtom = Atom.make((get) =>
  pipe(get(fileEditorAtom).currentPath, Option.getOrNull)
);

export const fileDocumentsLoadingAtom = Atom.make(
  (get) => get(fileEditorAtom).loading
);

export const fileDocumentsErrorAtom = Atom.make((get) =>
  pipe(get(fileEditorAtom).error, Option.getOrNull)
);

export const hasCurrentFileAtom = Atom.make((get) =>
  Option.isSome(get(fileEditorAtom).currentPath)
);

export const currentConflictAtom = Atom.make((get) =>
  pipe(get(conflictStateAtom).conflict, Option.getOrNull)
);

export const conflictResolvingAtom = Atom.make(
  (get) => get(conflictStateAtom).resolving
);

export const hasActiveConflictAtom = Atom.make((get) =>
  Option.isSome(get(conflictStateAtom).conflict)
);

// Writable derived atoms — read from saveUIAtom, write updates saveUIAtom
export const saveStateAtom = Atom.writable(
  (get) => get(saveUIAtom).state,
  (ctx, value: SaveState) => {
    ctx.set(saveUIAtom, { ...ctx.get(saveUIAtom), state: value });
  }
);

export const saveErrorAtom = Atom.writable(
  (get) => pipe(get(saveUIAtom).error, Option.getOrNull),
  (ctx, value: SaveError | null) => {
    ctx.set(saveUIAtom, {
      ...ctx.get(saveUIAtom),
      error: value ? Option.some(value) : Option.none<SaveError>(),
    });
  }
);

export const lastSavedAtAtom = Atom.writable(
  (get) => pipe(get(saveUIAtom).lastSavedAt, Option.getOrNull),
  (ctx, value: Date | null) => {
    ctx.set(saveUIAtom, {
      ...ctx.get(saveUIAtom),
      lastSavedAt: value ? Option.some(value) : Option.none<Date>(),
    });
  }
);

export const lastSaveResultAtom = Atom.writable(
  (get) => pipe(get(saveUIAtom).lastResult, Option.getOrNull),
  (ctx, value: FileSaveResult | null) => {
    ctx.set(saveUIAtom, {
      ...ctx.get(saveUIAtom),
      lastResult: value ? Option.some(value) : Option.none<FileSaveResult>(),
    });
  }
);

export const isSavingAtom = Atom.make(
  (get) => get(saveUIAtom).state === 'saving'
);

export const isSavedAtom = Atom.make(
  (get) => get(saveUIAtom).state === 'saved'
);

export const isSaveErrorAtom = Atom.make(
  (get) => get(saveUIAtom).state === 'error'
);

// Derived collections using Effect's immutable data structures
export const fileDocumentsAtom = Atom.make((get) => {
  const editor = get(fileEditorAtom);
  return pipe(
    editor.loadedPaths,
    HashSet.reduce(HashMap.empty<FilePath, FileMapping>(), (acc, path) =>
      pipe(
        get(fileAtom(path)),
        Option.match({
          onNone: () => acc,
          onSome: (state) => HashMap.set(acc, path, state.mapping),
        })
      )
    )
  );
});

export const fileContentCacheAtom = Atom.make((get) => {
  const editor = get(fileEditorAtom);
  return pipe(
    editor.loadedPaths,
    HashSet.reduce(HashMap.empty<FilePath, FileContentEntry>(), (acc, path) =>
      pipe(
        get(fileAtom(path)),
        Option.match({
          onNone: () => acc,
          onSome: (state) => HashMap.set(acc, path, state.content),
        })
      )
    )
  );
});

export const dirtyFilesAtom = Atom.make((get) => {
  const editor = get(fileEditorAtom);
  return pipe(
    editor.loadedPaths,
    HashSet.filter((path) =>
      pipe(
        get(fileAtom(path)),
        Option.map((state) => state.mapping.syncStatus === 'dirty'),
        Option.getOrElse(() => false)
      )
    )
  );
});

export const conflictFilesAtom = Atom.make((get) => {
  const editor = get(fileEditorAtom);
  return pipe(
    editor.loadedPaths,
    HashSet.filter((path) =>
      pipe(
        get(fileAtom(path)),
        Option.map((state) => state.mapping.syncStatus === 'conflict'),
        Option.getOrElse(() => false)
      )
    )
  );
});

export const currentFileMappingAtom = Atom.make((get) => {
  const editor = get(fileEditorAtom);
  return pipe(
    editor.currentPath,
    Option.flatMap((path) => get(fileAtom(path))),
    Option.map((s) => s.mapping),
    Option.getOrNull
  );
});

export const currentFileSyncStatusAtom = Atom.make((get) => {
  const mapping = get(currentFileMappingAtom);
  return mapping?.syncStatus ?? null;
});

export const currentFileDocumentIdAtom = Atom.make((get) => {
  const mapping = get(currentFileMappingAtom);
  return mapping?.documentId ?? null;
});

export const currentFileContentAtom = Atom.make((get) => {
  const editor = get(fileEditorAtom);
  return pipe(
    editor.currentPath,
    Option.flatMap((path) => get(fileAtom(path))),
    Option.map((s) => s.content),
    Option.getOrNull
  );
});

export const fileCountAtom = Atom.make((get) =>
  HashSet.size(get(fileEditorAtom).loadedPaths)
);

export const isCurrentFileDirtyAtom = Atom.make((get) => {
  const mapping = get(currentFileMappingAtom);
  return mapping?.syncStatus === 'dirty';
});

export const isCurrentFileConflictAtom = Atom.make((get) => {
  const mapping = get(currentFileMappingAtom);
  return mapping?.syncStatus === 'conflict';
});

export const fileListAtom = Atom.make((get) => {
  const docs = get(fileDocumentsAtom);
  return pipe(
    HashMap.values(docs),
    (iter) => Array.from(iter),
    (arr) => arr.sort((a, b) => a.path.localeCompare(b.path))
  );
});

export const dirtyFileListAtom = Atom.make((get) => {
  const docs = get(fileDocumentsAtom);
  const dirty = get(dirtyFilesAtom);
  return pipe(
    HashMap.values(docs),
    (iter) => Array.from(iter),
    (arr) => arr.filter((m) => HashSet.has(dirty, m.path)),
    (arr) => arr.sort((a, b) => a.path.localeCompare(b.path))
  );
});

export const canSaveAtom = Atom.make((get) => {
  const currentPath = get(currentFilePathAtom);
  const isDirty = get(isCurrentFileDirtyAtom);
  const hasConflict = get(isCurrentFileConflictAtom);
  const isSaving = get(isSavingAtom);
  return currentPath !== null && isDirty && !hasConflict && !isSaving;
});

// =============================================================================
// MARKDOWN RUNTIME (No FileAccessService)
// =============================================================================

// MarkdownServiceLive has no external requirements (dependencies are internal)
export const markdownRuntimeAtom = Atom.runtime(
  MarkdownServiceLive as Layer.Layer<MarkdownService, never, never>
);

export const markdownOps = {
  parse: markdownRuntimeAtom.fn<{ markdown: string }>()(({ markdown }) =>
    Effect.gen(function* () {
      const svc = yield* MarkdownService;
      return yield* svc.parse(markdown);
    }).pipe(Effect.withSpan('markdownOps.parse'))
  ),

  serialize: markdownRuntimeAtom.fn<{ json: JSONContent }>()(({ json }) =>
    Effect.gen(function* () {
      const svc = yield* MarkdownService;
      return yield* svc.serialize(json);
    }).pipe(Effect.withSpan('markdownOps.serialize'))
  ),

  normalize: markdownRuntimeAtom.fn<{ markdown: string }>()(({ markdown }) =>
    Effect.gen(function* () {
      const svc = yield* MarkdownService;
      return yield* svc.normalize(markdown);
    }).pipe(Effect.withSpan('markdownOps.normalize'))
  ),

  isMarkdown: markdownRuntimeAtom.fn<{ content: string }>()(({ content }) =>
    Effect.gen(function* () {
      const svc = yield* MarkdownService;
      return yield* svc.isMarkdown(content);
    }).pipe(Effect.withSpan('markdownOps.isMarkdown'))
  ),
};

// =============================================================================
// FILE OPERATIONS (Pure Effect — registry-bound at call site)
// =============================================================================

/**
 * Load file into editor.
 * Pure Effect — caller provides registry binding.
 */
const loadFile = (
  registry: Registry.Registry,
  path: FilePath,
  identity: IdentityId
) =>
  pipe(
    Effect.sync(() => {
      registry.update(fileEditorAtom, (s) => ({
        ...s,
        loading: true,
        error: Option.none<string>(),
      }));
    }),
    Effect.flatMap(() =>
      Effect.gen(function* () {
        const svc = yield* FileDocumentService;
        return yield* svc.loadFile(path, identity);
      })
    ),
    Effect.tap((result) =>
      Effect.sync(() => {
        // Update per-file atom
        registry.set(
          fileAtom(path),
          Option.some({
            mapping: result.mapping,
            content: {
              markdown: result.markdown,
              json: result.json,
              loadedAt: new Date(),
            },
          })
        );

        // Update global state
        registry.update(fileEditorAtom, (s) => ({
          ...s,
          currentPath: Option.some(path),
          loadedPaths: HashSet.add(s.loadedPaths, path),
          loading: false,
        }));
      })
    ),
    Effect.tapError((error) =>
      Effect.sync(() => {
        const message = error instanceof Error ? error.message : String(error);
        registry.update(fileEditorAtom, (s) => ({
          ...s,
          error: Option.some(message),
          loading: false,
        }));
      })
    ),
    Effect.withSpan('loadFile', { attributes: { path } })
  );

/**
 * Save file to disk.
 */
const saveFile = (
  registry: Registry.Registry,
  path: FilePath,
  markdown: string
) =>
  pipe(
    Effect.sync(() => {
      registry.update(fileEditorAtom, (s) => ({
        ...s,
        loading: true,
        error: Option.none<string>(),
      }));
      registry.update(saveUIAtom, (s) => ({
        ...s,
        state: 'saving' as SaveState,
      }));
    }),
    Effect.flatMap(() =>
      Effect.gen(function* () {
        const svc = yield* FileDocumentService;
        return yield* svc.saveFile(path, markdown);
      })
    ),
    Effect.tap((result) =>
      Effect.sync(() => {
        // Update per-file atom
        registry.update(fileAtom(path), (current) =>
          pipe(
            current,
            Option.map((s) => ({
              ...s,
              mapping: result.mapping,
              content: { ...s.content, markdown, loadedAt: new Date() },
            }))
          )
        );

        // Update global state
        registry.update(fileEditorAtom, (s) => ({ ...s, loading: false }));

        // Update save UI
        registry.update(saveUIAtom, (s) => ({
          ...s,
          state: 'saved' as SaveState,
          lastSavedAt: Option.some(new Date()),
          lastResult: Option.some(result),
        }));
      })
    ),
    Effect.tapError((error) =>
      Effect.sync(() => {
        const message = error instanceof Error ? error.message : String(error);
        registry.update(fileEditorAtom, (s) => ({
          ...s,
          error: Option.some(message),
          loading: false,
        }));
        registry.update(saveUIAtom, (s) => ({
          ...s,
          state: 'error' as SaveState,
          error: Option.some({
            message,
            path: path as string,
            timestamp: new Date(),
          }),
        }));
      })
    ),
    Effect.withSpan('saveFile', { attributes: { path } })
  );

/**
 * Reload file from disk.
 */
const reloadFile = (registry: Registry.Registry, path: FilePath) =>
  pipe(
    Effect.sync(() => {
      registry.update(fileEditorAtom, (s) => ({
        ...s,
        loading: true,
        error: Option.none<string>(),
      }));
    }),
    Effect.flatMap(() =>
      Effect.gen(function* () {
        const svc = yield* FileDocumentService;
        return yield* svc.reloadFile(path);
      })
    ),
    Effect.tap((result) =>
      Effect.sync(() => {
        registry.set(
          fileAtom(path),
          Option.some({
            mapping: result.mapping,
            content: {
              markdown: result.markdown,
              json: result.json,
              loadedAt: new Date(),
            },
          })
        );
        registry.update(fileEditorAtom, (s) => ({ ...s, loading: false }));
      })
    ),
    Effect.tapError((error) =>
      Effect.sync(() => {
        const message = error instanceof Error ? error.message : String(error);
        registry.update(fileEditorAtom, (s) => ({
          ...s,
          error: Option.some(message),
          loading: false,
        }));
      })
    ),
    Effect.withSpan('reloadFile', { attributes: { path } })
  );

/**
 * Mark file as dirty.
 */
const markDirty = (registry: Registry.Registry, path: FilePath) =>
  pipe(
    Effect.gen(function* () {
      const svc = yield* FileDocumentService;
      return yield* svc.markDirty(path);
    }),
    Effect.tap((mapping) =>
      Effect.sync(() => {
        registry.update(fileAtom(path), (current) =>
          pipe(
            current,
            Option.map((s) => ({ ...s, mapping }))
          )
        );
      })
    ),
    Effect.withSpan('markDirty', { attributes: { path } })
  );

/**
 * Check external changes.
 */
const checkExternalChanges = (path: FilePath) =>
  pipe(
    Effect.gen(function* () {
      const svc = yield* FileDocumentService;
      return yield* svc.checkExternalChanges(path);
    }),
    Effect.withSpan('checkExternalChanges', { attributes: { path } })
  );

/**
 * Get conflict info.
 */
const getConflict = (path: FilePath, localContent: string) =>
  pipe(
    Effect.gen(function* () {
      const svc = yield* FileDocumentService;
      return yield* svc.getConflict(path, localContent);
    }),
    Effect.withSpan('getConflict', { attributes: { path } })
  );

/**
 * Resolve conflict.
 */
const resolveConflict = (
  registry: Registry.Registry,
  path: FilePath,
  resolution: ConflictResolution,
  localContent: string,
  newPath?: FilePath
) =>
  pipe(
    Effect.sync(() => {
      registry.update(fileEditorAtom, (s) => ({
        ...s,
        loading: true,
        error: Option.none<string>(),
      }));
      registry.update(conflictStateAtom, (s) => ({ ...s, resolving: true }));
    }),
    Effect.flatMap(() =>
      Effect.gen(function* () {
        const svc = yield* FileDocumentService;
        return yield* svc.resolveConflict(
          path,
          resolution,
          localContent,
          newPath
        );
      })
    ),
    Effect.tap((result) =>
      Effect.sync(() => {
        const targetPath = newPath ?? path;
        registry.update(fileAtom(targetPath), (current) =>
          pipe(
            current,
            Option.map((s) => ({ ...s, mapping: result.mapping }))
          )
        );
        registry.update(fileEditorAtom, (s) => ({ ...s, loading: false }));
        registry.update(conflictStateAtom, (s) => ({
          ...s,
          conflict: Option.none<FileConflict>(),
          resolving: false,
        }));
      })
    ),
    Effect.tapError((error) =>
      Effect.sync(() => {
        const message = error instanceof Error ? error.message : String(error);
        registry.update(fileEditorAtom, (s) => ({
          ...s,
          error: Option.some(message),
          loading: false,
        }));
        registry.update(conflictStateAtom, (s) => ({ ...s, resolving: false }));
      })
    ),
    Effect.withSpan('resolveConflict', { attributes: { path, resolution } })
  );

/**
 * Get sync status.
 */
const getSyncStatus = (path: FilePath) =>
  pipe(
    Effect.gen(function* () {
      const svc = yield* FileDocumentService;
      return yield* svc.getSyncStatus(path);
    }),
    Effect.withSpan('getSyncStatus', { attributes: { path } })
  );

// =============================================================================
// SYNC HELPERS (Direct registry access — no Effect)
// =============================================================================

const fileSyncHelpers = {
  setCurrent: (registry: Registry.Registry, path: FilePath | null) => {
    registry.update(fileEditorAtom, (s) => ({
      ...s,
      currentPath: path ? Option.some(path) : Option.none(),
    }));
  },

  clearError: (registry: Registry.Registry) => {
    registry.update(fileEditorAtom, (s) => ({ ...s, error: Option.none() }));
  },

  closeFile: (registry: Registry.Registry, path: FilePath) => {
    registry.set(fileAtom(path), Option.none());
    registry.update(fileEditorAtom, (s) => ({
      ...s,
      loadedPaths: HashSet.remove(s.loadedPaths, path),
      currentPath: pipe(
        s.currentPath,
        Option.flatMap((p) => (p === path ? Option.none() : Option.some(p)))
      ),
    }));
  },

  isLoaded: (registry: Registry.Registry, path: FilePath): boolean =>
    Option.isSome(registry.get(fileAtom(path))),

  getContent: (
    registry: Registry.Registry,
    path: FilePath
  ): FileContentEntry | null =>
    pipe(
      registry.get(fileAtom(path)),
      Option.map((s) => s.content),
      Option.getOrNull
    ),

  getMapping: (
    registry: Registry.Registry,
    path: FilePath
  ): FileMapping | null =>
    pipe(
      registry.get(fileAtom(path)),
      Option.map((s) => s.mapping),
      Option.getOrNull
    ),
};

// =============================================================================
// FACTORY (For backward compatibility)
// =============================================================================

export interface FileDocumentOps {
  loadFile: (path: FilePath, identity: IdentityId) => Promise<FileLoadResult>;
  saveFile: (path: FilePath, markdown: string) => Promise<FileSaveResult>;
  reloadFile: (path: FilePath) => Promise<FileLoadResult>;
  markDirty: (path: FilePath) => Promise<FileMapping>;
  checkExternalChanges: (path: FilePath) => Promise<boolean>;
  getConflict: (
    path: FilePath,
    localContent: string
  ) => Promise<FileConflict | null>;
  resolveConflict: (
    path: FilePath,
    resolution: ConflictResolution,
    localContent: string,
    newPath?: FilePath
  ) => Promise<FileLoadResult | FileSaveResult>;
  getSyncStatus: (path: FilePath) => Promise<FileSyncStatus | null>;
  setCurrent: (path: FilePath | null) => void;
  closeFile: (path: FilePath) => void;
  clearError: () => void;
  isLoaded: (path: FilePath) => boolean;
  getContent: (path: FilePath) => FileContentEntry | null;
  getMapping: (path: FilePath) => FileMapping | null;
}

/**
 * Create file document operations bound to registry and layer.
 * Backward-compatible factory for existing consumers.
 */
export function makeFileDocumentOps<E, R>(
  registry: Registry.Registry,
  layer: Layer.Layer<FileDocumentService, E, R>
): FileDocumentOps {
  const runEffect = <A>(
    effect: Effect.Effect<A, unknown, FileDocumentService>
  ): Promise<A> =>
    Effect.runPromise(
      pipe(effect, Effect.provide(layer as Layer.Layer<FileDocumentService>))
    ) as Promise<A>;

  return {
    loadFile: (path, identity) => runEffect(loadFile(registry, path, identity)),
    saveFile: (path, markdown) => runEffect(saveFile(registry, path, markdown)),
    reloadFile: (path) => runEffect(reloadFile(registry, path)),
    markDirty: (path) => runEffect(markDirty(registry, path)),
    checkExternalChanges: (path) => runEffect(checkExternalChanges(path)),
    getConflict: (path, localContent) =>
      runEffect(getConflict(path, localContent)),
    resolveConflict: (path, resolution, localContent, newPath) =>
      runEffect(
        resolveConflict(registry, path, resolution, localContent, newPath)
      ),
    getSyncStatus: (path) => runEffect(getSyncStatus(path)),
    setCurrent: (path) => fileSyncHelpers.setCurrent(registry, path),
    closeFile: (path) => fileSyncHelpers.closeFile(registry, path),
    clearError: () => fileSyncHelpers.clearError(registry),
    isLoaded: (path) => fileSyncHelpers.isLoaded(registry, path),
    getContent: (path) => fileSyncHelpers.getContent(registry, path),
    getMapping: (path) => fileSyncHelpers.getMapping(registry, path),
  };
}

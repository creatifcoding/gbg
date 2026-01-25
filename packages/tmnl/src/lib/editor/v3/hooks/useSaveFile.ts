/**
 * useSaveFile Hook
 *
 * Provides save-to-disk functionality with XState machine + atoms.
 * Bidirectional binding: machine reacts to atom changes, atoms reflect machine state.
 *
 * Architecture:
 * - XState machine manages state transitions
 * - Atoms provide reactive state to React
 * - Machine state syncs to atoms on every transition
 * - Atom changes (dirty, path) trigger machine events
 *
 * @module editor/v3/hooks/useSaveFile
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useAtomValue, useAtomSet } from '@effect-atom/atom-react';
import { useMachine } from '@xstate/react';
import type { Registry } from '@effect-atom/atom';
import type { Layer } from 'effect';

import {
  // Path/dirty atoms
  currentFilePathAtom,
  isCurrentFileDirtyAtom,
  isCurrentFileConflictAtom,
  // Save state atoms
  saveStateAtom,
  saveErrorAtom,
  lastSavedAtAtom,
  lastSaveResultAtom,
  isSavingAtom,
  isSavedAtom,
  isSaveErrorAtom,
  canSaveAtom,
  // Operations
  makeFileDocumentOps,
  type FilePath,
  type FileSaveResult,
} from '../atoms/fileDocuments';
import { FileDocumentService } from '../services/FileDocumentService';
import {
  saveMachine,
  type SaveState,
  type SaveError,
} from '../machines/saveMachine';

// =============================================================================
// Types
// =============================================================================

export type { SaveState, SaveError };

/**
 * Save result from hook.
 */
export interface UseSaveFileResult {
  /** Current save state */
  state: SaveState;

  /** Whether a save operation is in progress */
  isSaving: boolean;

  /** Whether the last save was successful */
  isSaved: boolean;

  /** Whether the last save failed */
  isError: boolean;

  /** Whether the file can be saved (has file, is dirty, not conflict) */
  canSave: boolean;

  /** Whether the current file is dirty */
  isDirty: boolean;

  /** Whether the current file has a conflict */
  hasConflict: boolean;

  /** Last error, if any */
  error: SaveError | null;

  /** Last saved timestamp */
  lastSavedAt: Date | null;

  /** Trigger save operation */
  save: (content: string) => Promise<FileSaveResult | null>;

  /** Save specific file (not current) */
  saveFile: (path: FilePath, content: string) => Promise<FileSaveResult | null>;

  /** Reset error state */
  resetError: () => void;

  /** Reset to idle state */
  reset: () => void;
}

/**
 * Hook options.
 */
export interface UseSaveFileOptions {
  /**
   * Registry to use for atom operations.
   */
  registry: Registry.Registry;

  /**
   * Layer providing FileDocumentService.
   */
  fileDocumentLayer: Layer.Layer<FileDocumentService, unknown, never>;

  /**
   * Duration (ms) to show "saved" state before returning to idle.
   * @default 2000
   */
  savedDisplayDuration?: number;

  /**
   * Enable Ctrl+S keyboard shortcut.
   * @default true
   */
  enableKeyboardShortcut?: boolean;

  /**
   * Callback to get current editor content for Ctrl+S saves.
   * Required if enableKeyboardShortcut is true.
   */
  getContent?: () => string;

  /**
   * Called before save starts.
   */
  onSaveStart?: (path: FilePath) => void;

  /**
   * Called after successful save.
   */
  onSaveSuccess?: (result: FileSaveResult) => void;

  /**
   * Called after save error.
   */
  onSaveError?: (error: SaveError) => void;
}

/**
 * Props for morphing save button components.
 */
export interface MorphingSaveButtonProps {
  state: SaveState;
  isDirty: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Hook for save-to-disk functionality with XState + atoms.
 *
 * @example
 * ```tsx
 * function SaveButton({ editorRef }: { editorRef: React.RefObject<Editor> }) {
 *   const { state, isDirty, canSave, save } = useSaveFile({
 *     registry: panelRegistry,
 *     fileDocumentLayer: FileDocumentServiceTauriLayer,
 *     savedDisplayDuration: 2000,
 *     getContent: () => editorRef.current?.getMarkdown() ?? '',
 *   })
 *
 *   return (
 *     <MorphingSaveButton
 *       state={state}
 *       isDirty={isDirty}
 *       onClick={() => save(editorRef.current?.getMarkdown() ?? '')}
 *       disabled={!canSave}
 *     />
 *   )
 * }
 * ```
 */
export function useSaveFile(options: UseSaveFileOptions): UseSaveFileResult {
  const {
    registry,
    fileDocumentLayer,
    savedDisplayDuration = 2000,
    enableKeyboardShortcut = true,
    getContent,
    onSaveStart,
    onSaveSuccess,
    onSaveError,
  } = options;

  // Refs
  const isMountedRef = useRef(true);

  // Atom values (reactive)
  const currentPath = useAtomValue(currentFilePathAtom);
  const isDirty = useAtomValue(isCurrentFileDirtyAtom);
  const hasConflict = useAtomValue(isCurrentFileConflictAtom);
  const canSave = useAtomValue(canSaveAtom);

  // Atom setters
  const setSaveState = useAtomSet(saveStateAtom);
  const setSaveError = useAtomSet(saveErrorAtom);
  const setLastSavedAt = useAtomSet(lastSavedAtAtom);
  const setLastSaveResult = useAtomSet(lastSaveResultAtom);

  // Read derived save atoms
  const state = useAtomValue(saveStateAtom);
  const error = useAtomValue(saveErrorAtom);
  const lastSavedAt = useAtomValue(lastSavedAtAtom);
  const isSaving = useAtomValue(isSavingAtom);
  const isSaved = useAtomValue(isSavedAtom);
  const isError = useAtomValue(isSaveErrorAtom);

  // XState machine - provide initial context via input
  const [machineState, send] = useMachine(
    saveMachine.provide({
      delays: {
        savedDisplayDelay: () => savedDisplayDuration,
      },
    }),
    {
      input: {
        path: currentPath,
        isDirty,
        savedDisplayDuration,
      },
    }
  );

  // Sync machine state → atoms
  useEffect(() => {
    const stateValue = machineState.value as SaveState;
    setSaveState(stateValue);

    if (machineState.context.error) {
      setSaveError(machineState.context.error);
    }

    if (machineState.context.lastSavedAt) {
      setLastSavedAt(machineState.context.lastSavedAt);
    }
  }, [
    machineState.value,
    machineState.context,
    setSaveState,
    setSaveError,
    setLastSavedAt,
    setLastSaveResult,
  ]);

  // Sync path changes → machine
  useEffect(() => {
    send({ type: 'SET_PATH', path: currentPath });
  }, [currentPath, send]);

  // Sync dirty state → machine
  useEffect(() => {
    if (isDirty) {
      send({ type: 'MARK_DIRTY' });
    } else {
      send({ type: 'CLEAR_DIRTY' });
    }
  }, [isDirty, send]);

  // Create ops
  const ops = useMemo(
    () => makeFileDocumentOps(registry, fileDocumentLayer),
    [registry, fileDocumentLayer]
  );

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Save specific file
  const saveFile = useCallback(
    async (path: FilePath, content: string): Promise<FileSaveResult | null> => {
      // Send SAVE event to machine
      send({
        type: 'SAVE',
        path: path as string,
        content,
      });

      onSaveStart?.(path);

      try {
        const result = await ops.saveFile(path, content);

        if (!isMountedRef.current) return result;

        // Send success event (no payload — machine updates lastSavedAt internally)
        send({ type: 'SAVE_SUCCESS' });

        // Update atom with full result from actual save operation
        setLastSaveResult(result);

        onSaveSuccess?.(result);

        return result;
      } catch (err) {
        if (!isMountedRef.current) return null;

        const saveError: SaveError = {
          message: err instanceof Error ? err.message : String(err),
          path: path as string,
          timestamp: new Date(),
        };

        // Send error event
        send({ type: 'SAVE_ERROR', error: saveError });

        onSaveError?.(saveError);

        return null;
      }
    },
    [ops, send, onSaveStart, onSaveSuccess, onSaveError, setLastSaveResult]
  );

  // Save current file
  const save = useCallback(
    async (content: string): Promise<FileSaveResult | null> => {
      if (!currentPath) {
        console.warn('[useSaveFile] No current file to save');
        return null;
      }

      if (hasConflict) {
        console.warn('[useSaveFile] Cannot save file with conflict');
        return null;
      }

      return saveFile(currentPath, content);
    },
    [currentPath, hasConflict, saveFile]
  );

  // Reset error
  const resetError = useCallback(() => {
    send({ type: 'RESET' });
    setSaveError(null);
  }, [send, setSaveError]);

  // Reset to idle
  const reset = useCallback(() => {
    send({ type: 'RESET' });
    setSaveError(null);
    setSaveState('idle');
  }, [send, setSaveError, setSaveState]);

  // Keyboard shortcut handler
  useEffect(() => {
    if (!enableKeyboardShortcut || !getContent) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S or Cmd+S
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();

        if (!canSave) {
          console.log('[useSaveFile] Ctrl+S ignored: cannot save');
          return;
        }

        const content = getContent();
        save(content);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enableKeyboardShortcut, getContent, canSave, save]);

  return useMemo(
    () => ({
      state,
      isSaving,
      isSaved,
      isError,
      canSave,
      isDirty,
      hasConflict,
      error,
      lastSavedAt,
      save,
      saveFile,
      resetError,
      reset,
    }),
    [
      state,
      isSaving,
      isSaved,
      isError,
      canSave,
      isDirty,
      hasConflict,
      error,
      lastSavedAt,
      save,
      saveFile,
      resetError,
      reset,
    ]
  );
}

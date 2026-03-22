/**
 * Save State Machine Types
 *
 * Plain TypeScript types for the save state machine.
 * No Schema.Literal — XState enforces the contracts.
 *
 * @module editor/v3/schemas/save
 */

// =============================================================================
// Save States
// =============================================================================

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

// =============================================================================
// Save Error
// =============================================================================

export interface SaveError {
  readonly message: string;
  readonly path: string;
  readonly timestamp: Date;
}

// =============================================================================
// Machine Context
// =============================================================================

export interface SaveMachineContext {
  readonly path: string | null;
  readonly content: string | null;
  readonly error: SaveError | null;
  readonly lastSavedAt: Date | null;
  readonly isDirty: boolean;
  readonly savedDisplayDuration: number;
}

export const defaultSaveMachineContext: SaveMachineContext = {
  path: null,
  content: null,
  error: null,
  lastSavedAt: null,
  isDirty: false,
  savedDisplayDuration: 2000,
};

// =============================================================================
// Machine Events
// =============================================================================

export type SaveMachineEvent =
  | { type: 'SAVE'; path: string; content: string }
  | { type: 'SAVE_SUCCESS' }
  | { type: 'SAVE_ERROR'; error: SaveError }
  | { type: 'RETRY' }
  | { type: 'RESET' }
  | { type: 'MARK_DIRTY' }
  | { type: 'CLEAR_DIRTY' }
  | { type: 'SET_PATH'; path: string | null };

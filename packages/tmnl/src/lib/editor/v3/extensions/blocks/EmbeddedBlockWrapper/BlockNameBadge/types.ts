/**
 * BlockNameBadge Types
 *
 * TypeScript interfaces for the BlockNameBadge component.
 *
 * @module editor/v3/extensions/blocks/BlockNameBadge/types
 */

import type { BlockId } from '../shared';
import type { BlockNameMachineContext } from './machines/blockNameMachine';

// =============================================================================
// State Types
// =============================================================================

/**
 * Badge state values (matches XState machine states)
 */
export type BadgeState =
  | 'display'
  | 'editing'
  | 'submitting'
  | 'success'
  | 'error';

// =============================================================================
// Component Props
// =============================================================================

export interface BlockNameBadgeProps {
  /** The block ID this badge represents */
  blockId: BlockId;

  /** Handler for rename operations. If undefined, badge is read-only. */
  onRename?: (newName: string) => Promise<void>;

  /** Optional accent color override */
  accentColor?: string;

  /** Optional accent background override */
  accentBg?: string;
}

// =============================================================================
// Animation Refs
// =============================================================================

/**
 * Refs for all animatable elements in the badge.
 * Used by animation functions to target specific DOM elements.
 */
export interface AnimationRefs {
  /** Container wrapper */
  badgeRef: React.RefObject<HTMLDivElement>;

  /** Name text span */
  nameRef: React.RefObject<HTMLSpanElement>;

  /** "@" prefix symbol */
  prefixRef: React.RefObject<HTMLSpanElement>;

  /** Underline element */
  underlineRef: React.RefObject<HTMLDivElement>;

  /** Caret indicator (visible during editing) */
  caretRef: React.RefObject<HTMLDivElement>;

  /** Success checkmark SVG */
  checkmarkRef: React.RefObject<SVGSVGElement>;

  /** Error message span */
  errorRef: React.RefObject<HTMLSpanElement>;

  /** Block ID label */
  blockIdRef: React.RefObject<HTMLSpanElement>;
}

// =============================================================================
// Animation Config
// =============================================================================

/**
 * Configuration for a state transition animation
 */
export interface TransitionConfig {
  /** State we're transitioning from */
  from: BadgeState;

  /** State we're transitioning to */
  to: BadgeState;

  /** Animation target refs */
  refs: AnimationRefs;

  /** Machine context at transition time */
  context: BlockNameMachineContext;
}

/**
 * Animation handle returned by anime.js
 */
export interface AnimationHandle {
  play: () => void;
  pause: () => void;
  restart: () => void;
  reverse: () => void;
  seek: (time: number) => void;
  readonly paused: boolean;
  readonly completed: boolean;
}

// =============================================================================
// Error Handling
// =============================================================================

/**
 * Parsed error structure for display in the error popover.
 */
export interface ParsedError {
  /** Short error title (e.g., "Invalid name", "Network error") */
  title: string;
  /** Detailed error message */
  message: string;
  /** Error code if available */
  code?: string;
}

/**
 * Known error patterns for parsing.
 */
const ERROR_PATTERNS: Array<{
  pattern: RegExp;
  title: string;
  extract?: (match: RegExpMatchArray) => string;
}> = [
  {
    pattern: /invalid.*name/i,
    title: 'Invalid name',
  },
  {
    pattern: /already exists/i,
    title: 'Name taken',
  },
  {
    pattern: /network|fetch|connect/i,
    title: 'Network error',
  },
  {
    pattern: /timeout/i,
    title: 'Timeout',
  },
  {
    pattern: /permission|unauthorized|forbidden/i,
    title: 'Permission denied',
  },
  {
    pattern: /not found|404/i,
    title: 'Not found',
  },
];

/**
 * Parse an error string into a structured format for display.
 *
 * @param error - Raw error string from the rename operation
 * @returns Parsed error with title and message
 */
export function parseError(error: string): ParsedError {
  // Try to match known patterns
  for (const { pattern, title } of ERROR_PATTERNS) {
    if (pattern.test(error)) {
      return {
        title,
        message: error,
      };
    }
  }

  // Extract code from patterns like "[ERR_CODE] message" or "Error: message"
  const codeMatch = error.match(/^\[?([A-Z_]+)\]?:?\s*(.+)$/i);
  if (codeMatch) {
    return {
      title: 'Error',
      message: codeMatch[2] || error,
      code: codeMatch[1],
    };
  }

  // Default: use "Rename failed" as title
  return {
    title: 'Rename failed',
    message: error,
  };
}

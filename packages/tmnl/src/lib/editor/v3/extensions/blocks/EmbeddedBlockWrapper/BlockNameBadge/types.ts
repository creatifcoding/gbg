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

/**
 * Chart Lock System Schemas
 *
 * Effect Schema definitions for chart lock tiers.
 * Enables semaphore-style locking for agentic chart generation.
 *
 * Lock Tiers:
 * - unlocked: User can edit freely
 * - agent-soft: Agent generated, user can override
 * - agent-locked: Agent generated, user cannot edit without explicit unlock
 * - user-locked: User explicitly locked config
 *
 * @module charts/locks/schemas
 */

import { Schema } from 'effect';

// =============================================================================
// Lock Tier Schema
// =============================================================================

/**
 * Lock tier levels for chart configurations
 *
 * This implements a semaphore pattern for agentic chart generation:
 * - Agents can create charts with varying lock levels
 * - Users can override agent-soft locks freely
 * - agent-locked requires explicit unlock action
 * - user-locked prevents even agents from modifying
 */
export const LockTierSchema = Schema.Literal(
  'unlocked',      // Default state, freely editable
  'agent-soft',    // Agent generated, user can override
  'agent-locked',  // Agent generated, requires unlock
  'user-locked'    // User locked, no modifications
);

export type LockTier = typeof LockTierSchema.Type;

// =============================================================================
// Lock State Schema
// =============================================================================

/**
 * Complete lock state for a chart
 */
export const LockStateSchema = Schema.Struct({
  /** Current lock tier */
  tier: LockTierSchema,

  /** ID of the entity that set the lock (agent ID or user ID) */
  lockedBy: Schema.NullOr(Schema.String),

  /** Timestamp when lock was set (ISO 8601) */
  lockedAt: Schema.NullOr(Schema.String),

  /** Optional reason for the lock */
  reason: Schema.optional(Schema.String),

  /** Hash of locked config (for change detection) */
  configHash: Schema.optional(Schema.String),
});

export type LockState = typeof LockStateSchema.Type;

// =============================================================================
// Lock Action Schemas
// =============================================================================

/**
 * Action to change lock state
 */
export const LockActionSchema = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('Lock'),
    tier: LockTierSchema,
    lockedBy: Schema.String,
    reason: Schema.optional(Schema.String),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Unlock'),
    unlockedBy: Schema.String,
    force: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Transfer'),
    fromId: Schema.String,
    toId: Schema.String,
    tier: Schema.optional(LockTierSchema),
  })
);

export type LockAction = typeof LockActionSchema.Type;

// =============================================================================
// Default State
// =============================================================================

/**
 * Default lock state (unlocked)
 */
export const DEFAULT_LOCK_STATE: LockState = {
  tier: 'unlocked',
  lockedBy: null,
  lockedAt: null,
};

// =============================================================================
// Permissions
// =============================================================================

/**
 * Check if a lock tier allows user editing
 */
export const canUserEdit = (tier: LockTier): boolean => {
  return tier === 'unlocked' || tier === 'agent-soft';
};

/**
 * Check if a lock tier allows agent modification
 */
export const canAgentModify = (tier: LockTier): boolean => {
  return tier !== 'user-locked';
};

/**
 * Check if unlock is required before editing
 */
export const requiresUnlock = (tier: LockTier): boolean => {
  return tier === 'agent-locked' || tier === 'user-locked';
};

/**
 * Get lock tier display info
 */
export const getLockTierInfo = (tier: LockTier): {
  label: string;
  description: string;
  color: string;
  icon: string;
} => {
  switch (tier) {
    case 'unlocked':
      return {
        label: 'Unlocked',
        description: 'Chart can be freely edited',
        color: 'var(--tmnl-text-muted)',
        icon: '🔓',
      };
    case 'agent-soft':
      return {
        label: 'Agent Generated',
        description: 'AI generated, you can override',
        color: 'var(--tmnl-accent-blue)',
        icon: '🤖',
      };
    case 'agent-locked':
      return {
        label: 'Agent Locked',
        description: 'AI locked, unlock to edit',
        color: 'var(--tmnl-accent-amber)',
        icon: '🔒',
      };
    case 'user-locked':
      return {
        label: 'User Locked',
        description: 'You locked this chart',
        color: 'var(--tmnl-accent-green)',
        icon: '🔐',
      };
  }
};

/**
 * Chart Lock Atoms
 *
 * Reactive state management for chart lock system using effect-atom.
 * Uses simple writable atoms for lock state management.
 *
 * @module charts/locks/atoms
 */

import { Atom, Registry } from '@effect-atom/atom-react';
import {
  DEFAULT_LOCK_STATE,
  type LockState,
  type LockTier,
  type LockAction,
  canUserEdit,
  canAgentModify,
  requiresUnlock,
} from './schemas';

// =============================================================================
// Types
// =============================================================================

export interface ChartLockAtoms {
  lockStateAtom: Atom.Writable<LockState, LockState>;
  lockTierAtom: Atom.Atom<LockTier>;
  isLockedAtom: Atom.Atom<boolean>;
  canEditAtom: Atom.Atom<boolean>;
  canAgentAtom: Atom.Atom<boolean>;
}

// =============================================================================
// Registry
// =============================================================================

/**
 * Singleton registry for chart locks
 */
export const chartLockRegistry = Registry.make();

// =============================================================================
// Atom Factory
// =============================================================================

/**
 * Cache for lock atoms by chart ID
 */
const lockAtomCache = new Map<string, ChartLockAtoms>();

/**
 * Create lock atoms for a chart
 *
 * @param chartId - Unique chart identifier
 */
export const createChartLockAtoms = (chartId: string): ChartLockAtoms => {
  // Return cached if exists
  const cached = lockAtomCache.get(chartId);
  if (cached) return cached;

  // State atom (writable)
  const lockStateAtom = Atom.make<LockState>(DEFAULT_LOCK_STATE);

  // Derived atoms (read-only)
  const lockTierAtom = Atom.make<LockTier>((get) => get(lockStateAtom).tier);
  const isLockedAtom = Atom.make<boolean>((get) => requiresUnlock(get(lockTierAtom)));
  const canEditAtom = Atom.make<boolean>((get) => canUserEdit(get(lockTierAtom)));
  const canAgentAtom = Atom.make<boolean>((get) => canAgentModify(get(lockTierAtom)));

  const atoms: ChartLockAtoms = {
    lockStateAtom,
    lockTierAtom,
    isLockedAtom,
    canEditAtom,
    canAgentAtom,
  };

  lockAtomCache.set(chartId, atoms);
  return atoms;
};

/**
 * Get lock atoms for a chart (creates if not exists)
 */
export const getChartLockAtoms = (chartId: string): ChartLockAtoms => {
  return createChartLockAtoms(chartId);
};

/**
 * Dispose lock atoms for a chart
 */
export const disposeChartLockAtoms = (chartId: string): void => {
  lockAtomCache.delete(chartId);
};

// =============================================================================
// Lock Actions (using registry.set for synchronous mutations)
// =============================================================================

/**
 * Lock actions for a chart
 *
 * Uses registry.set() for synchronous mutations in React callbacks.
 * This follows the Fermion pattern: "registry.set() / registry.get() → synchronous"
 */
export const createLockActions = (chartId: string, registry = chartLockRegistry) => {
  const atoms = getChartLockAtoms(chartId);

  return {
    /**
     * Set lock tier directly
     */
    setLockTier: (tier: LockTier, lockedBy: string, reason?: string): void => {
      registry.set(atoms.lockStateAtom, {
        tier,
        lockedBy,
        lockedAt: new Date().toISOString(),
        reason,
      });
    },

    /**
     * Unlock the chart
     */
    unlock: (unlockedBy: string, force = false): boolean => {
      const current = registry.get(atoms.lockStateAtom);

      // Check permission
      if (current.tier === 'user-locked' && !force) {
        if (current.lockedBy !== unlockedBy) {
          return false; // Cannot unlock
        }
      }

      registry.set(atoms.lockStateAtom, DEFAULT_LOCK_STATE);
      return true;
    },

    /**
     * Process a lock action
     */
    processAction: (action: LockAction): boolean => {
      const current = registry.get(atoms.lockStateAtom);

      switch (action._tag) {
        case 'Lock':
          registry.set(atoms.lockStateAtom, {
            tier: action.tier,
            lockedBy: action.lockedBy,
            lockedAt: new Date().toISOString(),
            reason: action.reason,
          });
          return true;

        case 'Unlock':
          if (current.tier === 'user-locked' && !action.force) {
            if (current.lockedBy !== action.unlockedBy) {
              return false;
            }
          }
          registry.set(atoms.lockStateAtom, DEFAULT_LOCK_STATE);
          return true;

        case 'Transfer':
          if (current.lockedBy !== action.fromId) {
            return false;
          }
          registry.set(atoms.lockStateAtom, {
            tier: action.tier ?? current.tier,
            lockedBy: action.toId,
            lockedAt: new Date().toISOString(),
          });
          return true;

        default:
          return false;
      }
    },

    /**
     * Get current lock state
     */
    getLockState: (): LockState => {
      return registry.get(atoms.lockStateAtom);
    },

    /**
     * Check if currently editable
     */
    isEditable: (): boolean => {
      return registry.get(atoms.canEditAtom);
    },
  };
};

// =============================================================================
// React Hooks
// =============================================================================

/**
 * Hook to get lock actions for a chart
 */
export const useChartLockActions = (chartId: string) => {
  return createLockActions(chartId);
};

/**
 * Hook to get lock state atoms for a chart
 */
export const useChartLockAtoms = (chartId: string): ChartLockAtoms => {
  return getChartLockAtoms(chartId);
};

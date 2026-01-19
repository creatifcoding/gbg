/**
 * Chart Lock System
 *
 * Semaphore-style locking for agentic chart generation.
 *
 * @module charts/locks
 */

// Schemas
export {
  LockTierSchema,
  LockStateSchema,
  LockActionSchema,
  DEFAULT_LOCK_STATE,
  canUserEdit,
  canAgentModify,
  requiresUnlock,
  getLockTierInfo,
  type LockTier,
  type LockState,
  type LockAction,
} from './schemas';

// Atoms
export {
  chartLockRegistry,
  createChartLockAtoms,
  getChartLockAtoms,
  disposeChartLockAtoms,
  createLockActions,
  useChartLockActions,
  useChartLockAtoms,
  type ChartLockAtoms,
} from './atoms';

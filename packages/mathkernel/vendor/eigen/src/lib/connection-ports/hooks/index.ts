/**
 * Connection Ports Hooks
 *
 * React hooks for consuming connection ports with effect-atom Result patterns.
 *
 * @module connection-ports/hooks
 */

// Primary hook for consuming connection ports
export {
  useConnectionPort,
  type UseConnectionPortOptions,
  type UseConnectionPortReturn,
} from './useConnectionPort';

// Low-level stream subscription hook
export {
  useStreamSubscription,
  type UseStreamSubscriptionOptions,
  type UseStreamSubscriptionReturn,
} from './useStreamSubscription';

// Generic hook for consuming Stream atoms with Result pattern
export {
  useAtomStream,
  useAtomStreamSuspense,
  type UseAtomStreamReturn,
} from './useAtomStream';

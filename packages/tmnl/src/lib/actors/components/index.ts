/**
 * Actor Components - Barrel Export
 *
 * @module lib/actors/components
 */

// Primary export: Effect-based ActorProvider
export {
  ActorProvider,
  useActorContext,
  useActorReady,
  useWorkspaceService,
  type ActorProviderProps,
  type ActorContextValue,
} from './ActorProvider'

// NOTE: RivetProvider is deprecated and NOT re-exported here
// because rivetkit has Node.js-only dependencies (module.createRequire).
// If needed, import directly:
//   import { RivetProvider } from '@/lib/actors/components/RivetProvider'

// Re-export types only (no runtime import)
export type {
  RivetProviderProps,
  RivetContextValue,
} from './RivetProvider'

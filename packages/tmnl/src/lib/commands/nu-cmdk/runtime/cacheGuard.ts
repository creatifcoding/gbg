import { Atom } from "@effect-atom/atom"
import { Effect } from "effect"

export type CacheGuardMode = "sqlite-ready" | "memory-only"

export interface CacheGuard {
  readonly mode: Effect.Effect<CacheGuardMode>
  readonly reconcileRows: <A>(queryId: string, rows: ReadonlyArray<A>) => Effect.Effect<ReadonlyArray<A>>
  readonly simulateMigrationCrash: Effect.Effect<void>
}

export const makeInMemoryCacheGuard = (registry: ReturnType<typeof import("@effect-atom/atom").Registry.make>): CacheGuard => {
  const modeAtom = Atom.make<CacheGuardMode>("sqlite-ready")
  const migrationHealthyAtom = Atom.make(true)

  const unmountMode = registry.mount(modeAtom)
  const unmountMigration = registry.mount(migrationHealthyAtom)

  const cleanup = () => {
    unmountMode()
    unmountMigration()
  }

  // Caller can ignore cleanup for short-lived spike process;
  // exported for completeness if needed in future.
  void cleanup

  return {
    mode: Effect.sync(() => registry.get(modeAtom as any) as CacheGuardMode),

    reconcileRows: <A>(_queryId: string, rows: ReadonlyArray<A>) =>
      Effect.sync(() => {
        const healthy = registry.get(migrationHealthyAtom as any) as boolean
        if (!healthy) {
          // degraded mode still returns rows (memory-only fallback)
          return rows
        }
        return rows
      }),

    simulateMigrationCrash: Effect.sync(() => {
      registry.set(migrationHealthyAtom as any, false)
      registry.set(modeAtom as any, "memory-only")
    }),
  }
}

/**
 * Genifer RPC Handlers — Wire RPCs to existing repos
 *
 * Pattern: follows iiot/handlers/alarm-handlers.ts
 * Uses .toLayer({...}) with repo service dependencies.
 *
 * @module genifer/rpc/handlers
 */

import { Effect, Option } from 'effect'
import {
  GeniferTreeRpcs,
  GeniferElementRpcs,
  GeniferCompositeRpcs,
  GeniferSignalRpcs,
} from './GeniferRpcs'
import { RpcGeniferQueryError, RpcGeniferTreeNotFoundError } from './errors'
import { GeniferTreeRepo } from '../repos/GeniferTreeRepo'
import { GeniferElementRepo } from '../repos/GeniferElementRepo'
import { GeniferCompositeRepo } from '../repos/GeniferCompositeRepo'
import { GeniferSignalRepo } from '../repos/GeniferSignalRepo'

// =============================================================================
// Tree Handlers
// =============================================================================

export const GeniferTreeHandlers = GeniferTreeRpcs.toLayer({
  'GeniferTree.GetById': Effect.gen(function* () {
    const repo = yield* GeniferTreeRepo
    return ({ treeId }) =>
      Effect.gen(function* () {
        const result = yield* repo.findById(treeId as any).pipe(
          Effect.mapError((e) => new RpcGeniferQueryError({ operation: 'GetById', message: String(e) })),
        )
        return Option.isNone(result) ? null : result.value as any
      })
  }),

  'GeniferTree.FindByThread': Effect.gen(function* () {
    const repo = yield* GeniferTreeRepo
    return ({ threadId }) =>
      repo.findByThread(threadId).pipe(
        Effect.mapError((e) => new RpcGeniferQueryError({ operation: 'FindByThread', message: String(e) })),
      ) as any
  }),

  'GeniferTree.FindByQuality': Effect.gen(function* () {
    const repo = yield* GeniferTreeRepo
    return ({ minScore, limit }) =>
      repo.findByQuality(minScore, limit ?? 50).pipe(
        Effect.mapError((e) => new RpcGeniferQueryError({ operation: 'FindByQuality', message: String(e) })),
      ) as any
  }),

  'GeniferTree.Insert': Effect.gen(function* () {
    const repo = yield* GeniferTreeRepo
    return (payload) =>
      repo.insert(payload as any).pipe(
        Effect.mapError((e) => new RpcGeniferQueryError({ operation: 'Insert', message: String(e) })),
      ) as any
  }),

  'GeniferTree.UpdateRating': Effect.gen(function* () {
    const repo = yield* GeniferTreeRepo
    return ({ treeId, rating }) =>
      repo.updateRating(treeId as any, rating).pipe(
        Effect.mapError((e) => {
          if (String(e).includes('not found')) {
            return new RpcGeniferTreeNotFoundError({ treeId })
          }
          return new RpcGeniferQueryError({ operation: 'UpdateRating', message: String(e) })
        }),
      ) as any
  }),

  'GeniferTree.IncrementUsage': Effect.gen(function* () {
    const repo = yield* GeniferTreeRepo
    return ({ treeId }) =>
      repo.incrementUsage(treeId as any).pipe(
        Effect.mapError((e) => new RpcGeniferQueryError({ operation: 'IncrementUsage', message: String(e) })),
      ) as any
  }),

  'GeniferTree.Delete': Effect.gen(function* () {
    const repo = yield* GeniferTreeRepo
    return ({ treeId }) =>
      repo.delete(treeId as any).pipe(
        Effect.mapError((e) => new RpcGeniferQueryError({ operation: 'Delete', message: String(e) })),
      ) as any
  }),
})

// =============================================================================
// Element Handlers
// =============================================================================

export const GeniferElementHandlers = GeniferElementRpcs.toLayer({
  'GeniferElement.FindByTree': Effect.gen(function* () {
    const repo = yield* GeniferElementRepo
    return ({ treeId }) =>
      repo.findByTree(treeId as any).pipe(
        Effect.mapError((e) => new RpcGeniferQueryError({ operation: 'FindByTree', message: String(e) })),
      ) as any
  }),

  'GeniferElement.FindByKey': Effect.gen(function* () {
    const repo = yield* GeniferElementRepo
    return ({ treeId, elementKey }) =>
      Effect.gen(function* () {
        const result = yield* repo.findByKey(treeId as any, elementKey).pipe(
          Effect.mapError((e) => new RpcGeniferQueryError({ operation: 'FindByKey', message: String(e) })),
        )
        return Option.isNone(result) ? null : result.value as any
      })
  }),

  'GeniferElement.InsertBatch': Effect.gen(function* () {
    const repo = yield* GeniferElementRepo
    return ({ treeId, elements }) =>
      repo.insertBatch(treeId as any, elements as any).pipe(
        Effect.mapError((e) => new RpcGeniferQueryError({ operation: 'InsertBatch', message: String(e) })),
      ) as any
  }),

  'GeniferElement.DeleteByTree': Effect.gen(function* () {
    const repo = yield* GeniferElementRepo
    return ({ treeId }) =>
      repo.deleteByTree(treeId as any).pipe(
        Effect.mapError((e) => new RpcGeniferQueryError({ operation: 'DeleteByTree', message: String(e) })),
      ) as any
  }),
})

// =============================================================================
// Composite Handlers
// =============================================================================

export const GeniferCompositeHandlers = GeniferCompositeRpcs.toLayer({
  'GeniferComposite.FindByName': Effect.gen(function* () {
    const repo = yield* GeniferCompositeRepo
    return ({ name }) =>
      Effect.gen(function* () {
        const result = yield* repo.findByName(name).pipe(
          Effect.mapError((e) => new RpcGeniferQueryError({ operation: 'FindByName', message: String(e) })),
        )
        return Option.isNone(result) ? null : result.value as any
      })
  }),

  'GeniferComposite.Insert': Effect.gen(function* () {
    const repo = yield* GeniferCompositeRepo
    return (payload) =>
      repo.insert(payload as any).pipe(
        Effect.mapError((e) => new RpcGeniferQueryError({ operation: 'Insert', message: String(e) })),
      ) as any
  }),

  'GeniferComposite.List': Effect.gen(function* () {
    const repo = yield* GeniferCompositeRepo
    return ({ limit, offset }) =>
      repo.list(limit ?? 50, offset ?? 0).pipe(
        Effect.mapError((e) => new RpcGeniferQueryError({ operation: 'List', message: String(e) })),
      ) as any
  }),
})

// =============================================================================
// Signal Handlers
// =============================================================================

export const GeniferSignalHandlers = GeniferSignalRpcs.toLayer({
  'GeniferSignal.Record': Effect.gen(function* () {
    const repo = yield* GeniferSignalRepo
    return (payload) =>
      repo.record(payload as any).pipe(
        Effect.mapError((e) => new RpcGeniferQueryError({ operation: 'Record', message: String(e) })),
      ) as any
  }),

  'GeniferSignal.GetForTree': Effect.gen(function* () {
    const repo = yield* GeniferSignalRepo
    return ({ treeId }) =>
      repo.getForTree(treeId as any).pipe(
        Effect.mapError((e) => new RpcGeniferQueryError({ operation: 'GetForTree', message: String(e) })),
      ) as any
  }),
})

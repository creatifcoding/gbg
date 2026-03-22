#!/usr/bin/env bun
/// <reference types="bun-types" />
/**
 * IIoT Entity Generator
 *
 * Generates a complete IIoT entity from a name, following canonical patterns.
 * Creates schema, barrel, entity, state service, and RPC files.
 *
 * Usage:
 *   bun run tools/generate-entity.ts -- --name "Conveyor" --level 2
 *   bun run tools/generate-entity.ts -- --name "Conveyor" --level 2 --dry-run
 *   bun run tools/generate-entity.ts -- --name "Conveyor" --level 2 --prefix "CVR"
 *
 * Options:
 *   --name       Entity name in PascalCase (e.g., "Conveyor")
 *   --level      ISA-95 automation level (0-4, default: 1)
 *   --prefix     ID prefix (default: first 3 uppercase letters of name)
 *   --dry-run    Print generated code without writing files
 *   --force      Overwrite existing files
 *
 * @module tools/generate-entity
 */

import { parseArgs } from 'util'

// =============================================================================
// CLI Argument Parsing
// =============================================================================

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    name: { type: 'string' },
    level: { type: 'string', default: '1' },
    prefix: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
    force: { type: 'boolean', default: false },
  },
  strict: true,
  allowPositionals: false,
})

if (!values.name) {
  console.error('Error: --name is required')
  console.error('Usage: bun run tools/generate-entity.ts -- --name "Conveyor" --level 2')
  process.exit(1)
}

const entityName = values.name
const level = parseInt(values.level ?? '1', 10)
const dryRun = values['dry-run'] ?? false
const force = values.force ?? false

// Derived names
const pascalName = entityName.charAt(0).toUpperCase() + entityName.slice(1)
const camelName = entityName.charAt(0).toLowerCase() + entityName.slice(1)
const snakeName = entityName.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '')
const kebabName = entityName.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '')
const upperPrefix = (values.prefix ?? entityName.slice(0, 3)).toUpperCase()

const BASE_DIR = new URL('../src/lib/iiot', import.meta.url).pathname

// =============================================================================
// Template Generators
// =============================================================================

function generateSchema(): string {
  return `/**
 * ${pascalName} Entity Schema
 *
 * ISA-95 Level ${level} asset entity.
 *
 * @module @gbg/tmnl/iiot/schemas/assets/${kebabName}
 * @see ISA-95/IEC 62264 for equipment hierarchy standards
 */

import { Schema } from 'effect'
import { AssetMetadata, BaseAssetFields } from '../common'
import { HierarchyPath } from '../../hierarchy'

// =============================================================================
// ${pascalName} Identifier
// =============================================================================

/**
 * ${pascalName} identifier with embedded slug.
 * Format: '${upperPrefix}-{slug}' where slug is alphanumeric with hyphens.
 *
 * @example
 * \`\`\`ts
 * const id = make${pascalName}Id('my-${kebabName}') // '${upperPrefix}-my-${kebabName}'
 * \`\`\`
 */
export const ${pascalName}Id = Schema.String.pipe(
  Schema.pattern(/^${upperPrefix}-[a-zA-Z0-9-]+$/),
  Schema.brand('${pascalName}Id'),
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/${pascalName}Id',
    description: '${pascalName} identifier with ${upperPrefix}- prefix and slug',
  })
)
export type ${pascalName}Id = typeof ${pascalName}Id.Type

/**
 * Factory function to create a ${pascalName}Id from a slug.
 *
 * @param slug - Alphanumeric slug with hyphens
 * @returns ${pascalName}Id branded string
 */
export const make${pascalName}Id = (slug: string): ${pascalName}Id => \`${upperPrefix}-\${slug}\` as ${pascalName}Id

// =============================================================================
// ${pascalName} Status
// =============================================================================

/**
 * ${pascalName} lifecycle status.
 */
export const ${pascalName}Status = Schema.Literal(
  'planned',
  'active',
  'inactive',
  'maintenance',
  'decommissioned'
).pipe(
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/${pascalName}Status',
    description: '${pascalName} lifecycle state',
  })
)
export type ${pascalName}Status = typeof ${pascalName}Status.Type

// =============================================================================
// ${pascalName} Entity
// =============================================================================

/**
 * ${pascalName} Entity Schema - ISA-95 Level ${level}
 *
 * @example
 * \`\`\`ts
 * import { DateTime, Option } from 'effect'
 *
 * const entity = new ${pascalName}({
 *   id: make${pascalName}Id('example-01'),
 *   name: 'Example ${pascalName}',
 *   status: 'active',
 *   hierarchyPath: HierarchyPath.fromSegments([...]),
 *   createdAt: DateTime.unsafeNow(),
 * })
 *
 * entity.getAutomationLevel() // ${level}
 * entity.isOperational() // true
 * \`\`\`
 */
export class ${pascalName} extends Schema.TaggedClass<${pascalName}>()('${pascalName}', {
  /** Unique identifier (${upperPrefix}-{slug} format) */
  id: ${pascalName}Id,

  /** Spread base asset fields (name, status, description, location, metadata, timestamps, hierarchyPath, parent IDs) */
  ...BaseAssetFields,

  /** ${pascalName} lifecycle state (overrides generic AssetStatus) */
  status: ${pascalName}Status,
}) {
  /**
   * Get ISA-95 automation level.
   */
  getAutomationLevel(): ${level} {
    return ${level}
  }

  /**
   * Check if entity is operational.
   */
  isOperational(): boolean {
    return this.status === 'active'
  }

  /**
   * Check if this asset is a container.
   */
  isContainer(): boolean {
    return false
  }

  /**
   * Get the materialized hierarchy path as a string.
   */
  materializePath(): string {
    return this.hierarchyPath.toString()
  }
}

/** ${pascalName} entity type alias */
export type ${pascalName}Entity = typeof ${pascalName}.Type

// =============================================================================
// Create ${pascalName} Parameters
// =============================================================================

/**
 * Parameters for creating a new ${pascalName}.
 */
export const Create${pascalName}Params = Schema.Struct({
  /** Slug for the ID (will be prefixed with '${upperPrefix}-') */
  slug: Schema.String.pipe(
    Schema.pattern(/^[a-zA-Z0-9-]+$/),
    Schema.annotations({
      description: 'Alphanumeric slug for ${kebabName} ID',
    })
  ),

  /** Human-readable name */
  name: Schema.NonEmptyString,

  /** Initial status (defaults to 'planned' in handler) */
  status: Schema.optionalWith(${pascalName}Status, { as: 'Option' }),

  /** Optional description */
  description: Schema.optional(Schema.String),

  /** Initial metadata */
  metadata: Schema.optionalWith(AssetMetadata, { as: 'Option' }),
})
export type Create${pascalName}Params = Schema.Schema.Type<typeof Create${pascalName}Params>

// =============================================================================
// Update ${pascalName} Parameters
// =============================================================================

/**
 * Parameters for updating an existing ${pascalName}.
 */
export const Update${pascalName}Params = Schema.Struct({
  /** ID to update */
  id: ${pascalName}Id,

  /** Updated name */
  name: Schema.optionalWith(Schema.NonEmptyString, { as: 'Option' }),

  /** Updated status */
  status: Schema.optionalWith(${pascalName}Status, { as: 'Option' }),

  /** Updated description */
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Updated metadata (merged with existing) */
  metadata: Schema.optionalWith(AssetMetadata, { as: 'Option' }),
})
export type Update${pascalName}Params = Schema.Schema.Type<typeof Update${pascalName}Params>
`
}

function generateBarrel(): string {
  return `/**
 * ${pascalName} Entity Barrel Export
 * @module @gbg/tmnl/iiot/schemas/assets/${kebabName}
 */

export {
  ${pascalName}Id,
  type ${pascalName}Id as ${pascalName}IdType,
  make${pascalName}Id,
  ${pascalName}Status,
  type ${pascalName}Status as ${pascalName}StatusType,
  ${pascalName},
  Create${pascalName}Params,
  type Create${pascalName}Params as Create${pascalName}ParamsType,
  Update${pascalName}Params,
  type Update${pascalName}Params as Update${pascalName}ParamsType,
} from './schema'
`
}

function generateEntity(): string {
  return `/**
 * ${pascalName}Entity - Effect Cluster Entity for ${pascalName} Lifecycle
 *
 * Manages ISA-95 Level ${level} asset lifecycle.
 *
 * Entity Lifecycle:
 * - Create: Initialize in 'planned' state
 * - Get: Read current state
 * - Activate: planned -> active
 * - Deactivate: active -> inactive
 * - Decommission: inactive -> decommissioned (terminal)
 *
 * @module
 */

import { Schema, Effect, Option, DateTime } from 'effect'
import { Entity } from '@effect/cluster'
import { Rpc } from '@effect/rpc'
import { ${pascalName}, Create${pascalName}Params, make${pascalName}Id } from '../schemas/assets/${kebabName}'
import { ${pascalName}State, ${pascalName}StateNotFoundError } from '../state/${pascalName}State'
import { IIoTFeatureFlags } from '../infrastructure/feature-flags'
import { maybeEmitAsset } from './_helpers'

// =============================================================================
// RPC Error Schemas
// =============================================================================

export class RpcNotFoundError extends Schema.TaggedError<RpcNotFoundError>()(
  'Rpc${pascalName}NotFoundError',
  { ${camelName}Id: Schema.String }
) {}

export class RpcTransitionError extends Schema.TaggedError<RpcTransitionError>()(
  'Rpc${pascalName}TransitionError',
  { ${camelName}Id: Schema.String, message: Schema.String }
) {}

export class RpcQueryError extends Schema.TaggedError<RpcQueryError>()(
  'Rpc${pascalName}QueryError',
  { operation: Schema.String, message: Schema.String }
) {}

// =============================================================================
// RPC Tags
// =============================================================================

export const ${pascalName}EntityType = '${pascalName}' as const
export const ${pascalName}CreateTag = \`\${${pascalName}EntityType}.Create\` as const
export const ${pascalName}GetTag = \`\${${pascalName}EntityType}.Get\` as const
export const ${pascalName}ActivateTag = \`\${${pascalName}EntityType}.Activate\` as const
export const ${pascalName}DeactivateTag = \`\${${pascalName}EntityType}.Deactivate\` as const
export const ${pascalName}DecommissionTag = \`\${${pascalName}EntityType}.Decommission\` as const

// =============================================================================
// RPC Definitions
// =============================================================================

export class Create${pascalName}Rpc extends Rpc.make(${pascalName}CreateTag, {
  payload: Create${pascalName}Params,
  primaryKey: ({ slug }) => slug,
  success: ${pascalName},
  error: RpcQueryError,
}) {}

export class Get${pascalName}Rpc extends Rpc.make(${pascalName}GetTag, {
  payload: Schema.Struct({ ${camelName}Id: Schema.String }),
  primaryKey: ({ ${camelName}Id }) => ${camelName}Id,
  success: ${pascalName},
  error: RpcNotFoundError,
}) {}

export class Activate${pascalName}Rpc extends Rpc.make(${pascalName}ActivateTag, {
  payload: Schema.Struct({ ${camelName}Id: Schema.String }),
  primaryKey: ({ ${camelName}Id }) => ${camelName}Id,
  success: ${pascalName},
  error: Schema.Union(RpcNotFoundError, RpcTransitionError),
}) {}

export class Deactivate${pascalName}Rpc extends Rpc.make(${pascalName}DeactivateTag, {
  payload: Schema.Struct({ ${camelName}Id: Schema.String }),
  primaryKey: ({ ${camelName}Id }) => ${camelName}Id,
  success: ${pascalName},
  error: Schema.Union(RpcNotFoundError, RpcTransitionError),
}) {}

export class Decommission${pascalName}Rpc extends Rpc.make(${pascalName}DecommissionTag, {
  payload: Schema.Struct({ ${camelName}Id: Schema.String }),
  primaryKey: ({ ${camelName}Id }) => ${camelName}Id,
  success: ${pascalName},
  error: Schema.Union(RpcNotFoundError, RpcTransitionError),
}) {}

// =============================================================================
// Entity Definition
// =============================================================================

export const ${pascalName}Entity = Entity.make(${pascalName}EntityType, [
  Create${pascalName}Rpc,
  Get${pascalName}Rpc,
  Activate${pascalName}Rpc,
  Deactivate${pascalName}Rpc,
  Decommission${pascalName}Rpc,
])

export type ${pascalName}Entity = typeof ${pascalName}Entity

// =============================================================================
// Handler Implementation
// =============================================================================

export const ${pascalName}EntityHandlers = ${pascalName}Entity.toLayer(
  Effect.gen(function* () {
    const state = yield* ${pascalName}State
    const flags = yield* IIoTFeatureFlags

    const handleCreate = (envelope: { payload: typeof Create${pascalName}Params.Type }) =>
      Effect.gen(function* () {
        const site = yield* state.create(envelope.payload)
        yield* maybeEmitAsset(flags, '${pascalName}', '${pascalName}Created', site)
        return site
      }).pipe(
        Effect.catchAll((e) =>
          Effect.fail(new RpcQueryError({ operation: 'create', message: String(e) }))
        )
      )

    const handleGet = (envelope: { payload: { ${camelName}Id: string } }) =>
      state.get(envelope.payload.${camelName}Id as any).pipe(
        Effect.catchTag('${pascalName}StateNotFoundError', () =>
          Effect.fail(new RpcNotFoundError({ ${camelName}Id: envelope.payload.${camelName}Id }))
        )
      )

    const handleActivate = (envelope: { payload: { ${camelName}Id: string } }) =>
      Effect.gen(function* () {
        const entity = yield* state.get(envelope.payload.${camelName}Id as any)
        if (entity.status !== 'planned' && entity.status !== 'inactive') {
          return yield* Effect.fail(
            new RpcTransitionError({
              ${camelName}Id: envelope.payload.${camelName}Id,
              message: \`Cannot activate from '\${entity.status}'\`,
            })
          )
        }
        const updated = new ${pascalName}({ ...entity, status: 'active' as const })
        yield* state.set(updated)
        yield* maybeEmitAsset(flags, '${pascalName}', '${pascalName}Activated', updated)
        return updated
      }).pipe(
        Effect.catchTag('${pascalName}StateNotFoundError', () =>
          Effect.fail(new RpcNotFoundError({ ${camelName}Id: envelope.payload.${camelName}Id }))
        )
      )

    const handleDeactivate = (envelope: { payload: { ${camelName}Id: string } }) =>
      Effect.gen(function* () {
        const entity = yield* state.get(envelope.payload.${camelName}Id as any)
        if (entity.status !== 'active') {
          return yield* Effect.fail(
            new RpcTransitionError({
              ${camelName}Id: envelope.payload.${camelName}Id,
              message: \`Cannot deactivate from '\${entity.status}'\`,
            })
          )
        }
        const updated = new ${pascalName}({ ...entity, status: 'inactive' as const })
        yield* state.set(updated)
        yield* maybeEmitAsset(flags, '${pascalName}', '${pascalName}Deactivated', updated)
        return updated
      }).pipe(
        Effect.catchTag('${pascalName}StateNotFoundError', () =>
          Effect.fail(new RpcNotFoundError({ ${camelName}Id: envelope.payload.${camelName}Id }))
        )
      )

    const handleDecommission = (envelope: { payload: { ${camelName}Id: string } }) =>
      Effect.gen(function* () {
        const entity = yield* state.get(envelope.payload.${camelName}Id as any)
        if (entity.status !== 'inactive') {
          return yield* Effect.fail(
            new RpcTransitionError({
              ${camelName}Id: envelope.payload.${camelName}Id,
              message: \`Cannot decommission from '\${entity.status}'\`,
            })
          )
        }
        const updated = new ${pascalName}({ ...entity, status: 'decommissioned' as const })
        yield* state.set(updated)
        yield* maybeEmitAsset(flags, '${pascalName}', '${pascalName}Decommissioned', updated)
        return updated
      }).pipe(
        Effect.catchTag('${pascalName}StateNotFoundError', () =>
          Effect.fail(new RpcNotFoundError({ ${camelName}Id: envelope.payload.${camelName}Id }))
        )
      )

    return ${pascalName}Entity.of({
      [${pascalName}CreateTag]: handleCreate,
      [${pascalName}GetTag]: handleGet,
      [${pascalName}ActivateTag]: handleActivate,
      [${pascalName}DeactivateTag]: handleDeactivate,
      [${pascalName}DecommissionTag]: handleDecommission,
    })
  })
)
`
}

function generateState(): string {
  return `/**
 * ${pascalName}State Service
 *
 * Effect.Service for ${camelName} state management with swappable implementations.
 * Provides in-memory (testing) and SQL (production) layers.
 *
 * @module
 */

import { Effect, Context, Layer, Option, Ref, DateTime } from 'effect'
import { ${pascalName}, Create${pascalName}Params, make${pascalName}Id } from '../schemas/assets/${kebabName}'
import { HierarchyPath, PathSegment } from '../schemas/hierarchy'
import type { PaginationOptions } from './StateShape'

// =============================================================================
// ID Generation
// =============================================================================

let ${camelName}Counter = 0

const generate${pascalName}Id = () => make${pascalName}Id(\`gen-\${Date.now()}-\${++${camelName}Counter}\`)

// =============================================================================
// Filter Types
// =============================================================================

export interface ${pascalName}Filter extends PaginationOptions {
  readonly status?: string
}

// =============================================================================
// Error Types
// =============================================================================

export class ${pascalName}StateNotFoundError {
  readonly _tag = '${pascalName}StateNotFoundError'
  constructor(readonly ${camelName}Id: string) {}
}

// =============================================================================
// Service Shape
// =============================================================================

export interface ${pascalName}StateShape {
  readonly create: (params: typeof Create${pascalName}Params.Type) => Effect.Effect<InstanceType<typeof ${pascalName}>>
  readonly get: (id: string) => Effect.Effect<InstanceType<typeof ${pascalName}>, ${pascalName}StateNotFoundError>
  readonly set: (entity: InstanceType<typeof ${pascalName}>) => Effect.Effect<void>
  readonly list: (filter: ${pascalName}Filter) => Effect.Effect<readonly InstanceType<typeof ${pascalName}>[]>
  readonly delete: (id: string) => Effect.Effect<boolean>
  readonly exists: (id: string) => Effect.Effect<boolean>
  readonly count: (filter: ${pascalName}Filter) => Effect.Effect<number>
}

// =============================================================================
// Service Definition
// =============================================================================

export class ${pascalName}State extends Context.Tag('iiot/${pascalName}State')<
  ${pascalName}State,
  ${pascalName}StateShape
>() {}

// =============================================================================
// In-Memory Implementation
// =============================================================================

export const ${pascalName}StateInMemory: Layer.Layer<${pascalName}State> = Layer.effect(
  ${pascalName}State,
  Ref.make(new Map<string, InstanceType<typeof ${pascalName}>>()).pipe(
    Effect.map((store) => {
      const matchesFilter = (entity: InstanceType<typeof ${pascalName}>, filter: ${pascalName}Filter): boolean => {
        if (filter.status && entity.status !== filter.status) return false
        return true
      }

      return {
        create: (params: typeof Create${pascalName}Params.Type) =>
          Effect.gen(function* () {
            const id = generate${pascalName}Id()
            const now = yield* DateTime.now

            const segment = new PathSegment({
              level: '${snakeName}' as any,
              id: id,
              name: Option.some(params.name),
            })
            const hierarchyPath = HierarchyPath.fromSegments([segment])

            const entity = new ${pascalName}({
              id: id as any,
              name: params.name,
              status: Option.getOrElse(params.status, () => 'planned' as const),
              description: params.description !== undefined ? Option.some(params.description) : Option.none(),
              location: Option.none(),
              metadata: Option.getOrElse(params.metadata, () => ({})),
              hierarchyPath,
              createdAt: now,
              updatedAt: Option.none(),
              enterpriseId: Option.none(),
              siteId: Option.none(),
              areaId: Option.none(),
              plantId: Option.none(),
              lineId: Option.none(),
              workCellId: Option.none(),
              machineId: Option.none(),
            })

            yield* Ref.update(store, (map) => {
              const newMap = new Map(map)
              newMap.set(id, entity)
              return newMap
            })

            return entity
          }),

        get: (id: string) =>
          Ref.get(store).pipe(
            Effect.flatMap((map) => {
              const entity = map.get(id)
              if (!entity) return Effect.fail(new ${pascalName}StateNotFoundError(id))
              return Effect.succeed(entity)
            })
          ),

        set: (entity: InstanceType<typeof ${pascalName}>) =>
          Ref.update(store, (map) => {
            const newMap = new Map(map)
            newMap.set(entity.id, entity)
            return newMap
          }),

        list: (filter: ${pascalName}Filter) =>
          Ref.get(store).pipe(
            Effect.map((map) => {
              let items = Array.from(map.values()).filter((e) => matchesFilter(e, filter))
              items.sort((a, b) => Number(b.createdAt.epochMillis) - Number(a.createdAt.epochMillis))
              if (filter.offset) items = items.slice(filter.offset)
              if (filter.limit) items = items.slice(0, filter.limit)
              return items
            })
          ),

        delete: (id: string) =>
          Ref.modify(store, (map) => {
            const existed = map.has(id)
            if (existed) {
              const newMap = new Map(map)
              newMap.delete(id)
              return [true, newMap] as const
            }
            return [false, map] as const
          }),

        exists: (id: string) =>
          Ref.get(store).pipe(Effect.map((map) => map.has(id))),

        count: (filter: ${pascalName}Filter) =>
          Ref.get(store).pipe(
            Effect.map((map) =>
              Array.from(map.values()).filter((e) => matchesFilter(e, filter)).length
            )
          ),
      }
    })
  )
)

// =============================================================================
// SQL Implementation Factory
// =============================================================================

export const make${pascalName}StateSql = (repo: {
  findById: (id: string) => Effect.Effect<Option.Option<InstanceType<typeof ${pascalName}>>, unknown>
  findAll: (filter: ${pascalName}Filter) => Effect.Effect<readonly InstanceType<typeof ${pascalName}>[], unknown>
  insert: (entity: InstanceType<typeof ${pascalName}>) => Effect.Effect<InstanceType<typeof ${pascalName}>, unknown>
  update: (entity: Partial<InstanceType<typeof ${pascalName}>> & { id: string }) => Effect.Effect<InstanceType<typeof ${pascalName}>, unknown>
  delete: (id: string) => Effect.Effect<boolean, unknown>
}): ${pascalName}StateShape => ({
  create: (params) =>
    Effect.gen(function* () {
      const id = generate${pascalName}Id()
      const now = yield* DateTime.now
      const segment = new PathSegment({ level: '${snakeName}' as any, id, name: Option.some(params.name) })
      const hierarchyPath = HierarchyPath.fromSegments([segment])
      const entity = new ${pascalName}({
        id: id as any,
        name: params.name,
        status: Option.getOrElse(params.status, () => 'planned' as const),
        description: params.description !== undefined ? Option.some(params.description) : Option.none(),
        location: Option.none(),
        metadata: Option.getOrElse(params.metadata, () => ({})),
        hierarchyPath,
        createdAt: now,
        updatedAt: Option.none(),
        enterpriseId: Option.none(),
        siteId: Option.none(),
        areaId: Option.none(),
        plantId: Option.none(),
        lineId: Option.none(),
        workCellId: Option.none(),
        machineId: Option.none(),
      })
      return yield* repo.insert(entity).pipe(Effect.orDie)
    }),

  get: (id) =>
    repo.findById(id).pipe(
      Effect.flatMap((opt) =>
        Option.isSome(opt)
          ? Effect.succeed(opt.value)
          : Effect.fail(new ${pascalName}StateNotFoundError(id))
      ),
      Effect.catchAll(() => Effect.fail(new ${pascalName}StateNotFoundError(id)))
    ),

  set: (entity) =>
    repo.findById(entity.id).pipe(
      Effect.flatMap((existing) =>
        Option.isSome(existing)
          ? repo.update(entity as any)
          : repo.insert(entity)
      ),
      Effect.asVoid,
      Effect.catchAll(() => Effect.void)
    ),

  list: (filter) =>
    repo.findAll(filter).pipe(Effect.catchAll(() => Effect.succeed([]))),

  delete: (id) =>
    repo.delete(id).pipe(Effect.catchAll(() => Effect.succeed(false))),

  exists: (id) =>
    repo.findById(id).pipe(
      Effect.map(Option.isSome),
      Effect.catchAll(() => Effect.succeed(false))
    ),

  count: (filter) =>
    repo.findAll({ ...filter, limit: undefined, offset: undefined }).pipe(
      Effect.map((items) => items.length),
      Effect.catchAll(() => Effect.succeed(0))
    ),
})
`
}

function generateRpcs(): string {
  return `/**
 * ${pascalName}Rpcs - Entity-Derived RPC Group for ${pascalName} Operations
 *
 * Uses EntityProxy.toRpcGroup() to create standard and "discard" RPCs
 * for each ${pascalName} entity operation.
 *
 * @module
 */

import { RpcGroup } from '@effect/rpc'
import { EntityProxy } from '@effect/cluster'
import { ${pascalName}Entity } from '../entity/${pascalName}Entity'

// =============================================================================
// Entity-Derived RPCs
// =============================================================================

export class ${pascalName}EntityRpcs extends EntityProxy.toRpcGroup(${pascalName}Entity) {}

// =============================================================================
// Combined RpcGroup Export
// =============================================================================

export const ${pascalName}Rpcs = RpcGroup.make(
  ...Array.from(${pascalName}EntityRpcs.requests.values())
)

export type ${pascalName}Rpcs = typeof ${pascalName}Rpcs
`
}

// =============================================================================
// File Output
// =============================================================================

interface GeneratedFile {
  path: string
  content: string
  label: string
}

const files: GeneratedFile[] = [
  {
    path: `${BASE_DIR}/schemas/assets/${kebabName}/schema.ts`,
    content: generateSchema(),
    label: `Schema: schemas/assets/${kebabName}/schema.ts`,
  },
  {
    path: `${BASE_DIR}/schemas/assets/${kebabName}/index.ts`,
    content: generateBarrel(),
    label: `Barrel: schemas/assets/${kebabName}/index.ts`,
  },
  {
    path: `${BASE_DIR}/entity/${pascalName}Entity.ts`,
    content: generateEntity(),
    label: `Entity: entity/${pascalName}Entity.ts`,
  },
  {
    path: `${BASE_DIR}/state/${pascalName}State.ts`,
    content: generateState(),
    label: `State: state/${pascalName}State.ts`,
  },
  {
    path: `${BASE_DIR}/rpc/${pascalName}Rpcs.ts`,
    content: generateRpcs(),
    label: `RPCs: rpc/${pascalName}Rpcs.ts`,
  },
]

console.log(`\n  IIoT Entity Generator`)
console.log(`  =====================`)
console.log(`  Entity:  ${pascalName}`)
console.log(`  Level:   ISA-95 L${level}`)
console.log(`  Prefix:  ${upperPrefix}`)
console.log(`  Mode:    ${dryRun ? 'DRY RUN' : 'WRITE'}`)
console.log()

for (const file of files) {
  if (dryRun) {
    console.log(`--- ${file.label} ---`)
    console.log(file.content)
    console.log()
  } else {
    const exists = await Bun.file(file.path).exists()
    if (exists && !force) {
      console.log(`  SKIP  ${file.label} (already exists, use --force to overwrite)`)
      continue
    }

    // Ensure directory exists
    const dir = file.path.substring(0, file.path.lastIndexOf('/'))
    await Bun.spawn(['mkdir', '-p', dir]).exited

    await Bun.write(file.path, file.content)
    console.log(`  WRITE ${file.label}`)
  }
}

if (!dryRun) {
  console.log()
  console.log(`  Next steps:`)
  console.log(`  1. Add exports to state/index.ts`)
  console.log(`  2. Add exports to rpc/index.ts`)
  console.log(`  3. Add to EntityStack if needed`)
  console.log(`  4. Run: bunx tsc --noEmit`)
}

console.log()

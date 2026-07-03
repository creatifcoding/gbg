import { Context, Effect, Layer, Schema } from 'effect'
import type { PanelContentEntry } from '../panel-registry'
import { panelRegistry } from '../panel-registry'
import { StateTier } from '../types/strip'

// =============================================================================
// Schema-backed metadata
// =============================================================================

export const PanelVisitorDefaults = Schema.Struct({
  width: Schema.optional(Schema.Number),
  height: Schema.optional(Schema.Number),
  mode: Schema.optional(Schema.Literal('tiled', 'floating')),
  accent: Schema.optional(Schema.String),
})
export type PanelVisitorDefaults = typeof PanelVisitorDefaults.Type

export const PanelVisitorMetadata = Schema.Struct({
  id: Schema.String.pipe(Schema.minLength(1)),
  label: Schema.String.pipe(Schema.minLength(1)),
  icon: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  category: Schema.optional(Schema.String),
  stateTier: Schema.optional(StateTier),
  defaults: Schema.optional(PanelVisitorDefaults),
})
export type PanelVisitorMetadata = typeof PanelVisitorMetadata.Type

export interface PanelVisitorDefinition extends PanelVisitorMetadata {
  readonly component: PanelContentEntry['component']
}

export function definePanelVisitor(definition: PanelVisitorDefinition): PanelVisitorDefinition {
  const metadata = Schema.decodeUnknownSync(PanelVisitorMetadata)(definition)
  return {
    ...metadata,
    component: definition.component,
  }
}

// =============================================================================
// Effect-native catalog service
// =============================================================================

export interface PanelVisitorCatalogShape {
  readonly entries: ReadonlyArray<PanelVisitorDefinition>
}

export class PanelVisitorCatalog extends Context.Tag('tmnl/floating/PanelVisitorCatalog')<
  PanelVisitorCatalog,
  PanelVisitorCatalogShape
>() {}

export const installPanelVisitorCatalog = Effect.gen(function* () {
  const catalog = yield* PanelVisitorCatalog

  for (const { id, component, ...entry } of catalog.entries) {
    panelRegistry.register(id, {
      ...entry,
      component,
    })
  }
})

export const makePanelVisitorCatalogLayer = (entries: ReadonlyArray<PanelVisitorDefinition>) =>
  Layer.succeed(PanelVisitorCatalog, { entries })

export function installPanelVisitorsFromLayer(layer: Layer.Layer<PanelVisitorCatalog>): void {
  Effect.runSync(installPanelVisitorCatalog.pipe(Effect.provide(layer)))
}

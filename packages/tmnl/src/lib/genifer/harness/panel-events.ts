import { Schema } from 'effect'

export const PanelMode = Schema.Literal('floating', 'tiled')
export type PanelMode = typeof PanelMode.Type

export const PanelSpawnedEvent = Schema.TaggedStruct('panel:spawned', {
  surfaceId: Schema.String,
  panelId: Schema.String,
  title: Schema.optional(Schema.String),
  prompt: Schema.optional(Schema.String),
  threadId: Schema.optional(Schema.String),
  width: Schema.optional(Schema.Number),
  height: Schema.optional(Schema.Number),
  mode: Schema.optional(PanelMode),
  surface: Schema.optional(Schema.Unknown),
})
export type PanelSpawnedEvent = typeof PanelSpawnedEvent.Type

export const PanelClosedEvent = Schema.TaggedStruct('panel:closed', {
  panelId: Schema.String,
})
export type PanelClosedEvent = typeof PanelClosedEvent.Type

export const PanelSurfaceUpdatedEvent = Schema.TaggedStruct('panel:surface_updated', {
  surfaceId: Schema.String,
  surface: Schema.Unknown,
})
export type PanelSurfaceUpdatedEvent = typeof PanelSurfaceUpdatedEvent.Type

export const PanelEvent = Schema.Union(PanelSpawnedEvent, PanelClosedEvent, PanelSurfaceUpdatedEvent)
export type PanelEvent = typeof PanelEvent.Type

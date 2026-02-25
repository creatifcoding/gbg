import { Schema } from 'effect'

export const PanelMode = Schema.Literal('floating', 'tiled')
export type PanelMode = typeof PanelMode.Type

export const PanelSpawnedPayload = Schema.Struct({
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
export type PanelSpawnedPayload = typeof PanelSpawnedPayload.Type

const PanelSpawnedEventBase = Schema.TaggedStruct('panel:spawned', {
  surfaceId: Schema.String,
  panelId: Schema.String,
  title: Schema.optional(Schema.String),
  prompt: Schema.optional(Schema.String),
  threadId: Schema.optional(Schema.String),
  width: Schema.optional(Schema.Number),
  height: Schema.optional(Schema.Number),
  mode: Schema.optional(PanelMode),
  surface: Schema.optional(Schema.Unknown),
  // Optional compatibility mirror for older payload-style consumers.
  payload: Schema.optional(PanelSpawnedPayload),
})

export const PanelSpawnedEvent = PanelSpawnedEventBase.pipe(
  Schema.filter(
    (event) =>
      event.payload == null
      || (event.payload.surfaceId === event.surfaceId && event.payload.panelId === event.panelId),
    {
      message: () => 'panel:spawned payload identifiers must match top-level surfaceId and panelId',
    },
  ),
)
export type PanelSpawnedEvent = typeof PanelSpawnedEvent.Type

export const PanelClosedPayload = Schema.Struct({
  panelId: Schema.String,
})
export type PanelClosedPayload = typeof PanelClosedPayload.Type

const PanelClosedEventBase = Schema.TaggedStruct('panel:closed', {
  panelId: Schema.String,
  // Optional compatibility mirror for older payload-style consumers.
  payload: Schema.optional(PanelClosedPayload),
})

export const PanelClosedEvent = PanelClosedEventBase.pipe(
  Schema.filter(
    (event) => event.payload == null || event.payload.panelId === event.panelId,
    {
      message: () => 'panel:closed payload.panelId must match top-level panelId',
    },
  ),
)
export type PanelClosedEvent = typeof PanelClosedEvent.Type

export const PanelSurfaceUpdatedPayload = Schema.Struct({
  surfaceId: Schema.String,
  surface: Schema.Unknown,
})
export type PanelSurfaceUpdatedPayload = typeof PanelSurfaceUpdatedPayload.Type

const PanelSurfaceUpdatedEventBase = Schema.TaggedStruct('panel:surface_updated', {
  surfaceId: Schema.String,
  surface: Schema.Unknown,
  // Optional compatibility mirror for older payload-style consumers.
  payload: Schema.optional(PanelSurfaceUpdatedPayload),
})

export const PanelSurfaceUpdatedEvent = PanelSurfaceUpdatedEventBase.pipe(
  Schema.filter(
    (event) => event.payload == null || event.payload.surfaceId === event.surfaceId,
    {
      message: () => 'panel:surface_updated payload.surfaceId must match top-level surfaceId',
    },
  ),
)
export type PanelSurfaceUpdatedEvent = typeof PanelSurfaceUpdatedEvent.Type

export const PanelEvent = Schema.Union(PanelSpawnedEvent, PanelClosedEvent, PanelSurfaceUpdatedEvent)
export type PanelEvent = typeof PanelEvent.Type

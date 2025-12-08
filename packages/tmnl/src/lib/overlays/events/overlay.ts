/**
 * Overlay Lifecycle Events
 *
 * EventGroup for overlay registration and state transitions.
 */

import { EventGroup } from "@effect/experimental"
import { Schema } from "effect"
import { ContainerId, OverlayId } from "../schemas"

// ─────────────────────────────────────────────────────────────
// Overlay Events
// ─────────────────────────────────────────────────────────────

export const OverlayEvents = EventGroup.empty
  .add({
    tag: "OverlayRegistered",
    primaryKey: (p) => `${p.containerId}:${p.overlayId}`,
    payload: Schema.Struct({
      containerId: ContainerId,
      overlayId: OverlayId,
      name: Schema.String,
      visualPriority: Schema.Number,
    }),
  })
  .add({
    tag: "OverlayUnregistered",
    primaryKey: (p) => `${p.containerId}:${p.overlayId}`,
    payload: Schema.Struct({
      containerId: ContainerId,
      overlayId: OverlayId,
    }),
  })
  .add({
    tag: "OverlayEnabled",
    primaryKey: (p) => `${p.containerId}:${p.overlayId}`,
    payload: Schema.Struct({
      containerId: ContainerId,
      overlayId: OverlayId,
      activatedAt: Schema.Number,
    }),
  })
  .add({
    tag: "OverlayDisabled",
    primaryKey: (p) => `${p.containerId}:${p.overlayId}`,
    payload: Schema.Struct({
      containerId: ContainerId,
      overlayId: OverlayId,
    }),
  })
  .add({
    tag: "OverlaySuspended",
    primaryKey: (p) => `${p.containerId}:${p.overlayId}`,
    payload: Schema.Struct({
      containerId: ContainerId,
      overlayId: OverlayId,
    }),
  })
  .add({
    tag: "OverlayResumed",
    primaryKey: (p) => `${p.containerId}:${p.overlayId}`,
    payload: Schema.Struct({
      containerId: ContainerId,
      overlayId: OverlayId,
    }),
  })

// ─────────────────────────────────────────────────────────────
// Event Types (for external consumers)
// ─────────────────────────────────────────────────────────────

export type OverlayRegisteredPayload = {
  readonly containerId: ContainerId
  readonly overlayId: OverlayId
  readonly name: string
  readonly visualPriority: number
}

export type OverlayUnregisteredPayload = {
  readonly containerId: ContainerId
  readonly overlayId: OverlayId
}

export type OverlayEnabledPayload = {
  readonly containerId: ContainerId
  readonly overlayId: OverlayId
  readonly activatedAt: number
}

export type OverlayDisabledPayload = {
  readonly containerId: ContainerId
  readonly overlayId: OverlayId
}

export type OverlaySuspendedPayload = {
  readonly containerId: ContainerId
  readonly overlayId: OverlayId
}

export type OverlayResumedPayload = {
  readonly containerId: ContainerId
  readonly overlayId: OverlayId
}

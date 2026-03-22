/**
 * Port Events
 *
 * EventGroup for port pub/sub operations.
 */

import { EventGroup } from "@effect/experimental"
import { Schema } from "effect"
import { ContainerId, PortId } from "../schemas"

// ─────────────────────────────────────────────────────────────
// Port Events
// ─────────────────────────────────────────────────────────────

export const PortEvents = EventGroup.empty
  .add({
    tag: "PortPublished",
    primaryKey: (p) => `${p.containerId}:${p.portId}`,
    payload: Schema.Struct({
      containerId: ContainerId,
      portId: PortId,
      payload: Schema.Unknown,
      timestamp: Schema.Number,
    }),
  })
  .add({
    tag: "PortDestroyed",
    primaryKey: (p) => `${p.containerId}:${p.portId}`,
    payload: Schema.Struct({
      containerId: ContainerId,
      portId: PortId,
    }),
  })
  .add({
    tag: "ContainerPortsDestroyed",
    primaryKey: (p) => p.containerId,
    payload: Schema.Struct({
      containerId: ContainerId,
    }),
  })

// ─────────────────────────────────────────────────────────────
// Event Types (for external consumers)
// ─────────────────────────────────────────────────────────────

export type PortPublishedPayload = {
  readonly containerId: ContainerId
  readonly portId: PortId
  readonly payload: unknown
  readonly timestamp: number
}

export type PortDestroyedPayload = {
  readonly containerId: ContainerId
  readonly portId: PortId
}

export type ContainerPortsDestroyedPayload = {
  readonly containerId: ContainerId
}

/**
 * Container Events
 *
 * EventGroup for container lifecycle operations.
 */

import { EventGroup } from "@effect/experimental"
import { Schema } from "effect"
import { ContainerId } from "../schemas"

// ─────────────────────────────────────────────────────────────
// Container Events
// ─────────────────────────────────────────────────────────────

export const ContainerEvents = EventGroup.empty
  .add({
    tag: "ContainerCreated",
    primaryKey: (p) => p.containerId,
    payload: Schema.Struct({
      containerId: ContainerId,
      timestamp: Schema.Number,
    }),
  })
  .add({
    tag: "ContainerDestroyed",
    primaryKey: (p) => p.containerId,
    payload: Schema.Struct({
      containerId: ContainerId,
    }),
  })

// ─────────────────────────────────────────────────────────────
// Event Types (for external consumers)
// ─────────────────────────────────────────────────────────────

export type ContainerCreatedPayload = {
  readonly containerId: ContainerId
  readonly timestamp: number
}

export type ContainerDestroyedPayload = {
  readonly containerId: ContainerId
}

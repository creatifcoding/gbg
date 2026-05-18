/**
 * Structural Event Handlers — durable structural facts.
 *
 * These handlers are intentionally projection-light for now. The important
 * contract is that selected structural EventGroup facts have registered
 * EventLog handlers, so strict durable writes are schema-backed and replayable.
 */

import { Effect } from 'effect'
import * as EventLog from '@effect/experimental/EventLog'
import { StructuralEvents } from '../schemas/events/groups'

export const StructuralEventHandlers = EventLog.group(StructuralEvents, (handlers) =>
  handlers
    .handle('MachineCreated', ({ payload }) =>
      Effect.log(`[StructuralEventHandler] Machine created: ${payload.machineId} (${payload.name})`).pipe(
        Effect.asVoid,
      )
    )
)

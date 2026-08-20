import { decodeAnalog, isValidAnalogTransition, type Analog, type AnalogStatus } from '../schemas/analog'
import type { AnalogEvent } from '../schemas/events/analog-events'
import type { AnalogId } from '../schemas/identifiers'

export class AnalogTransitionError extends Error {
  readonly _tag = 'AnalogTransitionError'
  constructor(
    readonly analogId: AnalogId,
    readonly from: AnalogStatus,
    readonly to: AnalogStatus,
  ) {
    super(`Cannot move analog ${analogId} from ${from} to ${to}`)
    this.name = 'AnalogTransitionError'
  }
}

export type CreateAnalogInput = {
  id: AnalogId
  claim: string
  body?: string
  example?: boolean
}

function eventId(now: number, suffix: string): AnalogEvent['id'] {
  return `evt_${now}_${suffix}` as AnalogEvent['id']
}

export function createAnalog(
  input: CreateAnalogInput,
  now = Date.now(),
): { analog: Analog; event: AnalogEvent } {
  const analog = decodeAnalog({
    _tag: 'Analog',
    id: input.id,
    status: 'raw',
    claim: input.claim,
    body: input.body ?? '',
    example: input.example ?? false,
    createdAt: now,
    updatedAt: now,
  })

  const event: AnalogEvent = {
    id: eventId(now, `${analog.id}_created`),
    type: 'AnalogCreated',
    entityId: analog.id,
    occurredAt: now,
    payload: { claim: analog.claim },
  }

  return { analog, event }
}

export function transitionAnalog(
  analog: Analog,
  to: AnalogStatus,
  now = Date.now(),
): { analog: Analog; event: AnalogEvent } {
  if (!isValidAnalogTransition(analog.status, to)) {
    throw new AnalogTransitionError(analog.id, analog.status, to)
  }

  const next = decodeAnalog({
    ...analog,
    status: to,
    updatedAt: now,
  })

  const event: AnalogEvent = {
    id: eventId(now, `${analog.id}_${analog.status}_${to}`),
    type: 'AnalogTransitioned',
    entityId: analog.id,
    occurredAt: now,
    payload: { from: analog.status, to },
  }

  return { analog: next, event }
}

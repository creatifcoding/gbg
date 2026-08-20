import { Schema } from 'effect'
import { AnalogId } from './identifiers'

export const AnalogStatus = Schema.Literals([
  'raw',
  'working',
  'tested',
  'dead',
] as const)
export type AnalogStatus = typeof AnalogStatus.Type

export const ANALOG_STATUSES = [
  'raw',
  'working',
  'tested',
  'dead',
] as const satisfies ReadonlyArray<AnalogStatus>

const analogTransitions: Record<AnalogStatus, readonly AnalogStatus[]> = {
  raw: ['working', 'dead'],
  working: ['tested', 'dead'],
  tested: ['dead'],
  dead: [],
}

export function isValidAnalogTransition(
  from: AnalogStatus,
  to: AnalogStatus,
): boolean {
  return analogTransitions[from].includes(to)
}

export function getValidNextAnalogStates(
  current: AnalogStatus,
): readonly AnalogStatus[] {
  return analogTransitions[current]
}

export const Analog = Schema.Struct({
  _tag: Schema.Literal('Analog'),
  id: AnalogId,
  status: AnalogStatus,
  claim: Schema.NonEmptyString,
  body: Schema.String,
  example: Schema.Boolean,
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
})
export type Analog = typeof Analog.Type

export const decodeAnalog = Schema.decodeUnknownSync(Analog)

export function isAnalogStatus(value: string): value is AnalogStatus {
  return (ANALOG_STATUSES as readonly string[]).includes(value)
}

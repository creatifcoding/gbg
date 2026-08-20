import * as Schema from 'effect/Schema'

export const SpecimenId = Schema.String.pipe(Schema.brand('SpecimenId'))
export type SpecimenId = typeof SpecimenId.Type

export const ObservationId = Schema.String.pipe(Schema.brand('ObservationId'))
export type ObservationId = typeof ObservationId.Type

export const AnalogId = Schema.String.pipe(Schema.brand('AnalogId'))
export type AnalogId = typeof AnalogId.Type

export const OrganismId = Schema.String.pipe(Schema.brand('OrganismId'))
export type OrganismId = typeof OrganismId.Type

export const StructureId = Schema.String.pipe(Schema.brand('StructureId'))
export type StructureId = typeof StructureId.Type

export const MechanismId = Schema.String.pipe(Schema.brand('MechanismId'))
export type MechanismId = typeof MechanismId.Type

export const FunctionId = Schema.String.pipe(Schema.brand('FunctionId'))
export type FunctionId = typeof FunctionId.Type

export const AttachmentId = Schema.String.pipe(Schema.brand('AttachmentId'))
export type AttachmentId = typeof AttachmentId.Type

export const TagId = Schema.String.pipe(Schema.brand('TagId'))
export type TagId = typeof TagId.Type

export const QuestionId = Schema.String.pipe(Schema.brand('QuestionId'))
export type QuestionId = typeof QuestionId.Type

export const EdgeId = Schema.String.pipe(Schema.brand('EdgeId'))
export type EdgeId = typeof EdgeId.Type

export const EventId = Schema.String.pipe(Schema.brand('EventId'))
export type EventId = typeof EventId.Type

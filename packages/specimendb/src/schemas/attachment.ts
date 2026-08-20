import * as Schema from 'effect/Schema'
import { AttachmentId, ObservationId, SpecimenId } from './identifiers'

export const AttachmentKind = Schema.Literals(['image', 'file'] as const)
export type AttachmentKind = typeof AttachmentKind.Type

export const AttachmentHost = Schema.Union([
  Schema.TaggedStruct('specimen', {}),
  Schema.TaggedStruct('observation', { id: ObservationId }),
])
export type AttachmentHost = typeof AttachmentHost.Type

export const Attachment = Schema.Struct({
  id: AttachmentId,
  specimenId: SpecimenId,
  host: AttachmentHost,
  filename: Schema.NonEmptyString,
  mimeType: Schema.NonEmptyString,
  sizeBytes: Schema.Number,
  kind: AttachmentKind,
})
export type Attachment = typeof Attachment.Type

export const decodeAttachment = Schema.decodeUnknownSync(Attachment)

export function attachmentKindFromMime(mimeType: string): AttachmentKind {
  return mimeType.startsWith('image/') ? 'image' : 'file'
}

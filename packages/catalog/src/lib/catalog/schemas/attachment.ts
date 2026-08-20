import { Schema } from 'effect'
import { AttachmentId, CardId } from './identifiers'

export const AttachmentKind = Schema.Literals(['image', 'file'] as const)
export type AttachmentKind = typeof AttachmentKind.Type

export const Attachment = Schema.Struct({
  id: AttachmentId,
  cardId: CardId,
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

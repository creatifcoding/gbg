import { Schema } from 'effect'
import { TagId } from './identifiers'

export const Tag = Schema.Struct({
  id: TagId,
  slug: Schema.NonEmptyString,
})
export type Tag = typeof Tag.Type

export const Tags = Schema.Array(Schema.NonEmptyString).check(Schema.isMinLength(3))
export type Tags = typeof Tags.Type

export const decodeTag = Schema.decodeUnknownSync(Tag)

export function parseTags(raw: string): string[] {
  return raw
    .split(/[,;\n]/)
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
}

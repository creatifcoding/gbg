import * as Schema from 'effect/Schema'
import { TagId } from './identifiers'

export const Tag = Schema.Struct({
  id: TagId,
  slug: Schema.NonEmptyString,
})
export type Tag = typeof Tag.Type

export const decodeTag = Schema.decodeUnknownSync(Tag)

export function parseTags(raw: string): string[] {
  return raw
    .split(/[,;\n]/)
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
}

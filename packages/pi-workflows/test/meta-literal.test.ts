import { describe, expect, it } from 'vitest'

import { extractLiteralMeta, LiteralMetaParseError } from '../src/services/index'

describe('literal workflow meta extraction', () => {
  it('parses pure literal metadata without executing script code', () => {
    const meta = extractLiteralMeta(`
      export const meta = {
        name: 'literal-audit',
        description: "Literal parser smoke",
        phases: ['survey', 'synthesis',],
        maxConcurrency: 3,
        tags: ["audit", 'v0'],
      } as const

      export default async function workflow() {}
    `)

    expect(meta).toMatchObject({
      name: 'literal-audit',
      description: 'Literal parser smoke',
      phases: ['survey', 'synthesis'],
      maxConcurrency: 3,
      tags: ['audit', 'v0'],
    })
  })

  it('rejects dynamic identifiers and expressions', () => {
    expect(() =>
      extractLiteralMeta(`
        const description = 'nope'
        export const meta = {
          name: 'bad',
          description,
        }
      `),
    ).toThrow(LiteralMetaParseError)
  })

  it('rejects missing metadata', () => {
    expect(() => extractLiteralMeta('export default async function workflow() {}')).toThrow(LiteralMetaParseError)
  })

  it('rejects object spreads, array spreads, and template strings', () => {
    expect(() =>
      extractLiteralMeta(`export const meta = { name: 'spread', description: 'bad', ...extra }`),
    ).toThrow(LiteralMetaParseError)

    expect(() =>
      extractLiteralMeta(`export const meta = { name: 'spread', description: 'bad', tags: [...extra] }`),
    ).toThrow(LiteralMetaParseError)

    expect(() =>
      extractLiteralMeta('export const meta = { name: `dynamic`, description: "bad" }'),
    ).toThrow(LiteralMetaParseError)
  })

  it('allows comment markers and braces inside quoted strings', () => {
    const meta = extractLiteralMeta(`
      export const meta = {
        name: 'literal-comments',
        description: 'brace } and // comment marker inside string',
        tags: ['/* not a block comment */'],
      }
    `)

    expect(meta.description).toContain('// comment marker')
    expect(meta.tags).toEqual(['/* not a block comment */'])
  })
})

import { describe, expect, it } from 'vitest'

import {
  normalizeParsedQuery,
  removeDorkChip,
  toDorkChips,
} from '../log-dork-chips-model'

describe('log-dork-chips model', () => {
  it('normalizes invalid query input without throwing', () => {
    const normalized = normalizeParsedQuery({
      text: 42,
      fieldOperators: [
        { _tag: 'FieldOperator', field: 'scope', value: 'runtime', exclude: false },
        { nope: true },
      ],
      regexOperators: [{ _tag: 'RegexOperator', pattern: '^run' }, { value: 2 }],
      phraseOperators: [{ _tag: 'PhraseOperator', phrase: 'exact match' }, null],
      matchMode: 'fuzzy',
      caseSensitive: 'maybe',
      limit: '20',
      sort: 'name',
    } as unknown as Parameters<typeof normalizeParsedQuery>[0])

    expect(normalized.text).toBe('')
    expect(normalized.fieldOperators).toHaveLength(1)
    expect(normalized.regexOperators).toHaveLength(1)
    expect(normalized.phraseOperators).toHaveLength(1)
    expect(normalized.matchMode).toBe('fuzzy')
    expect(normalized.caseSensitive).toBeUndefined()
    expect(normalized.limit).toBeUndefined()
    expect(normalized.sort).toBe('name')

    expect(() => toDorkChips(undefined)).not.toThrow()
    expect(toDorkChips(undefined)).toEqual([])
  })

  it('removes chips deterministically by chip index and kind', () => {
    const query = normalizeParsedQuery({
      text: 'runtime',
      fieldOperators: [
        { _tag: 'FieldOperator', field: 'category', value: 'info', exclude: false },
        { _tag: 'FieldOperator', field: 'scope', value: 'runtime', exclude: false },
      ],
      regexOperators: [{ _tag: 'RegexOperator', pattern: '^run' }],
      phraseOperators: [],
      limit: 50,
    })

    const chips = toDorkChips(query)
    const categoryChip = chips.find((chip) => chip.kind === 'field' && chip.token === 'category:info')
    const limitChip = chips.find((chip) => chip.kind === 'param' && chip.token === 'limit:50')

    expect(categoryChip).toBeTruthy()
    expect(limitChip).toBeTruthy()

    const nextA = removeDorkChip(query, categoryChip!)
    const nextB = removeDorkChip(query, categoryChip!)

    expect(nextA).toEqual(nextB)
    expect(nextA.fieldOperators.map((op) => `${op.field}:${op.value}`)).toEqual(['scope:runtime'])

    const nextWithNoLimit = removeDorkChip(nextA, limitChip!)
    expect(nextWithNoLimit.limit).toBeUndefined()
    expect(nextWithNoLimit.text).toBe('runtime')
  })
})

import { emptyQuery, type ParsedQuery } from '../../../search/query'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isString = (value: unknown): value is string => typeof value === 'string'

const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean'

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const isFieldName = (
  value: unknown,
): value is 'category' | 'scope' | 'name' | 'desc' | 'keys' | 'field' =>
  value === 'category' ||
  value === 'scope' ||
  value === 'name' ||
  value === 'desc' ||
  value === 'keys' ||
  value === 'field'

const isMatchMode = (value: unknown): value is 'exact' | 'prefix' | 'fuzzy' =>
  value === 'exact' || value === 'prefix' || value === 'fuzzy'

const isSortField = (value: unknown): value is 'score' | 'name' =>
  value === 'score' || value === 'name'

const asFieldOperators = (
  value: unknown,
): ParsedQuery['fieldOperators'] => {
  if (!Array.isArray(value)) return []

  return value
    .filter((candidate): candidate is Record<string, unknown> => isRecord(candidate))
    .filter(
      (candidate) =>
        isFieldName(candidate.field) &&
        isString(candidate.value) &&
        isBoolean(candidate.exclude),
    )
    .map((candidate) => ({
      _tag: 'FieldOperator' as const,
      field: candidate.field,
      value: candidate.value,
      exclude: candidate.exclude,
    }))
}

const asRegexOperators = (
  value: unknown,
): ParsedQuery['regexOperators'] => {
  if (!Array.isArray(value)) return []

  return value
    .filter((candidate): candidate is Record<string, unknown> => isRecord(candidate))
    .filter((candidate) => isString(candidate.pattern))
    .map((candidate) => ({
      _tag: 'RegexOperator' as const,
      pattern: candidate.pattern,
    }))
}

const asPhraseOperators = (
  value: unknown,
): ParsedQuery['phraseOperators'] => {
  if (!Array.isArray(value)) return []

  return value
    .filter((candidate): candidate is Record<string, unknown> => isRecord(candidate))
    .filter((candidate) => isString(candidate.phrase))
    .map((candidate) => ({
      _tag: 'PhraseOperator' as const,
      phrase: candidate.phrase,
    }))
}

export const normalizeParsedQuery = (
  query: ParsedQuery | Partial<ParsedQuery> | null | undefined,
): ParsedQuery => {
  if (!isRecord(query)) return emptyQuery()

  return {
    text: isString(query.text) ? query.text : '',
    fieldOperators: asFieldOperators(query.fieldOperators),
    regexOperators: asRegexOperators(query.regexOperators),
    phraseOperators: asPhraseOperators(query.phraseOperators),
    matchMode: isMatchMode(query.matchMode) ? query.matchMode : undefined,
    caseSensitive: isBoolean(query.caseSensitive) ? query.caseSensitive : undefined,
    limit: isFiniteNumber(query.limit) ? query.limit : undefined,
    sort: isSortField(query.sort) ? query.sort : undefined,
  }
}

export type DorkChip =
  | {
      readonly id: string
      readonly token: string
      readonly kind: 'field'
      readonly index: number
      readonly label: string
      readonly excluded: boolean
    }
  | {
      readonly id: string
      readonly token: string
      readonly kind: 'regex'
      readonly index: number
      readonly label: string
    }
  | {
      readonly id: string
      readonly token: string
      readonly kind: 'phrase'
      readonly index: number
      readonly label: string
    }
  | {
      readonly id: string
      readonly token: string
      readonly kind: 'param'
      readonly param: 'matchMode' | 'caseSensitive' | 'limit' | 'sort'
      readonly label: string
    }

export const toDorkChips = (
  query: ParsedQuery | Partial<ParsedQuery> | null | undefined,
): ReadonlyArray<DorkChip> => {
  const parsed = normalizeParsedQuery(query)

  const fieldChips = parsed.fieldOperators.map((op, index) => ({
    id: `field-${index}`,
    token: `${op.exclude ? '-' : ''}${op.field}:${op.value}`,
    kind: 'field' as const,
    index,
    label: op.field.toUpperCase(),
    excluded: op.exclude,
  }))

  const regexChips = parsed.regexOperators.map((op, index) => ({
    id: `regex-${index}`,
    token: `regex:${op.pattern}`,
    kind: 'regex' as const,
    index,
    label: 'REGEX',
  }))

  const phraseChips = parsed.phraseOperators.map((op, index) => ({
    id: `phrase-${index}`,
    token: `"${op.phrase}"`,
    kind: 'phrase' as const,
    index,
    label: 'PHRASE',
  }))

  const paramChips: DorkChip[] = []

  if (parsed.matchMode) {
    paramChips.push({
      id: 'param-match-mode',
      token: `${parsed.matchMode}:`,
      kind: 'param',
      param: 'matchMode',
      label: 'MODE',
    })
  }

  if (parsed.caseSensitive !== undefined) {
    paramChips.push({
      id: 'param-case',
      token: `case:${parsed.caseSensitive ? 'sensitive' : 'insensitive'}`,
      kind: 'param',
      param: 'caseSensitive',
      label: 'CASE',
    })
  }

  if (parsed.limit !== undefined) {
    paramChips.push({
      id: 'param-limit',
      token: `limit:${parsed.limit}`,
      kind: 'param',
      param: 'limit',
      label: 'LIMIT',
    })
  }

  if (parsed.sort !== undefined) {
    paramChips.push({
      id: 'param-sort',
      token: `sort:${parsed.sort}`,
      kind: 'param',
      param: 'sort',
      label: 'SORT',
    })
  }

  return [...fieldChips, ...regexChips, ...phraseChips, ...paramChips]
}

export const removeDorkChip = (
  query: ParsedQuery | Partial<ParsedQuery> | null | undefined,
  chip: DorkChip,
): ParsedQuery => {
  const parsed = normalizeParsedQuery(query)

  switch (chip.kind) {
    case 'field':
      return {
        ...parsed,
        fieldOperators: parsed.fieldOperators.filter((_, index) => index !== chip.index),
      }
    case 'regex':
      return {
        ...parsed,
        regexOperators: parsed.regexOperators.filter((_, index) => index !== chip.index),
      }
    case 'phrase':
      return {
        ...parsed,
        phraseOperators: parsed.phraseOperators.filter((_, index) => index !== chip.index),
      }
    case 'param':
      if (chip.param === 'matchMode') {
        return { ...parsed, matchMode: undefined }
      }
      if (chip.param === 'caseSensitive') {
        return { ...parsed, caseSensitive: undefined }
      }
      if (chip.param === 'limit') {
        return { ...parsed, limit: undefined }
      }
      return { ...parsed, sort: undefined }
  }
}

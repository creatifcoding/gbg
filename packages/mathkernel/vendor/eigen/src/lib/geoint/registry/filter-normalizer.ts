import { Effect, Schema } from 'effect'
import type { RegistryFilter } from './schemas'

// =============================================================================
// CQL2 JSON (internal IR subset)
// =============================================================================

export const Cql2Operator = Schema.Literal(
  'and',
  'or',
  'not',
  '=',
  '!=',
  '<>',
  '<',
  '<=',
  '>',
  '>=',
  'in',
  'like'
)
export type Cql2Operator = typeof Cql2Operator.Type

export const Cql2PropertyRef = Schema.Struct({
  property: Schema.String,
})
export type Cql2PropertyRef = typeof Cql2PropertyRef.Type

export const Cql2Literal = Schema.Union(
  Schema.String,
  Schema.Number,
  Schema.Boolean,
  Schema.Null
)
export type Cql2Literal = typeof Cql2Literal.Type

export const Cql2Expression = Schema.Struct({
  op: Cql2Operator,
  args: Schema.Array(Schema.Unknown).pipe(Schema.minItems(1)),
})
export type Cql2Expression = typeof Cql2Expression.Type

export const NormalizedFilterResult = Schema.Struct({
  language: Schema.Literal('none', 'cql2-json'),
  expression: Schema.NullOr(Cql2Expression),
  diagnostics: Schema.Array(Schema.String),
})
export type NormalizedFilterResult = typeof NormalizedFilterResult.Type

export class FilterNormalizerError extends Schema.TaggedError<FilterNormalizerError>()(
  'FilterNormalizerError',
  {
    reason: Schema.Literal('UnsupportedLanguage', 'InvalidPayload', 'ParseError'),
    message: Schema.String,
    input: Schema.optional(Schema.Unknown),
  }
) {}

const decodeCql2Expression = Schema.decodeUnknownSync(Cql2Expression)

const property = (name: string): Cql2PropertyRef => ({ property: name })

const comparison = (
  op: Extract<Cql2Operator, '=' | '!=' | '<>' | '<' | '<=' | '>' | '>=' | 'like'>,
  field: string,
  value: Cql2Literal
): Cql2Expression => ({
  op,
  args: [property(field), value],
})

const inExpression = (field: string, values: ReadonlyArray<Cql2Literal>): Cql2Expression => ({
  op: 'in',
  args: [property(field), values],
})

const andExpression = (expressions: ReadonlyArray<Cql2Expression>): Cql2Expression => ({
  op: 'and',
  args: [...expressions],
})

const parseLiteral = (raw: string): Cql2Literal => {
  const trimmed = raw.trim()

  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.slice(1, -1)
  }

  if (/^(true|false)$/i.test(trimmed)) {
    return trimmed.toLowerCase() === 'true'
  }

  if (/^null$/i.test(trimmed)) {
    return null
  }

  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed)
  }

  return trimmed
}

const parseClause = (clause: string): Cql2Expression => {
  const inMatch = clause.match(/^([A-Za-z0-9_:.\-]+)\s+IN\s*\((.+)\)$/i)
  if (inMatch) {
    const [, field, valueList] = inMatch
    const values = valueList.split(',').map((part) => parseLiteral(part))
    return inExpression(field, values)
  }

  const likeMatch = clause.match(/^([A-Za-z0-9_:.\-]+)\s+LIKE\s+(.+)$/i)
  if (likeMatch) {
    const [, field, value] = likeMatch
    return comparison('like', field, parseLiteral(value))
  }

  const comparisonMatch = clause.match(/^([A-Za-z0-9_:.\-]+)\s*(=|!=|<>|<=|>=|<|>)\s*(.+)$/)
  if (comparisonMatch) {
    const [, field, op, value] = comparisonMatch
    return comparison(op as Extract<Cql2Operator, '=' | '!=' | '<>' | '<' | '<=' | '>' | '>='>, field, parseLiteral(value))
  }

  throw new FilterNormalizerError({
    reason: 'ParseError',
    message: `Unsupported CQL2 text clause: ${clause}`,
    input: clause,
  })
}

const parseCql2Text = (input: string): Cql2Expression => {
  const clauses = input
    .split(/\s+AND\s+/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)

  if (clauses.length === 0) {
    throw new FilterNormalizerError({
      reason: 'ParseError',
      message: 'CQL2 text expression is empty',
      input,
    })
  }

  const parsed = clauses.map(parseClause)
  return parsed.length === 1 ? parsed[0] : andExpression(parsed)
}

const fromStacOperator = (
  field: string,
  operator: string,
  value: unknown
): Cql2Expression => {
  if (typeof value === 'object' && value === null) {
    throw new FilterNormalizerError({
      reason: 'InvalidPayload',
      message: `Invalid null payload for STAC operator ${operator}`,
      input: { field, operator, value },
    })
  }

  switch (operator) {
    case 'eq':
      return comparison('=', field, value as Cql2Literal)
    case 'neq':
      return comparison('!=', field, value as Cql2Literal)
    case 'lt':
      return comparison('<', field, value as Cql2Literal)
    case 'lte':
      return comparison('<=', field, value as Cql2Literal)
    case 'gt':
      return comparison('>', field, value as Cql2Literal)
    case 'gte':
      return comparison('>=', field, value as Cql2Literal)
    case 'in':
      if (!Array.isArray(value)) {
        throw new FilterNormalizerError({
          reason: 'InvalidPayload',
          message: `STAC operator 'in' expects an array for ${field}`,
          input: { field, operator, value },
        })
      }
      return inExpression(field, value as ReadonlyArray<Cql2Literal>)
    case 'like':
      return comparison('like', field, value as Cql2Literal)
    default:
      throw new FilterNormalizerError({
        reason: 'UnsupportedLanguage',
        message: `Unsupported STAC query operator: ${operator}`,
        input: { field, operator, value },
      })
  }
}

const parseStacQueryObject = (query: unknown): Cql2Expression | null => {
  if (!query || typeof query !== 'object' || Array.isArray(query)) {
    throw new FilterNormalizerError({
      reason: 'InvalidPayload',
      message: 'STAC query object must be a record',
      input: query,
    })
  }

  const record = query as Record<string, unknown>
  const expressions: Cql2Expression[] = []

  for (const [field, condition] of Object.entries(record)) {
    if (condition === undefined) continue

    if (Array.isArray(condition)) {
      expressions.push(inExpression(field, condition as ReadonlyArray<Cql2Literal>))
      continue
    }

    if (condition !== null && typeof condition === 'object') {
      for (const [operator, value] of Object.entries(condition as Record<string, unknown>)) {
        expressions.push(fromStacOperator(field, operator, value))
      }
      continue
    }

    expressions.push(comparison('=', field, condition as Cql2Literal))
  }

  if (expressions.length === 0) {
    return null
  }

  return expressions.length === 1 ? expressions[0] : andExpression(expressions)
}

const parseSourceFilterObject = (filter: unknown): Cql2Expression | null => {
  if (!filter || typeof filter !== 'object' || Array.isArray(filter)) {
    throw new FilterNormalizerError({
      reason: 'InvalidPayload',
      message: 'Source filter must be an object',
      input: filter,
    })
  }

  const tagged = filter as { _tag?: string } & Record<string, unknown>
  const expressions: Cql2Expression[] = []

  switch (tagged._tag) {
    case 'TrackFilter': {
      if (typeof tagged.objectType === 'string') {
        expressions.push(comparison('=', 'objectType', tagged.objectType))
      }
      if (typeof tagged.classification === 'string') {
        expressions.push(comparison('=', 'classification', tagged.classification))
      }
      if (typeof tagged.minConfidence === 'number' && tagged.minConfidence > 0) {
        expressions.push(comparison('>=', 'confidence', tagged.minConfidence))
      }
      if (typeof tagged.active === 'boolean') {
        expressions.push(comparison('=', 'active', tagged.active))
      }
      break
    }

    case 'OsmFilter': {
      if (Array.isArray(tagged.categories) && tagged.categories.length > 0) {
        expressions.push(inExpression('category', tagged.categories as ReadonlyArray<Cql2Literal>))
      }

      if (tagged.tags && typeof tagged.tags === 'object' && !Array.isArray(tagged.tags)) {
        for (const [key, value] of Object.entries(tagged.tags as Record<string, unknown>)) {
          expressions.push(comparison('=', `tags.${key}`, value as Cql2Literal))
        }
      }

      if (typeof tagged.nameSearch === 'string' && tagged.nameSearch.length > 0) {
        expressions.push(comparison('like', 'name', `%${tagged.nameSearch}%`))
      }
      break
    }

    case 'FlightFilter': {
      if (Array.isArray(tagged.icao24) && tagged.icao24.length > 0) {
        expressions.push(inExpression('icao24', tagged.icao24 as ReadonlyArray<Cql2Literal>))
      }
      if (typeof tagged.callsignPattern === 'string' && tagged.callsignPattern.length > 0) {
        expressions.push(comparison('like', 'callsign', tagged.callsignPattern))
      }
      if (typeof tagged.category === 'string') {
        expressions.push(comparison('=', 'category', tagged.category))
      }
      if (typeof tagged.minAltitude === 'number') {
        expressions.push(comparison('>=', 'altitude', tagged.minAltitude))
      }
      if (typeof tagged.maxAltitude === 'number') {
        expressions.push(comparison('<=', 'altitude', tagged.maxAltitude))
      }
      if (typeof tagged.onGround === 'boolean') {
        expressions.push(comparison('=', 'onGround', tagged.onGround))
      }
      break
    }

    case 'FeatureFilter': {
      if (Array.isArray(tagged.featureIds) && tagged.featureIds.length > 0) {
        expressions.push(inExpression('featureId', tagged.featureIds as ReadonlyArray<Cql2Literal>))
      }
      if (tagged.properties && typeof tagged.properties === 'object' && !Array.isArray(tagged.properties)) {
        for (const [key, value] of Object.entries(tagged.properties as Record<string, unknown>)) {
          expressions.push(comparison('=', `properties.${key}`, value as Cql2Literal))
        }
      }
      break
    }

    default:
      throw new FilterNormalizerError({
        reason: 'InvalidPayload',
        message: `Unsupported source filter type: ${String(tagged._tag ?? 'unknown')}`,
        input: filter,
      })
  }

  if (expressions.length === 0) {
    return null
  }

  return expressions.length === 1 ? expressions[0] : andExpression(expressions)
}

const combineWithAnd = (expressions: ReadonlyArray<Cql2Expression>): Cql2Expression | null => {
  if (expressions.length === 0) return null
  return expressions.length === 1 ? expressions[0] : andExpression(expressions)
}

const asNormalizedResult = (
  expression: Cql2Expression | null,
  diagnostics: ReadonlyArray<string>
): NormalizedFilterResult => ({
  language: expression ? 'cql2-json' : 'none',
  expression,
  diagnostics: [...diagnostics],
})

export const normalizeRegistryFilter = (
  filter?: RegistryFilter
): Effect.Effect<NormalizedFilterResult, FilterNormalizerError> =>
  Effect.try({
    try: () => {
      if (!filter || filter.lang === 'none') {
        return asNormalizedResult(null, ['No filter provided'])
      }

      if (filter.lang === 'cql2-json') {
        const raw = filter.cql2 ?? filter.raw
        if (raw === undefined) {
          throw new FilterNormalizerError({
            reason: 'InvalidPayload',
            message: 'cql2-json filter requires cql2 or raw payload',
            input: filter,
          })
        }

        const expression = decodeCql2Expression(raw)
        return asNormalizedResult(expression, ['Normalized from cql2-json'])
      }

      if (filter.lang === 'cql2-text') {
        const raw = filter.raw ?? filter.cql2
        if (typeof raw !== 'string') {
          throw new FilterNormalizerError({
            reason: 'InvalidPayload',
            message: 'cql2-text filter requires string payload in raw or cql2',
            input: filter,
          })
        }

        const expression = parseCql2Text(raw)
        return asNormalizedResult(expression, ['Normalized from cql2-text'])
      }

      throw new FilterNormalizerError({
        reason: 'UnsupportedLanguage',
        message: `Unsupported filter language: ${String(filter.lang)}`,
        input: filter,
      })
    },
    catch: (error) =>
      error instanceof FilterNormalizerError
        ? error
        : new FilterNormalizerError({
            reason: 'ParseError',
            message: 'Failed to normalize registry filter',
            input: { error },
          }),
  })

export const normalizeStacQuery = (
  query: unknown
): Effect.Effect<NormalizedFilterResult, FilterNormalizerError> =>
  Effect.try({
    try: () => {
      const expression = parseStacQueryObject(query)
      return asNormalizedResult(expression, ['Normalized from STAC query object'])
    },
    catch: (error) =>
      error instanceof FilterNormalizerError
        ? error
        : new FilterNormalizerError({
            reason: 'ParseError',
            message: 'Failed to normalize STAC query object',
            input: { error, query },
          }),
  })

export const normalizeSourceFilters = (
  sourceFilters: ReadonlyArray<unknown>
): Effect.Effect<NormalizedFilterResult, FilterNormalizerError> =>
  Effect.try({
    try: () => {
      const expressions = sourceFilters
        .map(parseSourceFilterObject)
        .filter((expr): expr is Cql2Expression => expr !== null)

      return asNormalizedResult(
        combineWithAnd(expressions),
        ['Normalized from source-specific filters']
      )
    },
    catch: (error) =>
      error instanceof FilterNormalizerError
        ? error
        : new FilterNormalizerError({
            reason: 'ParseError',
            message: 'Failed to normalize source filters',
            input: { error, sourceFilters },
          }),
  })

export const normalizeFilterBundle = ({
  registryFilter,
  stacQuery,
  sourceFilters,
}: {
  registryFilter?: RegistryFilter
  stacQuery?: unknown
  sourceFilters?: ReadonlyArray<unknown>
}): Effect.Effect<NormalizedFilterResult, FilterNormalizerError> =>
  Effect.gen(function* () {
    const expressions: Cql2Expression[] = []
    const diagnostics: string[] = []

    if (registryFilter) {
      const normalized = yield* normalizeRegistryFilter(registryFilter)
      diagnostics.push(...normalized.diagnostics)
      if (normalized.expression) expressions.push(normalized.expression)
    }

    if (stacQuery !== undefined) {
      const normalized = yield* normalizeStacQuery(stacQuery)
      diagnostics.push(...normalized.diagnostics)
      if (normalized.expression) expressions.push(normalized.expression)
    }

    if (sourceFilters && sourceFilters.length > 0) {
      const normalized = yield* normalizeSourceFilters(sourceFilters)
      diagnostics.push(...normalized.diagnostics)
      if (normalized.expression) expressions.push(normalized.expression)
    }

    return asNormalizedResult(combineWithAnd(expressions), diagnostics)
  })

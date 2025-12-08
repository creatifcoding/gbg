/**
 * TMNL Search — Scored Operators
 *
 * Stream operators for score-based filtering and boosting.
 */

import { Stream } from 'effect'
import type { SearchResult } from '../types'

// ─────────────────────────────────────────────────────────────────────────────
// Score Filters
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Filter results with score above threshold
 */
export const withMinScore = <T, E>(threshold: number) =>
  Stream.filter<SearchResult<T>, E>((r) => r.score >= threshold)

/**
 * Filter results with score below threshold
 */
export const withMaxScore = <T, E>(threshold: number) =>
  Stream.filter<SearchResult<T>, E>((r) => r.score < threshold)

/**
 * Filter results within score range
 */
export const withScoreRange = <T, E>(min: number, max: number) =>
  Stream.filter<SearchResult<T>, E>((r) => r.score >= min && r.score <= max)

// ─────────────────────────────────────────────────────────────────────────────
// Boost Operators
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Boost score when a specific field matched
 */
export const withFieldBoost = <T, E>(field: string, multiplier: number) =>
  Stream.map<SearchResult<T>, SearchResult<T>, E>((r) => {
    const hasFieldMatch = r.matches?.some((m) => m.field === field) ?? false
    if (!hasFieldMatch) return r
    return {
      ...r,
      score: Math.min(1, r.score * multiplier),
    }
  })

/**
 * Boost score based on multiple field weights
 */
export const withBoosts = <T, E>(boosts: Record<string, number>) =>
  Stream.map<SearchResult<T>, SearchResult<T>, E>((r) => {
    let multiplier = 1
    for (const match of r.matches ?? []) {
      const boost = boosts[match.field]
      if (boost) multiplier *= boost
    }
    return {
      ...r,
      score: Math.min(1, r.score * multiplier),
    }
  })

/**
 * Apply score decay based on index position
 * Useful for time-based sorting where newer items should rank higher
 */
export const withPositionDecay = <T, E>(decayFactor: number = 0.01) =>
  Stream.mapAccum<SearchResult<T>, number, SearchResult<T>, E>(0, (index, r) => [
    index + 1,
    {
      ...r,
      score: r.score * Math.exp(-decayFactor * index),
      index,
    },
  ])

// ─────────────────────────────────────────────────────────────────────────────
// Match Filters
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Filter results that matched a specific field
 */
export const withFieldMatch = <T, E>(field: string) =>
  Stream.filter<SearchResult<T>, E>(
    (r) => r.matches?.some((m) => m.field === field) ?? false
  )

/**
 * Filter results that matched any of the specified fields
 */
export const withAnyFieldMatch = <T, E>(fields: string[]) =>
  Stream.filter<SearchResult<T>, E>(
    (r) => r.matches?.some((m) => fields.includes(m.field)) ?? false
  )

/**
 * Filter results that matched all specified fields
 */
export const withAllFieldMatches = <T, E>(fields: string[]) =>
  Stream.filter<SearchResult<T>, E>((r) => {
    const matchedFields = new Set(r.matches?.map((m) => m.field) ?? [])
    return fields.every((f) => matchedFields.has(f))
  })

/**
 * Filter results that have any matches
 */
export const withMatches = <T, E>() =>
  Stream.filter<SearchResult<T>, E>((r) => (r.matches?.length ?? 0) > 0)

// ─────────────────────────────────────────────────────────────────────────────
// Sorting (Collect + Sort + Re-emit)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sort results by score (descending) after collecting
 * Note: This breaks streaming for sorting, use sparingly
 */
export const sortedByScore = <T, E>() =>
  (stream: Stream.Stream<SearchResult<T>, E>): Stream.Stream<SearchResult<T>, E> =>
    Stream.unwrap(
      Stream.runCollect(stream).pipe(
        Stream.map((chunk) => {
          const sorted = [...chunk].sort((a, b) => b.score - a.score)
          return Stream.fromIterable(sorted)
        })
      )
    )

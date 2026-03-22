export interface FuzzyMatch {
  item: string
  score: number
  indices: number[]
}

/**
 * Simple fuzzy match scoring.
 * Returns a score (lower is better) and the indices of matched characters.
 * Returns null if no match.
 */
export function fuzzyMatch(
  query: string,
  target: string
): FuzzyMatch | null {
  const q = query.toLowerCase()
  const t = target.toLowerCase()

  if (q.length === 0) return { item: target, score: 0, indices: [] }
  if (q.length > t.length) return null

  const indices: number[] = []
  let score = 0
  let qIdx = 0
  let prevMatchIdx = -1

  for (let tIdx = 0; tIdx < t.length && qIdx < q.length; tIdx++) {
    if (t[tIdx] === q[qIdx]) {
      indices.push(tIdx)

      // Reward consecutive matches
      if (prevMatchIdx === tIdx - 1) {
        score += 0 // no penalty for consecutive
      } else {
        score += tIdx - (prevMatchIdx + 1) // penalty for gaps
      }

      // Reward start-of-word matches
      if (tIdx === 0 || t[tIdx - 1] === ' ' || t[tIdx - 1] === ':' || t[tIdx - 1] === '-') {
        score -= 2
      }

      prevMatchIdx = tIdx
      qIdx++
    }
  }

  if (qIdx !== q.length) return null

  // Normalize by target length (prefer shorter matches)
  score += t.length * 0.1

  return { item: target, score, indices }
}

/**
 * Rank a list of candidates by fuzzy match quality.
 */
export function fuzzyFilter<T>(
  query: string,
  candidates: T[],
  accessor: (item: T) => string
): (T & { _fuzzyScore: number; _fuzzyIndices: number[] })[] {
  if (!query) {
    return candidates.map((c) => ({
      ...c,
      _fuzzyScore: 0,
      _fuzzyIndices: [],
    }))
  }

  return candidates
    .map((candidate) => {
      const match = fuzzyMatch(query, accessor(candidate))
      if (!match) return null
      return {
        ...candidate,
        _fuzzyScore: match.score,
        _fuzzyIndices: match.indices,
      }
    })
    .filter(Boolean)
    .sort((a, b) => a!._fuzzyScore - b!._fuzzyScore) as (T & {
    _fuzzyScore: number
    _fuzzyIndices: number[]
  })[]
}

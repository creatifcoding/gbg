import {
  useCallback,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'
import type { ParsedQuery } from '../../../search/query'
import {
  normalizeParsedQuery,
  removeDorkChip,
  toDorkChips,
  type DorkChip,
} from './log-dork-chips-model'

export interface UseLogDorkChipsResult {
  readonly query: ParsedQuery
  readonly chips: ReadonlyArray<DorkChip>
  readonly activeChipId: string | null
  readonly setActiveChipId: Dispatch<SetStateAction<string | null>>
  readonly removeChip: (chip: DorkChip) => void
}

export const useLogDorkChips = (
  query: ParsedQuery | Partial<ParsedQuery> | null | undefined,
  onQueryChange: (next: ParsedQuery) => void,
): UseLogDorkChipsResult => {
  const normalizedQuery = useMemo(() => normalizeParsedQuery(query), [query])
  const chips = useMemo(() => toDorkChips(normalizedQuery), [normalizedQuery])
  const [activeChipId, setActiveChipId] = useState<string | null>(null)

  const removeChip = useCallback(
    (chip: DorkChip) => {
      onQueryChange(removeDorkChip(normalizedQuery, chip))
    },
    [normalizedQuery, onQueryChange],
  )

  return {
    query: normalizedQuery,
    chips,
    activeChipId,
    setActiveChipId,
    removeChip,
  }
}

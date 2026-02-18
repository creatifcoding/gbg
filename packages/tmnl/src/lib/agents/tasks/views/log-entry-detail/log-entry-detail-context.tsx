import { createContext, useContext } from 'react'
import type { AssembledLogEntry } from '../../services/CodecService'

export interface LogEntryDetailContextValue {
  readonly entry: AssembledLogEntry
}

export const LogEntryDetailContext = createContext<LogEntryDetailContextValue | null>(null)

export const useMaybeLogEntryDetailEntry = (
  entryOverride?: AssembledLogEntry,
): AssembledLogEntry | undefined => {
  if (entryOverride) return entryOverride

  const ctx = useContext(LogEntryDetailContext)
  return ctx?.entry
}

export const useLogEntryDetailEntry = (
  entryOverride?: AssembledLogEntry,
): AssembledLogEntry => {
  const entry = useMaybeLogEntryDetailEntry(entryOverride)
  if (entry) return entry

  throw new Error('LogEntryDetail subcomponents must be used inside <LogEntryDetail entry={...}>')
}

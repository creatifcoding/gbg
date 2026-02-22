import { Atom } from '@effect-atom/atom-react'
import type { LogEntry } from './schemas.ts'

export const entriesAtom = Atom.make<ReadonlyArray<LogEntry>>([]) as Atom.Writable<
  ReadonlyArray<LogEntry>,
  ReadonlyArray<LogEntry>
>

export const maxEntriesAtom = Atom.make<number>(500) as Atom.Writable<number, number>

export const sourcesAtom = Atom.make((get) => {
  const seen = new Set<string>()
  for (const entry of get(entriesAtom)) {
    seen.add(entry.source)
  }
  return Array.from(seen)
})

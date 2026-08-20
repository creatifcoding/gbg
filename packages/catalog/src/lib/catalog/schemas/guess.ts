import { Schema } from 'effect'

/**
 * A labeled guess on a Specimen. Not a reference-graph node.
 * Intake may stash an organism/structure/function name without creating
 * Organism, Structure, or BioFunction records.
 */
export const Guess = Schema.Struct({
  label: Schema.NonEmptyString,
  guess: Schema.Literal(true),
})
export type Guess = typeof Guess.Type

export function guessFromInput(raw: string): Guess | null {
  const label = raw.trim()
  if (label.length === 0 || label.toLowerCase() === 'unknown') {
    return null
  }
  return { label, guess: true as const }
}

export function guessLabel(guess: Guess | null | undefined): string {
  return guess?.label ?? 'unlinked'
}

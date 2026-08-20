import type { BioFunction } from '../schemas/function'
import type { Mechanism } from '../schemas/mechanism'
import type { Organism } from '../schemas/organism'
import type { Question } from '../schemas/question'
import type { Structure } from '../schemas/structure'
import type { Tag } from '../schemas/tag'
import type { CatalogSnapshot } from '../models/catalog-snapshot'

export function findTagBySlug(
  snapshot: CatalogSnapshot,
  slug: string,
): Tag | undefined {
  return snapshot.tags.find((tag) => tag.slug === slug)
}

export function upsertTag(snapshot: CatalogSnapshot, tag: Tag): CatalogSnapshot {
  const existing = findTagBySlug(snapshot, tag.slug)
  if (existing) return snapshot
  if (snapshot.tags.some((item) => item.id === tag.id)) return snapshot
  return { ...snapshot, tags: [...snapshot.tags, tag] }
}

export function insertQuestion(
  snapshot: CatalogSnapshot,
  question: Question,
): CatalogSnapshot {
  return { ...snapshot, questions: [...snapshot.questions, question] }
}

export function upsertOrganism(
  snapshot: CatalogSnapshot,
  organism: Organism,
): CatalogSnapshot {
  const index = snapshot.organisms.findIndex((item) => item.id === organism.id)
  if (index < 0) {
    return { ...snapshot, organisms: [organism, ...snapshot.organisms] }
  }
  const organisms = snapshot.organisms.slice()
  organisms[index] = organism
  return { ...snapshot, organisms }
}

export function upsertStructure(
  snapshot: CatalogSnapshot,
  structure: Structure,
): CatalogSnapshot {
  const index = snapshot.structures.findIndex((item) => item.id === structure.id)
  if (index < 0) {
    return { ...snapshot, structures: [structure, ...snapshot.structures] }
  }
  const structures = snapshot.structures.slice()
  structures[index] = structure
  return { ...snapshot, structures }
}

export function upsertMechanism(
  snapshot: CatalogSnapshot,
  mechanism: Mechanism,
): CatalogSnapshot {
  const index = snapshot.mechanisms.findIndex((item) => item.id === mechanism.id)
  if (index < 0) {
    return { ...snapshot, mechanisms: [mechanism, ...snapshot.mechanisms] }
  }
  const mechanisms = snapshot.mechanisms.slice()
  mechanisms[index] = mechanism
  return { ...snapshot, mechanisms }
}

export function upsertBioFunction(
  snapshot: CatalogSnapshot,
  bioFunction: BioFunction,
): CatalogSnapshot {
  const index = snapshot.functions.findIndex((item) => item.id === bioFunction.id)
  if (index < 0) {
    return { ...snapshot, functions: [bioFunction, ...snapshot.functions] }
  }
  const functions = snapshot.functions.slice()
  functions[index] = bioFunction
  return { ...snapshot, functions }
}

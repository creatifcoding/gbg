import type { Card } from '../schemas/card'
import type { CardId } from '../schemas/identifiers'
import type { CatalogSnapshot } from '../models/catalog-snapshot'
import type { CatalogEvent } from '../schemas/events'

export function findCard(
  snapshot: CatalogSnapshot,
  id: CardId | string,
): Card | undefined {
  return snapshot.cards.find((card) => card.id === id)
}

export function upsertCard(
  snapshot: CatalogSnapshot,
  card: Card,
): CatalogSnapshot {
  const index = snapshot.cards.findIndex((item) => item.id === card.id)
  const cards = snapshot.cards.slice()
  if (index < 0) {
    cards.unshift(card)
  } else {
    cards[index] = card
  }
  return { ...snapshot, cards }
}

export function appendEvents(
  snapshot: CatalogSnapshot,
  events: ReadonlyArray<CatalogEvent>,
): CatalogSnapshot {
  if (events.length === 0) return snapshot
  return { ...snapshot, events: [...snapshot.events, ...events] }
}

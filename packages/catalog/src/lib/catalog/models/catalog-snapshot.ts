import { Schema } from 'effect'
import { Analog } from '../schemas/analog'
import { Attachment } from '../schemas/attachment'
import { Card } from '../schemas/card'
import { Edge } from '../schemas/edge'
import { CatalogEvent } from '../schemas/events'
import { BioFunction } from '../schemas/function'
import { Mechanism } from '../schemas/mechanism'
import { Organism } from '../schemas/organism'
import { Question } from '../schemas/question'
import { Structure } from '../schemas/structure'
import { Tag } from '../schemas/tag'

export const CatalogSnapshot = Schema.Struct({
  version: Schema.Literal(2),
  cards: Schema.Array(Card),
  analogs: Schema.Array(Analog),
  organisms: Schema.Array(Organism),
  structures: Schema.Array(Structure),
  mechanisms: Schema.Array(Mechanism),
  functions: Schema.Array(BioFunction),
  attachments: Schema.Array(Attachment),
  tags: Schema.Array(Tag),
  questions: Schema.Array(Question),
  edges: Schema.Array(Edge),
  events: Schema.Array(CatalogEvent),
})
export type CatalogSnapshot = typeof CatalogSnapshot.Type

export const decodeCatalogSnapshot = Schema.decodeUnknownSync(CatalogSnapshot)

export function emptySnapshot(): CatalogSnapshot {
  return {
    version: 2,
    cards: [],
    analogs: [],
    organisms: [],
    structures: [],
    mechanisms: [],
    functions: [],
    attachments: [],
    tags: [],
    questions: [],
    edges: [],
    events: [],
  }
}

export type ExampleFragment = {
  cards?: CatalogSnapshot['cards']
  analogs?: CatalogSnapshot['analogs']
  organisms?: CatalogSnapshot['organisms']
  structures?: CatalogSnapshot['structures']
  mechanisms?: CatalogSnapshot['mechanisms']
  functions?: CatalogSnapshot['functions']
  tags?: CatalogSnapshot['tags']
  questions?: CatalogSnapshot['questions']
  edges?: CatalogSnapshot['edges']
  events?: CatalogSnapshot['events']
}

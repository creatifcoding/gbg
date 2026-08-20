import { Schema } from 'effect'
import { Analog } from '../schemas/analog'
import { Attachment } from '../schemas/attachment'
import { Edge } from '../schemas/edge'
import { CatalogEvent } from '../schemas/events'
import { BioFunction } from '../schemas/function'
import { Mechanism } from '../schemas/mechanism'
import { Observation } from '../schemas/observation'
import { Organism } from '../schemas/organism'
import { Question } from '../schemas/question'
import { Specimen } from '../schemas/specimen'
import { Structure } from '../schemas/structure'
import { Tag } from '../schemas/tag'

export const CatalogSnapshot = Schema.Struct({
  version: Schema.Literal(4),
  specimens: Schema.Array(Specimen),
  observations: Schema.Array(Observation),
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
    version: 4,
    specimens: [],
    observations: [],
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
  specimens?: CatalogSnapshot['specimens']
  observations?: CatalogSnapshot['observations']
  analogs?: CatalogSnapshot['analogs']
  organisms?: CatalogSnapshot['organisms']
  structures?: CatalogSnapshot['structures']
  mechanisms?: CatalogSnapshot['mechanisms']
  functions?: CatalogSnapshot['functions']
  attachments?: CatalogSnapshot['attachments']
  tags?: CatalogSnapshot['tags']
  questions?: CatalogSnapshot['questions']
  edges?: CatalogSnapshot['edges']
  events?: CatalogSnapshot['events']
}

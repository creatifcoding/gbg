import { createAnalog } from './entity/analog-entity'
import { createCard } from './entity/card-entity'
import { createEdge } from './entity/edge-entity'
import { emptySnapshot } from './models/catalog-snapshot'
import { hydrateCard, type CardView } from './models/card-view'
import type { ExampleFragment } from './models/catalog-snapshot'
import { decodeBioFunction } from './schemas/function'
import { decodeMechanism } from './schemas/mechanism'
import { decodeOrganism } from './schemas/organism'
import { decodeStructure } from './schemas/structure'
import { decodeTag } from './schemas/tag'
import { decodeQuestion } from './schemas/question'
import type { AnalogId, CardId, FunctionId, MechanismId, OrganismId, QuestionId, StructureId, TagId } from './schemas/identifiers'

const EXAMPLE_BANNER =
  'EXAMPLE CARD. Synthetic UI fixture. Not a paper, not a citation, not a result.'

const geckoCardId = 'ex_gecko_setae' as CardId
const lotusCardId = 'ex_lotus_leaf' as CardId
const scaleCardId = 'ex_unknown_scale' as CardId
const analogId = 'ex_gecko_tape' as AnalogId
const geckoId = 'org_ex_gecko' as OrganismId
const setaeId = 'str_ex_setae' as StructureId
const adhesionId = 'fn_ex_adhesion' as FunctionId
const vdwId = 'mech_ex_vdw' as MechanismId

const tagAdhesion = decodeTag({ id: 'tag_adhesion' as TagId, slug: 'adhesion' })
const tagSetae = decodeTag({ id: 'tag_setae' as TagId, slug: 'setae' })
const tagExample = decodeTag({ id: 'tag_example' as TagId, slug: 'example' })
const tagWetting = decodeTag({ id: 'tag_wetting' as TagId, slug: 'wetting' })
const tagLotus = decodeTag({ id: 'tag_lotus' as TagId, slug: 'lotus' })
const tagDenticle = decodeTag({ id: 'tag_denticle' as TagId, slug: 'denticle' })
const tagDrag = decodeTag({ id: 'tag_drag' as TagId, slug: 'drag' })

const geckoCreated = createCard(
  {
    id: geckoCardId,
    kind: 'picture',
    claim: 'Gecko toe pad dumped before the analog is designed.',
    organismGuess: { label: 'Tokay gecko', guess: true },
    structureGuess: { label: 'setae', guess: true },
    functionGuess: { label: 'dry adhesion', guess: true },
    tagIds: [tagAdhesion.id, tagSetae.id, tagExample.id],
    questionIds: [
      'q_ex_gecko_0' as QuestionId,
      'q_ex_gecko_1' as QuestionId,
    ],
    example: true,
  },
  0,
)

const lotusCreated = createCard(
  {
    id: lotusCardId,
    kind: 'dossier',
    claim: 'Lotus leaf notes parked until wetting is mapped.',
    organismGuess: { label: 'Nelumbo nucifera', guess: true },
    tagIds: [tagWetting.id, tagLotus.id, tagExample.id],
    questionIds: ['q_ex_lotus_0' as QuestionId],
    example: true,
  },
  0,
)

const scaleCreated = createCard(
  {
    id: scaleCardId,
    kind: 'picture',
    claim: 'Unknown scale photo. Drag-reduction guess only.',
    organismGuess: null,
    tagIds: [tagDenticle.id, tagDrag.id, tagExample.id],
    questionIds: ['q_ex_scale_0' as QuestionId],
    example: true,
  },
  0,
)

const analogCreated = createAnalog(
  {
    id: analogId,
    claim: 'Hook-and-loop tape as a dry-adhesive analog of gecko setae.',
    body: EXAMPLE_BANNER,
    example: true,
  },
  0,
)

const geckoFiled = {
  ...geckoCreated.card,
  status: 'raw' as const,
  body: EXAMPLE_BANNER,
}
const lotusFiled = {
  ...lotusCreated.card,
  status: 'working' as const,
  body: EXAMPLE_BANNER,
}
const scaleFiled = {
  ...scaleCreated.card,
  status: 'filed' as const,
  body: EXAMPLE_BANNER,
}

export const EXAMPLE_FRAGMENT: ExampleFragment = {
  tags: [
    tagAdhesion,
    tagSetae,
    tagExample,
    tagWetting,
    tagLotus,
    tagDenticle,
    tagDrag,
  ],
  questions: [
    decodeQuestion({
      id: 'q_ex_gecko_0' as QuestionId,
      cardId: geckoCardId,
      text: 'Is this setal contact or claw hooking?',
    }),
    decodeQuestion({
      id: 'q_ex_gecko_1' as QuestionId,
      cardId: geckoCardId,
      text: 'What surface was the toe on?',
    }),
    decodeQuestion({
      id: 'q_ex_lotus_0' as QuestionId,
      cardId: lotusCardId,
      text: 'Papillae scale still unknown. Guess only.',
    }),
    decodeQuestion({
      id: 'q_ex_scale_0' as QuestionId,
      cardId: scaleCardId,
      text: 'Shark denticle or something else?',
    }),
  ],
  cards: [geckoFiled, lotusFiled, scaleFiled],
  organisms: [
    decodeOrganism({
      id: geckoId,
      name: 'Tokay gecko',
      clade: 'Gekko gecko',
      habitat: 'arboreal',
      example: true,
    }),
  ],
  structures: [
    decodeStructure({
      id: setaeId,
      name: 'setae',
      summary: 'Keratin hairs that split into spatulae.',
      example: true,
    }),
  ],
  functions: [
    decodeBioFunction({
      id: adhesionId,
      name: 'adhesion',
      summary: 'Stick and release without glue.',
      example: true,
    }),
  ],
  mechanisms: [
    decodeMechanism({
      id: vdwId,
      name: 'van der Waals contact',
      summary: 'Weak intermolecular forces at spatulae tips.',
      example: true,
    }),
  ],
  analogs: [analogCreated.analog],
  edges: [
    createEdge({
      id: 'edge_ex_exhibits',
      kind: 'exhibits',
      from: { _tag: 'organism', id: geckoId },
      to: { _tag: 'structure', id: setaeId },
      createdAt: 0,
    }),
    createEdge({
      id: 'edge_ex_performs',
      kind: 'performs',
      from: { _tag: 'structure', id: setaeId },
      to: { _tag: 'function', id: adhesionId },
      createdAt: 0,
    }),
    createEdge({
      id: 'edge_ex_via',
      kind: 'via',
      from: { _tag: 'function', id: adhesionId },
      to: { _tag: 'mechanism', id: vdwId },
      createdAt: 0,
    }),
    createEdge({
      id: 'edge_ex_inspires',
      kind: 'inspires',
      from: { _tag: 'mechanism', id: vdwId },
      to: { _tag: 'analog', id: analogId },
      createdAt: 0,
    }),
    createEdge({
      id: 'edge_ex_depicts_org',
      kind: 'depicts',
      from: { _tag: 'card', id: geckoCardId },
      to: { _tag: 'organism', id: geckoId },
      createdAt: 0,
    }),
    createEdge({
      id: 'edge_ex_depicts_str',
      kind: 'depicts',
      from: { _tag: 'card', id: geckoCardId },
      to: { _tag: 'structure', id: setaeId },
      createdAt: 0,
    }),
  ],
  events: [
    geckoCreated.event,
    lotusCreated.event,
    scaleCreated.event,
    analogCreated.event,
  ],
}

export const EXAMPLE_CARDS: ReadonlyArray<CardView> = (() => {
  const snapshot = {
    ...emptySnapshot(),
    tags: EXAMPLE_FRAGMENT.tags ?? [],
    questions: EXAMPLE_FRAGMENT.questions ?? [],
    cards: EXAMPLE_FRAGMENT.cards ?? [],
  }
  return snapshot.cards.map((card) => hydrateCard(snapshot, card))
})()

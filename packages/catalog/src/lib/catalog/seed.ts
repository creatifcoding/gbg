import { Schema } from 'effect'
import { createAnalog } from './entity/analog-entity'
import { createSpecimen } from './entity/specimen-entity'
import { createEdge } from './entity/edge-entity'
import { emptySnapshot } from './models/catalog-snapshot'
import { hydrateSpecimen, type SpecimenView } from './models/specimen-view'
import type { ExampleFragment } from './models/catalog-snapshot'
import { decodeBioFunction } from './schemas/function'
import { decodeMechanism } from './schemas/mechanism'
import { decodeObservation } from './schemas/observation'
import { decodeOrganism } from './schemas/organism'
import { decodeStructure } from './schemas/structure'
import { decodeTag } from './schemas/tag'
import { decodeQuestion } from './schemas/question'
import {
  AnalogId,
  FunctionId,
  MechanismId,
  ObservationId,
  OrganismId,
  QuestionId,
  SpecimenId,
  StructureId,
  TagId,
} from './schemas/identifiers'

const EXAMPLE_BANNER =
  'EXAMPLE SPECIMEN. Synthetic UI fixture. Not a paper, not a citation, not a result.'

const geckoId = Schema.decodeUnknownSync(SpecimenId)('ex_gecko_toe')
const lotusId = Schema.decodeUnknownSync(SpecimenId)('ex_lotus_leaf')
const scaleId = Schema.decodeUnknownSync(SpecimenId)('ex_unknown_scale')
const geckoObsId = Schema.decodeUnknownSync(ObservationId)('obs_ex_gecko_toe')
const lotusObsId = Schema.decodeUnknownSync(ObservationId)('obs_ex_lotus_leaf')
const scaleObsId = Schema.decodeUnknownSync(ObservationId)('obs_ex_unknown_scale')
const analogId = Schema.decodeUnknownSync(AnalogId)('ex_gecko_tape')
const geckoOrgId = Schema.decodeUnknownSync(OrganismId)('org_ex_gecko')
const setaeId = Schema.decodeUnknownSync(StructureId)('str_ex_setae')
const adhesionId = Schema.decodeUnknownSync(FunctionId)('fn_ex_adhesion')
const vdwId = Schema.decodeUnknownSync(MechanismId)('mech_ex_vdw')

const tagAdhesion = decodeTag({
  id: Schema.decodeUnknownSync(TagId)('tag_adhesion'),
  slug: 'adhesion',
})
const tagSetae = decodeTag({
  id: Schema.decodeUnknownSync(TagId)('tag_setae'),
  slug: 'setae',
})
const tagExample = decodeTag({
  id: Schema.decodeUnknownSync(TagId)('tag_example'),
  slug: 'example',
})
const tagWetting = decodeTag({
  id: Schema.decodeUnknownSync(TagId)('tag_wetting'),
  slug: 'wetting',
})
const tagLotus = decodeTag({
  id: Schema.decodeUnknownSync(TagId)('tag_lotus'),
  slug: 'lotus',
})
const tagDenticle = decodeTag({
  id: Schema.decodeUnknownSync(TagId)('tag_denticle'),
  slug: 'denticle',
})
const tagDrag = decodeTag({
  id: Schema.decodeUnknownSync(TagId)('tag_drag'),
  slug: 'drag',
})

const geckoCreated = createSpecimen(
  {
    id: geckoId,
    kind: 'picture',
    claim: 'This gecko toe pad, dumped before the analog is designed.',
    organismGuess: { label: 'Tokay gecko', guess: true },
    structureGuess: { label: 'setae', guess: true },
    locality: 'captive enclosure',
    observedAt: 'example fixture',
    tagIds: [tagAdhesion.id, tagSetae.id, tagExample.id],
    questionIds: [
      Schema.decodeUnknownSync(QuestionId)('q_ex_gecko_0'),
      Schema.decodeUnknownSync(QuestionId)('q_ex_gecko_1'),
    ],
    observationIds: [geckoObsId],
    example: true,
  },
  0,
)

const lotusCreated = createSpecimen(
  {
    id: lotusId,
    kind: 'dossier',
    claim: 'This lotus leaf, parked until wetting is mapped.',
    organismGuess: { label: 'Nelumbo nucifera', guess: true },
    structureGuess: { label: 'leaf surface', guess: true },
    locality: null,
    observedAt: null,
    tagIds: [tagWetting.id, tagLotus.id, tagExample.id],
    questionIds: [Schema.decodeUnknownSync(QuestionId)('q_ex_lotus_0')],
    observationIds: [lotusObsId],
    example: true,
  },
  0,
)

const scaleCreated = createSpecimen(
  {
    id: scaleId,
    kind: 'picture',
    claim: 'This scale photo. Drag-reduction guess only.',
    organismGuess: null,
    structureGuess: { label: 'denticle', guess: true },
    locality: null,
    observedAt: null,
    tagIds: [tagDenticle.id, tagDrag.id, tagExample.id],
    questionIds: [Schema.decodeUnknownSync(QuestionId)('q_ex_scale_0')],
    observationIds: [scaleObsId],
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

function withBody(
  created: ReturnType<typeof createSpecimen>,
  status: 'raw' | 'filed' | 'working' | 'dead',
) {
  return {
    ...created.specimen,
    status,
    body: EXAMPLE_BANNER,
  }
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
      id: Schema.decodeUnknownSync(QuestionId)('q_ex_gecko_0'),
      specimenId: geckoId,
      text: 'Is this setal contact or claw hooking?',
    }),
    decodeQuestion({
      id: Schema.decodeUnknownSync(QuestionId)('q_ex_gecko_1'),
      specimenId: geckoId,
      text: 'What surface was the toe on?',
    }),
    decodeQuestion({
      id: Schema.decodeUnknownSync(QuestionId)('q_ex_lotus_0'),
      specimenId: lotusId,
      text: 'Papillae scale still unknown. Guess only.',
    }),
    decodeQuestion({
      id: Schema.decodeUnknownSync(QuestionId)('q_ex_scale_0'),
      specimenId: scaleId,
      text: 'Shark denticle or something else?',
    }),
  ],
  specimens: [
    withBody(geckoCreated, 'raw'),
    withBody(lotusCreated, 'working'),
    withBody(scaleCreated, 'filed'),
  ],
  observations: [
    decodeObservation({
      id: geckoObsId,
      specimenId: geckoId,
      kind: 'picture',
      note: '',
      attachmentIds: [],
      createdAt: 0,
    }),
    decodeObservation({
      id: lotusObsId,
      specimenId: lotusId,
      kind: 'dossier',
      note: '',
      attachmentIds: [],
      createdAt: 0,
    }),
    decodeObservation({
      id: scaleObsId,
      specimenId: scaleId,
      kind: 'picture',
      note: '',
      attachmentIds: [],
      createdAt: 0,
    }),
  ],
  organisms: [
    decodeOrganism({
      id: geckoOrgId,
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
      id: 'edge_ex_obs_gecko',
      kind: 'observation-of',
      from: { _tag: 'observation', id: geckoObsId },
      to: { _tag: 'specimen', id: geckoId },
      createdAt: 0,
    }),
    createEdge({
      id: 'edge_ex_obs_lotus',
      kind: 'observation-of',
      from: { _tag: 'observation', id: lotusObsId },
      to: { _tag: 'specimen', id: lotusId },
      createdAt: 0,
    }),
    createEdge({
      id: 'edge_ex_obs_scale',
      kind: 'observation-of',
      from: { _tag: 'observation', id: scaleObsId },
      to: { _tag: 'specimen', id: scaleId },
      createdAt: 0,
    }),
    createEdge({
      id: 'edge_ex_identified',
      kind: 'identified-as',
      from: { _tag: 'specimen', id: geckoId },
      to: { _tag: 'organism', id: geckoOrgId },
      createdAt: 0,
    }),
    createEdge({
      id: 'edge_ex_exhibits',
      kind: 'exhibits',
      from: { _tag: 'specimen', id: geckoId },
      to: { _tag: 'structure', id: setaeId },
      createdAt: 0,
    }),
    createEdge({
      id: 'edge_ex_org_exhibits',
      kind: 'exhibits',
      from: { _tag: 'organism', id: geckoOrgId },
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
      id: 'edge_ex_specimen_inspires',
      kind: 'inspires',
      from: { _tag: 'specimen', id: geckoId },
      to: { _tag: 'analog', id: analogId },
      createdAt: 0,
    }),
    createEdge({
      id: 'edge_ex_depicts_org',
      kind: 'depicts',
      from: { _tag: 'specimen', id: geckoId },
      to: { _tag: 'organism', id: geckoOrgId },
      createdAt: 0,
    }),
    createEdge({
      id: 'edge_ex_depicts_str',
      kind: 'depicts',
      from: { _tag: 'specimen', id: geckoId },
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

export const EXAMPLE_SPECIMENS: ReadonlyArray<SpecimenView> = (() => {
  const snapshot = {
    ...emptySnapshot(),
    tags: EXAMPLE_FRAGMENT.tags ?? [],
    questions: EXAMPLE_FRAGMENT.questions ?? [],
    specimens: EXAMPLE_FRAGMENT.specimens ?? [],
    observations: EXAMPLE_FRAGMENT.observations ?? [],
  }
  return snapshot.specimens.map((specimen) => hydrateSpecimen(snapshot, specimen))
})()

import { decodeCard, type CatalogCard as CatalogCardType } from './schema'

const EXAMPLE_BANNER =
  'EXAMPLE CARD. Synthetic UI fixture. Not a paper, not a citation, not a result.'

export const EXAMPLE_CARDS: ReadonlyArray<CatalogCardType> = [
  decodeCard({
    id: 'ex_gel_lane',
    kind: 'picture',
    status: 'raw',
    claim: 'Gel photo dumped before any lane assignment.',
    tags: ['gel', 'western', 'example'],
    organism: { _tag: 'OrganismUnknown' },
    questions: ['Which sample is lane 3?', 'What antibody was used?'],
    notes: EXAMPLE_BANNER,
    attachments: [],
    example: true,
    createdAt: 0,
    updatedAt: 0,
  }),
  decodeCard({
    id: 'ex_protocol_note',
    kind: 'note',
    status: 'working',
    claim: 'Fixation time for the organoid slice is still undecided.',
    tags: ['organoid', 'fixation', 'example'],
    organism: { _tag: 'OrganismKnown', label: 'human iPSC organoid' },
    questions: ['PFA 15 min or 30 min at 4C?'],
    notes: EXAMPLE_BANNER,
    attachments: [],
    example: true,
    createdAt: 0,
    updatedAt: 0,
  }),
  decodeCard({
    id: 'ex_kit_insert',
    kind: 'artifact',
    status: 'filed',
    claim: 'Vendor kit insert parked until the lot number is written down.',
    tags: ['kit', 'lot', 'example'],
    organism: { _tag: 'OrganismUnknown' },
    questions: ['What lot arrived on the bench?'],
    notes: EXAMPLE_BANNER,
    attachments: [],
    example: true,
    createdAt: 0,
    updatedAt: 0,
  }),
]

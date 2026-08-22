/**
 * Composition IR for the locked Workbench HTML
 * (docs/variant/9263d787-0811-440f-8822-f31ee93b56a8.html).
 * Syntactic fragments (head, scripts, styles, text-only gaps) are omitted.
 * Labels point at the nearest semantic ancestor, not their wrapper span.
 *
 * @module @tmnl/specimendb/ui
 */

export type CompositionRole =
  | 'landmark'
  | 'pattern'
  | 'styling'
  | 'label'
  | 'well';

export type CompositionPattern = 'card' | 'property-row' | 'section';

export type CompositionNode = {
  readonly vid: string;
  readonly name?: string;
  readonly role: CompositionRole;
  readonly stylingOnly?: true;
  readonly landmark?: true;
  readonly pattern?: CompositionPattern;
  readonly labelOf?: string;
  readonly children?: readonly CompositionNode[];
};

export type BoundaryConfidence = 'high' | 'medium' | 'low';

export type AcceptedBoundary = {
  readonly name: string;
  readonly sourceVid: string;
  readonly responsibility: string;
  readonly evidence: string;
  readonly rejectedAlternatives: readonly string[];
  readonly proposedProps: readonly string[];
  readonly confidence: BoundaryConfidence;
};

export type RefusedBoundary = {
  readonly name: string;
  readonly sourceVid: string;
  readonly reason: string;
};

export const WORKBENCH_COMPOSITION = {
  vid: '12',
  role: 'styling',
  stylingOnly: true,
  children: [
    {
      vid: '13',
      role: 'landmark',
      landmark: true,
      name: 'Rail',
      children: [
        {
          vid: '14',
          name: 'WorkbenchHeader',
          role: 'landmark',
          landmark: true,
          children: [
            { vid: '17', role: 'label', labelOf: '14' },
            { vid: '19', role: 'styling', stylingOnly: true },
          ],
        },
        {
          vid: '21',
          name: 'WorkbenchCardList',
          role: 'pattern',
          pattern: 'card',
          children: [
            {
              vid: '22',
              name: 'WorkbenchCard',
              role: 'pattern',
              pattern: 'card',
              children: [
                { vid: '24', role: 'well', name: 'AccessionId' },
                { vid: '25', role: 'well', name: 'Status' },
                { vid: '28', role: 'well', name: 'Media' },
                {
                  vid: '31',
                  role: 'well',
                  name: 'MediaCaption',
                  labelOf: '28',
                },
                { vid: '32', role: 'well', name: 'Claim' },
                { vid: '36', role: 'well', name: 'Locality' },
                { vid: '38', role: 'well', name: 'Tag' },
                { vid: '39', role: 'well', name: 'Tag' },
                { vid: '40', role: 'well', name: 'Tag' },
              ],
            },
            {
              vid: '41',
              name: 'WorkbenchCard',
              role: 'pattern',
              pattern: 'card',
            },
            {
              vid: '60',
              name: 'WorkbenchCard',
              role: 'pattern',
              pattern: 'card',
            },
          ],
        },
      ],
    },
    {
      vid: '136',
      role: 'landmark',
      landmark: true,
      name: 'Main',
      children: [
        {
          vid: '137',
          name: 'WorkbenchIntakeChrome',
          role: 'landmark',
          landmark: true,
          children: [{ vid: '140', role: 'label', labelOf: '137' }],
        },
        {
          vid: '141',
          role: 'styling',
          stylingOnly: true,
          children: [
            {
              vid: '142',
              name: 'WorkbenchStage',
              role: 'landmark',
              landmark: true,
              children: [
                { vid: '146', role: 'well', name: 'StageId' },
                { vid: '147', role: 'well', name: 'StageClaim' },
                { vid: '149', role: 'styling', stylingOnly: true },
                { vid: '150', role: 'styling', stylingOnly: true },
                {
                  vid: '151',
                  name: 'WorkbenchViewport',
                  role: 'landmark',
                  landmark: true,
                  children: [
                    { vid: '152', role: 'label', labelOf: '151' },
                    { vid: '153', role: 'label', labelOf: '151' },
                    { vid: '154', role: 'label', labelOf: '151' },
                    { vid: '156', role: 'well', name: 'ViewportReadout' },
                  ],
                },
              ],
            },
            {
              vid: '169',
              name: 'WorkbenchPropertiesLog',
              role: 'landmark',
              landmark: true,
              children: [
                { vid: '171', role: 'label', labelOf: '169' },
                {
                  vid: '173',
                  name: 'WorkbenchClassification',
                  role: 'pattern',
                  pattern: 'section',
                  children: [
                    { vid: '175', role: 'label', labelOf: '173' },
                    {
                      vid: '178',
                      name: 'WorkbenchPropertyRow',
                      role: 'pattern',
                      pattern: 'property-row',
                    },
                    {
                      vid: '181',
                      name: 'WorkbenchPropertyRow',
                      role: 'pattern',
                      pattern: 'property-row',
                    },
                    {
                      vid: '184',
                      name: 'WorkbenchPropertyRow',
                      role: 'pattern',
                      pattern: 'property-row',
                    },
                    {
                      vid: '187',
                      name: 'WorkbenchPropertyRow',
                      role: 'pattern',
                      pattern: 'property-row',
                    },
                  ],
                },
                {
                  vid: '190',
                  name: 'WorkbenchStructuralMetrics',
                  role: 'pattern',
                  pattern: 'section',
                  children: [
                    { vid: '192', role: 'label', labelOf: '190' },
                    {
                      vid: '195',
                      name: 'WorkbenchPropertyRow',
                      role: 'pattern',
                      pattern: 'property-row',
                    },
                    {
                      vid: '198',
                      name: 'WorkbenchPropertyRow',
                      role: 'pattern',
                      pattern: 'property-row',
                    },
                    {
                      vid: '201',
                      name: 'WorkbenchPropertyRow',
                      role: 'pattern',
                      pattern: 'property-row',
                    },
                    {
                      vid: '204',
                      name: 'WorkbenchPropertyRow',
                      role: 'pattern',
                      pattern: 'property-row',
                    },
                    { vid: '209', role: 'well', name: 'MetricsNote' },
                  ],
                },
                {
                  vid: '210',
                  name: 'WorkbenchObservationLog',
                  role: 'pattern',
                  pattern: 'section',
                  children: [
                    { vid: '212', role: 'label', labelOf: '210' },
                    { vid: '215', role: 'well', name: 'Observation' },
                    { vid: '216', role: 'well', name: 'Observation' },
                    { vid: '218', role: 'label', labelOf: '217' },
                    { vid: '219', role: 'well', name: 'CreatedAt' },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
} as const satisfies CompositionNode;

export const EMPTY_RAIL_CARD_VIDS = ['22', '41', '60'] as const;

export const ACCEPTED_BOUNDARIES: readonly AcceptedBoundary[] = [
  {
    name: 'WorkbenchHeader',
    sourceVid: '14',
    responsibility: 'Left-rail brand row. Chrome only.',
    evidence: 'aside header vid 14 with SpecimenDB // Core label vid 17',
    rejectedAlternatives: [
      'AppChrome shared shell',
      'split icon and title into kit parts',
    ],
    proposedProps: [],
    confidence: 'high',
  },
  {
    name: 'WorkbenchCardList',
    sourceVid: '21',
    responsibility:
      'Scroll well that repeats WorkbenchCard. Empty catalog draws three templates (vids 22, 41, 60) with empty wells.',
    evidence:
      'vid 21 overflow column. HTML repeats the vid 22 card at 41 and 60 in the lock viewport. Vids 79 and 98 are below-fold theater, not a fourth empty frame.',
    rejectedAlternatives: [
      'shared PhotoRail from DossierView',
      'virtualized generic list',
    ],
    proposedProps: ['cards'],
    confidence: 'high',
  },
  {
    name: 'WorkbenchCard',
    sourceVid: '22',
    responsibility: 'One rail card. Empty chrome or one specimen projection.',
    evidence:
      'vid 22 card with id, Status, Media, claim, Locality, three tag wells',
    rejectedAlternatives: [
      'AnalogCard kit',
      'DossierThumb shared card',
      'generic CatalogCard',
    ],
    proposedProps: ['view', 'selected', 'onSelect', 'onPromote'],
    confidence: 'high',
  },
  {
    name: 'WorkbenchIntakeChrome',
    sourceVid: '137',
    responsibility: 'Look-only intake. kind=chrome. No intake-file.',
    evidence:
      'vid 137 dashed drop with Initiate Intake Sequence copy. Phase 1 cut Intake as chrome.',
    rejectedAlternatives: [
      'Intake kind=live',
      'shared IntakeDrop zone',
      'file input behind the well',
    ],
    proposedProps: [],
    confidence: 'high',
  },
  {
    name: 'WorkbenchStage',
    sourceVid: '142',
    responsibility:
      'Selected record column: id, claim, inert Export DB / Run Sim, viewport.',
    evidence: 'vid 142 stage column holds header vid 144 and viewport vid 151',
    rejectedAlternatives: ['DossierView.Body', 'generic detail pane'],
    proposedProps: ['view'],
    confidence: 'high',
  },
  {
    name: 'WorkbenchViewport',
    sourceVid: '151',
    responsibility:
      'VIEWPORT_XZ chrome. Readout stays empty. No invented MAG or R: values.',
    evidence: 'vid 151 corner-brackets well. vid 156 was theater R: 0.992.',
    rejectedAlternatives: [
      'bind Media bytes as a 3D viewer',
      'restore MAG: 400x',
    ],
    proposedProps: [],
    confidence: 'high',
  },
  {
    name: 'WorkbenchPropertiesLog',
    sourceVid: '169',
    responsibility:
      'Right column that hosts classification, metrics, and observation sections.',
    evidence: 'vid 169 with Properties Log label vid 171',
    rejectedAlternatives: [
      'shared inspector kit',
      'collapse into one definition list',
    ],
    proposedProps: ['view'],
    confidence: 'high',
  },
  {
    name: 'WorkbenchClassification',
    sourceVid: '173',
    responsibility:
      'Phylum / Class / Order / Family rows. Taxon rank/name only.',
    evidence: 'vid 173 section. HTML values were theater Chordata/Mammalia.',
    rejectedAlternatives: [
      'Accession TAXONOMY_DATA table',
      'infer ranks from claim text',
    ],
    proposedProps: ['taxon'],
    confidence: 'high',
  },
  {
    name: 'WorkbenchStructuralMetrics',
    sourceVid: '190',
    responsibility:
      'Tensile / density / hardness / overlap rows stay empty unless a matching component exists. Note well may take Used, Generated, or Structure text.',
    evidence: 'vid 190 section. Numeric values in the HTML were theater.',
    rejectedAlternatives: [
      'fill Tensile_Str from Structure.text',
      'invent MPa / g/cm³',
    ],
    proposedProps: ['note'],
    confidence: 'medium',
  },
  {
    name: 'WorkbenchObservationLog',
    sourceVid: '210',
    responsibility: 'Two observation wells plus LAST_UPDATED / createdAt.',
    evidence:
      'vid 215 and 216 paragraphs, vid 219 clock. HTML copy was theater.',
    rejectedAlternatives: ['Observer log from DossierView', 'fake 14m AGO'],
    proposedProps: ['observations', 'createdAt'],
    confidence: 'high',
  },
  {
    name: 'WorkbenchPropertyRow',
    sourceVid: '178',
    responsibility:
      'Label/value row used by classification and metrics. Not a split pair of components.',
    evidence: 'Repeated flex justify-between rows starting at vid 178',
    rejectedAlternatives: [
      'separate Label and Value components',
      'shared form Field kit',
    ],
    proposedProps: ['label', 'value', 'rowVid', 'labelVid', 'valueVid'],
    confidence: 'high',
  },
] as const;

export const REFUSED_BOUNDARIES: readonly RefusedBoundary[] = [
  {
    name: 'DocumentShell',
    sourceVid: '0',
    reason:
      'html/head/body and the imported-workbench mount are page chrome, not a Workbench region.',
  },
  {
    name: 'FlexSplit',
    sourceVid: '12',
    reason:
      'vid 12 and vid 141 are layout flex splits. No responsibility beyond placing aside and main.',
  },
  {
    name: 'SpacingWrapper',
    sourceVid: '15',
    reason:
      'gap/flex wrappers (15, 18, 23, 33, 145, 148, 172) are spacing only.',
  },
  {
    name: 'LabelControlSplit',
    sourceVid: '179',
    reason:
      'A property label and its value are one WorkbenchPropertyRow. Do not name vid 179 and vid 180 as siblings.',
  },
  {
    name: 'W7Pane',
    sourceVid: 'unreachable',
    reason:
      'W7 lives on LabEntity kind=activity. The existing Observation Log is the nearest source well, so no separate W7 pane is accepted.',
  },
] as const;

export const W7_BOUNDARY = {
  name: 'W7Pane',
  status: 'no-separate-pane',
  sourceVid: 'unreachable',
  reason:
    'W7 lines fill the existing Observation Log when provenance is supplied. The tree rejects a new W7 pane.',
} as const;

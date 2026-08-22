/**
 * Mint in-repo lab files as catalog entities. Declaration is cheap (kind + type).
 * Components besides Kind / Type / Bytes stay gated to systems that actually ran.
 * Does not invent a specimen, GPS, taxon, or SKU.
 * Does not rewrite terrarium/MANIFEST.sha256 (ADR-003).
 *
 * @module @tmnl/specimendb/adapters/cad01-seed
 */

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as Effect from 'effect/Effect';
import { CatalogError, EntityNotFoundError, ActivityAppendError } from '../schemas/errors.js';
import { trustEntityRef, type EntityRef } from '../schemas/identifiers.js';
import {
  decodeLabEntity,
  type EntityKind,
  type EntityType,
  type LabEntity,
} from '../schemas/provenance.js';
import type { CatalogRecord } from '../schemas/entity.js';
import type { ContentAddress } from '../schemas/provenance.js';
import { EntityState } from '../state/EntityState.js';
import type { EntityMint } from '../state/EntityState.js';
import { appendActivity, declarationComponents } from './activity.js';
import { seedGeneratingNote } from './generating-note.js';

/** Commit that added the terrarium / analog / contract trees on this ref. */
export const CAD01_TREE_SHA = '60abe9434a4236baf17de2e9e6569b1b8a734298';
const CAD01_REV = CAD01_TREE_SHA.slice(0, 8);
export const CAD01_COMMITTED_AT = '2026-08-21T01:58:40Z';

const TERRARIUM = 'projects/biomemetics/labs/mantis/terrarium';
const MANTIS = 'projects/biomemetics/labs/mantis';
export const CAD01_STEP_PATH =
  `${TERRARIUM}/cad/src/frame/exports/MANTIS-TERRARIUM-FRAME-RAIL-B20-DRAFT.step` as const;
const MANIFEST_PATH = `${TERRARIUM}/MANIFEST.sha256`;
const SCHEMATICS = `${TERRARIUM}/schematics`;

export const CAD01_SOLID_REF = trustEntityRef(`gbg:step:CAD01@${CAD01_REV}`);
export const CAD01_EXPORT_REF = trustEntityRef(`gbg:activity:export-cad01@${CAD01_REV}`);
export const CAD01_PROJECT_REF = trustEntityRef('gbg:activity:project-cad01@pr58');
export const CAD01_PDF_REF = trustEntityRef('gbg:sheet:schematics-pdf@pr58');

/**
 * Sheet type from SHEETS.md. S08/S09 are diagram. S07 is topology, not HLR.
 * Honesty is not attached on mint (gated). Do not upgrade.
 */
const SHEETS: ReadonlyArray<{
  readonly local: string;
  readonly file: string;
  readonly type: EntityType;
}> = [
  { local: 'S00', file: 'S00-cover.svg', type: 'projected' },
  { local: 'S01', file: 'S01-ortho.svg', type: 'projected' },
  { local: 'S02', file: 'S02-exploded.svg', type: 'projected' },
  { local: 'S03', file: 'S03-blocks.svg', type: 'projected' },
  { local: 'S04', file: 'S04-rail-strip.svg', type: 'projected' },
  { local: 'S05', file: 'S05-carriage-mech.svg', type: 'projected' },
  { local: 'S06', file: 'S06-latch-binder.svg', type: 'projected' },
  { local: 'S07', file: 'S07-camera-load.svg', type: 'diagram' },
  { local: 'S08', file: 'S08-electrical.svg', type: 'diagram' },
  { local: 'S09', file: 'S09-particle-brick.svg', type: 'diagram' },
  { local: 'S10', file: 'S10-husbandry.svg', type: 'projected' },
  { local: 'S11', file: 'S11-details.svg', type: 'projected' },
];

export const CAD01_SHEET_REFS: ReadonlyArray<EntityRef> = SHEETS.map((sheet) =>
  trustEntityRef(`gbg:sheet:${sheet.local}@pr58`),
);

const HLR_SHEET_LOCALS = new Set(['S00', 'S01', 'S02', 'S03', 'S04', 'S05', 'S06']);

export const CAD01_HLR_SHEET_REFS: ReadonlyArray<EntityRef> = SHEETS.filter((sheet) =>
  HLR_SHEET_LOCALS.has(sheet.local),
).map((sheet) => trustEntityRef(`gbg:sheet:${sheet.local}@pr58`));

const PART_STEPS: ReadonlyArray<{ readonly local: string; readonly path: string }> = [
  { local: 'B01', path: `${TERRARIUM}/cad/src/frame/exports/B01-corner-block.step` },
  { local: 'B02', path: `${TERRARIUM}/cad/src/frame/exports/B02-edge-250.step` },
  { local: 'B03', path: `${TERRARIUM}/cad/src/frame/exports/B03-splice-250-500.step` },
  { local: 'B04', path: `${TERRARIUM}/cad/src/frame/exports/B04-cassette-retainer.step` },
  { local: 'B10', path: `${TERRARIUM}/cad/src/frame/exports/B10-ceiling-mesh-frame.step` },
  { local: 'B05', path: `${TERRARIUM}/cad/src/boundary/exports/B05-view-cassette.step` },
  { local: 'B06', path: `${TERRARIUM}/cad/src/boundary/exports/B06-front-door.step` },
  { local: 'B07', path: `${TERRARIUM}/cad/src/boundary/exports/B07-door-labyrinth.step` },
  { local: 'B12', path: `${TERRARIUM}/cad/src/boundary/exports/B12-low-intake-vent.step` },
  { local: 'B13', path: `${TERRARIUM}/cad/src/boundary/exports/B13-high-exhaust-vent.step` },
  { local: 'B14', path: `${TERRARIUM}/cad/src/boundary/exports/B14-false-bottom.step` },
  { local: 'B20', path: `${TERRARIUM}/cad/src/boundary/exports/B20-animal-wet-barrier.step` },
  { local: 'B18-250', path: `${TERRARIUM}/cad/src/rail/exports/B18-rail-channel-250.step` },
  { local: 'B18-500', path: `${TERRARIUM}/cad/src/rail/exports/B18-rail-channel-500.step` },
  { local: 'B51', path: `${TERRARIUM}/cad/src/rail/exports/B51-end-stop.step` },
  { local: 'B52-250', path: `${TERRARIUM}/cad/src/rail/exports/B52-access-guard-250.step` },
  { local: 'B52-500', path: `${TERRARIUM}/cad/src/rail/exports/B52-access-guard-500.step` },
];

const PROFILE_SHEETS: ReadonlyArray<{ readonly local: string; readonly path: string }> = [
  {
    local: 'B05-nominal',
    path: `${TERRARIUM}/cad/src/boundary/exports/profiles/B05-view-cassette-nominal.svg`,
  },
  {
    local: 'B05-kerf-0.15',
    path: `${TERRARIUM}/cad/src/boundary/exports/profiles/B05-view-cassette-kerf-0.15-src-12f9dd48bdc3.svg`,
  },
  {
    local: 'B06-nominal',
    path: `${TERRARIUM}/cad/src/boundary/exports/profiles/B06-front-door-nominal.svg`,
  },
  {
    local: 'B06-kerf-0.15',
    path: `${TERRARIUM}/cad/src/boundary/exports/profiles/B06-front-door-kerf-0.15-src-12f9dd48bdc3.svg`,
  },
];

const REPORTS: ReadonlyArray<{
  readonly local: string;
  readonly type: EntityType;
  readonly path: string;
}> = [
  {
    local: 'occt-export',
    type: 'occt-export',
    path: `${TERRARIUM}/cad/src/frame/exports/occt-export-report.json`,
  },
  {
    local: 'frame-geometry',
    type: 'geometry',
    path: `${TERRARIUM}/simulations/mechanical/frame/reports/geometry-report.json`,
  },
  {
    local: 'frame-step-roundtrip',
    type: 'step-roundtrip',
    path: `${TERRARIUM}/simulations/mechanical/frame/reports/step-roundtrip.json`,
  },
  {
    local: 'mechanism-geometry',
    type: 'geometry',
    path: `${TERRARIUM}/simulations/mechanical/mechanism/reports/geometry-report.json`,
  },
  {
    local: 'mechanism-kinematic',
    type: 'kinematic',
    path: `${TERRARIUM}/simulations/mechanical/mechanism/reports/kinematic-report.json`,
  },
];

const CONTRACTS: ReadonlyArray<{
  readonly local: string;
  readonly type: EntityType;
  readonly path: string;
}> = [
  { local: 'params', type: 'params', path: `${TERRARIUM}/params.json` },
  { local: 'bus', type: 'bus', path: `${TERRARIUM}/bus.json` },
  {
    local: 'ee-interface',
    type: 'interface',
    path: `${TERRARIUM}/ee/kicad/contracts/ee-interface-v1.json`,
  },
  { local: 'interfaces', type: 'interface', path: `${MANTIS}/contracts/interfaces.json` },
];

const CATALOGS: ReadonlyArray<{
  readonly local: string;
  readonly type: EntityType;
  readonly path: string;
}> = [
  { local: 'analogs', type: 'analog', path: `${MANTIS}/analogs/catalog.json` },
  { local: 'mechanisms', type: 'mechanism', path: `${MANTIS}/mechanisms/catalog.json` },
  { local: 'functions', type: 'function', path: `${MANTIS}/mechanisms/functions.json` },
  { local: 'morphology', type: 'structure', path: `${MANTIS}/morphology/catalog.json` },
  { local: 'observations', type: 'observation', path: `${MANTIS}/observations/catalog.json` },
];

export type DeclaredEntity = {
  readonly mint: EntityMint;
  readonly bytes: ContentAddress;
};

const repoRootFromHere = (): string =>
  resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

const sha256File = (abs: string): string =>
  createHash('sha256').update(readFileSync(abs)).digest('hex');

const readManifestDigests = (abs: string): ReadonlyMap<string, string> => {
  const out = new Map<string, string>();
  for (const line of readFileSync(abs, 'utf8').split('\n')) {
    if (line.length === 0) continue;
    const hash = line.slice(0, 64);
    const path = line.slice(66);
    if (hash.length === 64 && path.length > 0) out.set(path, hash);
  }
  return out;
};

const declareFile = (
  repoRoot: string,
  input: {
    readonly refKind: string;
    readonly local: string;
    readonly rev: string;
    readonly kind: EntityKind;
    readonly type: EntityType;
    readonly path: string;
    readonly manifestKey?: string;
    readonly manifest?: ReadonlyMap<string, string>;
  },
): DeclaredEntity => {
  const abs = join(repoRoot, input.path);
  const digest = sha256File(abs);
  if (input.manifestKey !== undefined && input.manifest !== undefined) {
    const recorded = input.manifest.get(input.manifestKey);
    if (recorded === undefined) {
      throw new Error(`MANIFEST.sha256 has no digest for ${input.manifestKey}`);
    }
    if (recorded !== digest) {
      throw new Error(`digest mismatch for ${input.manifestKey}`);
    }
  }
  return {
    mint: {
      id: trustEntityRef(`gbg:${input.refKind}:${input.local}@${input.rev}`),
      kind: input.kind,
      type: input.type,
      createdAt: CAD01_COMMITTED_AT,
    },
    bytes: { gitSha: CAD01_TREE_SHA, digest, path: input.path },
  };
};

const discoverStepFiles = (dir: string, repoRoot: string): ReadonlyArray<string> => {
  const abs = join(repoRoot, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs)
    .filter((name) => name.endsWith('.step'))
    .map((name) => `${dir}/${name}`);
};

const optionalCube = (repoRoot: string): DeclaredEntity | undefined => {
  const candidates = [
    `${MANTIS}/evidence/runs/environment/fixtures/review/cube.step`,
    `${MANTIS}/evidence/fixtures/cube.step`,
    `${MANTIS}/evidence/cube.step`,
    `${MANTIS}/evidence/fixtures/corpus/cube.step`,
  ];
  const path = candidates.find((rel) => existsSync(join(repoRoot, rel)));
  if (path === undefined) return undefined;
  return declareFile(repoRoot, {
    refKind: 'step',
    local: 'cube',
    rev: CAD01_REV,
    kind: 'solid',
    type: 'fixture',
    path,
  });
};

const optionalCarriageBinder = (repoRoot: string): ReadonlyArray<DeclaredEntity> => {
  const out: Array<DeclaredEntity> = [];
  for (const dir of [
    `${TERRARIUM}/cad/src/carriage/exports`,
    `${TERRARIUM}/cad/src/binder/exports`,
  ]) {
    for (const path of discoverStepFiles(dir, repoRoot)) {
      const file = path.slice(path.lastIndexOf('/') + 1);
      const isAssembly = file.toLowerCase().includes('assembly');
      out.push(
        declareFile(repoRoot, {
          refKind: 'step',
          local: file.replace(/\.step$/i, ''),
          rev: CAD01_REV,
          kind: 'solid',
          type: isAssembly ? 'assembly' : 'part',
          path,
        }),
      );
    }
  }
  return out;
};

const optionalHtml = (repoRoot: string): ReadonlyArray<DeclaredEntity> => {
  const ui = join(repoRoot, 'packages/specimendb/src/ui');
  if (!existsSync(ui)) return [];
  return readdirSync(ui)
    .filter((name) => name.endsWith('.html'))
    .map((name) => {
      const local = name.toLowerCase().includes('accession')
        ? 'accession'
        : name.replace(/\.html$/i, '');
      return declareFile(repoRoot, {
        refKind: 'html',
        local,
        rev: CAD01_REV,
        kind: 'html',
        type: local === 'accession' ? 'accession' : 'variant',
        path: `packages/specimendb/src/ui/${name}`,
      });
    });
};

export const loadDeclaredEntities = (
  repoRoot: string = repoRootFromHere(),
): ReadonlyArray<DeclaredEntity> => {
  const manifest = readManifestDigests(join(repoRoot, MANIFEST_PATH));
  const out: Array<DeclaredEntity> = [];

  out.push(
    declareFile(repoRoot, {
      refKind: 'step',
      local: 'CAD01',
      rev: CAD01_REV,
      kind: 'solid',
      type: 'assembly',
      path: CAD01_STEP_PATH,
    }),
  );

  for (const part of PART_STEPS) {
    out.push(
      declareFile(repoRoot, {
        refKind: 'step',
        local: part.local,
        rev: CAD01_REV,
        kind: 'solid',
        type: 'part',
        path: part.path,
      }),
    );
  }

  const cube = optionalCube(repoRoot);
  if (cube !== undefined) out.push(cube);
  out.push(...optionalCarriageBinder(repoRoot));

  for (const sheet of SHEETS) {
    out.push(
      declareFile(repoRoot, {
        refKind: 'sheet',
        local: sheet.local,
        rev: 'pr58',
        kind: 'sheet',
        type: sheet.type,
        path: `${SCHEMATICS}/${sheet.file}`,
        manifestKey: `schematics/${sheet.file}`,
        manifest,
      }),
    );
  }

  out.push(
    declareFile(repoRoot, {
      refKind: 'sheet',
      local: 'schematics-pdf',
      rev: 'pr58',
      kind: 'sheet',
      type: 'projected',
      path: `${SCHEMATICS}/schematics.pdf`,
      manifestKey: 'schematics/schematics.pdf',
      manifest,
    }),
  );

  for (const profile of PROFILE_SHEETS) {
    out.push(
      declareFile(repoRoot, {
        refKind: 'sheet',
        local: profile.local,
        rev: CAD01_REV,
        kind: 'sheet',
        type: 'projected',
        path: profile.path,
      }),
    );
  }

  for (const report of REPORTS) {
    out.push(
      declareFile(repoRoot, {
        refKind: 'report',
        local: report.local,
        rev: CAD01_REV,
        kind: 'report',
        type: report.type,
        path: report.path,
      }),
    );
  }

  for (const contract of CONTRACTS) {
    out.push(
      declareFile(repoRoot, {
        refKind: 'contract',
        local: contract.local,
        rev: CAD01_REV,
        kind: 'contract',
        type: contract.type,
        path: contract.path,
      }),
    );
  }

  for (const catalog of CATALOGS) {
    out.push(
      declareFile(repoRoot, {
        refKind: 'catalog',
        local: catalog.local,
        rev: CAD01_REV,
        kind: 'catalog',
        type: catalog.type,
        path: catalog.path,
      }),
    );
  }

  out.push(...optionalHtml(repoRoot));
  return out;
};

export type Cad01Pack = {
  readonly solid: DeclaredEntity;
  readonly sheets: ReadonlyArray<DeclaredEntity>;
  readonly pdf: DeclaredEntity;
  readonly exportActivity: LabEntity;
  readonly activity: LabEntity;
  readonly declared: ReadonlyArray<DeclaredEntity>;
};

export const loadCad01Pack = (repoRoot: string = repoRootFromHere()): Cad01Pack => {
  const declared = loadDeclaredEntities(repoRoot);
  const solid = declared.find((row) => row.mint.id === CAD01_SOLID_REF);
  if (solid === undefined) {
    throw new Error('CAD-01 assembly STEP missing from declared set');
  }
  const sheets = CAD01_SHEET_REFS.map((id) => {
    const row = declared.find((item) => item.mint.id === id);
    if (row === undefined) throw new Error(`sheet ${id} missing from declared set`);
    return row;
  });
  const pdf = declared.find((row) => row.mint.id === CAD01_PDF_REF);
  if (pdf === undefined) {
    throw new Error('schematics.pdf missing from declared set');
  }

  const exportActivity = decodeLabEntity({
    _tag: 'LabEntity',
    ref: CAD01_EXPORT_REF,
    kind: 'activity',
    type: 'export',
    label: 'CAD-01 STEP export',
    class: 'theoretical',
    bytes: {
      gitSha: CAD01_TREE_SHA,
      path: `${TERRARIUM}/cad/src/frame/exports/occt-export-report.json`,
    },
    who: [
      {
        _tag: 'Agent',
        agentType: 'software',
        label: 'freecad-part-occt',
      },
    ],
    what: {
      used: [],
      generated: [CAD01_SOLID_REF],
    },
    when: {
      startedAt: CAD01_COMMITTED_AT,
      gitSha: CAD01_TREE_SHA,
    },
    where: 'unknown',
    why: '#20',
    how: 'freecad-part-occt',
    used: [],
    generated: [CAD01_SOLID_REF],
    wasAssociatedWith: [
      {
        _tag: 'Agent',
        agentType: 'software',
        label: 'freecad-part-occt',
      },
    ],
  });

  const generated = [...CAD01_HLR_SHEET_REFS];
  const activity = decodeLabEntity({
    _tag: 'LabEntity',
    ref: CAD01_PROJECT_REF,
    kind: 'activity',
    type: 'hlr',
    label: 'HLR/project CAD-01 sheets',
    class: 'theoretical',
    bytes: {
      gitSha: CAD01_TREE_SHA,
      path: `${TERRARIUM}/cad/generate_schematics.py`,
    },
    who: [
      {
        _tag: 'Agent',
        agentType: 'software',
        label: 'generate_schematics.py',
      },
    ],
    what: {
      used: [CAD01_SOLID_REF],
      generated,
    },
    when: {
      startedAt: CAD01_COMMITTED_AT,
      gitSha: CAD01_TREE_SHA,
    },
    where: 'unknown',
    why: '#58',
    how: 'generate_schematics.py',
    used: [CAD01_SOLID_REF],
    generated,
    wasAssociatedWith: [
      {
        _tag: 'Agent',
        agentType: 'software',
        label: 'generate_schematics.py',
      },
    ],
  });

  return { solid, sheets, pdf, exportActivity, activity, declared };
};

const seedDeclared = (
  declared: ReadonlyArray<DeclaredEntity>,
): Effect.Effect<ReadonlyArray<CatalogRecord>, CatalogError | EntityNotFoundError, EntityState> =>
  Effect.gen(function* () {
    const state = yield* EntityState;
    const records: Array<CatalogRecord> = [];
    for (const row of declared) {
      records.push(
        yield* state.ensure(row.mint, declarationComponents({
          kind: row.mint.kind,
          type: row.mint.type,
          bytes: row.bytes,
        })),
      );
    }
    return records;
  });

export const seedCad01Hlr = (): Effect.Effect<
  {
    readonly pack: Cad01Pack;
    readonly records: ReadonlyArray<CatalogRecord>;
    readonly exportActivity: CatalogRecord;
    readonly activity: CatalogRecord;
    readonly note: CatalogRecord;
  },
  CatalogError | EntityNotFoundError | ActivityAppendError,
  EntityState
> =>
  Effect.gen(function* () {
    const pack = yield* Effect.try({
      try: () => loadCad01Pack(),
      catch: (cause) =>
        new CatalogError({
          operation: 'loadCad01Pack',
          message: cause instanceof Error ? cause.message : String(cause),
          cause,
        }),
    });
    const records = yield* seedDeclared(pack.declared);
    const state = yield* EntityState;
    const exportActivity = yield* appendActivity(state, pack.exportActivity);
    const activity = yield* appendActivity(state, pack.activity);
    const generating = yield* seedGeneratingNote();
    return { pack, records, exportActivity, activity, note: generating.note };
  });

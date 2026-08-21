/**
 * Eat-file evidence: no-GPS JPEG → raw specimen, sidecar on disk, locality unknown.
 * Run: bun test/evidence-eat-file.ts
 */

import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as Effect from 'effect/Effect';
import * as RpcTest from 'effect/unstable/rpc/RpcTest';
import { jpegWithGps, jpegWithoutGps } from './fixtures.js';
import { layer } from '../src/layers.js';
import { catalogPgFromEnv } from '../src/repos/pg.js';
import { SpecimenRpcs } from '../src/rpc/SpecimenRpcs.js';
import { exifOf, localityOf, mediaOf, statusOf } from '../src/schemas/specimen.js';
import { specimenSurface } from '../src/surface.js';

const root = await mkdtemp(join(tmpdir(), 'specimendb-evidence-'));
const assetsRoot = join(root, 'assets');
const outDir = process.env['SPECIMENDB_EVIDENCE_DIR'] ?? join(root, 'evidence');
await mkdir(outDir, { recursive: true });

const report = await Effect.runPromise(
  Effect.scoped(
    Effect.gen(function* () {
      const client = yield* RpcTest.makeClient(SpecimenRpcs);
      const noGps = yield* client.Intake({
        bytes: jpegWithoutGps(),
        filename: 'field.jpg',
      });
      const withGps = yield* client.Intake({
        bytes: jpegWithGps(),
        filename: 'located.jpg',
      });
      const got = yield* client.Get({ specimenId: noGps.specimenId });
      const listed = yield* client.List();
      const sidecarPath = exifOf(noGps)?.sidecarPath;
      const sidecar = sidecarPath
        ? JSON.parse(yield* Effect.tryPromise(() => readFile(sidecarPath, 'utf8')))
        : null;
      return {
        catalogRoot: root,
        noGps: {
          specimenId: noGps.specimenId,
          status: statusOf(noGps),
          locality: localityOf(noGps),
          surface: specimenSurface(noGps),
          original: mediaOf(noGps)?.assetPath,
          sidecarPath,
          sidecar,
          getStatus: statusOf(got),
          getLocality: localityOf(got)?.state,
          listed: listed.some((s) => s.id === noGps.specimenId),
        },
        withGps: {
          specimenId: withGps.specimenId,
          status: statusOf(withGps),
          locality: localityOf(withGps),
          surface: specimenSurface(withGps),
        },
      };
    }),
  ).pipe(
    Effect.provide(
      layer({
        pg: catalogPgFromEnv(),
        assetsRoot,
      }),
    ),
  ),
);

const jsonPath = join(outDir, 'eat-file-evidence.json');
await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
console.log(`evidence json: ${jsonPath}`);

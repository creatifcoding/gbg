/**
 * Intake / Get / List over Postgres (`@effect/sql-pg`).
 * JPEG/HEIC without GPS file as raw, locality unknown, sidecar always written.
 */

import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as Effect from 'effect/Effect';
import * as RpcTest from 'effect/unstable/rpc/RpcTest';
import { heicWithoutGps, jpegWithGps, jpegWithoutGps } from './fixtures.js';
import { gpsFromExif, extractExifTags } from '../src/media/exif.js';
import { catalogPgFromEnv } from '../src/repos/pg.js';
import { exifOf, localityOf, localityStateOf, mediaOf, nextStatus, statusOf } from '../src/schemas/specimen.js';
import { specimenSurface } from '../src/surface.js';
import { layer } from '../src/layers.js';
import { SpecimenRpcs } from '../src/rpc/SpecimenRpcs.js';

const pgUnavailable = (cause: unknown): Error => {
  const detail = cause instanceof Error ? cause.message : String(cause);
  return new Error(
    `Intake/Get/List tests need Postgres at SPECIMENDB_PG_* (default 127.0.0.1:5434). ${detail}`,
    { cause },
  );
};

const runCatalog = async (program: Effect.Effect<unknown, unknown, never>) => {
  const root = await mkdtemp(join(tmpdir(), 'specimendb-'));
  try {
    await Effect.runPromise(
      Effect.scoped(program).pipe(
        Effect.provide(
          layer({
            pg: catalogPgFromEnv(),
            assetsRoot: join(root, 'assets'),
          }),
        ),
      ) as Effect.Effect<unknown>,
    );
  } catch (cause) {
    throw pgUnavailable(cause);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

const readUtf8 = (path: string) => Effect.tryPromise(() => readFile(path, 'utf8'));
const readBytes = (path: string) => Effect.tryPromise(() => readFile(path));
const exists = (path: string) =>
  Effect.tryPromise(() => access(path)).pipe(Effect.as(true), Effect.orElseSucceed(() => false));

describe('status machine', () => {
  it('advances raw → filed → working → dead and stays dead', () => {
    expect(nextStatus('raw')).toBe('filed');
    expect(nextStatus('filed')).toBe('working');
    expect(nextStatus('working')).toBe('dead');
    expect(nextStatus('dead')).toBe('dead');
  });
});

describe('exif gps extraction', () => {
  it('does not invent GPS for a JPEG without EXIF', () => {
    const tags = extractExifTags(jpegWithoutGps(), 'jpeg');
    expect(tags).toEqual({});
    expect(gpsFromExif(tags)).toBeUndefined();
  });

  it('does not invent GPS for a HEIC without an Exif box', () => {
    const tags = extractExifTags(heicWithoutGps(), 'heic');
    expect(tags).toEqual({});
    expect(gpsFromExif(tags)).toBeUndefined();
  });

  it('reads GPS from a JPEG that actually has it', () => {
    const tags = extractExifTags(jpegWithGps(), 'jpeg');
    expect(tags['Make']).toBe('Apple');
    expect(tags['Model']).toBe('iPhone');
    const gps = gpsFromExif(tags);
    expect(gps).toBeDefined();
    expect(gps?.latitude).toBe(37);
    expect(gps?.longitude).toBe(-122);
  });
});

describe('Intake / Get / List', () => {
  it('files a JPEG without GPS as raw, sidecar present, locality unknown', async () => {
    await runCatalog(
      Effect.gen(function* () {
        const client = yield* RpcTest.makeClient(SpecimenRpcs);
        const original = jpegWithoutGps();
        const intake = yield* client.Intake({
          bytes: original,
          filename: 'field.jpg',
        });
        expect(statusOf(intake)).toBe('raw');
        expect(intake.components.some((c) => c._tag === 'Taxon')).toBe(false);

        const locality = localityOf(intake);
        expect(locality?._tag).toBe('Locality');
        expect(locality?.state).toBe('unknown');
        expect(locality?.latitude).toBeUndefined();
        expect(locality?.longitude).toBeUndefined();
        expect(localityStateOf(intake)).toBe('unknown');

        const media = mediaOf(intake);
        expect(media?.kind).toBe('jpeg');
        expect(yield* exists(media!.assetPath)).toBe(true);
        const stored = yield* readBytes(media!.assetPath);
        expect(Buffer.from(stored).equals(Buffer.from(original))).toBe(true);

        const exif = exifOf(intake);
        expect(exif?.sidecarPath).toBe(`${media!.assetPath}.json`);
        expect(yield* exists(exif!.sidecarPath!)).toBe(true);
        const sidecar = JSON.parse(yield* readUtf8(exif!.sidecarPath!)) as Record<string, unknown>;
        expect(sidecar['SourceFile']).toBe(media!.filename);
        expect(sidecar['GPSLatitude']).toBeUndefined();

        const surface = specimenSurface(intake);
        expect(surface.status).toBe('raw');
        expect(surface.locality).toEqual({ state: 'unknown' });

        const got = yield* client.Get({ specimenId: intake.specimenId });
        expect(got.id).toBe(intake.specimenId);
        expect(statusOf(got)).toBe('raw');
        expect(localityOf(got)?.state).toBe('unknown');
        expect(exifOf(got)?.sidecarPath).toBe(exif?.sidecarPath);

        const listed = yield* client.List();
        const listedHit = listed.find((s) => s.id === intake.specimenId);
        expect(listedHit).toBeDefined();
        expect(statusOf(listedHit!)).toBe('raw');
        expect(localityOf(listedHit!)?.state).toBe('unknown');
        expect(exifOf(listedHit!)?.sidecarPath).toBe(exif?.sidecarPath);

        const filed = yield* client.Promote({ specimenId: intake.specimenId });
        expect(statusOf(filed)).toBe('filed');
        const working = yield* client.Promote({ specimenId: intake.specimenId });
        expect(statusOf(working)).toBe('working');
        const dead = yield* client.Promote({ specimenId: intake.specimenId });
        expect(statusOf(dead)).toBe('dead');
        const stillDead = yield* client.Promote({ specimenId: intake.specimenId });
        expect(statusOf(stillDead)).toBe('dead');
        expect(localityOf(stillDead)?.state).toBe('unknown');
      }) as Effect.Effect<unknown, unknown, never>,
    );
  });

  it('files a HEIC without GPS as raw with locality unknown and a sidecar', async () => {
    await runCatalog(
      Effect.gen(function* () {
        const client = yield* RpcTest.makeClient(SpecimenRpcs);
        const intake = yield* client.Intake({
          bytes: heicWithoutGps(),
          filename: 'leaf.heic',
          mediaType: 'image/heic',
        });
        expect(statusOf(intake)).toBe('raw');
        expect(localityOf(intake)?.state).toBe('unknown');
        const media = mediaOf(intake);
        expect(media?.kind).toBe('heic');
        const exif = exifOf(intake);
        expect(yield* exists(exif!.sidecarPath!)).toBe(true);

        const got = yield* client.Get({ specimenId: intake.specimenId });
        expect(localityOf(got)?.state).toBe('unknown');
      }) as Effect.Effect<unknown, unknown, never>,
    );
  });

  it('does not overwrite an original when the same filename arrives twice', async () => {
    await runCatalog(
      Effect.gen(function* () {
        const client = yield* RpcTest.makeClient(SpecimenRpcs);
        const first = yield* client.Intake({
          bytes: jpegWithoutGps(),
          filename: 'field.jpg',
        });
        const second = yield* client.Intake({
          bytes: jpegWithGps(),
          filename: 'field.jpg',
        });
        const firstPath = mediaOf(first)!.assetPath;
        const secondPath = mediaOf(second)!.assetPath;
        expect(firstPath).not.toBe(secondPath);
        expect(yield* exists(firstPath)).toBe(true);
        expect(yield* exists(secondPath)).toBe(true);
        expect(statusOf(first)).toBe('raw');
        expect(statusOf(second)).toBe('raw');
      }) as Effect.Effect<unknown, unknown, never>,
    );
  });

  it('attaches fixed locality from EXIF GPS when it actually exists', async () => {
    await runCatalog(
      Effect.gen(function* () {
        const client = yield* RpcTest.makeClient(SpecimenRpcs);
        const intake = yield* client.Intake({
          bytes: jpegWithGps(),
          filename: 'located.jpg',
        });
        expect(statusOf(intake)).toBe('raw');
        const locality = localityOf(intake);
        expect(locality?.state).toBe('fixed');
        expect(locality?.source).toBe('exif');
        expect(locality?.latitude).toBe(37);
        expect(locality?.longitude).toBe(-122);
        expect(specimenSurface(intake).locality.state).toBe('fixed');
        const exif = exifOf(intake);
        expect(exif?.tags['Make']).toBe('Apple');
        expect(exif?.tags['Model']).toBe('iPhone');
        expect(yield* exists(exif!.sidecarPath!)).toBe(true);
      }) as Effect.Effect<unknown, unknown, never>,
    );
  });

  it('attaches capture-page geo only when EXIF has no GPS', async () => {
    await runCatalog(
      Effect.gen(function* () {
        const client = yield* RpcTest.makeClient(SpecimenRpcs);
        const intake = yield* client.Intake({
          bytes: jpegWithoutGps(),
          filename: 'phone.jpg',
          geo: { latitude: 51.5, longitude: -0.12 },
          claim: 'leaf on the path',
        });
        const locality = localityOf(intake);
        expect(locality?.state).toBe('fixed');
        expect(locality?.source).toBe('capture-page');
        expect(locality?.latitude).toBe(51.5);
        expect(locality?.longitude).toBe(-0.12);
        const claim = intake.components.find((c) => c._tag === 'Claim');
        expect(claim?._tag === 'Claim' && claim.text).toBe('leaf on the path');
      }) as Effect.Effect<unknown, unknown, never>,
    );
  });
});

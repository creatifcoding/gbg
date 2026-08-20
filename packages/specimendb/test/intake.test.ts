/**
 * Intake / Get / List over DuckDB. JPEG and HEIC without GPS still file as raw.
 */

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as Effect from 'effect/Effect';
import * as RpcTest from 'effect/unstable/rpc/RpcTest';
import { heicWithoutGps, jpegWithGps, jpegWithoutGps } from './fixtures.js';
import { gpsFromExif, extractExifTags } from '../src/media/exif.js';
import { localityOf } from '../src/schemas/specimen.js';
import { layer } from '../src/layers.js';
import { SpecimenRpcs } from '../src/rpc/SpecimenRpcs.js';

const runCatalog = async (program: Effect.Effect<unknown, unknown, never>) => {
  const root = await mkdtemp(join(tmpdir(), 'specimendb-'));
  try {
    await Effect.runPromise(
      Effect.scoped(program).pipe(
        Effect.provide(
          layer({
            databasePath: join(root, 'catalog.duckdb'),
            assetsRoot: join(root, 'assets'),
          }),
        ),
      ) as Effect.Effect<unknown>,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

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
  it('files a JPEG without GPS as a raw specimen and omits locality', async () => {
    await runCatalog(
      Effect.gen(function* () {
        const client = yield* RpcTest.makeClient(SpecimenRpcs);
        const intake = yield* client.Intake({
          bytes: jpegWithoutGps(),
          filename: 'field.jpg',
        });
        expect(intake.specimenId.length).toBeGreaterThan(0);
        const status = intake.components.find((c) => c._tag === 'Status');
        expect(status?._tag === 'Status' && status.value).toBe('raw');
        expect(intake.components.some((c) => c._tag === 'Locality')).toBe(false);
        expect(intake.components.some((c) => c._tag === 'Taxon')).toBe(false);
        const media = intake.components.find((c) => c._tag === 'Media');
        expect(media?._tag === 'Media' && media.kind).toBe('jpeg');

        const got = yield* client.Get({ specimenId: intake.specimenId });
        expect(got.id).toBe(intake.specimenId);
        expect(localityOf(got)).toBeUndefined();

        const listed = yield* client.List();
        expect(listed.some((s) => s.id === intake.specimenId)).toBe(true);
        const listedHit = listed.find((s) => s.id === intake.specimenId);
        expect(listedHit && localityOf(listedHit)).toBeUndefined();
      }) as Effect.Effect<unknown, unknown, never>,
    );
  });

  it('files a HEIC without GPS as a raw specimen and omits locality', async () => {
    await runCatalog(
      Effect.gen(function* () {
        const client = yield* RpcTest.makeClient(SpecimenRpcs);
        const intake = yield* client.Intake({
          bytes: heicWithoutGps(),
          filename: 'leaf.heic',
          mediaType: 'image/heic',
        });
        const status = intake.components.find((c) => c._tag === 'Status');
        expect(status?._tag === 'Status' && status.value).toBe('raw');
        expect(intake.components.some((c) => c._tag === 'Locality')).toBe(false);
        const media = intake.components.find((c) => c._tag === 'Media');
        expect(media?._tag === 'Media' && media.kind).toBe('heic');

        const got = yield* client.Get({ specimenId: intake.specimenId });
        expect(localityOf(got)).toBeUndefined();
      }) as Effect.Effect<unknown, unknown, never>,
    );
  });

  it('attaches locality from EXIF GPS when it actually exists', async () => {
    await runCatalog(
      Effect.gen(function* () {
        const client = yield* RpcTest.makeClient(SpecimenRpcs);
        const intake = yield* client.Intake({
          bytes: jpegWithGps(),
          filename: 'located.jpg',
        });
        const locality = intake.components.find((c) => c._tag === 'Locality');
        expect(locality?._tag === 'Locality' && locality.source).toBe('exif');
        if (locality?._tag === 'Locality') {
          expect(locality.latitude).toBe(37);
          expect(locality.longitude).toBe(-122);
        }
        const exif = intake.components.find((c) => c._tag === 'Exif');
        expect(exif?._tag === 'Exif' && exif.tags['Make']).toBe('Apple');
        expect(exif?._tag === 'Exif' && exif.tags['Model']).toBe('iPhone');
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
        const locality = intake.components.find((c) => c._tag === 'Locality');
        expect(locality?._tag === 'Locality' && locality.source).toBe('capture-page');
        if (locality?._tag === 'Locality') {
          expect(locality.latitude).toBe(51.5);
          expect(locality.longitude).toBe(-0.12);
        }
        const claim = intake.components.find((c) => c._tag === 'Claim');
        expect(claim?._tag === 'Claim' && claim.text).toBe('leaf on the path');
      }) as Effect.Effect<unknown, unknown, never>,
    );
  });
});

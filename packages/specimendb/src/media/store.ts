/**
 * Copy originals into the catalog assets directory. Never overwrite.
 *
 * @module @tmnl/specimendb/media/store
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { CatalogConfigTag } from '../schemas/config.js';
import { IntakeError } from '../schemas/errors.js';
import type { SpecimenId } from '../schemas/identifiers.js';

export interface StoredAsset {
  readonly assetPath: string;
  readonly sidecarPath: string;
  readonly filename: string;
}

export interface AssetStoreShape {
  readonly storeOriginal: (
    specimenId: SpecimenId,
    filename: string,
    bytes: Uint8Array,
  ) => Effect.Effect<StoredAsset, IntakeError>;
  readonly writeSidecar: (
    sidecarPath: string,
    json: unknown,
  ) => Effect.Effect<void, IntakeError>;
}

const safeFilename = (filename: string): string => {
  const base = path.basename(filename).replace(/[^A-Za-z0-9._-]/g, '_');
  return base.length > 0 ? base : 'specimen.bin';
};

const uniquePath = (dir: string, filename: string): Effect.Effect<string, IntakeError> =>
  Effect.tryPromise({
    try: async () => {
      const initial = path.join(dir, filename);
      try {
        await fs.access(initial);
      } catch {
        return initial;
      }
      const ext = path.extname(filename);
      const stem = path.basename(filename, ext);
      for (let i = 2; i < 10_000; i++) {
        const candidate = path.join(dir, `${stem}-${i}${ext}`);
        try {
          await fs.access(candidate);
        } catch {
          return candidate;
        }
      }
      throw new Error(`could not allocate a unique path for ${filename}`);
    },
    catch: (cause) =>
      new IntakeError({ message: `Failed to allocate asset path for ${filename}`, cause }),
  });

export class AssetStore extends Context.Service<AssetStore, AssetStoreShape>()(
  '@tmnl/specimendb/AssetStore',
) {
  static readonly layer = Layer.effect(
    AssetStore,
    Effect.gen(function* () {
      const config = yield* CatalogConfigTag;

      const storeOriginal = (specimenId: SpecimenId, filename: string, bytes: Uint8Array) =>
        Effect.gen(function* () {
          const dir = path.join(config.assetsRoot, specimenId);
          yield* Effect.tryPromise({
            try: () => fs.mkdir(dir, { recursive: true }),
            catch: (cause) =>
              new IntakeError({ message: `Failed to create assets directory ${dir}`, cause }),
          });
          const dest = yield* uniquePath(dir, safeFilename(filename));
          yield* Effect.tryPromise({
            try: () => fs.writeFile(dest, bytes),
            catch: (cause) =>
              new IntakeError({ message: `Failed to copy original to ${dest}`, cause }),
          });
          return {
            assetPath: dest,
            sidecarPath: `${dest}.json`,
            filename: path.basename(dest),
          } satisfies StoredAsset;
        });

      const writeSidecar = (sidecarPath: string, json: unknown) =>
        Effect.tryPromise({
          try: () => fs.writeFile(sidecarPath, `${JSON.stringify(json, null, 2)}\n`),
          catch: (cause) =>
            new IntakeError({ message: `Failed to write EXIF sidecar ${sidecarPath}`, cause }),
        });

      return AssetStore.of({ storeOriginal, writeSidecar });
    }),
  );
}

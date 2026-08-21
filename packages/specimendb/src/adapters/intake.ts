/**
 * Intake adapter — eat file, mint specimen entity, attach what arrived.
 * Locality only if EXIF/capture geo exists. Raw is enough.
 *
 * @module @tmnl/specimendb/adapters/intake
 */

import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { AssetStore } from '../media/store.js';
import { toExiftoolSidecar } from '../media/exif.js';
import { detectMediaKind, extractExifTags } from '../media/exif.js';
import { IntakeError } from '../schemas/errors.js';
import { specimenRefFromId, trustSpecimenId, type SpecimenId } from '../schemas/identifiers.js';
import type { EntityRef } from '../schemas/identifiers.js';
import type { Component } from '../schemas/components.js';
import type { IntakePayload } from '../schemas/specimen.js';
import { IntakeAdapterTag } from '../tags.js';
import { buildIntakeComponents } from './intake-bundle.js';

export interface PreparedIntake {
  readonly specimenId: SpecimenId;
  readonly entityId: EntityRef;
  readonly createdAt: string;
  readonly components: ReadonlyArray<Component>;
}

export interface IntakeAdapterShape {
  readonly prepare: (
    payload: typeof IntakePayload.Type,
  ) => Effect.Effect<PreparedIntake, IntakeError>;
}

const nowIso = () => new Date().toISOString();
const newId = (): string => globalThis.crypto.randomUUID();

export class IntakeAdapter extends Context.Service<IntakeAdapter, IntakeAdapterShape>()(
  IntakeAdapterTag,
) {
  static readonly layer = Layer.effect(
    IntakeAdapter,
    Effect.gen(function* () {
      const assets = yield* AssetStore;

      const prepare: IntakeAdapterShape['prepare'] = (payload) =>
        Effect.gen(function* () {
          const specimenId = trustSpecimenId(newId());
          const kind = detectMediaKind(payload.bytes, payload.filename, payload.mediaType);
          const stored = yield* assets.storeOriginal(specimenId, payload.filename, payload.bytes);
          const tags = extractExifTags(payload.bytes, kind);
          yield* assets.writeSidecar(stored.sidecarPath, toExiftoolSidecar(stored.filename, tags));
          return {
            specimenId,
            entityId: specimenRefFromId(specimenId),
            createdAt: nowIso(),
            components: buildIntakeComponents(payload, stored),
          } satisfies PreparedIntake;
        });

      return IntakeAdapter.of({ prepare });
    }),
  );

  /** Memory testbed: same EXIF/locality rules, no filesystem. */
  static readonly memory = Layer.succeed(IntakeAdapter)(
    IntakeAdapter.of({
      prepare: (payload) =>
        Effect.sync(() => {
          const specimenId = trustSpecimenId(newId());
          const filename = payload.filename.length > 0 ? payload.filename : 'specimen.bin';
          const assetPath = `memory://${specimenId}/${filename}`;
          return {
            specimenId,
            entityId: specimenRefFromId(specimenId),
            createdAt: nowIso(),
            components: buildIntakeComponents(payload, {
              filename,
              assetPath,
              sidecarPath: `${assetPath}.json`,
            }),
          } satisfies PreparedIntake;
        }),
    }),
  );
}

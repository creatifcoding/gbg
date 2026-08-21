/**
 * Browser-safe in-memory Intake/Get/List/Promote client.
 * Same EXIF/locality rules as the catalog. Does not import Postgres or node:fs.
 *
 * @module
 */

import * as Effect from 'effect/Effect';
import { StatusComponent } from '../src/schemas/components.js';
import { buildIntakeComponents } from '../src/adapters/intake-bundle.js';
import { SpecimenNotFoundError } from '../src/schemas/errors.js';
import { trustSpecimenId, type SpecimenId } from '../src/schemas/identifiers.js';
import {
  nextStatus,
  statusOf,
  type IntakePayload,
  type IntakeResult,
  type Specimen,
} from '../src/schemas/specimen.js';
import type { SpecimenRpcClient } from '../src/ui/catalog-stx.js';

const newId = (): string => globalThis.crypto.randomUUID();

export const makeMemoryRepo = () => {
  const rows = new Map<string, Specimen>();

  const intake = (payload: typeof IntakePayload.Type) =>
    Effect.sync(() => {
      const specimenId = trustSpecimenId(newId());
      const createdAt = new Date().toISOString();
      const filename = payload.filename.length > 0 ? payload.filename : 'specimen.bin';
      const assetPath = `memory://${specimenId}/${filename}`;
      const components = buildIntakeComponents(payload, {
        filename,
        assetPath,
        sidecarPath: `${assetPath}.json`,
      });
      const specimen: Specimen = { id: specimenId, createdAt, components };
      rows.set(specimenId, specimen);
      return { specimenId, components } satisfies typeof IntakeResult.Type;
    });

  const get = (specimenId: SpecimenId) =>
    Effect.gen(function* () {
      const specimen = rows.get(specimenId);
      if (specimen === undefined) {
        return yield* new SpecimenNotFoundError({ specimenId });
      }
      return specimen;
    });

  const list = () =>
    Effect.sync(() => [...rows.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)));

  const promote = (specimenId: SpecimenId) =>
    Effect.gen(function* () {
      const specimen = yield* get(specimenId);
      const current = statusOf(specimen) ?? 'raw';
      if (current === 'dead') return specimen;
      const replacement = new StatusComponent({ value: nextStatus(current) });
      const hasStatus = specimen.components.some((component) => component._tag === 'Status');
      const components = hasStatus
        ? specimen.components.map((component) =>
            component._tag === 'Status' ? replacement : component,
          )
        : [replacement, ...specimen.components];
      const updated: Specimen = { ...specimen, components };
      rows.set(specimenId, updated);
      return updated;
    });

  return { intake, get, list, promote };
};

export const makeMemoryClient = (): SpecimenRpcClient => {
  const repo = makeMemoryRepo();
  return {
    Intake: (payload) => repo.intake(payload),
    Get: (payload) => repo.get(payload.specimenId),
    List: () => repo.list(),
    Promote: (payload) => repo.promote(payload.specimenId),
  };
};

/**
 * STX catalog surface. Atom + autoLens live on the stx() instance.
 * RPC calls stay Intake / Get / List / Promote / Attach — this module does not invent GPS or ids.
 *
 * @module @tmnl/specimendb/ui
 */

import * as Effect from 'effect/Effect';
import * as Result from 'effect/Result';
import { stx, type StxInstance } from '@tmnl/stx';
import { localityView, type LocalityView } from '../surface.js';
import {
  statusOf,
  type AttachableComponent,
  type IntakePayload,
  type IntakeResult,
  type Specimen,
} from '../schemas/specimen.js';
import type { SpecimenId } from '../schemas/identifiers.js';
import type { SpecimenStatus } from '../schemas/components.js';
import type { AttachError, CatalogError, IntakeError, SpecimenNotFoundError } from '../schemas/errors.js';

export type StatusFilter = 'all' | SpecimenStatus;

export type CatalogState = {
  query: string;
  statusFilter: StatusFilter;
  items: ReadonlyArray<Specimen>;
  selectedId: SpecimenId | null;
  selected: Specimen | null;
  previews: Readonly<Record<string, string>>;
  listStatus: 'idle' | 'loading' | 'ready' | 'error';
  listError: string | null;
  intakeStatus: 'idle' | 'dropping' | 'error';
  intakeError: string | null;
  online: boolean;
};

export const initialCatalogState: CatalogState = {
  query: '',
  statusFilter: 'all',
  items: [],
  selectedId: null,
  selected: null,
  previews: {},
  listStatus: 'idle',
  listError: null,
  intakeStatus: 'idle',
  intakeError: null,
  online: false,
};

export interface SpecimenRpcClient {
  readonly Intake: (
    payload: typeof IntakePayload.Type,
  ) => Effect.Effect<typeof IntakeResult.Type, CatalogError | IntakeError>;
  readonly Get: (payload: {
    readonly specimenId: SpecimenId;
  }) => Effect.Effect<Specimen, CatalogError | SpecimenNotFoundError>;
  readonly List: () => Effect.Effect<ReadonlyArray<Specimen>, CatalogError>;
  readonly Promote: (payload: {
    readonly specimenId: SpecimenId;
  }) => Effect.Effect<Specimen, CatalogError | SpecimenNotFoundError>;
  /** Published catalog Attach. Optional on UI test doubles that never attach. */
  readonly Attach?: (payload: {
    readonly specimenId: SpecimenId;
    readonly component: AttachableComponent;
  }) => Effect.Effect<Specimen, CatalogError | SpecimenNotFoundError | AttachError>;
}

export type CatalogSurface = {
  readonly store: StxInstance<CatalogState>;
  readonly list: () => Promise<void>;
  readonly select: (specimenId: SpecimenId) => Promise<void>;
  readonly promote: (specimenId: SpecimenId) => Promise<void>;
  readonly intakeFile: (file: File) => Promise<void>;
  readonly intakeFiles: (files: Iterable<File>) => Promise<void>;
};

const messageOf = (error: unknown): string => {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === 'string' && message.length > 0) return message;
  }
  return 'catalog error';
};

export const formatLocality = (view: LocalityView): string => {
  if (view.state !== 'fixed') return 'unknown';
  const ns = view.latitude >= 0 ? 'N' : 'S';
  const ew = view.longitude >= 0 ? 'E' : 'W';
  return `${Math.abs(view.latitude).toFixed(4)}° ${ns}, ${Math.abs(view.longitude).toFixed(4)}° ${ew}`;
};

export const localityLabel = (specimen: { readonly components: Specimen['components'] }): string =>
  formatLocality(localityView(specimen));

export const isJpegHeic = (file: { readonly name: string; readonly type: string }): boolean => {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  if (type === 'image/jpeg' || type === 'image/jpg' || type === 'image/heic' || type === 'image/heif') {
    return true;
  }
  return name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.heic') || name.endsWith('.heif');
};

export const visibleSpecimens = (state: CatalogState): ReadonlyArray<Specimen> => {
  const q = state.query.trim().toLowerCase();
  return state.items.filter((specimen) => {
    const status = statusOf(specimen) ?? 'raw';
    if (state.statusFilter !== 'all' && status !== state.statusFilter) return false;
    if (q.length === 0) return true;
    return specimen.id.toLowerCase().includes(q);
  });
};

const previewFor = (file: File): string | undefined => {
  if (!file.type.startsWith('image/')) return undefined;
  return URL.createObjectURL(file);
};

export const at = <A>(
  lens: unknown,
): { get: (s: CatalogState) => A; _optic: object } =>
  lens as { get: (s: CatalogState) => A; _optic: object };

export const onStatusPromote =
  (catalog: CatalogSurface, specimenId: SpecimenId) =>
  (event: { readonly stopPropagation: () => void; readonly preventDefault: () => void }): void => {
    event.stopPropagation();
    event.preventDefault();
    void catalog.promote(specimenId);
  };

export const createCatalog = (client: SpecimenRpcClient): CatalogSurface => {
  const store = stx<CatalogState>(initialCatalogState);

  const patch = (partial: Partial<CatalogState>) => {
    store.set({ ...store.get(), ...partial });
  };

  const listEffect = Effect.gen(function* () {
    patch({ listStatus: 'loading' });
    const outcome = yield* Effect.result(client.List());
    if (Result.isFailure(outcome)) {
      patch({
        listStatus: 'error',
        listError: messageOf(outcome.failure),
        online: false,
      });
      return;
    }
    patch({
      items: [...outcome.success],
      listStatus: 'ready',
      listError: null,
      online: true,
    });
  });

  const selectEffect = (specimenId: SpecimenId) =>
    Effect.gen(function* () {
      patch({ selectedId: specimenId });
      const outcome = yield* Effect.result(client.Get({ specimenId }));
      if (Result.isFailure(outcome)) {
        patch({
          selected: null,
          listError: messageOf(outcome.failure),
        });
        return;
      }
      patch({ selected: outcome.success, listError: null });
    });

  const intakeEffect = (file: File) =>
    Effect.gen(function* () {
      if (!isJpegHeic(file)) {
        patch({
          intakeStatus: 'error',
          intakeError: 'JPEG/HEIC first',
        });
        return;
      }
      patch({
        intakeStatus: 'dropping',
        intakeError: null,
      });
      const bufferOutcome = yield* Effect.result(
        Effect.tryPromise({
          try: () => file.arrayBuffer(),
          catch: (cause) => ({ message: `Failed to read ${file.name}`, cause }),
        }),
      );
      if (Result.isFailure(bufferOutcome)) {
        patch({
          intakeStatus: 'error',
          intakeError: messageOf(bufferOutcome.failure),
        });
        return;
      }
      const mediaType = file.type.length > 0 ? file.type : undefined;
      const intakeOutcome = yield* Effect.result(
        client.Intake({
          bytes: new Uint8Array(bufferOutcome.success),
          filename: file.name,
          ...(mediaType !== undefined ? { mediaType } : {}),
        }),
      );
      if (Result.isFailure(intakeOutcome)) {
        patch({
          intakeStatus: 'error',
          intakeError: messageOf(intakeOutcome.failure),
        });
        return;
      }
      const preview = previewFor(file);
      const previews =
        preview === undefined
          ? store.get().previews
          : { ...store.get().previews, [intakeOutcome.success.specimenId]: preview };
      patch({
        intakeStatus: 'idle',
        intakeError: null,
        selectedId: intakeOutcome.success.specimenId,
        previews,
      });
      yield* listEffect;
      yield* selectEffect(intakeOutcome.success.specimenId);
    });

  const promoteEffect = (specimenId: SpecimenId) =>
    Effect.gen(function* () {
      const outcome = yield* Effect.result(client.Promote({ specimenId }));
      if (Result.isFailure(outcome)) {
        patch({ listError: messageOf(outcome.failure) });
        return;
      }
      yield* listEffect;
      yield* selectEffect(specimenId);
    });

  return {
    store,
    list: () => Effect.runPromise(listEffect),
    select: (specimenId) => Effect.runPromise(selectEffect(specimenId)),
    promote: (specimenId) => Effect.runPromise(promoteEffect(specimenId)),
    intakeFile: (file) => Effect.runPromise(intakeEffect(file)),
    intakeFiles: async (files) => {
      for (const file of files) {
        await Effect.runPromise(intakeEffect(file));
      }
    },
  };
};

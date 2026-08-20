/**
 * Governed Attach RPC. Memory catalog only — this file does not open PGlite.
 * Locality/Taxon/GPS cannot be admitted through Attach.
 */

import { describe, expect, it } from 'vitest';
import * as Effect from 'effect/Effect';
import * as RpcTest from 'effect/unstable/rpc/RpcTest';
import { StructureComponent, LocalityComponent, TaxonComponent } from '../src/schemas/components.js';
import { localityOf, localityStateOf } from '../src/schemas/specimen.js';
import { SpecimenRpcs } from '../src/rpc/SpecimenRpcs.js';
import { MemoryCatalogLive } from '../testbed/memory-rpc.js';
import { jpegWithoutGps } from './fixtures.js';
import type { AttachableComponent } from '../src/schemas/specimen.js';

const runMemory = (program: Effect.Effect<unknown, unknown, never>) =>
  Effect.runPromise(
    Effect.scoped(program).pipe(
      Effect.provide(MemoryCatalogLive),
    ) as Effect.Effect<unknown>,
  );

describe('Attach RPC', () => {
  it('attaches a reviewed structure without mutating locality or inventing GPS', async () => {
    await runMemory(
      Effect.gen(function* () {
        const client = yield* RpcTest.makeClient(SpecimenRpcs);
        const intake = yield* client.Intake({
          bytes: jpegWithoutGps(),
          filename: 'coupon.jpg',
        });
        expect(localityStateOf(intake)).toBe('unknown');

        const attached = yield* client.Attach({
          specimenId: intake.specimenId,
          component: new StructureComponent({ text: 'Coupon exposes twelve contacts.' }),
        });
        expect(attached.id).toBe(intake.specimenId);
        expect(localityOf(attached)?.state).toBe('unknown');
        expect(localityOf(attached)?.latitude).toBeUndefined();
        expect(localityOf(attached)?.longitude).toBeUndefined();
        expect(
          attached.components.some(
            (component) =>
              component._tag === 'Structure' &&
              component.text === 'Coupon exposes twelve contacts.',
          ),
        ).toBe(true);

        const got = yield* client.Get({ specimenId: intake.specimenId });
        expect(localityStateOf(got)).toBe('unknown');
      }) as Effect.Effect<unknown, unknown, never>,
    );
  });

  it('refuses Locality / GPS through Attach and leaves the specimen unknown', async () => {
    await runMemory(
      Effect.gen(function* () {
        const client = yield* RpcTest.makeClient(SpecimenRpcs);
        const intake = yield* client.Intake({
          bytes: jpegWithoutGps(),
          filename: 'coupon.jpg',
        });
        const forged = new LocalityComponent({
          state: 'fixed',
          latitude: 51.5,
          longitude: -0.1,
          source: 'capture-page',
        });
        const outcome = yield* client
          .Attach({
            specimenId: intake.specimenId,
            component: forged as unknown as AttachableComponent,
          })
          .pipe(
            Effect.as('attached' as const),
            Effect.catchCause(() => Effect.succeed('refused' as const)),
          );
        expect(outcome).toBe('refused');
        const got = yield* client.Get({ specimenId: intake.specimenId });
        expect(localityStateOf(got)).toBe('unknown');
        expect(localityOf(got)?.latitude).toBeUndefined();
      }) as Effect.Effect<unknown, unknown, never>,
    );
  });

  it('refuses Taxon through Attach', async () => {
    await runMemory(
      Effect.gen(function* () {
        const client = yield* RpcTest.makeClient(SpecimenRpcs);
        const intake = yield* client.Intake({
          bytes: jpegWithoutGps(),
          filename: 'coupon.jpg',
        });
        const outcome = yield* client
          .Attach({
            specimenId: intake.specimenId,
            component: new TaxonComponent({
              scientificName: 'Mantis religiosa',
            }) as unknown as AttachableComponent,
          })
          .pipe(
            Effect.as('attached' as const),
            Effect.catchCause(() => Effect.succeed('refused' as const)),
          );
        expect(outcome).toBe('refused');
      }) as Effect.Effect<unknown, unknown, never>,
    );
  });
});

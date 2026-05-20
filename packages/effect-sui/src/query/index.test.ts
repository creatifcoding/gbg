import { bcs } from '@mysten/sui/bcs';
import * as Effect from 'effect-v4/Effect';
import * as Schema from 'effect-v4/Schema';
import { describe, expect, it } from 'vitest';

import { SuiObject } from '../effectable';
import { decodeSuiObjectId, decodeSuiObjectDigest, SuiObjectVersion } from '../schema';
import { SuiBcsBridge, SuiObjectResolver } from '../services';
import {
  makeBcsBridge,
  makeObjectResolver,
  SuiBcsBridgeLive,
  type ClientWithCoreReads,
} from './index';

describe('Sui query services', () => {
  const objectId = decodeSuiObjectId('0x7');
  const digest = decodeSuiObjectDigest('11111111111111111111111111111112');

  it('encodes pure values through Mysten BCS codecs', async () => {
    const bytes = await Effect.runPromise(
      SuiBcsBridge.use((bridge) => bridge.encodePure({ value: 9n, typeTag: 'u64' as never })).pipe(
        Effect.provide(SuiBcsBridgeLive),
      ),
    );

    expect([...bytes]).toEqual([9, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('decodes BCS bytes through codec parse and optional Effect Schema', async () => {
    const bridge = makeBcsBridge();
    const bytes = bcs.u64().serialize(42n).toBytes();

    const decoded = await Effect.runPromise(
      bridge.decode({
        bytes,
        codec: bcs.u64(),
        schema: Schema.String,
        label: 'u64',
      }),
    );

    expect(decoded).toBe('42');
  });

  it('resolves object refs and snapshots through a Core client', async () => {
    const client: ClientWithCoreReads = {
      core: {
        getObject: async ({ objectId: requestedId }) => ({
          object: {
            objectId: requestedId,
            version: '3',
            digest,
            owner: { $kind: 'Shared', Shared: { initialSharedVersion: '1' } },
            type: '0x2::coin::Coin<0x2::sui::SUI>',
            json: { balance: '99' },
          },
        }),
      },
    };
    const resolver = makeObjectResolver(client);

    const resolved = await Effect.runPromise(resolver.resolve({ id: objectId, decodeContent: true }));

    expect(resolved.id).toBe(objectId);
    expect(resolved.ref?.objectId).toBe(objectId);
    expect(resolved.ref?.version).toBe('3');
    expect(resolved.sharedRef?.initialSharedVersion).toBe('1');
    expect(resolved.snapshot?.content).toEqual({ balance: '99' });
  });

  it('refreshes SuiObject capabilities through the resolver service shape', async () => {
    const client: ClientWithCoreReads = {
      core: {
        getObject: async () => ({
          object: {
            objectId,
            version: Schema.decodeUnknownSync(SuiObjectVersion)('5'),
            digest,
            type: '0x2::coin::Coin<0x2::sui::SUI>',
            json: { balance: '123' },
          },
        }),
      },
    };
    const resolver = makeObjectResolver(client);
    const object = new SuiObject({
      id: objectId,
      refresh: (self) => SuiObjectResolver.use((service) => service.refresh(self)),
    });

    const snapshot = await Effect.runPromise(
      object.pipe(Effect.provideService(SuiObjectResolver, resolver)),
    );

    expect(snapshot.ref?.version).toBe('5');
    expect(snapshot.content).toEqual({ balance: '123' });
  });
});

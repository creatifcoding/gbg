/** BCS bridge service contracts. */

import * as Context from 'effect/Context';
import type * as Effect from 'effect/Effect';

import type { SuiTypeTagString } from '../schema';

export interface SuiBcsDecodeRequest<A = unknown> {
  readonly bytes: Uint8Array;
  readonly codec: unknown;
  readonly schema: unknown;
  readonly label?: string;
}

export interface SuiPureEncodeRequest<A = unknown> {
  readonly value: A;
  readonly typeTag: SuiTypeTagString;
  readonly codec?: unknown;
  readonly schema?: unknown;
}

export interface SuiBcsBridgeShape {
  readonly decode: <A>(request: SuiBcsDecodeRequest<A>) => Effect.Effect<A, unknown, never>;
  readonly encodePure: <A>(request: SuiPureEncodeRequest<A>) => Effect.Effect<Uint8Array, unknown, never>;
  readonly serialize: <A>(value: A, codec: unknown) => Effect.Effect<Uint8Array, unknown, never>;
}

export class SuiBcsBridge extends Context.Service<SuiBcsBridge, SuiBcsBridgeShape>()(
  '@tmnl/effect-sui/SuiBcsBridge',
) {}

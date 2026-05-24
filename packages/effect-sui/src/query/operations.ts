/** SuiQuery Effect constructors. */

import * as Effect from 'effect-v4/Effect';

import type { SuiObject, SuiObjectSnapshot } from '../effectable';
import {
  SuiBcsBridge,
  type SuiBcsDecodeRequest,
  SuiObjectResolver,
  type SuiObjectResolveRequest,
  type SuiObjectResolveResult,
  type SuiPureEncodeRequest,
} from '../services';

export const resolve = <A>(
  request: SuiObjectResolveRequest<A>,
): Effect.Effect<SuiObjectResolveResult<A>, unknown, SuiObjectResolver> =>
  SuiObjectResolver.use((resolver) => resolver.resolve(request));

export const refresh = <A>(
  object: SuiObject<A, unknown, unknown>,
): Effect.Effect<SuiObjectSnapshot<A>, unknown, SuiObjectResolver> =>
  SuiObjectResolver.use((resolver) => resolver.refresh(object));

export const decode = <A>(
  request: SuiBcsDecodeRequest<A>,
): Effect.Effect<A, unknown, SuiBcsBridge> => SuiBcsBridge.use((bridge) => bridge.decode(request));

export const encodePure = <A>(
  request: SuiPureEncodeRequest<A>,
): Effect.Effect<Uint8Array, unknown, SuiBcsBridge> => SuiBcsBridge.use((bridge) => bridge.encodePure(request));

export const serialize = <A>(
  value: A,
  codec: unknown,
): Effect.Effect<Uint8Array, unknown, SuiBcsBridge> => SuiBcsBridge.use((bridge) => bridge.serialize(value, codec));

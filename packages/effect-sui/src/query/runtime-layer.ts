import * as Layer from 'effect/Layer';

import { SuiClientService } from '../services';
import { SuiBcsBridgeLive } from './bcs';
import { SuiObjectResolverFromClient } from './resolver';
import type { ClientWithCoreReads } from './types';
import type { SuiQueryServices } from './runtime-types';

export const SuiQueryLive = Layer.merge(SuiBcsBridgeLive, SuiObjectResolverFromClient);

export const makeLayer = (client: ClientWithCoreReads): Layer.Layer<SuiQueryServices, never, never> => SuiQueryLive.pipe(
  Layer.provideMerge(SuiClientService.layer(client)),
);

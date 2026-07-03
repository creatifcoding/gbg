/** Sui client service boundary. */

import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';

export interface SuiClientServiceShape {
  readonly client: unknown;
}

export class SuiClientService extends Context.Service<
  SuiClientService,
  SuiClientServiceShape
>()('@tmnl/effect-sui/SuiClientService') {
  static readonly layer = (client: unknown) => Layer.succeed(SuiClientService)({ client });
}

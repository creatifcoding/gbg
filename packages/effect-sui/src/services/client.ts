/** Sui client service boundary. */

import * as Context from 'effect-v4/Context';
import * as Layer from 'effect-v4/Layer';

export interface SuiClientServiceShape {
  readonly client: unknown;
}

export class SuiClientService extends Context.Service<
  SuiClientService,
  SuiClientServiceShape
>()('@tmnl/effect-sui/SuiClientService') {
  static readonly layer = (client: unknown) => Layer.succeed(SuiClientService)({ client });
}

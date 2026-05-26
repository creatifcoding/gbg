/** Authorization service assembly for SuiFlow. */

import * as Layer from 'effect-v4/Layer';

import {
  SuiAuthService,
  type SuiAuthServiceShape,
  SuiClientService,
} from '../services';
import { authorizeWithPolicy } from './auth-core';
import type { ClientWithTransactionBuild } from './types';

export const makeAuthService = (client: ClientWithTransactionBuild): SuiAuthServiceShape => ({
  authorize: (tx, payment, artifact, gasPlan) => authorizeWithPolicy({ client, tx, payment, artifact, gasPlan }),
});

export const SuiAuthServiceFromClient = Layer.effect(SuiAuthService)(
  SuiClientService.useSync((service) => makeAuthService(service.client as ClientWithTransactionBuild)),
);

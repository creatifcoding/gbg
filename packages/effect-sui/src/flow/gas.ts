/** Gas planning services for SuiFlow. */

import * as Effect from 'effect-v4/Effect';
import * as Layer from 'effect-v4/Layer';

import { AutoGasPolicy } from '../schema';
import { SuiClientService, SuiGasPlanner, type SuiGasPlan, type SuiGasPlannerShape } from '../services';
import { gasRationale, resolveGasBudget, resolveGasPrice } from './gas-plan';
import type { ClientWithCoreGas } from './types';

export const makeGasPlanner = (client?: ClientWithCoreGas): SuiGasPlannerShape => ({
  plan: (tx) => Effect.gen(function* () {
    const policy = tx.gasPolicy ?? new AutoGasPolicy({});
    const price = yield* resolveGasPrice(policy, client);
    const budget = yield* resolveGasBudget(policy);
    return {
      price,
      budget,
      requiresDryRun: budget === undefined,
      rationale: gasRationale(policy, price, budget),
    } satisfies SuiGasPlan;
  }),
});

export const SuiGasPlannerFromClient = Layer.effect(SuiGasPlanner)(
  SuiClientService.useSync((service) => makeGasPlanner(service.client as ClientWithCoreGas)),
);

export const SuiGasPlannerNoClient = Layer.succeed(SuiGasPlanner)(makeGasPlanner());

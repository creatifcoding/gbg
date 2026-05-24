/** Gas planning services for SuiFlow. */

import * as Effect from 'effect-v4/Effect';
import * as Layer from 'effect-v4/Layer';

import { AutoGasPolicy, ExplicitGasPolicy, type SuiGasPolicy, SuiInvariantViolation } from '../schema';
import { SuiClientService, SuiGasPlanner, type SuiGasPlan, type SuiGasPlannerShape } from '../services';
import { invariant } from './errors';
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

function resolveGasPrice(
  policy: SuiGasPolicy,
  client?: ClientWithCoreGas,
): Effect.Effect<bigint | undefined, SuiInvariantViolation> {
  if (policy.price !== undefined) return parseBigInt(policy.price, 'SuiGasPlanner.price');
  if (!client?.core.getReferenceGasPrice) return Effect.succeed(undefined);

  return Effect.flatMap(
    Effect.tryPromise({
      try: () => client.core.getReferenceGasPrice!(),
      catch: (cause) => invariant('SuiGasPlanner.referenceGasPrice', cause),
    }),
    (response) => parseBigInt(response.referenceGasPrice, 'SuiGasPlanner.referenceGasPrice'),
  );
}

function resolveGasBudget(policy: SuiGasPolicy): Effect.Effect<bigint | undefined, SuiInvariantViolation> {
  return policy.budget === undefined
    ? Effect.succeed(undefined)
    : parseBigInt(policy.budget, 'SuiGasPlanner.budget');
}

function parseBigInt(value: string | number | bigint, invariantName: string): Effect.Effect<bigint, SuiInvariantViolation> {
  return Effect.try({
    try: () => BigInt(value),
    catch: (cause) => invariant(invariantName, cause),
  });
}

function gasRationale(policy: SuiGasPolicy, price: bigint | undefined, budget: bigint | undefined): string {
  const source = policy instanceof ExplicitGasPolicy ? 'explicit' : 'auto';
  return `${source} gas policy; price=${price?.toString() ?? 'sdk-default'}; budget=${budget?.toString() ?? 'dry-run'}`;
}

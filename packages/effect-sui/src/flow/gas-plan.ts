import * as Effect from 'effect-v4/Effect';

import { ExplicitGasPolicy, SuiGasPlanningError, type SuiGasPolicy } from '../schema';
import { gasPlanning } from './errors';
import type { ClientWithCoreGas } from './types';

export const resolveGasPrice = (
  policy: SuiGasPolicy,
  client?: ClientWithCoreGas,
): Effect.Effect<bigint | undefined, SuiGasPlanningError> => {
  if (policy.price !== undefined) return parseBigInt(policy.price, 'SuiGasPlanner.price');
  if (!client?.core.getReferenceGasPrice) return Effect.succeed(undefined);

  return Effect.flatMap(
    Effect.tryPromise({
      try: () => client.core.getReferenceGasPrice!(),
      catch: (cause) => gasPlanning('referenceGasPrice', cause),
    }),
    (response) => parseBigInt(response.referenceGasPrice, 'SuiGasPlanner.referenceGasPrice'),
  );
};

export const resolveGasBudget = (policy: SuiGasPolicy): Effect.Effect<bigint | undefined, SuiGasPlanningError> =>
  policy.budget === undefined
    ? Effect.succeed(undefined)
    : parseBigInt(policy.budget, 'SuiGasPlanner.budget');

export const gasRationale = (policy: SuiGasPolicy, price: bigint | undefined, budget: bigint | undefined): string => {
  const source = policy instanceof ExplicitGasPolicy ? 'explicit' : 'auto';
  return `${source} gas policy; price=${price?.toString() ?? 'sdk-default'}; budget=${budget?.toString() ?? 'dry-run'}`;
};

const parseBigInt = (value: string | number | bigint, policy: string): Effect.Effect<bigint, SuiGasPlanningError> =>
  Effect.try({
    try: () => BigInt(value),
    catch: (cause) => gasPlanning(policy, cause),
  });

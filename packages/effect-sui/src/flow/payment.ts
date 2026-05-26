/** Payment planning service assembly for SuiFlow. */

import * as Effect from 'effect-v4/Effect';
import * as Layer from 'effect-v4/Layer';

import { AutoPaymentPolicy } from '../schema';
import { SuiPaymentService, type SuiPaymentServiceShape } from '../services';
import { collectPtbObjectInputIds, planPayment } from './payment-plan';

export const makePaymentService = (): SuiPaymentServiceShape => ({
  plan: (tx, _gasPlan) => Effect.gen(function* () {
    const policy = tx.paymentPolicy ?? new AutoPaymentPolicy({ addressBalance: true });
    return yield* planPayment(policy, collectPtbObjectInputIds(tx));
  }),
});

export const SuiPaymentServiceLive = Layer.succeed(SuiPaymentService)(makePaymentService());

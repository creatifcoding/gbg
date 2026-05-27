/** SuiFlow service layer graph. */

import * as Layer from 'effect-v4/Layer';

import { SuiDiagnosticsLive } from '../diagnostics';
import { SuiPtbLive } from '../ptb';
import { SuiReservationServiceLive } from '../reservation';
import { SuiClientService } from '../services';
import { SuiAuthServiceFromClient } from './auth';
import { SuiGasPlannerFromClient } from './gas';
import { SuiPaymentServiceLive } from './payment';
import { makeTxRunnerLayer, type SuiTxRunnerOptions } from './runner';
import { SuiExecutionServiceFromClient, SuiFinalityServiceFromClient, SuiPreflightServiceFromClient } from './rpc';
import type { ClientWithTransactionLifecycle } from './types';
import type { SuiFlowServices } from './runtime-types';

export const SuiPaymentAuthLive = Layer.mergeAll(
  SuiGasPlannerFromClient,
  SuiPaymentServiceLive,
  SuiAuthServiceFromClient,
);

export const SuiTxLifecycleServices = Layer.mergeAll(
  SuiPtbLive,
  SuiPaymentAuthLive,
  SuiPreflightServiceFromClient,
  SuiExecutionServiceFromClient,
  SuiFinalityServiceFromClient,
  SuiReservationServiceLive,
  SuiDiagnosticsLive,
);

export const makeTxLifecycleLayer = (options: SuiTxRunnerOptions = {}) =>
  makeTxRunnerLayer(options).pipe(Layer.provideMerge(SuiTxLifecycleServices));

export const SuiTxLifecycleLive = makeTxLifecycleLayer();

export const makeLayer = (
  client: ClientWithTransactionLifecycle,
  options: SuiTxRunnerOptions = {},
): Layer.Layer<SuiFlowServices, never, never> => makeTxLifecycleLayer(options).pipe(
  Layer.provideMerge(SuiClientService.layer(client)),
);

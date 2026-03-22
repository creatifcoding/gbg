import { Atom } from '@effect-atom/atom';
import { Layer } from 'effect';
import { SqliteLedgerStore } from './persistence/sqlite';
import { JsonLedgerExport } from './persistence/jsonExport';
import { HookRegistryService } from './services/HookRegistryService';
import { HookRuntimeService } from './services/HookRuntimeService';
import { DecisionMatrixService } from './services/DecisionMatrixService';
import { AuditLedgerService } from './services/AuditLedgerService';
import { ReplayService } from './services/ReplayService';

export const HypothesisLabLive = Layer.mergeAll(
  SqliteLedgerStore.Default,
  JsonLedgerExport.Default,
  HookRegistryService.Default,
  HookRuntimeService.Default,
  DecisionMatrixService.Default,
  AuditLedgerService.Default,
  ReplayService.Default
);

export const hypothesisLabRuntimeAtom = Atom.runtime(HypothesisLabLive);

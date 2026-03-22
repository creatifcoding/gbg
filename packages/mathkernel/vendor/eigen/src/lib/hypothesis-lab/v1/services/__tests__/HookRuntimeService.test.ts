import { describe, it, expect } from '@effect/vitest';
import { Effect, Layer, Schema } from 'effect';
import {
  EvidenceRecord,
  HookGroupSpec,
  HookPlanCompiled,
  HookStepSpec,
  Hypothesis,
  type HookPlanCompiled as HookPlanCompiledType,
  type HookStepPolicy,
} from '../../schemas';
import {
  HookRegistryService,
  type HookDefinition,
} from '../HookRegistryService';
import { HookRuntimeService } from '../HookRuntimeService';

const defaultPolicy: HookStepPolicy = {
  timeoutMs: 1000,
  retries: 0,
  onError: 'halt',
};

const makeStep = (
  stepId: string,
  hookKey: string,
  policy: Partial<HookStepPolicy> = {}
) =>
  HookStepSpec.make({
    stepId,
    hookKey,
    hookVersion: '1.0.0',
    inputSchemaRef: `schema://${hookKey}/input/v1`,
    outputSchemaRef: `schema://${hookKey}/output/v1`,
    policy: {
      ...defaultPolicy,
      ...policy,
    },
    mergePolicy: undefined,
  });

const makeInput = () => ({
  runId: 'run-1',
  hypotheses: [
    Hypothesis.make({
      id: 'hyp-a',
      runId: 'run-1',
      label: 'A',
      statement: 'Hypothesis A',
      assumptions: [],
      createdAt: 1,
      createdBy: 'test',
    }),
    Hypothesis.make({
      id: 'hyp-b',
      runId: 'run-1',
      label: 'B',
      statement: 'Hypothesis B',
      assumptions: [],
      createdAt: 1,
      createdBy: 'test',
    }),
  ],
});

const makePlan = (stages: HookPlanCompiledType['stages'], events: HookPlanCompiledType['events']) =>
  HookPlanCompiled.make({
    planId: 'plan-test',
    schemaVersion: '1.0.0',
    builderVersion: '1.0.0',
    createdAt: new Date(0).toISOString(),
    stages,
    events,
    resolverSnapshot: [],
    integrity: {
      contentHash: 'test',
    },
  });

const hookInputSchema = Schema.Struct({
  runId: Schema.String,
  hypotheses: Schema.Array(Schema.Unknown),
});

const hookOutputSchema = Schema.Struct({
  evidence: Schema.Array(EvidenceRecord),
});

const makeEvidence = (
  id: string,
  confidence: number,
  summary = 'same-summary'
) =>
  EvidenceRecord.make({
    id,
    runId: 'run-1',
    source: 'hook://runtime-test',
    summary,
    confidence,
    metadata: {
      key: 'value',
    },
    createdAt: 1,
  });

const makeHook = (
  key: string,
  options: {
    delayMs?: number;
    confidence?: number;
    summary?: string;
    failWith?: string;
    evidenceId?: string;
  }
): HookDefinition => ({
  key,
  version: '1.0.0',
  resolvedTo: `@tmnl/tests/${key}`,
  inputSchema: hookInputSchema,
  outputSchema: hookOutputSchema,
  run: () =>
    Effect.gen(function* () {
      if (options.delayMs && options.delayMs > 0) {
        yield* Effect.promise(
          () =>
            new Promise<void>((resolve) => {
              setTimeout(resolve, options.delayMs);
            })
        );
      }

      if (options.failWith) {
        return yield* Effect.fail(new Error(options.failWith));
      }

      return {
        evidence: [
          makeEvidence(
            options.evidenceId ?? `${key}-evidence`,
            options.confidence ?? 0.5,
            options.summary
          ),
        ],
      };
    }),
});

const runtimeTestLayer = Layer.mergeAll(HookRegistryService.Default, HookRuntimeService.Default);

describe('HookRuntimeService', () => {
  it.effect('executes parallel-safe groups with deterministic merge and tie-break decisions', () =>
    Effect.gen(function* () {
      const registry = yield* HookRegistryService;
      const runtime = yield* HookRuntimeService;

      const plan = makePlan(
        [
          {
            name: 'before.validate',
            mode: 'sequential',
            sequence: 1,
            entries: [
              HookGroupSpec.make({
                groupId: 'g-1',
                mode: 'parallel-safe',
                mergeContractRef: 'merge://g-1/v1',
                steps: [
                  makeStep('step-fast-low', 'hook.fast-low', {
                    onError: 'continue',
                  }),
                  makeStep('step-slow-high', 'hook.slow-high', {
                    onError: 'continue',
                  }),
                ],
              }),
            ],
          },
        ],
        []
      );

      // First run: high-confidence hook finishes slower.
      yield* registry.register(
        makeHook('hook.fast-low', {
          delayMs: 1,
          confidence: 0.4,
          summary: 'conflict-summary',
          evidenceId: 'ev-low',
        })
      );
      yield* registry.register(
        makeHook('hook.slow-high', {
          delayMs: 30,
          confidence: 0.9,
          summary: 'conflict-summary',
          evidenceId: 'ev-high',
        })
      );

      const outputSlowWinner = yield* runtime.executePlan(plan, makeInput());

      // Second run: completion order is flipped.
      yield* registry.register(
        makeHook('hook.fast-low', {
          delayMs: 30,
          confidence: 0.4,
          summary: 'conflict-summary',
          evidenceId: 'ev-low',
        })
      );
      yield* registry.register(
        makeHook('hook.slow-high', {
          delayMs: 1,
          confidence: 0.9,
          summary: 'conflict-summary',
          evidenceId: 'ev-high',
        })
      );

      const outputFastWinner = yield* runtime.executePlan(plan, makeInput());

      expect(outputSlowWinner.evidence.map((entry) => entry.id)).toEqual(['ev-high']);
      expect(outputFastWinner.evidence.map((entry) => entry.id)).toEqual(['ev-high']);

      expect(outputSlowWinner.mergeDecisions).toHaveLength(1);
      expect(outputSlowWinner.mergeDecisions[0]?.winnerStepId).toBe('step-slow-high');
      expect(outputSlowWinner.mergeDecisions[0]?.droppedStepIds).toEqual(['step-fast-low']);
    }).pipe(Effect.provide(runtimeTestLayer))
  );

  it.effect('respects onError policies: continue/quarantine recover, halt fails', () =>
    Effect.gen(function* () {
      const registry = yield* HookRegistryService;
      const runtime = yield* HookRuntimeService;

      yield* registry.register(
        makeHook('hook.fail', {
          failWith: 'boom',
        })
      );

      yield* registry.register(
        makeHook('hook.ok', {
          confidence: 0.8,
          evidenceId: 'ev-ok',
          summary: 'ok-summary',
        })
      );

      const continuePlan = makePlan(
        [
          {
            name: 'before.validate',
            mode: 'sequential',
            sequence: 1,
            entries: [
              makeStep('step-fail-continue', 'hook.fail', { onError: 'continue' }),
              makeStep('step-ok-after-continue', 'hook.ok'),
            ],
          },
        ],
        []
      );

      const continueOutput = yield* runtime.executePlan(continuePlan, makeInput());
      expect(continueOutput.evidence.map((entry) => entry.id)).toEqual(['ev-ok']);
      expect(continueOutput.failures).toHaveLength(1);
      expect(continueOutput.stepOutcomes.find((entry) => entry.stepId === 'step-fail-continue')?.outcome).toBe(
        'failure'
      );

      const quarantinePlan = makePlan(
        [
          {
            name: 'before.validate',
            mode: 'sequential',
            sequence: 1,
            entries: [
              makeStep('step-fail-quarantine', 'hook.fail', { onError: 'quarantine' }),
              makeStep('step-ok-after-quarantine', 'hook.ok'),
            ],
          },
        ],
        []
      );

      const quarantineOutput = yield* runtime.executePlan(quarantinePlan, makeInput());
      expect(quarantineOutput.evidence.map((entry) => entry.id)).toEqual(['ev-ok']);
      expect(quarantineOutput.failures).toHaveLength(1);
      expect(
        quarantineOutput.stepOutcomes.find((entry) => entry.stepId === 'step-fail-quarantine')
          ?.outcome
      ).toBe('quarantined');

      const haltPlan = makePlan(
        [
          {
            name: 'before.validate',
            mode: 'sequential',
            sequence: 1,
            entries: [
              makeStep('step-fail-halt', 'hook.fail', { onError: 'halt' }),
              makeStep('step-ok-after-halt', 'hook.ok'),
            ],
          },
        ],
        []
      );

      const haltExit = yield* runtime.executePlan(haltPlan, makeInput()).pipe(Effect.exit);
      expect(haltExit._tag).toBe('Failure');
    }).pipe(Effect.provide(runtimeTestLayer))
  );

  it.effect('executes event hooks by explicit event name without running stage hooks', () =>
    Effect.gen(function* () {
      const registry = yield* HookRegistryService;
      const runtime = yield* HookRuntimeService;

      yield* registry.register(
        makeHook('hook.stage-should-not-run', {
          failWith: 'stage-should-not-run',
        })
      );
      yield* registry.register(
        makeHook('hook.event-ok', {
          confidence: 0.75,
          evidenceId: 'ev-event',
          summary: 'event-summary',
        })
      );

      const plan = makePlan(
        [
          {
            name: 'before.validate',
            mode: 'sequential',
            sequence: 1,
            entries: [makeStep('step-stage', 'hook.stage-should-not-run')],
          },
        ],
        [
          {
            eventName: 'onVerdictFinalized',
            steps: [makeStep('event-step-1', 'hook.event-ok', { onError: 'continue' })],
          },
        ]
      );

      const eventOutput = yield* runtime.executeEvent(
        plan,
        makeInput(),
        'onVerdictFinalized'
      );

      expect(eventOutput.evidence.map((entry) => entry.id)).toEqual(['ev-event']);
      expect(eventOutput.failures).toHaveLength(0);
      expect(eventOutput.stepOutcomes.map((entry) => entry.scope)).toEqual(['event']);

      const missingEventOutput = yield* runtime.executeEvent(plan, makeInput(), 'missing-event');
      expect(missingEventOutput.evidence).toHaveLength(0);
      expect(missingEventOutput.failures).toHaveLength(0);
      expect(missingEventOutput.stepOutcomes).toHaveLength(0);
    }).pipe(Effect.provide(runtimeTestLayer))
  );
});

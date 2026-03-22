import { Effect, Schema } from 'effect';
import {
  HookPlanCompiled,
  type HookEventSpec,
  type HookOnErrorPolicy,
  type HookPlanCompiled as HookPlanCompiledType,
  type HookStageSpec,
  type HookStepSpec,
  type EvidenceRecord,
  type Hypothesis,
} from '../schemas';
import { HookContractDecodeError, HookExecutionError } from '../errors';
import { HookRegistryService } from './HookRegistryService';
import {
  deterministicMergeContributions,
  freezeMergePolicy,
  sortEvidenceDeterministically,
  sortFailuresDeterministically,
  sortStepOutcomesDeterministically,
  type EvidenceContribution,
  type MergeTieBreakDecision,
} from './deterministicMerge';

export interface HookRuntimeInput {
  readonly runId: string;
  readonly hypotheses: ReadonlyArray<Hypothesis>;
}

export interface HookFailureRecord {
  readonly stepId: string;
  readonly hookKey: string;
  readonly reason: string;
  readonly policy: HookOnErrorPolicy;
  readonly scope: 'stage' | 'event';
  readonly scopeName: string;
  readonly groupId?: string;
}

export interface HookStepOutcomeRecord {
  readonly stepId: string;
  readonly hookKey: string;
  readonly scope: 'stage' | 'event';
  readonly scopeName: string;
  readonly groupId?: string;
  readonly outcome: 'success' | 'failure' | 'quarantined';
  readonly reason?: string;
}

export interface HookRuntimeOutput {
  readonly evidence: ReadonlyArray<EvidenceRecord>;
  readonly quarantinedEvidence: ReadonlyArray<EvidenceRecord>;
  readonly failures: ReadonlyArray<HookFailureRecord>;
  readonly mergeDecisions: ReadonlyArray<MergeTieBreakDecision>;
  readonly stepOutcomes: ReadonlyArray<HookStepOutcomeRecord>;
}

const HookRuntimeInputSchema = Schema.Struct({
  runId: Schema.String,
  hypotheses: Schema.Array(Schema.Unknown),
});

interface StepContext {
  readonly scope: 'stage' | 'event';
  readonly scopeName: string;
  readonly groupId?: string;
  readonly sequence: number;
}

interface RuntimeChunk {
  readonly contributions: ReadonlyArray<EvidenceContribution>;
  readonly quarantinedEvidence: ReadonlyArray<EvidenceRecord>;
  readonly failures: ReadonlyArray<HookFailureRecord & { readonly sequence: number }>;
  readonly mergeDecisions: ReadonlyArray<MergeTieBreakDecision>;
  readonly stepOutcomes: ReadonlyArray<HookStepOutcomeRecord & { readonly sequence: number }>;
}

const emptyChunk = (): RuntimeChunk => ({
  contributions: [],
  quarantinedEvidence: [],
  failures: [],
  mergeDecisions: [],
  stepOutcomes: [],
});

const emptyOutput = (): HookRuntimeOutput => ({
  evidence: [],
  quarantinedEvidence: [],
  failures: [],
  mergeDecisions: [],
  stepOutcomes: [],
});

const summarizeUnknownError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return 'Hook execution failure';
  }
};

const extractEvidence = (decodedOutput: unknown): ReadonlyArray<EvidenceRecord> => {
  if (typeof decodedOutput !== 'object' || decodedOutput === null) {
    return [];
  }

  if (!('evidence' in decodedOutput)) {
    return [];
  }

  const candidate = decodedOutput as { evidence?: ReadonlyArray<EvidenceRecord> };
  return sortEvidenceDeterministically(candidate.evidence ?? []);
};

const sortMergeDecisions = (
  decisions: ReadonlyArray<MergeTieBreakDecision>
): ReadonlyArray<MergeTieBreakDecision> =>
  [...decisions].sort((left, right) => {
    if (left.scope !== right.scope) {
      return left.scope.localeCompare(right.scope);
    }

    if (left.mergeContractRef !== right.mergeContractRef) {
      return left.mergeContractRef.localeCompare(right.mergeContractRef);
    }

    if (left.mergeKey !== right.mergeKey) {
      return left.mergeKey.localeCompare(right.mergeKey);
    }

    return left.winnerStepId.localeCompare(right.winnerStepId);
  });

const combineChunksDeterministically = (chunks: ReadonlyArray<RuntimeChunk>): RuntimeChunk => ({
  contributions: chunks.flatMap((chunk) => chunk.contributions),
  quarantinedEvidence: sortEvidenceDeterministically(
    chunks.flatMap((chunk) => chunk.quarantinedEvidence)
  ),
  failures: sortFailuresDeterministically(chunks.flatMap((chunk) => chunk.failures)),
  mergeDecisions: sortMergeDecisions(chunks.flatMap((chunk) => chunk.mergeDecisions)),
  stepOutcomes: sortStepOutcomesDeterministically(
    chunks.flatMap((chunk) => chunk.stepOutcomes)
  ),
});

const appendChunkToOutput = (
  state: HookRuntimeOutput,
  chunk: RuntimeChunk
): HookRuntimeOutput => ({
  evidence: [...state.evidence, ...chunk.contributions.map((contribution) => contribution.evidence)],
  quarantinedEvidence: [...state.quarantinedEvidence, ...chunk.quarantinedEvidence],
  failures: [...state.failures, ...chunk.failures.map(({ sequence: _sequence, ...failure }) => failure)],
  mergeDecisions: [...state.mergeDecisions, ...chunk.mergeDecisions],
  stepOutcomes: [
    ...state.stepOutcomes,
    ...chunk.stepOutcomes.map(({ sequence: _sequence, ...outcome }) => outcome),
  ],
});

const toRuntimeDecodeError = (
  hookKey: string,
  message: string,
  cause: unknown
): HookContractDecodeError =>
  new HookContractDecodeError({
    hookKey,
    message,
    cause,
  });

const stepSequenceBase = (stageSequence: number, entryIndex: number): number =>
  stageSequence * 10_000 + (entryIndex + 1) * 100;

const eventSequenceBase = (eventIndex: number): number => (eventIndex + 1) * 10_000;

export class HookRuntimeService extends Effect.Service<HookRuntimeService>()(
  'tmnl/hypothesis-lab/HookRuntimeService',
  {
    dependencies: [HookRegistryService.Default],
    effect: Effect.gen(function* () {
      const registry = yield* HookRegistryService;

      const executeStep = (
        step: HookStepSpec,
        input: HookRuntimeInput,
        context: StepContext
      ): Effect.Effect<RuntimeChunk, unknown> =>
        Effect.gen(function* () {
          yield* Effect.annotateCurrentSpan({
            scope: context.scope,
            scopeName: context.scopeName,
            groupId: context.groupId ?? 'none',
            stepId: step.stepId,
            hookKey: step.hookKey,
            onError: step.policy.onError,
          });

          const hook = yield* registry.resolve(step.hookKey);

          const decodedInput = yield* Schema.decodeUnknown(hook.inputSchema)(input).pipe(
            Effect.mapError((error) =>
              toRuntimeDecodeError(
                step.hookKey,
                `Failed to decode hook input for ${step.hookKey}`,
                error
              )
            )
          );

          const rawOutput = yield* hook.run(decodedInput).pipe(
            Effect.mapError(
              (error) =>
                new HookExecutionError({
                  hookKey: step.hookKey,
                  stage: context.scopeName,
                  message: 'Hook execution failed',
                  cause: error,
                })
            )
          );

          const decodedOutput = yield* Schema.decodeUnknown(hook.outputSchema)(rawOutput).pipe(
            Effect.mapError((error) =>
              toRuntimeDecodeError(
                step.hookKey,
                `Failed to decode hook output for ${step.hookKey}`,
                error
              )
            )
          );

          const evidence = extractEvidence(decodedOutput);

          const contributions: ReadonlyArray<EvidenceContribution> = evidence.map((record) => ({
            evidence: record,
            origin: {
              stepId: step.stepId,
              hookKey: step.hookKey,
              sequence: context.sequence,
              mergePolicy: step.mergePolicy,
            },
          }));

          return {
            ...emptyChunk(),
            contributions,
            stepOutcomes: [
              {
                stepId: step.stepId,
                hookKey: step.hookKey,
                scope: context.scope,
                scopeName: context.scopeName,
                groupId: context.groupId,
                outcome: 'success' as const,
                sequence: context.sequence,
              },
            ],
          };
        }).pipe(
          Effect.withSpan('HypothesisLab.HookRuntime.executeStep'),
          Effect.catchAll((error) => {
            if (step.policy.onError === 'halt') {
              return Effect.fail(error);
            }

            const reason = summarizeUnknownError(error);
            const failureOutcome =
              step.policy.onError === 'quarantine'
                ? ('quarantined' as const)
                : ('failure' as const);

            return Effect.succeed({
              ...emptyChunk(),
              failures: [
                {
                  stepId: step.stepId,
                  hookKey: step.hookKey,
                  reason,
                  policy: step.policy.onError,
                  scope: context.scope,
                  scopeName: context.scopeName,
                  groupId: context.groupId,
                  sequence: context.sequence,
                },
              ],
              stepOutcomes: [
                {
                  stepId: step.stepId,
                  hookKey: step.hookKey,
                  scope: context.scope,
                  scopeName: context.scopeName,
                  groupId: context.groupId,
                  outcome: failureOutcome,
                  reason,
                  sequence: context.sequence,
                },
              ],
            });
          })
        );

      const executeParallelGroup = (
        stage: HookStageSpec,
        groupEntryIndex: number,
        input: HookRuntimeInput,
        groupId: string,
        mergeContractRef: string,
        steps: ReadonlyArray<HookStepSpec>
      ): Effect.Effect<RuntimeChunk, unknown> =>
        Effect.gen(function* () {
          yield* Effect.annotateCurrentSpan({
            stage: stage.name,
            stageMode: stage.mode,
            groupId,
            mergeContractRef,
            groupMode: 'parallel-safe',
          });

          const sequenceBase = stepSequenceBase(stage.sequence, groupEntryIndex);

          const stepEffects = steps.map((step, index) =>
            executeStep(step, input, {
              scope: 'stage',
              scopeName: stage.name,
              groupId,
              sequence: sequenceBase + index + 1,
            })
          );

          const results = yield* Effect.all(stepEffects, { concurrency: 'unbounded' });
          const combined = combineChunksDeterministically(results);

          const frozenPolicy = freezeMergePolicy(mergeContractRef);
          const merged = deterministicMergeContributions(
            combined.contributions,
            `stage:${stage.name}:group:${groupId}`,
            frozenPolicy
          );

          return {
            ...combined,
            contributions: merged.merged,
            mergeDecisions: sortMergeDecisions([
              ...combined.mergeDecisions,
              ...merged.decisions,
            ]),
          };
        }).pipe(Effect.withSpan('HypothesisLab.HookRuntime.executeGroup'));

      const executeStageEntry = (
        stage: HookStageSpec,
        entryIndex: number,
        input: HookRuntimeInput
      ): Effect.Effect<RuntimeChunk, unknown> => {
        const entry = stage.entries[entryIndex];

        if (entry._tag === 'HookGroupSpec') {
          return executeParallelGroup(
            stage,
            entryIndex,
            input,
            entry.groupId,
            entry.mergeContractRef,
            entry.steps
          );
        }

        return executeStep(entry, input, {
          scope: 'stage',
          scopeName: stage.name,
          sequence: stepSequenceBase(stage.sequence, entryIndex) + 1,
        });
      };

      const executeStage = (
        stage: HookStageSpec,
        input: HookRuntimeInput,
        state: HookRuntimeOutput
      ): Effect.Effect<HookRuntimeOutput, unknown> =>
        Effect.gen(function* () {
          yield* Effect.annotateCurrentSpan({
            stage: stage.name,
            stageMode: stage.mode,
            sequence: stage.sequence,
          });

          if (stage.mode === 'sequential') {
            let current = state;

            for (let index = 0; index < stage.entries.length; index++) {
              const entryChunk = yield* executeStageEntry(stage, index, input);
              current = appendChunkToOutput(current, entryChunk);
            }

            return current;
          }

          const entryEffects = stage.entries.map((_entry, index) =>
            executeStageEntry(stage, index, input)
          );

          const entryResults = yield* Effect.all(entryEffects, { concurrency: 'unbounded' });
          const combined = combineChunksDeterministically(entryResults);

          const stageMergeContract = `merge://stage/${stage.name}/v1`;
          const frozenPolicy = freezeMergePolicy(stageMergeContract);
          const merged = deterministicMergeContributions(
            combined.contributions,
            `stage:${stage.name}`,
            frozenPolicy
          );

          const stageChunk: RuntimeChunk = {
            ...combined,
            contributions: merged.merged,
            mergeDecisions: sortMergeDecisions([
              ...combined.mergeDecisions,
              ...merged.decisions,
            ]),
          };

          return appendChunkToOutput(state, stageChunk);
        }).pipe(Effect.withSpan('HypothesisLab.HookRuntime.executeStage'));

      const executeEventSpec = (
        event: HookEventSpec,
        eventIndex: number,
        input: HookRuntimeInput
      ): Effect.Effect<RuntimeChunk, unknown> =>
        Effect.gen(function* () {
          yield* Effect.annotateCurrentSpan({
            eventName: event.eventName,
            eventIndex,
          });

          const base = eventSequenceBase(eventIndex);

          let chunk = emptyChunk();
          for (let index = 0; index < event.steps.length; index++) {
            const step = event.steps[index];
            const stepChunk = yield* executeStep(step, input, {
              scope: 'event',
              scopeName: event.eventName,
              sequence: base + index + 1,
            });

            chunk = combineChunksDeterministically([chunk, stepChunk]);
          }

          const eventMergeContract = `merge://event/${event.eventName}/v1`;
          const frozenPolicy = freezeMergePolicy(eventMergeContract);
          const merged = deterministicMergeContributions(
            chunk.contributions,
            `event:${event.eventName}`,
            frozenPolicy
          );

          return {
            ...chunk,
            contributions: merged.merged,
            mergeDecisions: sortMergeDecisions([...chunk.mergeDecisions, ...merged.decisions]),
          };
        }).pipe(Effect.withSpan('HypothesisLab.HookRuntime.executeEventSpec'));

      const decodePlan = (plan: HookPlanCompiledType) =>
        Schema.decodeUnknown(HookPlanCompiled)(plan).pipe(
          Effect.mapError((error) =>
            toRuntimeDecodeError('runtime/plan', 'Hook runtime plan invalid', error)
          )
        );

      const decodeRuntimeInput = (input: HookRuntimeInput) =>
        Schema.decodeUnknown(HookRuntimeInputSchema)({
          runId: input.runId,
          hypotheses: input.hypotheses,
        }).pipe(
          Effect.mapError((error) =>
            toRuntimeDecodeError('runtime/input', 'Hook runtime input invalid', error)
          )
        );

      const executePlan = (
        plan: HookPlanCompiledType,
        input: HookRuntimeInput
      ): Effect.Effect<HookRuntimeOutput, unknown> =>
        Effect.gen(function* () {
          const decodedPlan = yield* decodePlan(plan);
          yield* decodeRuntimeInput(input);

          yield* Effect.annotateCurrentSpan({
            planId: decodedPlan.planId,
            runId: input.runId,
            executionScope: 'stages',
          });

          const orderedStages = [...decodedPlan.stages].sort((left, right) => {
            if (left.sequence !== right.sequence) {
              return left.sequence - right.sequence;
            }

            return left.name.localeCompare(right.name);
          });

          return yield* Effect.reduce(orderedStages, emptyOutput(), (acc, stage) =>
            executeStage(stage, input, acc)
          );
        }).pipe(Effect.withSpan('HypothesisLab.HookRuntime.executePlan'));

      const executeEvent = (
        plan: HookPlanCompiledType,
        input: HookRuntimeInput,
        eventName: string
      ): Effect.Effect<HookRuntimeOutput, unknown> =>
        Effect.gen(function* () {
          const decodedPlan = yield* decodePlan(plan);
          yield* decodeRuntimeInput(input);

          yield* Effect.annotateCurrentSpan({
            planId: decodedPlan.planId,
            runId: input.runId,
            executionScope: 'event',
            eventName,
          });

          const matchingEvents = decodedPlan.events
            .map((event, index) => ({ event, index }))
            .filter(({ event }) => event.eventName === eventName);

          if (matchingEvents.length === 0) {
            return emptyOutput();
          }

          return yield* Effect.reduce(matchingEvents, emptyOutput(), (acc, { event, index }) =>
            executeEventSpec(event, index, input).pipe(
              Effect.map((chunk) => appendChunkToOutput(acc, chunk))
            )
          );
        }).pipe(Effect.withSpan('HypothesisLab.HookRuntime.executeEvent'));

      return {
        executePlan,
        executeEvent,
      } as const;
    }),
  }
) {}

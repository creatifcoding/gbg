import { Atom } from '@effect-atom/atom';
import { Effect, Schema } from 'effect';
import {
  CreateRunInput,
  HookInvoked,
  HookPlanCompiledEvent,
  Hypothesis,
  type Hypothesis as HypothesisType,
  HypothesisSeeded,
  MatrixDrafted,
  RatificationPhaseAdvanced,
  RatifyVerdictInput,
  ReplayEvaluated,
  RunCreated,
  TrustGateEvaluated,
  VerdictRatified,
  type AuditEvent,
  type CreateRunInput as CreateRunInputType,
  type RatifyVerdictInput as RatifyVerdictInputType,
  type TrustGate,
  type TrustGateStatus,
} from '../schemas';
import {
  MatrixComputationError,
  MissingPlanError,
  MissingRunStateError,
  MissingVerdictError,
} from '../errors';
import { hypothesisLabRuntimeAtom } from '../runtime';
import { makeDefaultVerticalSlicePlan } from '../builder/HookPlanBuilder';
import { HookRuntimeService, type HookRuntimeOutput } from '../services/HookRuntimeService';
import { DecisionMatrixService } from '../services/DecisionMatrixService';
import { AuditLedgerService } from '../services/AuditLedgerService';
import { ReplayService } from '../services/ReplayService';
import {
  auditEventsAtom,
  compiledPlanAtom,
  errorMessageAtom,
  evidenceAtom,
  hypothesesAtom,
  matrixAtom,
  replayReportAtom,
  runAtom,
  statusAtom,
  verdictAtom,
} from './state';

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Unknown hypothesis-lab error';

const appendAuditEvent = (
  event: AuditEvent,
  ctx: Atom.FnContext,
  ledger: {
    append: (event: AuditEvent) => Effect.Effect<void, unknown>;
  }
): Effect.Effect<void, unknown> =>
  Effect.gen(function* () {
    ctx.set(auditEventsAtom, [...ctx(auditEventsAtom), event]);
    yield* ledger.append(event);
  });

const appendTrustGateEvent = (
  params: {
    runId: string;
    gate: TrustGate;
    status: TrustGateStatus;
    detail: string;
    actor: string | null;
  },
  ctx: Atom.FnContext,
  ledger: {
    append: (event: AuditEvent) => Effect.Effect<void, unknown>;
  }
): Effect.Effect<void, unknown> =>
  appendAuditEvent(
    TrustGateEvaluated.make({
      runId: params.runId,
      gate: params.gate,
      status: params.status,
      detail: params.detail,
      actor: params.actor,
      timestamp: Date.now(),
    }),
    ctx,
    ledger
  );

const appendHookOutcomeEvents = (
  runId: string,
  output: HookRuntimeOutput,
  ctx: Atom.FnContext,
  ledger: {
    append: (event: AuditEvent) => Effect.Effect<void, unknown>;
  }
): Effect.Effect<void, unknown> =>
  Effect.forEach(
    output.stepOutcomes,
    (step) =>
      appendAuditEvent(
        HookInvoked.make({
          runId,
          stage: `${step.scope}:${step.scopeName}`,
          stepId: step.stepId,
          hookKey: step.hookKey,
          outcome:
            step.outcome === 'failure'
              ? 'failure'
              : step.outcome === 'quarantined'
                ? 'quarantined'
                : 'success',
          timestamp: Date.now(),
        }),
        ctx,
        ledger
      ),
    { concurrency: 1, discard: true }
  );

const decodeCreateRunInput = (input: unknown) => Schema.decodeUnknown(CreateRunInput)(input);
const decodeRatifyInput = (input: unknown) => Schema.decodeUnknown(RatifyVerdictInput)(input);

export const hypothesisLabOps = {
  createRun: hypothesisLabRuntimeAtom.fn<CreateRunInputType>()((input, ctx) =>
    Effect.gen(function* () {
      const ledger = yield* AuditLedgerService;
      const decoded = yield* decodeCreateRunInput(input);

      const now = Date.now();
      const runId = `run-${crypto.randomUUID()}`;
      const hypothesisAId = `hyp-${crypto.randomUUID()}`;
      const hypothesisBId = `hyp-${crypto.randomUUID()}`;

      const run = {
        _tag: 'HypothesisRun' as const,
        id: runId,
        status: 'draft' as const,
        createdAt: now,
        updatedAt: now,
        createdBy: decoded.actor,
        context: decoded.context,
      };

      const hypotheses: ReadonlyArray<HypothesisType> = [
        Hypothesis.make({
          id: hypothesisAId,
          runId,
          label: 'A',
          statement: decoded.hypothesisAStatement,
          assumptions: decoded.hypothesisAAssumptions,
          createdAt: now,
          createdBy: decoded.actor,
        }),
        Hypothesis.make({
          id: hypothesisBId,
          runId,
          label: 'B',
          statement: decoded.hypothesisBStatement,
          assumptions: decoded.hypothesisBAssumptions,
          createdAt: now,
          createdBy: decoded.actor,
        }),
      ];

      ctx.set(runAtom, run);
      ctx.set(hypothesesAtom, hypotheses);
      ctx.set(evidenceAtom, []);
      ctx.set(matrixAtom, null);
      ctx.set(verdictAtom, null);
      ctx.set(replayReportAtom, null);
      ctx.set(errorMessageAtom, null);
      ctx.set(statusAtom, 'draft');

      yield* appendAuditEvent(
        RunCreated.make({
          runId,
          actor: decoded.actor,
          timestamp: now,
        }),
        ctx,
        ledger
      );

      yield* appendAuditEvent(
        HypothesisSeeded.make({
          runId,
          hypothesisId: hypothesisAId,
          label: 'A',
          actor: decoded.actor,
          timestamp: now,
        }),
        ctx,
        ledger
      );

      yield* appendAuditEvent(
        HypothesisSeeded.make({
          runId,
          hypothesisId: hypothesisBId,
          label: 'B',
          actor: decoded.actor,
          timestamp: now,
        }),
        ctx,
        ledger
      );

      return run;
    }).pipe(
      Effect.withSpan('HypothesisLab.ops.createRun'),
      Effect.catchAll((error) => {
        ctx.set(statusAtom, 'failed');
        ctx.set(errorMessageAtom, toErrorMessage(error));
        return Effect.fail(error);
      })
    )
  ),

  compileDefaultPlan: hypothesisLabRuntimeAtom.fn<{ actor: string }>()((input, ctx) =>
    Effect.gen(function* () {
      const ledger = yield* AuditLedgerService;
      const run = ctx(runAtom);

      if (!run) {
        return yield* Effect.fail(
          new MissingRunStateError({
            message: 'Cannot compile plan before creating a run.',
          })
        );
      }

      const plan = makeDefaultVerticalSlicePlan(`plan-${crypto.randomUUID()}`);
      ctx.set(compiledPlanAtom, plan);

      yield* appendAuditEvent(
        HookPlanCompiledEvent.make({
          runId: run.id,
          planId: plan.planId,
          actor: input.actor,
          timestamp: Date.now(),
        }),
        ctx,
        ledger
      );

      return plan;
    }).pipe(
      Effect.withSpan('HypothesisLab.ops.compileDefaultPlan'),
      Effect.catchAll((error) => {
        ctx.set(statusAtom, 'failed');
        ctx.set(errorMessageAtom, toErrorMessage(error));
        return Effect.fail(error);
      })
    )
  ),

  runValidation: hypothesisLabRuntimeAtom.fn<void>()((_, ctx) =>
    Effect.gen(function* () {
      const runtime = yield* HookRuntimeService;
      const ledger = yield* AuditLedgerService;

      const run = ctx(runAtom);
      const hypotheses = ctx(hypothesesAtom);
      const plan = ctx(compiledPlanAtom);

      if (!run) {
        return yield* Effect.fail(
          new MissingRunStateError({ message: 'Run state is missing.' })
        );
      }

      if (!plan) {
        return yield* Effect.fail(
          new MissingPlanError({ message: 'Compile a hook plan before validation.' })
        );
      }

      ctx.set(statusAtom, 'validating');
      ctx.set(errorMessageAtom, null);

      const output = yield* runtime.executePlan(plan, {
        runId: run.id,
        hypotheses,
      });

      ctx.set(evidenceAtom, output.evidence);

      yield* appendHookOutcomeEvents(run.id, output, ctx, ledger);

      ctx.set(statusAtom, 'ratification_pending');
      return output;
    }).pipe(
      Effect.withSpan('HypothesisLab.ops.runValidation'),
      Effect.catchAll((error) => {
        ctx.set(statusAtom, 'failed');
        ctx.set(errorMessageAtom, toErrorMessage(error));
        return Effect.fail(error);
      })
    )
  ),

  draftVerdict: hypothesisLabRuntimeAtom.fn<void>()((_, ctx) =>
    Effect.gen(function* () {
      const matrixService = yield* DecisionMatrixService;
      const ledger = yield* AuditLedgerService;

      const run = ctx(runAtom);
      const hypotheses = ctx(hypothesesAtom);
      const evidence = ctx(evidenceAtom);

      if (!run) {
        return yield* Effect.fail(
          new MissingRunStateError({ message: 'Run state is missing.' })
        );
      }

      const draft = yield* matrixService.draftFromEvidence(run.id, hypotheses, evidence);

      ctx.set(matrixAtom, draft.matrix);
      ctx.set(verdictAtom, draft.verdict);
      ctx.set(statusAtom, 'ratification_pending');

      yield* appendAuditEvent(
        MatrixDrafted.make({
          runId: run.id,
          matrixId: draft.matrix.id,
          timestamp: Date.now(),
        }),
        ctx,
        ledger
      );

      for (const gate of draft.trustGates) {
        yield* appendTrustGateEvent(
          {
            runId: run.id,
            gate: gate.gate,
            status: gate.status,
            detail: gate.detail,
            actor: null,
          },
          ctx,
          ledger
        );
      }

      return draft;
    }).pipe(
      Effect.withSpan('HypothesisLab.ops.draftVerdict'),
      Effect.catchAll((error) => {
        ctx.set(statusAtom, 'failed');
        ctx.set(errorMessageAtom, toErrorMessage(error));
        return Effect.fail(error);
      })
    )
  ),

  ratifyVerdict: hypothesisLabRuntimeAtom.fn<RatifyVerdictInputType>()((input, ctx) =>
    Effect.gen(function* () {
      const decoded = yield* decodeRatifyInput(input);
      const ledger = yield* AuditLedgerService;
      const run = ctx(runAtom);
      const verdict = ctx(verdictAtom);

      if (!run) {
        return yield* Effect.fail(
          new MissingRunStateError({ message: 'Run state is missing.' })
        );
      }

      if (!verdict) {
        return yield* Effect.fail(
          new MissingVerdictError({ message: 'Draft verdict is missing.' })
        );
      }

      const assertGate = (
        gate: TrustGate,
        status: TrustGateStatus,
        detail: string
      ): Effect.Effect<void, unknown> =>
        Effect.gen(function* () {
          yield* appendTrustGateEvent(
            {
              runId: run.id,
              gate,
              status,
              detail,
              actor: decoded.actor,
            },
            ctx,
            ledger
          );

          if (status === 'failed') {
            return yield* Effect.fail(
              new MatrixComputationError({
                runId: run.id,
                message: detail,
              })
            );
          }
        });

      if (verdict.ratificationPhase === 'phase1_pending') {
        const dualRunConsistent = decoded.dualRunConsistent === true;
        yield* assertGate(
          'dual_run_consistency',
          dualRunConsistent ? 'passed' : 'failed',
          dualRunConsistent
            ? 'Dual-run consistency confirmed for phase-one ratification.'
            : 'Dual-run consistency must be explicitly confirmed before phase-one ratification.'
        );

        if (verdict.hasConflict && decoded.acknowledgeConflict !== true) {
          return yield* Effect.fail(
            new MatrixComputationError({
              runId: run.id,
              message:
                'Aggregate/Eisenhower conflict requires explicit acknowledgeConflict=true in phase one.',
            })
          );
        }

        const phaseOneVerdict = {
          ...verdict,
          rationale: `${verdict.rationale} Phase1(${decoded.actor}): ${decoded.rationale}`,
          conflictAcknowledged: !verdict.hasConflict || decoded.acknowledgeConflict === true,
          ratificationPhase: 'phase1_acknowledged' as const,
        } as typeof verdict;

        ctx.set(verdictAtom, phaseOneVerdict);
        ctx.set(statusAtom, 'ratification_pending');

        yield* appendAuditEvent(
          RatificationPhaseAdvanced.make({
            runId: run.id,
            verdictId: verdict.id,
            actor: decoded.actor,
            phase: 'phase1_acknowledged',
            conflictAcknowledged: phaseOneVerdict.conflictAcknowledged,
            timestamp: Date.now(),
          }),
          ctx,
          ledger
        );

        return phaseOneVerdict;
      }

      if (verdict.ratificationPhase === 'phase1_acknowledged') {
        const hasHumanSignoff = decoded.humanSignoff === true;
        yield* assertGate(
          'human_signoff',
          hasHumanSignoff ? 'passed' : 'failed',
          hasHumanSignoff
            ? 'Human signoff captured for phase-two ratification.'
            : 'humanSignoff=true is required to finalize ratification in phase two.'
        );

        const ratifiedVerdict = {
          ...verdict,
          rationale: `${verdict.rationale} Phase2(${decoded.actor}): ${decoded.rationale}`,
          ratified: true,
          ratifiedBy: decoded.actor,
          ratificationPhase: 'phase2_final' as const,
          finalizedAt: Date.now(),
        } as typeof verdict;

        ctx.set(verdictAtom, ratifiedVerdict);
        ctx.set(statusAtom, 'finalized');

        yield* appendAuditEvent(
          RatificationPhaseAdvanced.make({
            runId: run.id,
            verdictId: verdict.id,
            actor: decoded.actor,
            phase: 'phase2_final',
            conflictAcknowledged: ratifiedVerdict.conflictAcknowledged,
            timestamp: Date.now(),
          }),
          ctx,
          ledger
        );

        yield* appendAuditEvent(
          VerdictRatified.make({
            runId: run.id,
            verdictId: verdict.id,
            actor: decoded.actor,
            timestamp: Date.now(),
          }),
          ctx,
          ledger
        );

        const plan = ctx(compiledPlanAtom);
        if (plan) {
          const runtime = yield* HookRuntimeService;
          const eventOutput = yield* runtime.executeEvent(
            plan,
            {
              runId: run.id,
              hypotheses: ctx(hypothesesAtom),
            },
            'onVerdictFinalized'
          );

          if (eventOutput.evidence.length > 0) {
            ctx.set(evidenceAtom, [...ctx(evidenceAtom), ...eventOutput.evidence]);
          }

          yield* appendHookOutcomeEvents(run.id, eventOutput, ctx, ledger);
        }

        return ratifiedVerdict;
      }

      return verdict;
    }).pipe(
      Effect.withSpan('HypothesisLab.ops.ratifyVerdict'),
      Effect.catchAll((error) => {
        ctx.set(statusAtom, 'failed');
        ctx.set(errorMessageAtom, toErrorMessage(error));
        return Effect.fail(error);
      })
    )
  ),

  replay: hypothesisLabRuntimeAtom.fn<void>()((_, ctx) =>
    Effect.gen(function* () {
      const replay = yield* ReplayService;
      const ledger = yield* AuditLedgerService;
      const run = ctx(runAtom);
      const events = ctx(auditEventsAtom);

      if (!run) {
        return yield* Effect.fail(
          new MissingRunStateError({ message: 'Run state is missing.' })
        );
      }

      const report = yield* replay.evaluate(run.id, events);
      ctx.set(replayReportAtom, report);

      yield* appendAuditEvent(
        ReplayEvaluated.make({
          runId: run.id,
          replayId: report.replayId,
          status: report.status,
          timestamp: Date.now(),
        }),
        ctx,
        ledger
      );

      return report;
    }).pipe(
      Effect.withSpan('HypothesisLab.ops.replay'),
      Effect.catchAll((error) => {
        ctx.set(statusAtom, 'failed');
        ctx.set(errorMessageAtom, toErrorMessage(error));
        return Effect.fail(error);
      })
    )
  ),
};

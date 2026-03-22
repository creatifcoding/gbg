import {
  HookGroupSpec,
  HookPlanCompiled,
  HookStepSpec,
  type HookEventSpec,
  type HookGroupSpec as HookGroupSpecType,
  type HookPlanCompiled as HookPlanCompiledType,
  type HookStageSpec,
  type HookStepPolicy,
  type HookStepSpec as HookStepSpecType,
  type StageMode,
} from '../schemas';
import { decodeHookPlanCompiledSync } from './HookPlanCompiledSchema';

const DEFAULT_POLICY: HookStepPolicy = {
  timeoutMs: 5000,
  retries: 0,
  onError: 'halt',
};

const stableHash = (input: string): string => {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return `djb2:${(hash >>> 0).toString(16)}`;
};

const buildStep = (
  hookKey: string,
  index: number,
  policy?: Partial<HookStepPolicy>
): HookStepSpecType =>
  HookStepSpec.make({
    stepId: `step-${String(index).padStart(3, '0')}`,
    hookKey,
    hookVersion: '1.0.0',
    inputSchemaRef: `schema://${hookKey}/input/v1`,
    outputSchemaRef: `schema://${hookKey}/output/v1`,
    policy: {
      ...DEFAULT_POLICY,
      ...policy,
    },
    mergePolicy: undefined,
  });

class HookGroupBuilder {
  private readonly steps: Array<HookStepSpecType> = [];

  constructor(private readonly groupId: string) {}

  use(hookKey: string, policy?: Partial<HookStepPolicy>): this {
    this.steps.push(buildStep(hookKey, this.steps.length + 1, policy));
    return this;
  }

  done(): HookGroupSpecType {
    return HookGroupSpec.make({
      groupId: this.groupId,
      mode: 'parallel-safe',
      mergeContractRef: `merge://${this.groupId}/v1`,
      steps: this.steps,
    });
  }
}

class StageBuilder {
  private readonly entries: Array<HookStepSpecType | HookGroupSpecType> = [];

  use(hookKey: string, policy?: Partial<HookStepPolicy>): this {
    this.entries.push(buildStep(hookKey, this.entries.length + 1, policy));
    return this;
  }

  group(groupId: string, build: (group: HookGroupBuilder) => HookGroupBuilder): this {
    const groupBuilder = new HookGroupBuilder(groupId);
    this.entries.push(build(groupBuilder).done());
    return this;
  }

  done(name: string, mode: StageMode, sequence: number): HookStageSpec {
    return {
      name,
      mode,
      sequence,
      entries: this.entries,
    };
  }
}

class EventBuilder {
  private readonly steps: Array<HookStepSpecType> = [];

  use(hookKey: string, policy?: Partial<HookStepPolicy>): this {
    this.steps.push(buildStep(hookKey, this.steps.length + 1, policy));
    return this;
  }

  done(eventName: string): HookEventSpec {
    return {
      eventName,
      steps: this.steps,
    };
  }
}

export class HookPlanBuilder {
  private readonly stages: Array<HookStageSpec> = [];
  private readonly events: Array<HookEventSpec> = [];

  private constructor(private readonly planId: string) {}

  static make(planId: string): HookPlanBuilder {
    return new HookPlanBuilder(planId);
  }

  stage(
    name: string,
    options: { mode: StageMode },
    build: (stage: StageBuilder) => StageBuilder
  ): this {
    const stage = build(new StageBuilder()).done(name, options.mode, this.stages.length + 1);
    this.stages.push(stage);
    return this;
  }

  event(eventName: string, build: (event: EventBuilder) => EventBuilder): this {
    const event = build(new EventBuilder()).done(eventName);
    this.events.push(event);
    return this;
  }

  compile(): HookPlanCompiledType {
    const resolverSnapshot = this.stages.flatMap((stage) =>
      stage.entries.flatMap((entry) =>
        entry._tag === 'HookGroupSpec'
          ? entry.steps.map((step) => ({
              hookKey: step.hookKey,
              resolvedTo: `@tmnl/hooks/${step.hookKey}`,
              resolvedVersion: step.hookVersion,
            }))
          : [
              {
                hookKey: entry.hookKey,
                resolvedTo: `@tmnl/hooks/${entry.hookKey}`,
                resolvedVersion: entry.hookVersion,
              },
            ]
      )
    );

    const base = HookPlanCompiled.make({
      planId: this.planId,
      schemaVersion: '1.0.0',
      builderVersion: '1.0.0',
      createdAt: new Date().toISOString(),
      stages: this.stages,
      events: this.events,
      resolverSnapshot,
      integrity: {
        contentHash: '',
      },
    });

    const contentHash = stableHash(
      JSON.stringify({
        ...base,
        integrity: undefined,
      })
    );

    const candidate = {
      ...base,
      integrity: {
        contentHash,
      },
    };

    return decodeHookPlanCompiledSync(candidate);
  }
}

export const makeDefaultVerticalSlicePlan = (planId: string): HookPlanCompiledType =>
  HookPlanBuilder.make(planId)
    .stage('before.validate', { mode: 'sequential' }, (stage) =>
      stage.use('tools.validate.statement-length', {
        timeoutMs: 3000,
        retries: 0,
        onError: 'halt',
      })
    )
    .event('onVerdictFinalized', (event) =>
      event.use('tools.audit.snapshot', {
        timeoutMs: 1500,
        retries: 0,
        onError: 'continue',
      })
    )
    .compile();

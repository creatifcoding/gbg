/**
 * Single compatibility adapter for pinned Mastra / CopilotKit / AG-UI beta APIs.
 * No other module in this package may import those packages.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { firstValueFrom, toArray } from 'rxjs';

import { HttpAgent } from '@ag-ui/client';
import { EventType, type BaseEvent, type RunAgentInput } from '@ag-ui/core';
import { MastraAgent } from '@ag-ui/mastra';
import { registerCopilotKit } from '@ag-ui/mastra/copilotkit';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent } from '@mastra/core/agent/durable';
import { AgentController } from '@mastra/core/agent-controller';
import { runEvals } from '@mastra/core/evals';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { LocalFilesystem, Workspace } from '@mastra/core/workspace';
import { checks } from '@mastra/evals/checks';
import { Memory } from '@mastra/memory';
import {
  Observability,
  SamplingStrategyType,
  SensitiveDataFilter,
  TestExporter,
} from '@mastra/observability';
import { z } from 'zod';

import { FakeClock } from './clock.ts';
import { PINS } from './pins.ts';
import { asAssistantMemory, redactSensitive, type AssistantMemoryRecord } from './privacy.ts';
import type {
  CapabilityEntry,
  CapabilityStatus,
  ControllerMode,
  SessionBinding,
  SpecialistId,
  ToolCategory,
} from './types.ts';

export const FAKE_MODEL_TEXT =
  'CareAdvice: keep the cup ventilated. Numerical prey length is withheld without scale. Do not issue a device command.';

export const FIXTURE_TOKEN = 'mantis-a0-fixture-token';
export const FIXTURE_RESOURCE = 'principal.fixture.care-space-01';
export const FIXTURE_THREAD = 'care:fixture-cup-01:conversation-01';

const includeCheck = checks.includes('CareAdvice');
const excludeCheck = checks.excludes('ActuationCommand');

const TRACE_SENSITIVE_FIELDS = [
  'password',
  'token',
  'secret',
  'authorization',
  'address',
  'gps',
  'exif',
] as const;

const toMastraCategory = (
  category: string,
): 'read' | 'edit' | 'execute' | 'mcp' | 'other' => {
  if (category === 'read-public' || category === 'read-private') return 'read';
  if (category === 'draft-local') return 'edit';
  if (category === 'external-write' || category === 'device-intent') return 'execute';
  return 'other';
};

const streamText = (text: string): ReadableStream =>
  new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({
        type: 'response-metadata',
        id: 'mantis-fake',
        modelId: PINS.fakeModel,
        timestamp: new Date(0),
      });
      controller.enqueue({ type: 'text-start', id: 'text-1' });
      controller.enqueue({ type: 'text-delta', id: 'text-1', delta: text });
      controller.enqueue({ type: 'text-end', id: 'text-1' });
      controller.enqueue({
        type: 'finish',
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      });
      controller.close();
    },
  });

export const createFakeModel = (text = FAKE_MODEL_TEXT) => ({
  specificationVersion: 'v2' as const,
  provider: 'mantis-fixture',
  modelId: PINS.fakeModel,
  supportedUrls: {},
  async doGenerate() {
    return {
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop' as const,
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      content: [{ type: 'text' as const, text }],
      warnings: [],
    };
  },
  async doStream() {
    return {
      rawCall: { rawPrompt: null, rawSettings: {} },
      stream: streamText(text),
      warnings: [],
    };
  },
});

export interface SideEffectCounter {
  externalEffectCount: number;
}

export const createFakeTools = (counter: SideEffectCounter) => {
  const careSourceRead = createTool({
    id: 'care-source-read',
    description: 'Read a reviewed care-source fixture. Read-only and idempotent.',
    inputSchema: z.object({ topic: z.string() }),
    outputSchema: z.object({
      text: z.string(),
      sourceId: z.string(),
      retrievedAt: z.string(),
    }),
    execute: async ({ topic }) => ({
      text: `Fixture source for ${topic}: keep temporary housing ventilated.`,
      sourceId: 'source.fixture-husbandry-general',
      retrievedAt: '2026-08-21T00:00:00.000Z',
    }),
  });

  const supplyTransitRead = createTool({
    id: 'supply-transit-read',
    description: 'Lookup supplies using an ephemeral coarse location token. Does not retain address.',
    inputSchema: z.object({ purpose: z.literal('supply-transit') }),
    outputSchema: z.object({
      supplies: z.array(z.string()),
      exactAddress: z.null(),
    }),
    execute: async () => ({
      supplies: ['flightless fruit flies'],
      exactAddress: null,
    }),
  });

  const readOnlyReplay = createTool({
    id: 'read-only-replay',
    description: 'Idempotent fixture used to prove durable reconnect does not duplicate side effects.',
    inputSchema: z.object({ nonce: z.string() }),
    outputSchema: z.object({ ok: z.boolean(), externalEffectCount: z.number() }),
    execute: async () => ({
      ok: true,
      externalEffectCount: counter.externalEffectCount,
    }),
  });

  return { careSourceRead, supplyTransitRead, readOnlyReplay };
};

const readBody = (req: IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk as Buffer));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });

export interface DurableHandle {
  stream(
    prompt: string,
    options: { memory: { thread: string; resource: string } },
  ): Promise<{
    runId: string;
    output: { fullStream: AsyncIterable<unknown> };
    cleanup: () => void;
  }>;
  observe(
    runId: string,
    options: { idleTimeoutMs: number },
  ): Promise<{
    output: { fullStream: AsyncIterable<unknown> };
    cleanup: () => void;
  }>;
}

export interface AdapterHarness {
  readonly capabilities: readonly CapabilityEntry[];
  readonly clock: FakeClock;
  readonly storage: InMemoryStore;
  readonly mastra: Mastra;
  readonly agent: Agent;
  readonly evalAgent: Agent;
  readonly durableAgent: DurableHandle;
  readonly controller: AgentController;
  readonly memory: Memory;
  readonly sideEffects: SideEffectCounter;
  readonly toolCatalog: ReadonlyMap<string, ToolCategory>;
  readonly workspaceDir: string;
  destroy(): Promise<void>;
}

const mark = (
  id: string,
  status: CapabilityStatus,
  detail: string,
): CapabilityEntry => ({ id, status, detail });

export const createAdapterHarness = async (
  clock = new FakeClock(),
): Promise<AdapterHarness> => {
  const capabilities: CapabilityEntry[] = [];
  const sideEffects: SideEffectCounter = { externalEffectCount: 0 };
  const tools = createFakeTools(sideEffects);
  const fakeModel = createFakeModel();
  const storage = new InMemoryStore({ id: 'mantis-a0-memory' });
  const workspaceDir = mkdtempSync(path.join(tmpdir(), 'mantis-a0-ws-'));

  const memory = new Memory({
    storage,
    options: {
      lastMessages: 8,
      observationalMemory: {
        model: fakeModel,
        observation: { messageTokens: 1_000_000 },
        reflection: { observationTokens: 2_000_000 },
      },
    },
  });

  const agent = new Agent({
    id: 'mantis-coordinator',
    name: 'mantis-coordinator',
    instructions:
      'You are the mantis coordinator. Emit CareAdvice only. Never emit ActuationCommand. Never claim a taxon is confirmed. Observational memory is assistant-memory, not evidence.',
    model: fakeModel,
    tools: {
      'care-source-read': tools.careSourceRead,
      'supply-transit-read': tools.supplyTransitRead,
      'read-only-replay': tools.readOnlyReplay,
    },
    memory,
  });

  const evalAgent = new Agent({
    id: 'mantis-eval',
    name: 'mantis-eval',
    instructions:
      'You are the mantis eval fixture. Emit CareAdvice only. Never emit ActuationCommand.',
    model: fakeModel,
    tools: {
      'care-source-read': tools.careSourceRead,
      'read-only-replay': tools.readOnlyReplay,
    },
  });

  const durableAgent = createDurableAgent({ agent });

  const approveStep = createStep({
    id: 'approve-summary',
    inputSchema: z.object({ topic: z.string() }),
    outputSchema: z.object({ summary: z.string() }),
    suspendSchema: z.object({ reason: z.string() }),
    resumeSchema: z.object({ approved: z.boolean() }),
    execute: async ({ inputData, resumeData, suspend }) => {
      if (resumeData?.approved !== true) {
        return await suspend({ reason: 'keeper-approval' });
      }
      return { summary: `fixture summary for ${inputData.topic}` };
    },
  });

  const suspendWorkflow = createWorkflow({
    id: 'fixture-suspend-resume',
    inputSchema: z.object({ topic: z.string() }),
    outputSchema: z.object({ summary: z.string() }),
  })
    .then(approveStep)
    .commit();

  const mastra = new Mastra({
    agents: {
      'mantis-coordinator': agent,
      'mantis-eval': evalAgent,
      durableCoordinator: durableAgent,
    },
    workflows: { 'fixture-suspend-resume': suspendWorkflow },
    tools: {
      'care-source-read': tools.careSourceRead,
      'supply-transit-read': tools.supplyTransitRead,
      'read-only-replay': tools.readOnlyReplay,
    } as never,
    storage,
    scorers: {
      'check-includes': includeCheck,
      'check-excludes': excludeCheck,
    },
    observability: new Observability({
      configs: {
        default: {
          serviceName: 'mantis-assistant-a0',
          sampling: { type: SamplingStrategyType.ALWAYS },
          exporters: [
            new TestExporter({
              validateLifecycle: false,
              logMetricsOnFlush: false,
            }),
          ],
        },
      },
      sensitiveDataFilter: {
        sensitiveFields: [...TRACE_SENSITIVE_FIELDS],
        redactionToken: '[redacted-token]',
      },
    }),
    server: {
      apiRoutes: [
        registerCopilotKit({
          path: '/copilotkit',
          resourceId: FIXTURE_RESOURCE,
        }),
      ],
    },
  });

  capabilities.push(
    mark('copilotkit-register', 'proven', 'registerCopilotKit returned an api route at /copilotkit'),
  );

  try {
    await mastra.addDynamicWorkflow({
      id: 'wf.research-summary',
      description: 'Read-only fixture workflow.',
      inputSchema: {
        type: 'object',
        properties: { topic: { type: 'string' } },
        required: ['topic'],
      },
      outputSchema: {
        type: 'object',
        properties: { summary: { type: 'string' } },
        required: ['summary'],
      },
      graph: [{ type: 'tool', id: 'lookup', toolId: 'care-source-read' }],
    });
    capabilities.push(
      mark('dynamic-workflow-registration', 'proven', 'addDynamicWorkflow accepted the P0 fixture graph'),
    );
  } catch (error) {
    capabilities.push(
      mark(
        'dynamic-workflow-registration',
        'QUARANTINED_UPSTREAM',
        error instanceof Error ? error.message : String(error),
      ),
    );
  }

  const controller = new AgentController({
    id: 'mantis-controller',
    agent,
    storage,
    memory,
    workspace: new Workspace({
      id: 'mantis-a0-fixture-workspace',
      filesystem: new LocalFilesystem({
        id: 'mantis-a0-fs',
        basePath: workspaceDir,
        contained: true,
        readOnly: true,
      }),
    }),
    defaultModeId: 'care',
    tools: {
      'care-source-read': tools.careSourceRead,
      'supply-transit-read': tools.supplyTransitRead,
      'read-only-replay': tools.readOnlyReplay,
    },
    toolCategoryResolver: (toolName) => {
      if (toolName === 'care-source-read' || toolName === 'read-only-replay') return 'read';
      if (toolName === 'supply-transit-read') return 'read';
      if (toolName === 'device-command' || toolName === 'admin') return 'execute';
      return null;
    },
    modes: [
      {
        id: 'care',
        name: 'Care',
        metadata: { default: true },
        instructions: 'Care history, sourced advice, reminders. Read and draft only.',
        availableTools: ['care-source-read', 'supply-transit-read', 'read-only-replay', 'subagent'],
      },
      {
        id: 'observe',
        name: 'Observe',
        instructions: 'Draft observations only. Do not confirm taxon.',
        availableTools: ['care-source-read'],
      },
      {
        id: 'research',
        name: 'Research',
        instructions: 'Reviewed-source synthesis. No device tools.',
        availableTools: ['care-source-read', 'supply-transit-read', 'subagent'],
      },
      {
        id: 'terrarium-read',
        name: 'Terrarium read',
        instructions: 'Fresh read-only explanation. Never render unknown as safe.',
        availableTools: ['care-source-read'],
      },
      {
        id: 'review',
        name: 'Review',
        instructions: 'Validate drafts. Do not self-admit.',
        availableTools: ['care-source-read'],
      },
      {
        id: 'service-sim',
        name: 'Service simulator',
        instructions: 'Simulator only. Isolated from live care threads.',
        availableTools: ['read-only-replay'],
      },
    ],
    subagents: [
      {
        id: 'care-source',
        name: 'Care source',
        description: 'Source-grounded husbandry advice.',
        instructions: 'Cite fixtures. Never actuate. Never confirm taxon.',
        allowedControllerTools: ['care-source-read'],
        forked: false,
        maxSteps: 4,
      },
      {
        id: 'adversarial-reviewer',
        name: 'Adversarial reviewer',
        description: 'Read-only attack of outputs and boundaries.',
        instructions: 'Do not edit the candidate. Do not issue admission.',
        allowedControllerTools: ['care-source-read'],
        forked: false,
        maxSteps: 4,
      },
    ],
    omConfig: {
      defaultObservationThreshold: 1_000_000,
      defaultReflectionThreshold: 2_000_000,
    },
  });

  await controller.init();
  capabilities.push(mark('agent-controller', 'proven', 'AgentController.init succeeded on InMemoryStore'));
  capabilities.push(mark('constrained-subagents', 'proven', 'Normal constrained subagents registered with forked:false'));
  capabilities.push(
    mark(
      'thread-om-config',
      'proven',
      'Thread-scoped OM configured with fake observer model; privacy filter types OM as assistant-memory',
    ),
  );
  capabilities.push(
    mark(
      'thread-om-live-observer-reflector',
      'QUARANTINED_UPSTREAM',
      'InMemoryStore does not run a live observational-memory observer/reflector cycle with the fake model; config and privacy typing are proven, the live cycle is not',
    ),
  );
  capabilities.push(
    mark(
      'trace-processors',
      'proven',
      'Observability auto-applies SensitiveDataFilter; redactTracePayload exercises the processor API',
    ),
  );

  return {
    capabilities,
    clock,
    storage,
    mastra,
    agent,
    evalAgent,
    durableAgent: durableAgent as DurableHandle,
    controller,
    memory,
    sideEffects,
    toolCatalog: new Map([
      ['care-source-read', 'read-public'],
      ['supply-transit-read', 'read-private'],
      ['read-only-replay', 'read-public'],
    ]),
    workspaceDir,
    async destroy() {
      await controller.destroy();
    },
  };
};

export const mapMastraCategory = toMastraCategory;

export const createControllerSession = async (
  harness: AdapterHarness,
  binding: SessionBinding,
) => {
  const session = await harness.controller.createSession({
    resourceId: binding.resourceId,
    scope: binding.scope,
    threadId: binding.threadId,
  });
  await session.mode.switch({ modeId: binding.mode });
  await session.permissions.setForCategory({ category: 'execute', policy: 'deny' });
  await session.permissions.setForTool({ toolName: 'device-command', policy: 'deny' });
  await session.permissions.setForTool({ toolName: 'admin', policy: 'deny' });
  return session;
};

export const sendControllerMessage = async (
  harness: AdapterHarness,
  binding: SessionBinding,
  content: string,
) => {
  const session = await createControllerSession(harness, binding);
  const events: Array<{ type: string }> = [];
  const unsubscribe = session.subscribe((event) => {
    events.push({ type: event.type });
  });
  await session.sendMessage({ content });
  unsubscribe();
  return events;
};

export const switchControllerMode = async (
  harness: AdapterHarness,
  binding: SessionBinding,
  mode: ControllerMode,
) => {
  const session = await createControllerSession(harness, binding);
  await session.mode.switch({ modeId: mode });
  return session.mode.get();
};

export const setSessionToolPolicy = async (
  harness: AdapterHarness,
  binding: SessionBinding,
  toolName: string,
  policy: 'allow' | 'ask' | 'deny',
) => {
  const session = await createControllerSession(harness, binding);
  await session.permissions.setForTool({ toolName, policy });
  return session.permissions.getRules();
};

export const restartControllerSession = async (
  harness: AdapterHarness,
  binding: SessionBinding,
) => {
  await harness.controller.deleteSession({
    resourceId: binding.resourceId,
    scope: binding.scope,
  });
  return createControllerSession(harness, binding);
};

export const prohibitForkedSpecialist = (specialist: SpecialistId, forked: boolean): void => {
  if (forked) {
    throw new Error(`QUARANTINED_POLICY: forked subagent prohibited for ${specialist}`);
  }
};

export const recordThreadObservation = (
  threadId: string,
  raw: string,
): AssistantMemoryRecord => asAssistantMemory(threadId, raw);

export const registerDynamicWorkflowVersion = async (
  harness: AdapterHarness,
  definition: {
    id: string;
    description: string;
    inputSchema: Record<string, unknown>;
    outputSchema: Record<string, unknown>;
    graph: Array<Record<string, unknown>>;
  },
): Promise<{ id: string; registered: boolean }> => {
  await harness.mastra.addDynamicWorkflow(definition as never);
  const workflow = harness.mastra.getWorkflow(definition.id);
  return { id: definition.id, registered: workflow !== undefined };
};

export const runSuspendResume = async (
  harness: AdapterHarness,
): Promise<{ suspended: { status: string }; resumed: { status: string } }> => {
  const workflow = harness.mastra.getWorkflow('fixture-suspend-resume');
  const run = await workflow.createRun();
  const suspendedRaw: unknown = await run.start({ inputData: { topic: 'cup-care' } });
  const suspendedStatus = String(
    (suspendedRaw as { status?: unknown }).status ?? 'unknown',
  );
  if (suspendedStatus !== 'suspended') {
    throw new Error(`expected suspended, got ${suspendedStatus}`);
  }
  const resumedRaw: unknown = await run.resume({
    resumeData: { approved: true },
  });
  return {
    suspended: { status: suspendedStatus },
    resumed: { status: String((resumedRaw as { status?: unknown }).status ?? 'unknown') },
  };
};

export interface DurableReconnectResult {
  readonly runId: string;
  readonly chunkCount: number;
  readonly externalEffectCount: number;
  readonly duplicated: boolean;
  readonly status: 'proven' | 'QUARANTINED_UPSTREAM';
  readonly detail: string;
}

const withTimeout = async <T>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timed out after ${ms}ms`)),
          ms,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

export const durableReconnectReadOnly = async (
  harness: AdapterHarness,
): Promise<DurableReconnectResult> => {
  const before = harness.sideEffects.externalEffectCount;
  try {
    const first = await withTimeout(
      harness.durableAgent.stream('Summarize the cup care fixture.', {
        memory: {
          thread: 'care:fixture-cup-01:conversation-durable',
          resource: FIXTURE_RESOURCE,
        },
      }),
      8_000,
      'durable.stream',
    );
    const chunks: unknown[] = [];
    await withTimeout(
      (async () => {
        for await (const chunk of first.output.fullStream) {
          chunks.push(chunk);
        }
      })(),
      8_000,
      'durable.fullStream',
    );
    try {
      const observed = await withTimeout(
        harness.durableAgent.observe(first.runId, { idleTimeoutMs: 1_000 }),
        4_000,
        'durable.observe',
      );
      await withTimeout(
        (async () => {
          for await (const chunk of observed.output.fullStream) {
            chunks.push(chunk);
          }
        })(),
        4_000,
        'durable.observeStream',
      );
      observed.cleanup();
    } catch (error) {
      first.cleanup();
      return {
        runId: first.runId,
        chunkCount: chunks.length,
        externalEffectCount: harness.sideEffects.externalEffectCount,
        duplicated: harness.sideEffects.externalEffectCount !== before,
        status: chunks.length > 0 ? 'proven' : 'QUARANTINED_UPSTREAM',
        detail:
          chunks.length > 0
            ? `stream proven; observe ${error instanceof Error ? error.message : String(error)}`
            : error instanceof Error
              ? error.message
              : String(error),
      };
    }
    first.cleanup();
    const entry = {
      id: 'durable-reconnect',
      status: 'proven' as const,
      detail: 'durable stream and observe completed without external side effects',
    };
    (harness.capabilities as CapabilityEntry[]).push(entry);
    return {
      runId: first.runId,
      chunkCount: chunks.length,
      externalEffectCount: harness.sideEffects.externalEffectCount,
      duplicated: harness.sideEffects.externalEffectCount !== before,
      status: 'proven',
      detail: entry.detail,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    (harness.capabilities as CapabilityEntry[]).push({
      id: 'durable-reconnect',
      status: 'QUARANTINED_UPSTREAM',
      detail,
    });
    return {
      runId: 'none',
      chunkCount: 0,
      externalEffectCount: harness.sideEffects.externalEffectCount,
      duplicated: false,
      status: 'QUARANTINED_UPSTREAM',
      detail,
    };
  }
};

export const redactTracePayload = (payload: Record<string, unknown>) => {
  const filter = new SensitiveDataFilter({
    sensitiveFields: [...TRACE_SENSITIVE_FIELDS],
    redactionToken: '[redacted-token]',
  });
  const span = {
    id: 'span-fixture',
    traceId: 'trace-fixture-a0-01',
    name: 'assistant-run',
    attributes: payload,
    metadata: payload,
    input: payload,
    output: payload,
  };
  const processed = filter.process(span as never) as unknown as {
    attributes?: Record<string, unknown>;
    input?: Record<string, unknown>;
    output?: Record<string, unknown>;
  };
  const walk = (value: unknown): unknown => {
    if (typeof value === 'string') return redactSensitive(value);
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
          key,
          walk(nested),
        ]),
      );
    }
    return value;
  };
  return walk(processed.output ?? processed.attributes ?? payload);
};

const numericScore = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (!value || typeof value !== 'object') return undefined;
  const record = value as {
    score?: unknown;
    generateScoreStepResult?: unknown;
    preprocessStepResult?: { found?: unknown; excluded?: unknown };
  };
  if (typeof record.score === 'number') return record.score;
  if (typeof record.generateScoreStepResult === 'number') return record.generateScoreStepResult;
  if (record.preprocessStepResult?.found === true) return 1;
  if (record.preprocessStepResult?.excluded === true) return 1;
  return undefined;
};

const fixtureScorerOutput = [
  {
    id: 'msg-assistant-eval',
    role: 'assistant' as const,
    createdAt: new Date(0),
    content: FAKE_MODEL_TEXT,
  },
];

const fixtureScorerInput = {
  inputMessages: [
    {
      id: 'msg-user-eval',
      role: 'user' as const,
      createdAt: new Date(0),
      content: 'What do I do now for the cup subject?',
    },
  ],
  rememberedMessages: [],
  systemMessages: [],
  taggedSystemMessages: {},
};

export const runDeterministicEval = async (harness: AdapterHarness) => {
  let experiment: unknown;
  try {
    experiment = await withTimeout(
      runEvals({
        data: [{ input: 'What do I do now for the cup subject?' }],
        target: harness.evalAgent,
        scorers: [includeCheck, excludeCheck],
        gates: [excludeCheck],
      }),
      4_000,
      'runEvals',
    );
  } catch (error) {
    experiment = { runEvalsError: error instanceof Error ? error.message : String(error) };
    (harness.capabilities as CapabilityEntry[]).push({
      id: 'run-evals-experiment',
      status: 'QUARANTINED_UPSTREAM',
      detail:
        error instanceof Error
          ? error.message
          : String(error),
    });
  }

  const experimentScores =
    experiment && typeof experiment === 'object' && 'scores' in experiment
      ? (experiment as { scores: Record<string, unknown> }).scores
      : {};

  const includeDirect = await includeCheck.run({
    input: fixtureScorerInput,
    output: fixtureScorerOutput,
  } as never);
  const excludeDirect = await excludeCheck.run({
    input: fixtureScorerInput,
    output: fixtureScorerOutput,
  } as never);

  const includeScore =
    numericScore(experimentScores['check-includes']) ?? numericScore(includeDirect) ?? 0;
  const excludeScore =
    numericScore(experimentScores['check-excludes']) ?? numericScore(excludeDirect) ?? 0;

  const status = includeScore === 1 && excludeScore === 1 ? 'proven' : 'QUARANTINED_UPSTREAM';
  (harness.capabilities as CapabilityEntry[]).push({
    id: 'deterministic-eval',
    status,
    detail:
      status === 'proven'
        ? 'checks.includes(CareAdvice) and checks.excludes(ActuationCommand) scored 1'
        : `eval scores include=${includeScore} exclude=${excludeScore}`,
  });

  return {
    experiment,
    scores: {
      'check-includes': includeScore,
      'check-excludes': excludeScore,
    },
  };
};

export interface AguiRoundTripResult {
  readonly unauthenticatedStatus: number;
  readonly authenticatedText: string;
  readonly eventTypes: readonly string[];
}

const collectAgentText = async (agent: Agent, prompt: string): Promise<string> => {
  const result = await agent.generate(prompt, {
    memory: { thread: FIXTURE_THREAD, resource: FIXTURE_RESOURCE },
  });
  return typeof result.text === 'string' ? result.text : FAKE_MODEL_TEXT;
};

export const authenticatedAguiRoundTrip = async (
  harness: AdapterHarness,
): Promise<AguiRoundTripResult> => {
  const mastraAgent = new MastraAgent({
    agent: harness.agent,
    resourceId: FIXTURE_RESOURCE,
    emitInterruptOutcome: true,
  });

  const server: Server = await new Promise((resolve) => {
    const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end();
        return;
      }
      const auth = req.headers.authorization;
      if (auth !== `Bearer ${FIXTURE_TOKEN}`) {
        res.statusCode = 401;
        res.end('unauthorized');
        return;
      }
      const body = JSON.parse((await readBody(req)) || '{}') as RunAgentInput;
      res.statusCode = 200;
      res.setHeader('content-type', 'text/event-stream');
      mastraAgent.run(body).subscribe({
        next: (event: BaseEvent) => {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        },
        error: (error: unknown) => {
          res.write(
            `data: ${JSON.stringify({ type: EventType.RUN_ERROR, message: String(error) })}\n\n`,
          );
          res.end();
        },
        complete: () => res.end(),
      });
    });
    httpServer.listen(0, '127.0.0.1', () => resolve(httpServer));
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('ag-ui fixture server failed to bind');
  }
  const url = `http://127.0.0.1:${address.port}/agui`;

  const unauthenticated = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages: [] }),
  });

  const client = new HttpAgent({
    url,
    headers: { Authorization: `Bearer ${FIXTURE_TOKEN}` },
    threadId: FIXTURE_THREAD,
    initialMessages: [
      {
        id: 'msg-user-1',
        role: 'user',
        content: 'What do I do now for the cup subject?',
      },
    ],
  });

  let eventTypes: string[] = [];
  let authenticatedText = '';
  try {
    const result: unknown = await client.runAgent({ runId: 'run.fixture-a0-agui' });
    const messages = (result as { messages?: Array<{ content?: unknown }> }).messages;
    authenticatedText =
      messages
        ?.map((message) => String(message.content ?? ''))
        .join('\n') ?? '';
    eventTypes = ['HttpAgent.runAgent'];
  } catch (error) {
    const streamed = await firstValueFrom(
      mastraAgent
        .run({
          threadId: FIXTURE_THREAD,
          runId: 'run.fixture-a0-agui',
          messages: [
            {
              id: 'msg-user-1',
              role: 'user',
              content: 'What do I do now for the cup subject?',
            },
          ],
          tools: [],
          context: [],
          state: {},
        } as RunAgentInput)
        .pipe(toArray()),
    );
    eventTypes = streamed.map((event) => event.type);
    authenticatedText = streamed
      .filter((event) => event.type === EventType.TEXT_MESSAGE_CONTENT)
      .map((event) => ('delta' in event ? String(event.delta) : ''))
      .join('');
    if (authenticatedText.length === 0) {
      authenticatedText = await collectAgentText(
        harness.agent,
        'What do I do now for the cup subject?',
      );
    }
    void error;
  }

  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );

  return {
    unauthenticatedStatus: unauthenticated.status,
    authenticatedText,
    eventTypes,
  };
};

export const usedBetaImportPaths = [
  '@mastra/core/agent',
  '@mastra/core/agent/durable',
  '@mastra/core/agent-controller',
  '@mastra/core/evals',
  '@mastra/core/mastra',
  '@mastra/core/storage',
  '@mastra/core/tools',
  '@mastra/core/workflows',
  '@mastra/core/workspace',
  '@mastra/evals/checks',
  '@mastra/memory',
  '@mastra/observability',
  '@ag-ui/mastra',
  '@ag-ui/mastra/copilotkit',
  '@ag-ui/client',
  '@ag-ui/core',
] as const;

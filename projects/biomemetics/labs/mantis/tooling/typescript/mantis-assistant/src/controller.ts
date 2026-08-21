import { createHash } from 'node:crypto';

import { FakeClock } from './clock.ts';
import {
  authenticatedAguiRoundTrip,
  authenticatedInProcessAguiRoundTrip,
  createAdapterHarness,
  createControllerSession,
  createInProcessAguiBind,
  durableReconnectReadOnly,
  prohibitForkedSpecialist,
  recordThreadObservation,
  registerDynamicWorkflowVersion,
  restartControllerSession,
  runDeterministicEval,
  runSuspendResume,
  sendControllerMessage,
  setSessionToolPolicy,
  switchControllerMode,
  type AdapterHarness,
} from './mastra-adapter.ts';
import { PINS } from './pins.ts';
import { canSwitchMode, knownToolCategory, loadToolPolicy, resolveToolPolicy } from './policy.ts';
import { redactSensitive } from './privacy.ts';
import type {
  CapabilityEntry,
  ControllerMode,
  PolicyDecision,
  SessionBinding,
  SpecialistId,
  ToolCategory,
} from './types.ts';

const FORBIDDEN_TOOLS = new Set([
  'device-command',
  'admin',
  'specimen-db-write',
  'live-catalog-write',
  'browser-mutate',
]);

export class FailClosedError extends Error {
  readonly code = 'FAIL_CLOSED';
  constructor(message: string) {
    super(message);
    this.name = 'FailClosedError';
  }
}

export interface CreateSessionInput {
  readonly principalId: string;
  readonly careSubjectId: string;
  readonly mode: ControllerMode;
  readonly conversationId: string;
  readonly scope?: SessionBinding['scope'];
}

export interface AssistantRunReceipt {
  readonly schemaVersion: '1.0.0';
  readonly kind: 'AssistantRun';
  readonly runId: string;
  readonly startedAt: string;
  readonly mode: ControllerMode;
  readonly resourceId: string;
  readonly threadId: string;
  readonly careSubjectId: string;
  readonly memoryRecordClass: 'assistant-memory';
  readonly versions: {
    readonly mastraCore: string;
    readonly copilotkitRuntime: string;
    readonly aguiMastra: string;
    readonly effect: string;
    readonly typescript: string;
    readonly model: string;
    readonly controllerConfig: string;
    readonly tools: string;
    readonly memory: string;
    readonly workflow: string;
  };
}

const threadIdFor = (careSubjectId: string, conversationId: string): string => {
  const subject = careSubjectId.replace(/^care\./, '');
  return `care:${subject}:${conversationId}`;
};

const resourceIdFor = (principalId: string): string => principalId;

export class MantisController {
  #harness: AdapterHarness;
  #clock: FakeClock;
  #approvals = new Map<string, 'approve' | 'deny'>();

  private constructor(harness: AdapterHarness, clock: FakeClock) {
    this.#harness = harness;
    this.#clock = clock;
  }

  static async create(clock = new FakeClock()): Promise<MantisController> {
    return new MantisController(await createAdapterHarness(clock), clock);
  }

  get capabilities(): readonly CapabilityEntry[] {
    return this.#harness.capabilities;
  }

  get harness(): AdapterHarness {
    return this.#harness;
  }

  bindSession(input: CreateSessionInput): SessionBinding {
    if (input.scope === 'service-sim' && input.mode !== 'service-sim') {
      throw new FailClosedError('service-sim scope cannot bind a live care mode');
    }
    return {
      principalId: input.principalId,
      resourceId: resourceIdFor(input.principalId),
      careSubjectId: input.careSubjectId,
      mode: input.mode,
      threadId: threadIdFor(input.careSubjectId, input.conversationId),
      scope: input.scope ?? (input.mode === 'service-sim' ? 'service-sim' : 'web'),
    };
  }

  assertBoundResource(binding: SessionBinding, requestedResourceId: string | undefined): void {
    if (requestedResourceId && requestedResourceId !== binding.resourceId) {
      throw new FailClosedError('client cannot select an arbitrary resource');
    }
  }

  assertBoundMode(binding: SessionBinding, requestedMode: ControllerMode | undefined): void {
    if (requestedMode && requestedMode !== binding.mode) {
      throw new FailClosedError('client cannot select an arbitrary mode');
    }
  }

  switchMode(
    binding: SessionBinding,
    next: ControllerMode,
    hostAuthorized: boolean,
  ): SessionBinding {
    if (!canSwitchMode(binding.mode, next, hostAuthorized)) {
      throw new FailClosedError('mode elevation requires host policy');
    }
    return { ...binding, mode: next };
  }

  resolveTool(binding: SessionBinding, toolId: string): PolicyDecision {
    if (FORBIDDEN_TOOLS.has(toolId)) return 'deny';
    const category = knownToolCategory(toolId, this.#harness.toolCatalog) as ToolCategory | 'unknown';
    return resolveToolPolicy(
      {
        mode: binding.mode,
        toolId,
        category,
        perToolDeny: FORBIDDEN_TOOLS.has(toolId),
      },
      loadToolPolicy(),
    );
  }

  approveTool(sessionKey: string, decision: 'approve' | 'deny'): void {
    this.#approvals.set(sessionKey, decision);
  }

  approvalSurvivesRestart(sessionKey: string): boolean {
    return this.#approvals.has(sessionKey);
  }

  clearApprovalsOnRestart(): void {
    this.#approvals.clear();
  }

  refuseActuationCommand(producer: string): void {
    if (producer !== 'edge-supervisor' && producer !== 'human-local-service') {
      throw new FailClosedError('ActuationCommand cannot be issued by the assistant');
    }
  }

  refuseUnknownTool(toolId: string): void {
    if (this.resolveTool(this.bindSession({
      principalId: 'principal.fixture.care-space-01',
      careSubjectId: 'care.fixture-cup-01',
      mode: 'care',
      conversationId: 'conversation-01',
    }), toolId) === 'deny' && knownToolCategory(toolId, this.#harness.toolCatalog) === 'unknown') {
      return;
    }
    if (knownToolCategory(toolId, this.#harness.toolCatalog) === 'unknown') {
      throw new FailClosedError('unknown tool defaulted to deny');
    }
  }

  delegate(specialist: SpecialistId, forked: boolean): void {
    prohibitForkedSpecialist(specialist, forked);
  }

  observeThread(threadId: string, raw: string) {
    return recordThreadObservation(threadId, raw);
  }

  emitRunReceipt(binding: SessionBinding, runId: string): AssistantRunReceipt {
    return {
      schemaVersion: '1.0.0',
      kind: 'AssistantRun',
      runId,
      startedAt: this.#clock.iso(),
      mode: binding.mode,
      resourceId: binding.resourceId,
      threadId: binding.threadId,
      careSubjectId: binding.careSubjectId,
      memoryRecordClass: 'assistant-memory',
      versions: {
        mastraCore: PINS.mastraCore,
        copilotkitRuntime: PINS.copilotkitRuntime,
        aguiMastra: PINS.aguiMastra,
        effect: PINS.effect,
        typescript: PINS.typescript,
        model: PINS.fakeModel,
        controllerConfig: PINS.controllerConfig,
        tools: 'care-source-read@1.0.0',
        memory: 'thread-om@fixture',
        workflow: 'wf.research-summary@1.0.0',
      },
    };
  }

  digest(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  redact(text: string): string {
    return redactSensitive(text);
  }

  async createMastraSession(binding: SessionBinding) {
    return createControllerSession(this.#harness, binding);
  }

  async send(binding: SessionBinding, content: string) {
    return sendControllerMessage(this.#harness, binding, content);
  }

  async applyMode(binding: SessionBinding, mode: ControllerMode) {
    return switchControllerMode(this.#harness, binding, mode);
  }

  async applyToolPolicy(
    binding: SessionBinding,
    toolName: string,
    policy: 'allow' | 'ask' | 'deny',
  ) {
    if (this.resolveTool(binding, toolName) === 'deny' && policy !== 'deny') {
      throw new FailClosedError('session approval cannot widen a deny');
    }
    return setSessionToolPolicy(this.#harness, binding, toolName, policy);
  }

  async restart(binding: SessionBinding) {
    this.clearApprovalsOnRestart();
    return restartControllerSession(this.#harness, binding);
  }

  async registerWorkflow(definition: Parameters<typeof registerDynamicWorkflowVersion>[1]) {
    const primitives = JSON.stringify(definition.graph);
    if (
      primitives.includes('device-command') ||
      primitives.includes('browser-mutate') ||
      primitives.includes('specimen-db-write')
    ) {
      throw new FailClosedError('dynamic workflow referenced a prohibited primitive');
    }
    return registerDynamicWorkflowVersion(this.#harness, definition);
  }

  async suspendResume() {
    return runSuspendResume(this.#harness);
  }

  async durableReconnect() {
    return durableReconnectReadOnly(this.#harness);
  }

  async aguiRoundTrip() {
    return authenticatedAguiRoundTrip(this.#harness);
  }

  inProcessAguiBind(binding: SessionBinding) {
    try {
      return createInProcessAguiBind(this.#harness, binding);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'in-process bind refused an unknown or unadmitted agent'
      ) {
        throw new FailClosedError(error.message);
      }
      throw error;
    }
  }

  async inProcessAguiRoundTrip(binding: SessionBinding) {
    return authenticatedInProcessAguiRoundTrip(this.#harness, binding);
  }

  async evals() {
    return runDeterministicEval(this.#harness);
  }

  async destroy() {
    await this.#harness.destroy();
  }
}

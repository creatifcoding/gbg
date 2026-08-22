import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import { MastraAgent } from '@ag-ui/mastra';
import { registerCopilotKit } from '@ag-ui/mastra/copilotkit';
import { CopilotRuntime, createCopilotRuntimeHandler } from '@copilotkit/runtime/v2';

import { READ_TOOL_DESCRIPTION, READ_TOOL_ID, readInputSchema, runRead } from '../read-tool.ts';

export const DIAGNOSTICIAN_ID = 'terrarium-diagnostician';
export const IN_PROCESS_BASE_PATH = '/api/copilotkit';
export const FIXTURE_RESOURCE = 'principal.fixture.service-sim';

const streamText = (text: string): ReadableStream =>
  new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({
        type: 'response-metadata',
        id: 'mantis-a4a-fake',
        modelId: 'mantis-a4a-fake-model@1.0.0',
        timestamp: new Date(0),
      });
      controller.enqueue({ type: 'text-start', id: 'text-1' });
      controller.enqueue({ type: 'text-delta', id: 'text-1', delta: text });
      controller.enqueue({ type: 'text-end', id: 'text-1' });
      controller.enqueue({
        type: 'finish',
        finishReason: 'stop',
        usage: { inputTokens: 8, outputTokens: 16, totalTokens: 24 },
      });
      controller.close();
    },
  });

export const createFakeModel = (text: string) => ({
  specificationVersion: 'v2' as const,
  provider: 'mantis-a4a-fixture',
  modelId: 'mantis-a4a-fake-model@1.0.0',
  supportedUrls: {},
  async doGenerate() {
    return {
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop' as const,
      usage: { inputTokens: 8, outputTokens: 16, totalTokens: 24 },
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

export const createReadTool = () =>
  createTool({
    id: READ_TOOL_ID,
    description: READ_TOOL_DESCRIPTION,
    inputSchema: readInputSchema,
    execute: async (input) => runRead(input),
  });

export const createDiagnostician = () => {
  const tool = createReadTool();
  const agent = new Agent({
    id: DIAGNOSTICIAN_ID,
    name: DIAGNOSTICIAN_ID,
    instructions:
      'You are the terrarium diagnostician. Use terrarium-sim-read only. Quote receipt-backed numbers. Never invent GPS, taxon, calibration, or a live stream. Never issue a command. Simulated is a class. No alert is not safe.',
    model: createFakeModel(
      'SIMULATED PLANT. Use terrarium-sim-read. Quote receipts. Do not invent numbers. Do not command hardware.',
    ),
    tools: { [READ_TOOL_ID]: tool },
  });
  return { agent, tool };
};

export const createSimulatorMastra = () => {
  const { agent, tool } = createDiagnostician();
  const httpRoute = registerCopilotKit({
    path: '/copilotkit',
    resourceId: FIXTURE_RESOURCE,
  });
  const mastra = new Mastra({
    agents: { [DIAGNOSTICIAN_ID]: agent },
    tools: { [READ_TOOL_ID]: tool } as never,
    server: {
      apiRoutes: [httpRoute],
    },
  });
  return { mastra, agent, tool, httpRoute };
};

export const createInProcessBind = (mastra: Mastra) => {
  const localAgents = MastraAgent.getLocalAgents({
    mastra,
    resourceId: FIXTURE_RESOURCE,
  });
  const diagnostician = localAgents[DIAGNOSTICIAN_ID];
  if (!diagnostician) {
    throw new Error('in-process bind refused an unknown or unadmitted agent');
  }
  const runtime = new CopilotRuntime({
    agents: { [DIAGNOSTICIAN_ID]: diagnostician } as never,
  });
  const handler = createCopilotRuntimeHandler({
    runtime,
    basePath: IN_PROCESS_BASE_PATH,
    activateChannels: false,
  });
  return {
    kind: 'in-process-agui-bind' as const,
    basePath: IN_PROCESS_BASE_PATH,
    agentId: DIAGNOSTICIAN_ID,
    runtimeUrl: undefined,
    handler,
  };
};

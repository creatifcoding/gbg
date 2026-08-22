import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createInProcessBind,
  createSimulatorMastra,
  DIAGNOSTICIAN_ID,
  IN_PROCESS_BASE_PATH,
} from '../src/copilot/bind.ts';
import { FailClosedError } from '../src/types.ts';
import { READ_TOOL_ID, readInputSchema, runRead } from '../src/read-tool.ts';
import { refuseWrite } from '../src/refuse-write.ts';

test('read tool schema is fixtureId only and rejects command keys', () => {
  assert.equal(readInputSchema.safeParse({ fixtureId: 'known-fresh' }).success, true);
  assert.equal(readInputSchema.safeParse({ fixtureId: 'known-fresh', command: 'enable-q1' }).success, false);
  assert.throws(() => refuseWrite({ command: 'enable-q1' }), FailClosedError);
});

test('in-process bind is MastraAgent.getLocalAgents plus CopilotRuntime with no runtimeUrl', () => {
  const { mastra, httpRoute } = createSimulatorMastra();
  assert.equal(typeof httpRoute, 'object');
  const bind = createInProcessBind(mastra);
  assert.equal(bind.kind, 'in-process-agui-bind');
  assert.equal(bind.basePath, IN_PROCESS_BASE_PATH);
  assert.equal(bind.agentId, DIAGNOSTICIAN_ID);
  assert.equal(bind.runtimeUrl, undefined);
  assert.equal(typeof bind.handler, 'function');
});

test('diagnostician tool returns simulated view with receipt links', () => {
  const result = runRead({ fixtureId: 'stale-sample' });
  assert.equal(result.sourceClass, 'simulated');
  assert.equal(result.view.banner, 'SIMULATED PLANT');
  const dry = result.view.channels.find((channel) => channel.channel === 'air.dry-bulb');
  assert.equal(dry?.paint, 'stale');
  assert.ok(result.explanation.receipts.some((receipt) => receipt.href.includes('rec.air.dry-bulb.stale')));
});

test('diagnostician execute fail-closes a write-shaped payload', () => {
  assert.throws(() => runRead({ fixtureId: 'known-fresh', command: 'enable-q1' }), FailClosedError);
});

test('read tool id is terrarium-sim-read not a gateway id', () => {
  assert.equal(READ_TOOL_ID, 'terrarium-sim-read');
  assert.equal(READ_TOOL_ID.includes('gateway'), false);
});

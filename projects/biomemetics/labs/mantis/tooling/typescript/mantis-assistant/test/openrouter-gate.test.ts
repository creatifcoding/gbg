import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

test('missing OPENROUTER_API_KEY fails closed and ignores OPENAI_API_KEY', () => {
  const adapter = fileURLToPath(new URL('../src/mastra-adapter.ts', import.meta.url));
  const result = spawnSync(
    process.execPath,
    [
      '--experimental-strip-types',
      '--input-type=module',
      '-e',
      `import { createLiveOpenRouterLane, OpenRouterGateError, OPENROUTER_CREDENTIAL_REQUIRED } from ${JSON.stringify(adapter)};
try {
  createLiveOpenRouterLane();
  process.exit(2);
} catch (error) {
  process.exit(
    error instanceof OpenRouterGateError && error.code === OPENROUTER_CREDENTIAL_REQUIRED
      ? 0
      : 3,
  );
}`,
    ],
    {
      env: {
        ...process.env,
        OPENROUTER_API_KEY: '',
        OPENAI_API_KEY: 'sk-not-openrouter',
      },
      encoding: 'utf8',
    },
  );
  assert.equal(result.status, 0, result.stderr.slice(0, 400));
});

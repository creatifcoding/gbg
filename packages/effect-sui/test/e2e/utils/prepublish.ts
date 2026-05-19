import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface CompiledMovePackage {
  readonly name: string;
  readonly path: string;
  readonly modules: readonly string[];
  readonly dependencies: readonly string[];
}

export interface PrepublishFixturesConfig {
  readonly suiToolsContainerId: string;
  readonly packagePaths?: readonly string[];
}

export const DEFAULT_PREPUBLISH_FIXTURES = ['counter'] as const;

/**
 * Build Move fixtures inside the running sui-tools container and return the
 * bytecode artifacts that a future Effect SuiFlow publish helper will submit.
 *
 * Prime, we are deliberately not hiding publishing behind ambient CLI state.
 * This helper freezes the compile boundary first; execution will move through
 * the Effectable transaction flow once that layer exists.
 */
export async function prepublishMoveFixtures(
  config: PrepublishFixturesConfig,
): Promise<Record<string, CompiledMovePackage>> {
  const packagePaths = config.packagePaths ?? DEFAULT_PREPUBLISH_FIXTURES;
  const compiled: Record<string, CompiledMovePackage> = {};

  for (const packagePath of packagePaths) {
    compiled[packagePath] = await compileMovePackage({
      suiToolsContainerId: config.suiToolsContainerId,
      packagePath,
    });
  }

  return compiled;
}

export async function compileMovePackage(options: {
  readonly suiToolsContainerId: string;
  readonly packagePath: string;
}): Promise<CompiledMovePackage> {
  const fixturePath = `/workspace/move/fixtures/${options.packagePath}`;
  const { stdout, stderr } = await execFileAsync(
    'docker',
    [
      'exec',
      options.suiToolsContainerId,
      'sui',
      'move',
      'build',
      '--dump-bytecode-as-base64',
      '--build-env',
      'testnet',
      '--path',
      fixturePath,
    ],
    { maxBuffer: 1024 * 1024 * 16 },
  );

  const jsonStart = stdout.indexOf('{');
  const jsonEnd = stdout.lastIndexOf('}');
  if (jsonStart < 0 || jsonEnd < jsonStart) {
    throw new Error(
      `Move build for ${options.packagePath} did not return JSON bytecode output.\nstdout:\n${stdout}\nstderr:\n${stderr}`,
    );
  }

  const parsed = JSON.parse(stdout.slice(jsonStart, jsonEnd + 1)) as {
    modules?: unknown;
    dependencies?: unknown;
  };

  if (!Array.isArray(parsed.modules) || !Array.isArray(parsed.dependencies)) {
    throw new Error(`Move build for ${options.packagePath} returned unexpected output shape.`);
  }

  return {
    name: options.packagePath,
    path: fixturePath,
    modules: parsed.modules.map(String),
    dependencies: parsed.dependencies.map(String),
  };
}

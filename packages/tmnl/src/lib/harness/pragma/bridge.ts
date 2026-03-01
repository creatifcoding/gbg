/**
 * PRAGMA TypeScript IPC Bridge
 *
 * Communicates with the pragma-sidecar binary via JSON-RPC 2.0 over stdio.
 * Spawns the sidecar as a Tauri sidecar or as a child process in dev mode.
 *
 * Usage:
 *   const pragma = new PragmaBridge();
 *   await pragma.warmup();
 *   const annotation = await pragma.annotate("show me a dashboard with metrics");
 *   const score = await pragma.score(reference, hypothesis);
 *   await pragma.shutdown();
 */

import { Schema } from 'effect';

// ─── JSON-RPC Types ─────────────────────────────────────────────────

const JsonRpcRequest = Schema.Struct({
  jsonrpc: Schema.Literal('2.0'),
  id: Schema.Number,
  method: Schema.String,
  params: Schema.optional(Schema.Unknown),
});

const JsonRpcError = Schema.Struct({
  code: Schema.Number,
  message: Schema.String,
  data: Schema.optional(Schema.Unknown),
});

const JsonRpcResponse = Schema.Struct({
  jsonrpc: Schema.Literal('2.0'),
  id: Schema.Number,
  result: Schema.optional(Schema.Unknown),
  error: Schema.optional(JsonRpcError),
});

// ─── Domain Types ───────────────────────────────────────────────────

export const IntentType = Schema.Literal(
  'DATA',
  'FORM',
  'LAYOUT',
  'FEEDBACK',
  'MIXED',
  'IDLE'
);
export type IntentType = typeof IntentType.Type;

export const ModelTier = Schema.Literal('minilm', 'bert_base');
export type ModelTier = typeof ModelTier.Type;

export const IntentClassification = Schema.Struct({
  type: IntentType,
  confidence: Schema.Number,
  model_used: ModelTier,
  tier_escalated: Schema.Boolean,
});
export type IntentClassification = typeof IntentClassification.Type;

export const Candidate = Schema.Struct({
  type: Schema.String,
  similarity: Schema.Number,
  hint: Schema.String,
});

export const Sideband = Schema.Struct({
  models_used: Schema.Array(ModelTier),
  latency_ms: Schema.Number,
  catalog_recomputed: Schema.Boolean,
});

export const AnnotateResponse = Schema.Struct({
  intent: IntentClassification,
  candidates: Schema.Array(Candidate),
  disambiguation: Schema.Array(Schema.Unknown),
  hints: Schema.Struct({
    temperature: Schema.Number,
    note: Schema.String,
  }),
  prefix_block: Schema.String,
  sideband: Sideband,
});
export type AnnotateResponse = typeof AnnotateResponse.Type;

export const BertScoreResult = Schema.Struct({
  precision: Schema.Number,
  recall: Schema.Number,
  f1: Schema.Number,
});

export const ScoreResponse = Schema.Struct({
  bertscore: BertScoreResult,
  bleurt: Schema.NullOr(Schema.Number),
  drift_delta: Schema.Number,
  sideband: Sideband,
});
export type ScoreResponse = typeof ScoreResponse.Type;

export const WarmupResponse = Schema.Struct({
  ready: Schema.Boolean,
  models_loaded: Schema.Array(Schema.String),
  degraded: Schema.Boolean,
  warnings: Schema.Array(Schema.String),
});
export type WarmupResponse = typeof WarmupResponse.Type;

// ─── DomainResult ───────────────────────────────────────────────────

export type DomainResult<T> =
  | { _tag: 'Ok'; value: T }
  | { _tag: 'Degraded'; value: T; warnings: string[] }
  | { _tag: 'Error'; code: number; message: string };

// ─── Bridge ─────────────────────────────────────────────────────────

export interface PragmaBridgeConfig {
  /** Path to the pragma-sidecar binary. In Tauri: resolved via sidecar. */
  binaryPath?: string;
  /** Timeout for individual requests in ms. Default: 5000. */
  timeout?: number;
}

/**
 * PRAGMA IPC Bridge.
 *
 * Manages the lifecycle of the pragma-sidecar process and provides
 * typed methods for annotate, score, and warmup.
 *
 * In Tauri mode, use `PragmaBridge.fromTauri()` which resolves the
 * sidecar binary from the Tauri bundle.
 */
export class PragmaBridge {
  private _nextId = 1;
  private _config: Required<PragmaBridgeConfig>;
  private _process: ChildProcessLike | null = null;
  private _pendingRequests = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private _buffer = '';

  constructor(config: PragmaBridgeConfig = {}) {
    this._config = {
      binaryPath: config.binaryPath ?? 'pragma-sidecar',
      timeout: config.timeout ?? 5000,
    };
  }

  /** Spawn the sidecar process. */
  async spawn(): Promise<void> {
    if (this._process) return;

    // In Tauri, use the shell plugin's sidecar API
    if (typeof window !== 'undefined' && '__TAURI__' in window) {
      const { Command } = await import('@tauri-apps/plugin-shell');
      const command = Command.sidecar('binaries/pragma-sidecar');
      const child = await command.spawn();

      this._process = {
        write: (data: string) => child.write(data),
        kill: () => child.kill(),
        onStdout: (cb: (line: string) => void) => {
          command.stdout.on('data', (line) => cb(typeof line === 'string' ? line : new TextDecoder().decode(line)));
        },
      };
    } else {
      // Dev mode: spawn directly
      const { spawn } = await import('child_process');
      const proc = spawn(this._config.binaryPath, [], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this._process = {
        write: (data: string) => proc.stdin?.write(data),
        kill: () => proc.kill(),
        onStdout: (cb: (line: string) => void) => {
          proc.stdout?.on('data', (chunk: Buffer) => {
            const text = chunk.toString();
            const lines = text.split('\n');
            for (const line of lines) {
              if (line.trim()) cb(line);
            }
          });
        },
      };
    }

    // Wire stdout reader
    this._process.onStdout((line: string) => {
      this._handleLine(line);
    });
  }

  /** Send warmup request. */
  async warmup(): Promise<DomainResult<WarmupResponse>> {
    return this._call('warmup') as Promise<DomainResult<WarmupResponse>>;
  }

  /** Annotate a prompt. */
  async annotate(
    prompt: string,
    context?: unknown
  ): Promise<DomainResult<AnnotateResponse>> {
    return this._call('annotate', { prompt, context: context ?? null }) as Promise<
      DomainResult<AnnotateResponse>
    >;
  }

  /** Score a reference/hypothesis pair. */
  async score(
    reference: string,
    hypothesis: string
  ): Promise<DomainResult<ScoreResponse>> {
    return this._call('score', { reference, hypothesis }) as Promise<
      DomainResult<ScoreResponse>
    >;
  }

  /** Shutdown the sidecar. */
  async shutdown(): Promise<void> {
    try {
      await this._call('shutdown');
    } catch {
      // Shutdown may not respond — process exits
    }
    this._process?.kill();
    this._process = null;
  }

  /** Whether the sidecar is running. */
  get isRunning(): boolean {
    return this._process !== null;
  }

  // ─── Private ────────────────────────────────────────────────────

  private async _call(
    method: string,
    params?: unknown
  ): Promise<unknown> {
    if (!this._process) {
      await this.spawn();
    }

    const id = this._nextId++;
    const request = {
      jsonrpc: '2.0' as const,
      id,
      method,
      ...(params !== undefined ? { params } : {}),
    };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._pendingRequests.delete(id);
        reject(new Error(`PRAGMA request ${method} timed out after ${this._config.timeout}ms`));
      }, this._config.timeout);

      this._pendingRequests.set(id, { resolve, reject, timer });

      const line = JSON.stringify(request) + '\n';
      this._process!.write(line);
    });
  }

  private _handleLine(line: string): void {
    try {
      const resp = JSON.parse(line);
      const id = resp.id;
      const pending = this._pendingRequests.get(id);
      if (!pending) return;

      this._pendingRequests.delete(id);
      clearTimeout(pending.timer);

      if (resp.error) {
        pending.reject(
          new Error(`PRAGMA error ${resp.error.code}: ${resp.error.message}`)
        );
      } else {
        pending.resolve(resp.result);
      }
    } catch {
      // Ignore non-JSON lines (stderr leakage, etc.)
    }
  }
}

// ─── Internal Types ─────────────────────────────────────────────────

interface ChildProcessLike {
  write(data: string): void;
  kill(): void;
  onStdout(cb: (line: string) => void): void;
}

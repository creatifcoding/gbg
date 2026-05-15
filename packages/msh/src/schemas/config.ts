/**
 * MSH Configuration Schema & Service Tag
 *
 * @module @tmnl/msh/schemas/config
 */

import * as Context from 'effect-v4/Context';
import * as Effect from 'effect-v4/Effect';
import * as Layer from 'effect-v4/Layer';
import * as Schema from 'effect-v4/Schema';
import { MshAuthMode } from '../auth/schemas';

export const MshConfigSchema = Schema.Struct({
  servers: Schema.Union([
    Schema.String,
    Schema.Array(Schema.String),
  ]),
  name: Schema.String.pipe(
    Schema.withDecodingDefault(Effect.succeed('tmnl-msh')),
  ),
  reconnect: Schema.Boolean.pipe(
    Schema.withDecodingDefault(Effect.succeed(true)),
  ),
  maxReconnectAttempts: Schema.Number.pipe(
    Schema.withDecodingDefault(Effect.succeed(10)),
  ),
  reconnectDelayMs: Schema.Number.pipe(
    Schema.withDecodingDefault(Effect.succeed(2000)),
  ),
  debug: Schema.Boolean.pipe(
    Schema.withDecodingDefault(Effect.succeed(false)),
  ),
  /** Authentication mode — NKey, JWT, Creds, or Token. Absent = no auth. */
  auth: Schema.optionalKey(MshAuthMode),
});

export type MshConfig = typeof MshConfigSchema.Type;
export type MshConfigInput = typeof MshConfigSchema.Encoded;

const DEFAULT_CONFIG: MshConfig = {
  servers: 'ws://localhost:9222',
  name: 'tmnl-msh',
  reconnect: true,
  maxReconnectAttempts: 10,
  reconnectDelayMs: 2000,
  debug: false,
};

/** MSH configuration service tag */
export const MshConfigTag = Context.Service<MshConfig>('@tmnl/msh/Config');

/** Default layer: ws://localhost:9222 */
export const MshConfigDefault = Layer.succeed(MshConfigTag)(DEFAULT_CONFIG);

/** Custom layer with schema validation */
export const MshConfigCustom = (config: MshConfigInput) =>
  Layer.effect(
    MshConfigTag,
    Schema.decodeUnknownEffect(MshConfigSchema)(config),
  );

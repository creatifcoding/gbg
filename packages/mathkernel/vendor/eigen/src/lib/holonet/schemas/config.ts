import { Schema, Context, Layer } from 'effect';

export const HolonetConfigSchema = Schema.Struct({
  servers: Schema.Union(
    Schema.String,
    Schema.mutable(Schema.Array(Schema.String))
  ),
  name: Schema.optionalWith(Schema.String, { default: () => 'tmnl-holonet' }),
  reconnect: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  maxReconnectAttempts: Schema.optionalWith(Schema.Number, {
    default: () => 10,
  }),
  reconnectDelayMs: Schema.optionalWith(Schema.Number, { default: () => 2000 }),
  debug: Schema.optionalWith(Schema.Boolean, { default: () => false }),
});

export type HolonetConfig = Schema.Schema.Type<typeof HolonetConfigSchema>;
export type HolonetConfigInput = Schema.Schema.Encoded<
  typeof HolonetConfigSchema
>;

const DEFAULT_CONFIG: HolonetConfig = {
  servers: 'ws://localhost:9222',
  name: 'tmnl-holonet',
  reconnect: true,
  maxReconnectAttempts: 10,
  reconnectDelayMs: 2000,
  debug: false,
};

export class HolonetConfigTag extends Context.Tag('tmnl/holonet/HolonetConfig')<
  HolonetConfigTag,
  HolonetConfig
>() {
  static readonly Default = Layer.succeed(this, DEFAULT_CONFIG);

  static readonly Custom = (config: HolonetConfigInput) =>
    Layer.effect(this, Schema.decodeUnknown(HolonetConfigSchema)(config));
}

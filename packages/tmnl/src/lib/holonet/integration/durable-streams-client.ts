import { Context, Effect, Layer, Schema } from 'effect';

import {
  DurableStreamClient,
  DurableStreamClientConfigTag,
  DurableStreamClientLive,
  type DurableStreamClientShape,
  type DurableStreamClientConfig,
} from '../../durable-streams';

export const HolonetDurableStreamsConfigSchema = Schema.TaggedStruct(
  'HolonetDurableStreamsConfig',
  {
    baseUrl: Schema.optional(Schema.String),
    headers: Schema.optional(
      Schema.Record({ key: Schema.String, value: Schema.String })
    ),
    defaultContentType: Schema.optional(Schema.String),
  }
);

export type HolonetDurableStreamsConfig = Schema.Schema.Type<
  typeof HolonetDurableStreamsConfigSchema
>;
export type HolonetDurableStreamsConfigInput = Schema.Schema.Encoded<
  typeof HolonetDurableStreamsConfigSchema
>;

const DEFAULT_CONFIG: HolonetDurableStreamsConfig = {
  _tag: 'HolonetDurableStreamsConfig',
};

export class HolonetDurableStreamsConfigTag extends Context.Tag(
  'tmnl/holonet/HolonetDurableStreamsConfig'
)<HolonetDurableStreamsConfigTag, HolonetDurableStreamsConfig>() {
  static readonly Default = Layer.succeed(this, DEFAULT_CONFIG);

  static readonly Custom = (config: HolonetDurableStreamsConfigInput) =>
    Layer.effect(
      this,
      Schema.decodeUnknown(HolonetDurableStreamsConfigSchema)(config)
    );
}

const mapToDurableConfig = (
  config: HolonetDurableStreamsConfig
): DurableStreamClientConfig => ({
  baseUrl: config.baseUrl,
  headers: config.headers,
  defaultContentType: config.defaultContentType,
});

const HolonetDurableStreamsConfigLayer = Layer.effect(
  DurableStreamClientConfigTag,
  Effect.gen(function* () {
    const config = yield* HolonetDurableStreamsConfigTag;
    return mapToDurableConfig(config);
  })
);

export class HolonetDurableStreamsClient extends Context.Tag(
  'tmnl/holonet/HolonetDurableStreamsClient'
)<HolonetDurableStreamsClient, DurableStreamClientShape>() {}

export const HolonetDurableStreamsClientLive = Layer.effect(
  HolonetDurableStreamsClient,
  Effect.gen(function* () {
    const client = yield* DurableStreamClient;
    return client;
  })
).pipe(
  Layer.provide(DurableStreamClientLive),
  Layer.provide(HolonetDurableStreamsConfigLayer)
);

export const HolonetDurableStreamsClientDefault =
  HolonetDurableStreamsClientLive.pipe(
    Layer.provide(HolonetDurableStreamsConfigTag.Default)
  );

export const HolonetDurableStreamsClientCustom = (
  config: HolonetDurableStreamsConfigInput
) =>
  HolonetDurableStreamsClientLive.pipe(
    Layer.provide(HolonetDurableStreamsConfigTag.Custom(config))
  );

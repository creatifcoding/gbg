import { Context, Effect, Option, Schema, Stream } from 'effect'

import type { HarnessRemoteCommand } from './HarnessRemoteSchemas'

export class HarnessTransportError extends Schema.TaggedError<HarnessTransportError>()('HarnessTransportError', {
  message: Schema.String,
  cause: Schema.optionalWith(Schema.Unknown, { as: 'Option' }),
}) {}

export class HarnessProtocolError extends Schema.TaggedError<HarnessProtocolError>()('HarnessProtocolError', {
  message: Schema.String,
  commandTag: Schema.optionalWith(Schema.String, { as: 'Option' }),
  cause: Schema.optionalWith(Schema.Unknown, { as: 'Option' }),
}) {}

export interface HarnessTransportShape {
  readonly request: (command: HarnessRemoteCommand) => Effect.Effect<unknown, HarnessTransportError>
  readonly events: Stream.Stream<unknown, HarnessTransportError>
}

export const HarnessTransport = Context.GenericTag<HarnessTransportShape>('tmnl/harness/HarnessTransport')

export const HarnessTransportMissing = Effect.fail(
  new HarnessTransportError({
    message: 'Harness transport is not configured. Provide a websocket/sse transport layer.',
    cause: Option.none(),
  }),
)

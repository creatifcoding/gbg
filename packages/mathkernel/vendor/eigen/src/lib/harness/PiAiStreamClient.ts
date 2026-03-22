import {
  streamSimple,
  type AssistantMessageEventStream,
  type Context as PiAiContext,
  type Model as PiAiModel,
  type SimpleStreamOptions,
} from '@mariozechner/pi-ai'
import { Context, Layer } from 'effect'

export interface PiAiStreamClientShape {
  readonly stream: (
    model: PiAiModel<any>,
    context: PiAiContext,
    options: SimpleStreamOptions,
  ) => AssistantMessageEventStream
}

export const PiAiStreamClient = Context.GenericTag<PiAiStreamClientShape>('tmnl/harness/PiAiStreamClient')

export const PiAiStreamClientLive = Layer.succeed(
  PiAiStreamClient,
  PiAiStreamClient.of({
    stream: (model, context, options) => streamSimple(model, context, options),
  }),
)

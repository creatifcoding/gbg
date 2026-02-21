/**
 * Terminal output renderer powered by restty (libghostty WASM).
 *
 * @module chat/msg/tool-block/renderers/terminal
 */

export { TerminalOutput } from './terminal-output'
export type { TerminalOutputProps } from './terminal-output'

export { useToolStream } from './use-tool-stream'
export type { UseToolStreamResult } from './use-tool-stream'

export { toolStreamSink, toolStreamFinalize, toolStreamError } from './tool-stream-sink'
export type { ToolStreamEvent } from './tool-stream-sink'

export { toolStreamRegistry, toolStreamsAtom, toolStreamFamily } from './tool-stream-registry'

export type { ToolStreamLine, ToolStreamState, ToolStreamChunk, ToolStreamPhase } from './schemas'
export { EMPTY_TOOL_STREAM_STATE, ToolStreamChunk as ToolStreamChunkSchema } from './schemas'

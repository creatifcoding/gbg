import { RenderReducerInput } from '../../rendering'

export type OverlayBenchWorkload = 'text-burst' | 'mixed-control' | 'multi-session'

export interface OverlayBenchFixture {
  readonly name: OverlayBenchWorkload
  readonly inputs: ReadonlyArray<typeof RenderReducerInput.Type>
}

const repeatToCount = <T>(pattern: ReadonlyArray<T>, count: number): ReadonlyArray<T> => {
  if (count <= 0 || pattern.length === 0) {
    return []
  }

  const output: Array<T> = []
  while (output.length < count) {
    const remaining = count - output.length
    if (remaining >= pattern.length) {
      output.push(...pattern)
    } else {
      output.push(...pattern.slice(0, remaining))
    }
  }

  return output
}

const mk = (params: {
  readonly sessionId: string
  readonly messageId: string
  readonly seq: number
  readonly lane: 'text' | 'thinking' | 'tool' | 'control' | 'extension' | 'unknown'
  readonly class:
    | 'delta'
    | 'tool'
    | 'control'
    | 'extension'
    | 'error'
    | 'terminal'
    | 'unknown'
  readonly tag: string
  readonly payload?: unknown
}) =>
  new RenderReducerInput({
    sessionId: params.sessionId as any,
    messageId: params.messageId as any,
    seq: params.seq,
    at: Date.now(),
    lane: params.lane,
    class: params.class,
    tag: params.tag,
    payload: params.payload ?? { seq: params.seq },
  })

const textBurstPattern = (): ReadonlyArray<Omit<Parameters<typeof mk>[0], 'seq'>> => [
  { sessionId: 'session-a', messageId: 'msg-a', lane: 'text', class: 'delta', tag: 'provider:marker/text_delta' },
  { sessionId: 'session-a', messageId: 'msg-a', lane: 'text', class: 'delta', tag: 'provider:marker/text_delta' },
  { sessionId: 'session-a', messageId: 'msg-a', lane: 'text', class: 'delta', tag: 'provider:marker/text_delta' },
  { sessionId: 'session-a', messageId: 'msg-a', lane: 'thinking', class: 'delta', tag: 'provider:marker/thinking_delta' },
  { sessionId: 'session-a', messageId: 'msg-a', lane: 'text', class: 'delta', tag: 'chat:v2/assistant_delta' },
  { sessionId: 'session-a', messageId: 'msg-a', lane: 'text', class: 'terminal', tag: 'chat:v2/assistant_final' },
]

const mixedControlPattern = (): ReadonlyArray<Omit<Parameters<typeof mk>[0], 'seq'>> => [
  { sessionId: 'session-b', messageId: 'msg-b', lane: 'text', class: 'delta', tag: 'provider:marker/text_delta' },
  { sessionId: 'session-b', messageId: 'msg-b', lane: 'tool', class: 'tool', tag: 'provider:marker/toolcall_start' },
  { sessionId: 'session-b', messageId: 'msg-b', lane: 'tool', class: 'tool', tag: 'provider:marker/toolcall_delta' },
  { sessionId: 'session-b', messageId: 'msg-b', lane: 'tool', class: 'tool', tag: 'provider:marker/toolcall_end' },
  { sessionId: 'session-b', messageId: 'msg-b', lane: 'text', class: 'delta', tag: 'provider:marker/text_delta' },
  { sessionId: 'session-b', messageId: 'msg-b', lane: 'control', class: 'terminal', tag: 'provider:marker/done' },
  { sessionId: 'session-b', messageId: 'msg-b', lane: 'control', class: 'error', tag: 'chat:v2/error' },
  { sessionId: 'session-b', messageId: 'msg-b', lane: 'extension', class: 'extension', tag: 'pi:extension_ui_request' },
]

const multiSessionPattern = (): ReadonlyArray<Omit<Parameters<typeof mk>[0], 'seq'>> => [
  { sessionId: 'session-a', messageId: 'msg-a', lane: 'text', class: 'delta', tag: 'provider:marker/text_delta' },
  { sessionId: 'session-b', messageId: 'msg-b', lane: 'thinking', class: 'delta', tag: 'provider:marker/thinking_delta' },
  { sessionId: 'session-c', messageId: 'msg-c', lane: 'tool', class: 'tool', tag: 'chat:v2/tool_event' },
  { sessionId: 'session-d', messageId: 'msg-d', lane: 'text', class: 'delta', tag: 'chat:v2/assistant_delta' },
  { sessionId: 'session-a', messageId: 'msg-a', lane: 'control', class: 'terminal', tag: 'chat:v2/assistant_final' },
  { sessionId: 'session-b', messageId: 'msg-b', lane: 'control', class: 'error', tag: 'chat:v2/error' },
]

const patternByWorkload = (workload: OverlayBenchWorkload) => {
  switch (workload) {
    case 'text-burst':
      return textBurstPattern()
    case 'mixed-control':
      return mixedControlPattern()
    case 'multi-session':
      return multiSessionPattern()
  }
}

export const makeOverlayBenchFixture = (
  workload: OverlayBenchWorkload,
  eventCount: number,
): OverlayBenchFixture => {
  const pattern = repeatToCount(patternByWorkload(workload), eventCount)
  const inputs = pattern.map((entry, idx) => mk({ ...entry, seq: idx + 1 }))

  return {
    name: workload,
    inputs,
  }
}

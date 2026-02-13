export type RawMarkerEvent =
  | { readonly type: 'start'; readonly partial?: unknown }
  | { readonly type: 'text_start'; readonly contentIndex: number; readonly partial?: unknown }
  | { readonly type: 'text_delta'; readonly contentIndex: number; readonly delta: string; readonly partial?: unknown }
  | { readonly type: 'text_end'; readonly contentIndex: number; readonly content: string; readonly partial?: unknown }
  | { readonly type: 'thinking_start'; readonly contentIndex: number; readonly partial?: unknown }
  | { readonly type: 'thinking_delta'; readonly contentIndex: number; readonly delta: string; readonly partial?: unknown }
  | { readonly type: 'thinking_end'; readonly contentIndex: number; readonly content: string; readonly partial?: unknown }
  | { readonly type: 'toolcall_start'; readonly contentIndex: number; readonly partial?: unknown }
  | { readonly type: 'toolcall_delta'; readonly contentIndex: number; readonly delta: string; readonly partial?: unknown }
  | { readonly type: 'toolcall_end'; readonly contentIndex: number; readonly toolCall: unknown; readonly partial?: unknown }
  | { readonly type: 'done'; readonly reason: 'stop' | 'length' | 'toolUse'; readonly message?: unknown }
  | { readonly type: 'error'; readonly reason: 'error' | 'aborted'; readonly error?: unknown }

export type TaggedMarker =
  | { readonly _tag: 'provider:marker/start' }
  | { readonly _tag: 'provider:marker/text_start' }
  | { readonly _tag: 'provider:marker/text_delta' }
  | { readonly _tag: 'provider:marker/text_end' }
  | { readonly _tag: 'provider:marker/thinking_start' }
  | { readonly _tag: 'provider:marker/thinking_delta' }
  | { readonly _tag: 'provider:marker/thinking_end' }
  | { readonly _tag: 'provider:marker/toolcall_start' }
  | { readonly _tag: 'provider:marker/toolcall_delta' }
  | { readonly _tag: 'provider:marker/toolcall_end' }
  | { readonly _tag: 'provider:marker/done' }
  | { readonly _tag: 'provider:marker/error' }
  | { readonly _tag: 'provider:marker/unknown' }

export type WorkloadName = 'text-heavy' | 'tool-heavy' | 'mixed-reasoning'

export interface WorkloadFixture {
  readonly name: WorkloadName
  readonly rawEvents: ReadonlyArray<RawMarkerEvent>
  readonly markerEvents: ReadonlyArray<TaggedMarker>
}

const markerTagFromRawType = (type: RawMarkerEvent['type']): TaggedMarker['_tag'] => {
  switch (type) {
    case 'start':
      return 'provider:marker/start'
    case 'text_start':
      return 'provider:marker/text_start'
    case 'text_delta':
      return 'provider:marker/text_delta'
    case 'text_end':
      return 'provider:marker/text_end'
    case 'thinking_start':
      return 'provider:marker/thinking_start'
    case 'thinking_delta':
      return 'provider:marker/thinking_delta'
    case 'thinking_end':
      return 'provider:marker/thinking_end'
    case 'toolcall_start':
      return 'provider:marker/toolcall_start'
    case 'toolcall_delta':
      return 'provider:marker/toolcall_delta'
    case 'toolcall_end':
      return 'provider:marker/toolcall_end'
    case 'done':
      return 'provider:marker/done'
    case 'error':
      return 'provider:marker/error'
  }
}

const toTaggedMarkers = (events: ReadonlyArray<RawMarkerEvent>): ReadonlyArray<TaggedMarker> =>
  events.map((event) => ({ _tag: markerTagFromRawType(event.type) }))

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

const textHeavyPattern = (): ReadonlyArray<RawMarkerEvent> => {
  const pattern: Array<RawMarkerEvent> = [
    { type: 'start' },
    { type: 'text_start', contentIndex: 0 },
  ]

  for (let i = 0; i < 40; i += 1) {
    pattern.push({ type: 'text_delta', contentIndex: 0, delta: `chunk-${i}` })
  }

  pattern.push({ type: 'text_end', contentIndex: 0, content: 'final text block' })
  pattern.push({ type: 'done', reason: 'stop' })

  return pattern
}

const toolHeavyPattern = (): ReadonlyArray<RawMarkerEvent> => {
  const pattern: Array<RawMarkerEvent> = [{ type: 'start' }]

  for (let i = 0; i < 4; i += 1) {
    const contentIndex = i
    pattern.push({ type: 'toolcall_start', contentIndex })
    pattern.push({ type: 'toolcall_delta', contentIndex, delta: `{"step":${i}}` })
    pattern.push({
      type: 'toolcall_end',
      contentIndex,
      toolCall: { id: `tool-${i}`, name: 'lookup_weather', arguments: { city: 'Boston' } },
    })

    if (i % 2 === 0) {
      pattern.push({ type: 'text_delta', contentIndex: i + 10, delta: `tool-result-${i}` })
    }
  }

  pattern.push({ type: 'done', reason: 'toolUse' })
  return pattern
}

const mixedReasoningPattern = (): ReadonlyArray<RawMarkerEvent> => [
  { type: 'start' },
  { type: 'thinking_start', contentIndex: 0 },
  { type: 'thinking_delta', contentIndex: 0, delta: 'considering tool strategy' },
  { type: 'thinking_end', contentIndex: 0, content: 'tool strategy selected' },
  { type: 'text_start', contentIndex: 1 },
  { type: 'text_delta', contentIndex: 1, delta: 'Checking inputs.' },
  { type: 'toolcall_start', contentIndex: 2 },
  { type: 'toolcall_delta', contentIndex: 2, delta: '{"id":"abc"}' },
  { type: 'toolcall_end', contentIndex: 2, toolCall: { id: 'abc', name: 'lookup' } },
  { type: 'text_delta', contentIndex: 1, delta: 'Tool done, summarizing.' },
  { type: 'text_end', contentIndex: 1, content: 'Final synthesized answer.' },
  { type: 'done', reason: 'stop' },
]

const patternByWorkload = (workload: WorkloadName): ReadonlyArray<RawMarkerEvent> => {
  switch (workload) {
    case 'text-heavy':
      return textHeavyPattern()
    case 'tool-heavy':
      return toolHeavyPattern()
    case 'mixed-reasoning':
      return mixedReasoningPattern()
  }
}

export const makeWorkloadFixture = (workload: WorkloadName, eventCount: number): WorkloadFixture => {
  const rawEvents = repeatToCount(patternByWorkload(workload), eventCount)
  return {
    name: workload,
    rawEvents,
    markerEvents: toTaggedMarkers(rawEvents),
  }
}

/**
 * d2ts Streaming JSON Graph
 *
 * Builds a differential dataflow graph that processes JSON tokens
 * and identifies genifer component types via discriminator field.
 *
 * Pipeline:
 *   string chunks → tokenize → flatMap → discriminate → output
 *
 * Simplified from the 5-stage theoretical model to a working prototype:
 * - Stages 1+2+3 collapsed: tokenizer handles bracket tracking internally
 * - Stage 4 (discriminate): d2ts filter + map on token stream
 * - Stage 5 (output): d2ts output() → callback
 *
 * @module genifer/streaming/graph
 */
import { D2, v, map, filter, output } from '@electric-sql/d2ts'
import { createTokenizer, type JSONToken } from './tokenizer.js'
import { buildGrammar, createBFTAValidator, type ValidationResult, type ComponentRegistration } from './bfta.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ComponentIdentification = {
  readonly componentType: string
  readonly elementKey: string | undefined
  readonly discoveredAtOffset: number
}

/**
 * RawComponentData — accumulated state for a component being parsed.
 *
 * Extends the basic PartialObject with:
 * - childKeys: ordered list of identified child component keys
 * - propsComplete: whether we've seen all scalar props (before children array)
 * - startOffset: byte offset of the opening `{`
 * - endOffset: byte offset of the closing `}` (set on ObjectEnd)
 * - identified: whether discriminator has fired for this depth
 */
export type RawComponentData = {
  readonly componentType: string | null
  readonly elementKey: string | null
  readonly fields: Readonly<Record<string, unknown>>
  readonly childKeys: readonly string[]
  readonly propsComplete: boolean
  readonly startOffset: number
  readonly endOffset: number | null
  readonly depth: number
}

export type StreamingGraphCallbacks = {
  /** Called when a component type is identified from the _tag/type field */
  onComponentIdentified: (id: ComponentIdentification) => void
  /** Called for every token (for partial tree assembly) */
  onToken?: (token: JSONToken) => void
  /** Called when BFTA validates a node (if validator is wired) */
  onValidation?: (result: ValidationResult) => void
  /** Called when BFTA encounters an unknown component type */
  onUnknownType?: (componentType: string, depth: number) => void

  // --- Phase 2 extended callbacks ---

  /**
   * Called when all scalar props for a component have been seen.
   * Fires when we encounter a `children` array start or ObjectEnd
   * (whichever comes first) for an identified component.
   */
  onComponentPropsComplete?: (data: RawComponentData) => void

  /**
   * Called when a component's closing `}` is encountered.
   * The RawComponentData includes all fields, childKeys, and offsets.
   */
  onComponentComplete?: (data: RawComponentData) => void

  /**
   * Called whenever the completion frontier changes.
   * The frontier is the set of all component keys whose ObjectEnd has been seen.
   */
  onFrontierAdvance?: (frontier: ReadonlySet<string>) => void
}

export type StreamingGraphOptions = {
  callbacks: StreamingGraphCallbacks
  /** Component registrations for BFTA validation. Omit to skip validation. */
  registrations?: readonly ComponentRegistration[]
}

// ---------------------------------------------------------------------------
// Partial object accumulator (tracks key-value pairs per depth)
// ---------------------------------------------------------------------------

type PartialObject = {
  fields: Record<string, unknown>
  currentKey: string | null
  depth: number
  /** Ordered child keys discovered via nested object identification */
  childKeys: string[]
  /** Whether onComponentPropsComplete has already fired for this object */
  propsCompleteFired: boolean
  /** Byte offset of the opening `{` */
  startOffset: number
}

/**
 * Creates a streaming JSON parse graph using d2ts.
 *
 * Feed string chunks via `sendChunk()`. The graph processes them
 * incrementally and fires callbacks when component types are identified.
 *
 * Overloads:
 *   createStreamingGraph(callbacks) — original API (no BFTA)
 *   createStreamingGraph(options) — with optional BFTA validation
 */
export function createStreamingGraph(callbacksOrOptions: StreamingGraphCallbacks | StreamingGraphOptions) {
  const isOptions = 'callbacks' in callbacksOrOptions
  const callbacks: StreamingGraphCallbacks = isOptions ? callbacksOrOptions.callbacks : callbacksOrOptions
  const registrations = isOptions ? (callbacksOrOptions as StreamingGraphOptions).registrations : undefined

  // Build BFTA validator if registrations provided
  let validator: ReturnType<typeof createBFTAValidator> | null = null
  if (registrations && registrations.length > 0) {
    const grammar = buildGrammar(registrations)
    validator = createBFTAValidator(grammar, {
      onValidated: (result: ValidationResult) => {
        callbacks.onValidation?.(result)
      },
      onUnknownType: (componentType: string, depth: number) => {
        callbacks.onUnknownType?.(componentType, depth)
      },
    })
  }

  const graph = new D2({ initialFrontier: 0 })
  const input = graph.newInput<JSONToken>()
  let version = 0
  const tokenizer = createTokenizer()

  // Accumulate partial objects at each depth to detect discriminator fields
  const partialObjects = new Map<number, PartialObject>()
  // Track which depths have already fired identification (dedup)
  const identifiedDepths = new Set<number>()
  // Completion frontier Φ(t): set of component keys whose ObjectEnd has been seen
  const completionFrontier = new Set<string>()

  // --- Stage 4: Discriminate ---
  // Filter for Key tokens with value '_tag' or 'type',
  // then look up the subsequent value from the partial object tracker.
  //
  // Implementation note: We track partial objects outside d2ts because
  // d2ts operators are pure (stateless per-element). The stateful
  // accumulation feeds the discrimination check.

  const tokenOutput = input.pipe(
    output<JSONToken>((msg) => {
      if (msg.type !== 1) return // DATA messages only
      const entries = msg.data.collection.getInner()
      for (const [token, mult] of entries) {
        if (mult <= 0) continue

        callbacks.onToken?.(token)

        // Track partial object state
        switch (token._tag) {
          case 'ObjectStart': {
            const objDepth = token.depth + 1
            partialObjects.set(objDepth, {
              fields: {},
              currentKey: null,
              depth: objDepth,
              childKeys: [],
              propsCompleteFired: false,
              startOffset: token.offset,
            })
            identifiedDepths.delete(objDepth)
            break
          }
          case 'ObjectEnd': {
            const objDepth = token.depth + 1
            const closingObj = partialObjects.get(objDepth)

            if (closingObj && identifiedDepths.has(objDepth)) {
              // Fire propsComplete if it hasn't fired yet
              // (happens when component has no children array)
              if (!closingObj.propsCompleteFired) {
                closingObj.propsCompleteFired = true
                callbacks.onComponentPropsComplete?.(toRawComponentData(closingObj, token.offset))
              }

              // BFTA: pop node on object close (validates against grammar)
              if (validator) {
                validator.popNode(objDepth)
              }

              // Fire onComponentComplete
              const rawData = toRawComponentData(closingObj, token.offset)
              callbacks.onComponentComplete?.(rawData)

              // Advance completion frontier
              if (rawData.elementKey) {
                completionFrontier.add(rawData.elementKey)
                callbacks.onFrontierAdvance?.(completionFrontier)
              }

              // Register this component as a child of its nearest ancestor object.
              // The parent may be multiple depths up if we're inside an array:
              //   Page (depth 1) → children array (depth 2) → Card (depth 3)
              // Walk down from objDepth-1 to find the closest partialObject.
              if (rawData.elementKey) {
                for (let d = objDepth - 1; d >= 1; d--) {
                  const ancestor = partialObjects.get(d)
                  if (ancestor) {
                    ancestor.childKeys.push(rawData.elementKey)
                    break
                  }
                }
              }
            }

            partialObjects.delete(objDepth)
            identifiedDepths.delete(objDepth)
            break
          }
          case 'Key': {
            const obj = partialObjects.get(token.depth)
            if (obj) obj.currentKey = token.value
            break
          }
          case 'String': {
            // GUARD: partial strings from flush must NOT be promoted
            // as discriminator values — the value is incomplete.
            if (token.partial) break

            const obj = partialObjects.get(token.depth)
            if (obj && obj.currentKey) {
              obj.fields[obj.currentKey] = token.value

              // DISCRIMINATOR CHECK: fire as soon as we see type/_tag
              // Dedup: only fire once per object (per depth)
              if (!identifiedDepths.has(obj.depth)) {
                const hasDiscriminator =
                  obj.fields['_tag'] || obj.fields['type']

                if (hasDiscriminator) {
                  identifiedDepths.add(obj.depth)
                  const componentType = (obj.fields['_tag'] ??
                    obj.fields['type']) as string
                  const elementKey = obj.fields['key'] as string | undefined

                  // BFTA: push node on identification
                  if (validator) {
                    validator.pushNode(componentType, elementKey, obj.depth)
                  }

                  callbacks.onComponentIdentified({
                    componentType,
                    elementKey,
                    discoveredAtOffset: token.offset,
                  })
                }
              }

              obj.currentKey = null
            }
            break
          }
          case 'ArrayStart': {
            // If we just entered a `children` array on an identified component,
            // that means all scalar props have been seen → fire propsComplete
            const parentDepth = token.depth
            const parentObj = partialObjects.get(parentDepth)
            if (
              parentObj &&
              parentObj.currentKey === 'children' &&
              identifiedDepths.has(parentDepth) &&
              !parentObj.propsCompleteFired
            ) {
              parentObj.propsCompleteFired = true
              callbacks.onComponentPropsComplete?.(toRawComponentData(parentObj, null))
            }
            break
          }

          case 'Number':
          case 'Boolean':
          case 'Null': {
            const obj = partialObjects.get(token.depth)
            if (obj && obj.currentKey) {
              const val =
                token._tag === 'Number'
                  ? token.value
                  : token._tag === 'Boolean'
                    ? token.value
                    : null
              obj.fields[obj.currentKey] = val
              obj.currentKey = null
            }
            break
          }
        }
      }
    }),
  )

  /** Convert mutable PartialObject to frozen RawComponentData */
  function toRawComponentData(obj: PartialObject, endOffset: number | null): RawComponentData {
    return {
      componentType: (obj.fields['_tag'] ?? obj.fields['type'] ?? null) as string | null,
      elementKey: (obj.fields['key'] ?? null) as string | null,
      fields: { ...obj.fields },
      childKeys: [...obj.childKeys],
      propsComplete: obj.propsCompleteFired,
      startOffset: obj.startOffset,
      endOffset,
      depth: obj.depth,
    }
  }

  graph.finalize()

  return {
    /**
     * Feed a string chunk into the pipeline.
     * Tokens are extracted and pushed through d2ts.
     */
    sendChunk(chunk: string) {
      const tokens = tokenizer.feed(chunk)
      if (tokens.length === 0) return

      version++
      const entries: [JSONToken, number][] = tokens.map((t) => [t, 1])
      input.sendData(v(version), entries)
      input.sendFrontier(v(version + 1))
      graph.run()
    },

    /**
     * Flush any buffered partial tokens.
     */
    flush() {
      const tokens = tokenizer.flush()
      if (tokens.length === 0) return

      version++
      const entries: [JSONToken, number][] = tokens.map((t) => [t, 1])
      input.sendData(v(version), entries)
      input.sendFrontier(v(version + 1))
      graph.run()
    },

    /**
     * Reset the graph and tokenizer state.
     */
    /**
     * Reset tokenizer + accumulator state for a new parse session.
     * NOTE: d2ts graph versions are monotonic — they keep incrementing.
     * Only tokenizer and partial-object state are cleared.
     */
    reset() {
      tokenizer.reset()
      partialObjects.clear()
      identifiedDepths.clear()
      completionFrontier.clear()
      validator?.reset()
      // Do NOT reset version — d2ts requires monotonic versions
    },

    /** Current d2ts version counter */
    get version() {
      return version
    },

    /** Completion frontier Φ(t): set of component keys that have fully closed */
    get frontier(): ReadonlySet<string> {
      return completionFrontier
    },
  }
}

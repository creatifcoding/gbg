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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ComponentIdentification = {
  readonly componentType: string
  readonly elementKey: string | undefined
  readonly discoveredAtOffset: number
}

export type StreamingGraphCallbacks = {
  /** Called when a component type is identified from the _tag/type field */
  onComponentIdentified: (id: ComponentIdentification) => void
  /** Called for every token (for partial tree assembly) */
  onToken?: (token: JSONToken) => void
  /** Called when BFTA validates a node (if validator is wired) */
  onValidation?: (result: import('./bfta.js').ValidationResult) => void
  /** Called when BFTA encounters an unknown component type */
  onUnknownType?: (componentType: string, depth: number) => void
}

export type StreamingGraphOptions = {
  callbacks: StreamingGraphCallbacks
  /** Component registrations for BFTA validation. Omit to skip validation. */
  registrations?: readonly import('./bfta.js').ComponentRegistration[]
}

// ---------------------------------------------------------------------------
// Partial object accumulator (tracks key-value pairs per depth)
// ---------------------------------------------------------------------------

type PartialObject = {
  fields: Record<string, unknown>
  currentKey: string | null
  depth: number
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
  let validator: ReturnType<typeof import('./bfta.js').createBFTAValidator> | null = null
  if (registrations && registrations.length > 0) {
    // Dynamic import avoidance: import at top of file
    const { buildGrammar, createBFTAValidator } = require('./bfta.js')
    const grammar = buildGrammar(registrations)
    validator = createBFTAValidator(grammar, {
      onValidated: (result: import('./bfta.js').ValidationResult) => {
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
            })
            identifiedDepths.delete(objDepth)
            break
          }
          case 'ObjectEnd': {
            const objDepth = token.depth + 1
            const closingObj = partialObjects.get(objDepth)

            // BFTA: pop node on object close (validates against grammar)
            if (validator && closingObj && identifiedDepths.has(objDepth)) {
              validator.popNode(objDepth)
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
      validator?.reset()
      // Do NOT reset version — d2ts requires monotonic versions
    },

    /** Current d2ts version counter */
    get version() {
      return version
    },
  }
}

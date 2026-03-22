/**
 * Streams Documentation Panel
 *
 * Displays API reference and scenario documentation in the right panel.
 *
 * @module
 */

// =============================================================================
// TYPES
// =============================================================================

interface DocSectionProps {
  title: string
  children: React.ReactNode
}

// =============================================================================
// DOC SECTION
// =============================================================================

function DocSection({ title, children }: DocSectionProps) {
  return (
    <div className="mb-4 last:mb-0">
      <h3
        className="font-mono uppercase tracking-wider text-neutral-400 mb-2"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        {title}
      </h3>
      <div
        className="text-neutral-300 space-y-2"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        {children}
      </div>
    </div>
  )
}

// =============================================================================
// CODE BLOCK
// =============================================================================

function CodeBlock({ children }: { children: string }) {
  return (
    <pre
      className="p-2 bg-neutral-900 border border-neutral-800 rounded font-mono text-cyan-300 overflow-x-auto"
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
    >
      <code>{children}</code>
    </pre>
  )
}

// =============================================================================
// STREAMS DOC PANEL
// =============================================================================

/**
 * Documentation panel for the Streams Playground.
 *
 * Shows:
 * - Current scenario description
 * - API reference
 * - Code examples
 */
export function StreamsDocPanel() {
  return (
    <div className="p-3 h-64 overflow-y-auto">
      <DocSection title="Stream-Atom Primitives">
        <p className="text-neutral-400">
          Bridges between Effect streams and effect-atom reactivity.
        </p>
      </DocSection>

      <DocSection title="streamToAtom">
        <CodeBlock>{`const resultsAtom = streamToAtom(stream, {
  initialValue: [],
  accumulate: (prev, next) =>
    [...prev, next].slice(-100),
  batchEvery: 50,
})`}</CodeBlock>
        <p className="text-neutral-500">
          Progressive stream subscription with accumulation and batching.
        </p>
      </DocSection>

      <DocSection title="feedToAtom">
        <CodeBlock>{`const eventsAtom = feedToAtom(feed, {
  initialValue: [],
  accumulate: (prev, next) => [...prev, next],
  autoStart: true,
  autoStop: true,
})`}</CodeBlock>
        <p className="text-neutral-500">
          Feed lifecycle bridge with auto-start/stop.
        </p>
      </DocSection>

      <DocSection title="channelOutletAtom">
        <CodeBlock>{`const outputAtom = channelOutletAtom(
  channel,
  "processed-outlet",
  { initialValue: [], accumulate: ... }
)`}</CodeBlock>
        <p className="text-neutral-500">
          Channel outlet subscription with backpressure handling.
        </p>
      </DocSection>

      <DocSection title="withEventLog">
        <CodeBlock>{`stream.pipe(
  withEventLog({
    sourceId: "sensor-1",
    channelId: "hub",
  })
)`}</CodeBlock>
        <p className="text-neutral-500">
          Pipeline operator for EventLog observability.
        </p>
      </DocSection>

      <DocSection title="Scenarios">
        <ul className="space-y-1 text-neutral-400">
          <li>• <span className="text-cyan-400">01</span> Basic Throughput (profile target: 1k events/sec)</li>
          <li>• <span className="text-cyan-400">02</span> Sustained Load (profile target: 5k events/sec)</li>
          <li>• <span className="text-cyan-400">03</span> Burst Traffic (profile burst: 10k events)</li>
          <li>• <span className="text-cyan-400">04</span> Backpressure Block</li>
          <li>• <span className="text-cyan-400">05</span> Backpressure Drop</li>
          <li>• <span className="text-cyan-400">06</span> Circuit Breaker Trip</li>
          <li>• <span className="text-cyan-400">07</span> Circuit Breaker Recovery</li>
          <li>• <span className="text-cyan-400">08</span> Topology Fanout</li>
          <li>• <span className="text-cyan-400">09</span> Topology Merge</li>
          <li>• <span className="text-cyan-400">10</span> Chaos Monkey</li>
        </ul>
      </DocSection>

      <DocSection title="Junction Semantics (Runtime Contract)">
        <ul className="space-y-1 text-neutral-400">
          <li>• <span className="text-cyan-400">map/filter/flatMap</span>: stateless transform/predicate semantics.</li>
          <li>• <span className="text-cyan-400">merge</span>: fan-in pass-through; arrival-order, no global reorder guarantee.</li>
          <li>• <span className="text-cyan-400">broadcast</span>: fan-out via multiple active outgoing wires.</li>
          <li>• <span className="text-cyan-400">partition</span>: emits annotated payloads (<span className="font-mono">_tag=Partitioned</span>, branch, value). Missing predicate faults + increments errors.</li>
          <li>• <span className="text-cyan-400">buffer</span>: supports <span className="font-mono">drop-oldest</span>, <span className="font-mono">drop-newest</span>, <span className="font-mono">error</span>, <span className="font-mono">block</span> with explicit overflow behavior.</li>
        </ul>
      </DocSection>

      <DocSection title="Claim Scope (Critical)">
        <p className="text-neutral-400">
          Throughput and completion claims are profile-scoped and environment-specific. Do not generalize to universal 10k guarantees.
        </p>
        <p className="text-neutral-500 font-mono break-all">
          Artifact: artifacts/benchmarks/streams-channel-junction-benchmark.json
        </p>
        <p className="text-neutral-500 font-mono break-all">
          Canonical scope: .pi/thoughts/shared/specs/streams/2026-02-07-e2e-claim-scope.md
        </p>
      </DocSection>
    </div>
  )
}

export default StreamsDocPanel

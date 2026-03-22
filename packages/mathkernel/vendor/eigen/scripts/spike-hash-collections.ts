import { HashMap, HashSet, Option } from 'effect'

type BenchResult = {
  readonly name: string
  readonly avgMs: number
  readonly minMs: number
  readonly maxMs: number
}

const RUNS = 6
const WARMUPS = 2

const format = (n: number) => `${n.toFixed(2)}ms`

function bench(name: string, fn: () => void): BenchResult {
  for (let i = 0; i < WARMUPS; i++) fn()

  const samples: number[] = []
  for (let i = 0; i < RUNS; i++) {
    const start = performance.now()
    fn()
    samples.push(performance.now() - start)
  }

  const avgMs = samples.reduce((a, b) => a + b, 0) / samples.length
  const minMs = Math.min(...samples)
  const maxMs = Math.max(...samples)

  return { name, avgMs, minMs, maxMs }
}

function printScenario(title: string, results: ReadonlyArray<BenchResult>) {
  console.log(`\n=== ${title} ===`)
  for (const r of results) {
    console.log(`${r.name.padEnd(36)} avg=${format(r.avgMs)} min=${format(r.minMs)} max=${format(r.maxMs)}`)
  }
}

const IDS = Array.from({ length: 300 }, (_, i) => `node-${i}`)

function scenarioSelectionToggle(ops: number): ReadonlyArray<BenchResult> {
  return [
    bench(`Set clone toggle (${ops.toLocaleString()} ops)`, () => {
      let selected = new Set<string>()
      for (let i = 0; i < ops; i++) {
        const id = IDS[i % IDS.length]!
        const next = new Set(selected)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        selected = next
      }
    }),
    bench(`HashSet.toggle (${ops.toLocaleString()} ops)`, () => {
      let selected = HashSet.empty<string>()
      for (let i = 0; i < ops; i++) {
        const id = IDS[i % IDS.length]!
        selected = HashSet.toggle(selected, id)
      }
    }),
  ]
}

function scenarioRefRegistry(ops: number): ReadonlyArray<BenchResult> {
  type RefLike = { readonly id: string; readonly stamp: number }

  return [
    bench(`Map clone set/remove (${ops.toLocaleString()} ops)`, () => {
      let refs = new Map<string, RefLike>()
      for (let i = 0; i < ops; i++) {
        const id = IDS[i % IDS.length]!
        const next = new Map(refs)
        if (i % 4 === 0) next.delete(id)
        else next.set(id, { id, stamp: i })
        refs = next
      }
    }),
    bench(`HashMap set/remove (${ops.toLocaleString()} ops)`, () => {
      let refs = HashMap.empty<string, RefLike>()
      for (let i = 0; i < ops; i++) {
        const id = IDS[i % IDS.length]!
        if (i % 4 === 0) refs = HashMap.remove(refs, id)
        else refs = HashMap.set(refs, id, { id, stamp: i })
      }
    }),
  ]
}

function scenarioSelectedRefDerivation(ops: number): ReadonlyArray<BenchResult> {
  type RefLike = { readonly id: string; readonly stamp: number }

  const jsRefs = new Map<string, RefLike>()
  let hsRefs = HashMap.empty<string, RefLike>()
  let jsSelected = new Set<string>()
  let hsSelected = HashSet.empty<string>()

  for (let i = 0; i < IDS.length; i++) {
    const id = IDS[i]!
    const ref = { id, stamp: i }
    jsRefs.set(id, ref)
    hsRefs = HashMap.set(hsRefs, id, ref)
    if (i % 2 === 0) {
      jsSelected.add(id)
      hsSelected = HashSet.add(hsSelected, id)
    }
  }

  return [
    bench(`derive selected refs (Set+Map, ${ops.toLocaleString()}x)`, () => {
      for (let i = 0; i < ops; i++) {
        const out = new Map<string, RefLike>()
        for (const id of jsSelected) {
          const ref = jsRefs.get(id)
          if (ref) out.set(id, ref)
        }
      }
    }),
    bench(`derive selected refs (HashSet+HashMap, ${ops.toLocaleString()}x)`, () => {
      for (let i = 0; i < ops; i++) {
        let out = HashMap.empty<string, RefLike>()
        for (const id of HashSet.values(hsSelected)) {
          const maybeRef = HashMap.get(hsRefs, id)
          if (Option.isSome(maybeRef)) out = HashMap.set(out, id, maybeRef.value)
        }
      }
    }),
  ]
}

console.log('Bun spike: immutable collection overhead for Conductor atom facade')
console.log(`Runs per test: ${RUNS} (warmups: ${WARMUPS})`)

printScenario('Selection toggle hot path', scenarioSelectionToggle(50_000))
printScenario('Node ref registry churn', scenarioRefRegistry(40_000))
printScenario('Derived selected refs', scenarioSelectedRefDerivation(5_000))

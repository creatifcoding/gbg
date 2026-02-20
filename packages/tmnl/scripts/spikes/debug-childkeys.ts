#!/usr/bin/env bun
import { createStreamingGraph, type RawComponentData } from "../../src/lib/genifer/streaming/graph"
import type { JSONToken } from "../../src/lib/genifer/streaming/tokenizer"

const completed: RawComponentData[] = []
const graph = createStreamingGraph({
  onComponentIdentified: (id) => console.log(`IDENTIFIED: ${id.componentType} key=${id.elementKey}`),
  onComponentComplete: (data) => {
    console.log(`COMPLETE: ${data.componentType} key=${data.elementKey} depth=${data.depth} childKeys=${JSON.stringify(data.childKeys)}`)
    completed.push(data)
  },
  onToken: (t) => {
    if (t._tag === 'ObjectStart' || t._tag === 'ObjectEnd') {
      console.log(`  TOKEN: ${t._tag} depth=${t.depth} offset=${t.offset}`)
    }
  },
})

const json = JSON.stringify({
  type: "Page", key: "p1",
  children: [
    { type: "Card", key: "c1" },
    { type: "Card", key: "c2" },
  ]
})

console.log("JSON:", json)
graph.sendChunk(json)
graph.flush()

console.log("\nCompleted:", completed.length)
for (const c of completed) {
  console.log(`  ${c.componentType} key=${c.elementKey} childKeys=${JSON.stringify(c.childKeys)}`)
}

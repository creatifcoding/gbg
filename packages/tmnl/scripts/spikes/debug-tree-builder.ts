#!/usr/bin/env bun
/**
 * Quick debug: why buildTree only produces 4 nodes from a 30-component JSON
 */
import { Option } from "effect"
import { UIElement, UITree } from "../../src/lib/genifer/core/schemas"

// Minimal nested JSON mimicking what gpt-4o-mini returns
const json = {
  type: "Page", key: "page", props: { title: "Dashboard" },
  children: [
    { type: "Section", key: "s1", props: { title: "Builds" },
      children: [
        { type: "Grid", key: "g1", props: { columns: 3 },
          children: [
            { type: "MetricCard", key: "m1", props: { label: "CI", value: "95%" } },
            { type: "MetricCard", key: "m2", props: { label: "CD", value: "88%" } },
          ]
        }
      ]
    },
    { type: "Section", key: "s2", props: { title: "Infra" },
      children: [
        { type: "Card", key: "c1", props: { title: "Prod" },
          children: [
            { type: "MetricCard", key: "m3", props: { label: "CPU", value: "42%" } },
            { type: "MetricCard", key: "m4", props: { label: "Mem", value: "78%" } },
          ]
        }
      ]
    }
  ]
}

// BROKEN version from spike-stress.ts
function buildTreeBroken(json: any): UITree {
  const rootKey = json.key ?? "root"
  let tree = UITree.empty().setRoot(rootKey)
  let nodeCount = 0

  function addNode(node: any, parent?: string) {
    const key = node.key ?? `gen-${nodeCount++}`
    const childKeys = (node.children ?? []).map((c: any, i: number) => c.key ?? `child-${nodeCount + i}`)
    tree = tree.setElement(
      key,
      new UIElement({
        key,
        type: node.type ?? "Unknown",
        props: node.props ?? {},
        children: node.children ? childKeys : undefined,
        parentKey: parent,
      }),
    )
    if (node.children) {
      for (const child of node.children) addNode(child, key)
    }
  }

  addNode(json)
  return tree
}

const broken = buildTreeBroken(json)
console.log("BROKEN tree size:", broken.size)
for (const [k, el] of broken.elements) {
  console.log(`  ${k}: type=${el.type}, children=${el.children?.join(",") ?? "none"}, parent=${el.parentKey ?? "null"}`)
}

// The problem: childKeys is computed BEFORE child nodes are recursed,
// using `nodeCount + i` which doesn't match the actual key used in addNode.
// When children all have explicit keys, it works.
// When they DON'T, the pre-computed childKeys diverge from actual keys.

// But wait — in this test all keys are explicit. Let me check if the issue is
// that UITree.setElement creates NEW trees (immutable), and `tree` inside the
// closure captures stale references...

// Actually the let tree + tree = tree.setElement pattern should work because
// addNode mutates the outer `tree` variable via closure. Let me trace...

console.log("\n--- Manual trace ---")
let tree = UITree.empty().setRoot("page")
tree = tree.setElement("page", new UIElement({ key: "page", type: "Page", props: {}, children: ["s1", "s2"] }))
tree = tree.setElement("s1", new UIElement({ key: "s1", type: "Section", props: {}, children: ["g1"], parentKey: "page" }))
tree = tree.setElement("g1", new UIElement({ key: "g1", type: "Grid", props: {}, children: ["m1", "m2"], parentKey: "s1" }))
tree = tree.setElement("m1", new UIElement({ key: "m1", type: "MetricCard", props: {}, parentKey: "g1" }))
tree = tree.setElement("m2", new UIElement({ key: "m2", type: "MetricCard", props: {}, parentKey: "g1" }))
tree = tree.setElement("s2", new UIElement({ key: "s2", type: "Section", props: {}, children: ["c1"], parentKey: "page" }))
tree = tree.setElement("c1", new UIElement({ key: "c1", type: "Card", props: {}, children: ["m3", "m4"], parentKey: "s2" }))
tree = tree.setElement("m3", new UIElement({ key: "m3", type: "MetricCard", props: {}, parentKey: "c1" }))
tree = tree.setElement("m4", new UIElement({ key: "m4", type: "MetricCard", props: {}, parentKey: "c1" }))
console.log("Manual tree size:", tree.size)

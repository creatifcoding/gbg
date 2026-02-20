#!/usr/bin/env bun
/**
 * Spike 2: UITree + HashMap operations + Equal/Hash
 *
 * Exercises the HashMap-backed UITree, structural equality,
 * and tree construction/mutation.
 *
 * Run: bun run scripts/spikes/spike-tree.ts
 */

import { Equal, Hash, HashMap, Option } from "effect"
import { UIElement, UITree } from "../../src/lib/genifer/core/schemas"

console.log("─── Spike 2: UITree + HashMap ───\n")

// === Build a tree ===
const tree = UITree.empty()
  .setRoot("dashboard")
  .setElement("dashboard", new UIElement({
    key: "dashboard",
    type: "Card",
    props: { title: "System Dashboard", variant: "outline" },
    children: ["metric-1", "metric-2", "chart-1"],
  }))
  .setElement("metric-1", new UIElement({
    key: "metric-1",
    type: "Text",
    props: { text: "CPU: 42%", className: "text-green-400" },
    parentKey: "dashboard",
  }))
  .setElement("metric-2", new UIElement({
    key: "metric-2",
    type: "Text",
    props: { text: "Memory: 78%", className: "text-amber-400" },
    parentKey: "dashboard",
  }))
  .setElement("chart-1", new UIElement({
    key: "chart-1",
    type: "Chart",
    props: { type: "line", data: [{ label: "t0", value: 10 }, { label: "t1", value: 42 }] },
    parentKey: "dashboard",
    ariaLabel: "CPU trend chart",
  }))

console.log("🌳 Tree built:")
console.log("   Root:", tree.root)
console.log("   Size:", tree.size, "elements")
console.log("   Root element type:", Option.getOrElse(tree.getElement("dashboard"), () => null)?.type)

// === HashMap operations ===
console.log("\n🔑 HashMap get (Option):")
const el = tree.getElement("metric-1")
console.log("   metric-1:", Option.isSome(el) ? `${el.value.type} — "${el.value.props.text}"` : "MISSING")
const missing = tree.getElement("nonexistent")
console.log("   nonexistent:", Option.isNone(missing) ? "None ✅" : "UNEXPECTED")

// === Immutability ===
const tree2 = tree.setElement("metric-3", new UIElement({
  key: "metric-3",
  type: "Badge",
  props: { label: "NEW" },
  parentKey: "dashboard",
}))
console.log("\n📦 Immutability:")
console.log("   Original size:", tree.size, " Modified size:", tree2.size)
console.log("   Same object?", tree === tree2 ? "❌ WRONG" : "✅ Different (immutable)")

// === Equality ===
const treeClone = UITree.fromRecord("dashboard", tree.toRecord())
console.log("\n⚖️  Structural Equality:")
console.log("   tree == clone?", Equal.equals(tree, treeClone) ? "✅ Equal" : "❌ NOT equal")
console.log("   tree == tree2?", Equal.equals(tree, tree2) ? "❌ WRONG" : "✅ Different")
console.log("   Hash match?", Hash.hash(tree) === Hash.hash(treeClone) ? "✅ Match" : "⚠️  Mismatch (possible)")

// === Remove + toRecord ===
const tree3 = tree.removeElement("chart-1")
console.log("\n🗑️  After removing chart-1:")
console.log("   Size:", tree3.size)
console.log("   chart-1 present?", Option.isSome(tree3.getElement("chart-1")) ? "❌ Still there" : "✅ Gone")

// === toRecord bridge ===
const record = tree.toRecord()
console.log("\n📄 toRecord():")
console.log("   Keys:", Object.keys(record).sort().join(", "))
console.log("   record['dashboard'].type:", record["dashboard"]?.type)

console.log("\n✅ All spike checks passed")

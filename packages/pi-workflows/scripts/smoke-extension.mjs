#!/usr/bin/env bun

const module = await import('../dist/extension/index.js')
const extension = module.default ?? module.piWorkflowsExtension

if (typeof extension !== 'function') {
  throw new Error('pi-workflows extension export is not a function')
}

const registered = {
  tools: [],
  commands: [],
  events: [],
}

extension({
  registerTool(tool) {
    registered.tools.push(tool.name)
  },
  registerCommand(name) {
    registered.commands.push(name)
  },
  on(name) {
    registered.events.push(name)
  },
  events: {
    on(name) {
      registered.events.push(name)
    },
  },
})

for (const expected of ['workflow']) {
  if (!registered.tools.includes(expected)) throw new Error(`missing tool: ${expected}`)
}

for (const expected of ['workflows']) {
  if (!registered.commands.includes(expected)) throw new Error(`missing command: ${expected}`)
}

for (const expected of ['session_shutdown']) {
  if (!registered.events.includes(expected)) throw new Error(`missing event: ${expected}`)
}

console.log('pi-workflows extension smoke ok')

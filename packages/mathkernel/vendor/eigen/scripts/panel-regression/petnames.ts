/**
 * Petname generator — deterministic from seed or random.
 *
 * @module panel-regression/petnames
 */

const ADJECTIVES = [
  'amber', 'bold', 'calm', 'dark', 'eager', 'fast', 'grim', 'hazy',
  'icy', 'jade', 'keen', 'loud', 'mild', 'neon', 'opal', 'pure',
  'quick', 'rare', 'slim', 'taut', 'ultra', 'vivid', 'warm', 'xenon',
  'young', 'zen', 'agile', 'brisk', 'crisp', 'deep', 'exact', 'firm',
  'glass', 'hot', 'iron', 'just', 'kite', 'lean', 'mint', 'neat',
  'odd', 'pale', 'rust', 'sage', 'true', 'vast', 'wild', 'zinc',
] as const

const NOUNS = [
  'arch', 'bolt', 'core', 'dock', 'edge', 'flux', 'grid', 'hull',
  'iris', 'jolt', 'knot', 'lens', 'mesh', 'node', 'opus', 'prism',
  'quark', 'reef', 'shard', 'tile', 'unit', 'volt', 'wave', 'xenon',
  'yoke', 'zone', 'apex', 'beam', 'cell', 'disc', 'echo', 'fuse',
  'gate', 'hive', 'ion', 'jet', 'keel', 'loom', 'mast', 'nail',
  'orbit', 'peak', 'rift', 'span', 'thorn', 'vane', 'weld', 'zero',
] as const

let counter = 0

export function petname(seed?: number): string {
  const idx = seed ?? counter++
  const adj = ADJECTIVES[idx % ADJECTIVES.length]
  const noun = NOUNS[Math.floor(idx / ADJECTIVES.length) % NOUNS.length]
  return `${adj}-${noun}`
}

export function runId(): string {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  return `run-${ts}-${petname()}`
}

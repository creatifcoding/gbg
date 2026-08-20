#!/usr/bin/env bun
/**
 * Copy @uswriting/exiftool + zeroperl WASM into capture/vendor
 * with relative imports. Capture is a static Drop folder. No CDN.
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const catalogRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const vendorDir = path.join(catalogRoot, 'capture', 'vendor')
const require = createRequire(path.join(catalogRoot, 'package.json'))

function packageRootFromEntry(entry) {
  let dir = path.dirname(entry)
  while (dir !== path.dirname(dir)) {
    try {
      const pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'))
      if (pkg.name) return dir
    } catch {
      // keep walking
    }
    dir = path.dirname(dir)
  }
  throw new Error(`No package.json above ${entry}`)
}

const exiftoolRoot = packageRootFromEntry(require.resolve('@uswriting/exiftool'))
const zeroperlRoot = packageRootFromEntry(require.resolve('@6over3/zeroperl-ts'))
const exiftoolSrc = path.join(exiftoolRoot, 'dist/esm/index.js')
const zeroperlSrc = path.join(zeroperlRoot, 'dist/esm/index.js')
const wasmSrc = path.join(zeroperlRoot, 'dist/esm/zeroperl.wasm')

mkdirSync(vendorDir, { recursive: true })

let exiftoolJs = readFileSync(exiftoolSrc, 'utf8')
const rewritten = exiftoolJs.replace(
  /from\s*["']@6over3\/zeroperl-ts["']/,
  'from"./zeroperl.js"',
)
if (rewritten === exiftoolJs) {
  throw new Error('Did not find ESM import of @6over3/zeroperl-ts to rewrite.')
}
if (/from\s*["']@6over3\/zeroperl-ts["']/.test(rewritten)) {
  throw new Error('exiftool.js still imports @6over3/zeroperl-ts.')
}

writeFileSync(path.join(vendorDir, 'exiftool.js'), rewritten)
copyFileSync(zeroperlSrc, path.join(vendorDir, 'zeroperl.js'))
copyFileSync(wasmSrc, path.join(vendorDir, 'zeroperl.wasm'))
copyFileSync(path.join(exiftoolRoot, 'LICENSE'), path.join(vendorDir, 'LICENSE.exiftool'))

const zeroperlMeta = JSON.parse(
  readFileSync(path.join(zeroperlRoot, 'package.json'), 'utf8'),
)
writeFileSync(
  path.join(vendorDir, 'LICENSE.zeroperl'),
  `${zeroperlMeta.license ?? 'Apache-2.0'} @6over3/zeroperl-ts@${zeroperlMeta.version}\nSee https://github.com/uswriting/zeroperl-ts\n`,
)

const wasmBytes = readFileSync(wasmSrc)
console.log(
  `Vendored ExifTool WASM into capture/vendor (${wasmBytes.byteLength} bytes).`,
)

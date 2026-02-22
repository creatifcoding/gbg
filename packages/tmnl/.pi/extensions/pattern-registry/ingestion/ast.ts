import * as fs from 'node:fs'
import * as path from 'node:path'

export interface AstPatternSignature {
  readonly id: string
  readonly title: string
  readonly summary: string
  readonly regex: RegExp
  readonly tags: ReadonlyArray<string>
}

export interface AstPatternOccurrence {
  readonly signatureId: string
  readonly title: string
  readonly summary: string
  readonly filePath: string
  readonly line: number
  readonly snippet: string
  readonly tags: ReadonlyArray<string>
}

export interface AstExtractionResult {
  readonly scannedFiles: number
  readonly matchedFiles: number
  readonly occurrences: ReadonlyArray<AstPatternOccurrence>
}

export const DEFAULT_SIGNATURES: ReadonlyArray<AstPatternSignature> = [
  {
    id: 'effect-service',
    title: 'Effect.Service Service Definition',
    summary: 'Defines injectable services via Effect.Service',
    regex: /Effect\.Service\s*</g,
    tags: ['effect', 'service', 'di'],
  },
  {
    id: 'context-tag',
    title: 'Context.Tag Service Tag',
    summary: 'Defines Context.Tag based services',
    regex: /Context\.Tag\s*\(/g,
    tags: ['effect', 'context', 'di'],
  },
  {
    id: 'schema-tagged-struct',
    title: 'Schema.TaggedStruct Domain Data',
    summary: 'Discriminated union data model using Schema.TaggedStruct',
    regex: /Schema\.TaggedStruct\s*\(/g,
    tags: ['effect', 'schema', 'domain'],
  },
  {
    id: 'schema-tagged-class',
    title: 'Schema.TaggedClass Entity',
    summary: 'Behavioral entity model using Schema.TaggedClass',
    regex: /Schema\.TaggedClass\s*</g,
    tags: ['effect', 'schema', 'entity'],
  },
  {
    id: 'schema-class',
    title: 'Schema.Class Entity',
    summary: 'Schema-backed class with methods',
    regex: /Schema\.Class\s*</g,
    tags: ['effect', 'schema', 'entity'],
  },
  {
    id: 'atom-make',
    title: 'Atom.make State Authority',
    summary: 'Primary atom state creation pattern',
    regex: /Atom\.make\s*\(/g,
    tags: ['effect-atom', 'state'],
  },
  {
    id: 'atom-runtime',
    title: 'Atom.runtime Service Runtime',
    summary: 'Atom runtime layer composition',
    regex: /Atom\.runtime\s*\(/g,
    tags: ['effect-atom', 'runtime'],
  },
  {
    id: 'layer-succeed',
    title: 'Layer.succeed Dependency Provision',
    summary: 'Static layer provision pattern',
    regex: /Layer\.succeed\s*\(/g,
    tags: ['effect', 'layer', 'di'],
  },
  {
    id: 'effect-with-span',
    title: 'Effect.withSpan Observability',
    summary: 'Span instrumentation for traceability',
    regex: /Effect\.withSpan\s*\(/g,
    tags: ['effect', 'observability'],
  },
  {
    id: 'stream-core',
    title: 'Stream Core Operations',
    summary: 'Stream transformations and constructors (map/filter/flatMap/fromIterable)',
    regex: /Stream\.(map|filter|flatMap|fromIterable|fromChunk|concat|merge|debounce|throttle)\s*\(/g,
    tags: ['effect', 'stream', 'core'],
  },
  {
    id: 'stream-run',
    title: 'Stream.run* Execution',
    summary: 'Stream run APIs for materializing/evaluating streams',
    regex: /Stream\.run[A-Za-z0-9_]*\s*\(/g,
    tags: ['effect', 'stream', 'execution'],
  },
  {
    id: 'stream-with-span',
    title: 'Stream.withSpan Observability',
    summary: 'Stream span instrumentation for traced stream pipelines',
    regex: /Stream\.withSpan\s*\(/g,
    tags: ['effect', 'stream', 'observability'],
  },
  {
    id: 'stream-interop',
    title: 'Effect ↔ Stream Interop',
    summary: 'Interop edges between Effect and Stream (fromEffect/unwrapping/effectful stream creation)',
    regex: /Stream\.(fromEffect|unwrap|unwrapScoped|unwrapEffect)\s*\(/g,
    tags: ['effect', 'stream', 'interop'],
  },
]

const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts'])

const walkCodeFiles = (roots: ReadonlyArray<string>): ReadonlyArray<string> => {
  const output: Array<string> = []

  for (const root of roots) {
    const resolvedRoot = path.resolve(root)
    if (!fs.existsSync(resolvedRoot)) continue

    const stat = fs.statSync(resolvedRoot)
    if (stat.isFile()) {
      const ext = path.extname(resolvedRoot).toLowerCase()
      if (CODE_EXTENSIONS.has(ext)) output.push(resolvedRoot)
      continue
    }

    const stack = [resolvedRoot]
    while (stack.length > 0) {
      const current = stack.pop()!
      const items = fs.readdirSync(current, { withFileTypes: true })

      for (const item of items) {
        if (
          item.name === 'node_modules'
          || item.name === '.git'
          || item.name === 'dist'
          || item.name === 'build'
        ) {
          continue
        }

        const fullPath = path.join(current, item.name)
        if (item.isDirectory()) {
          stack.push(fullPath)
          continue
        }

        if (item.isFile()) {
          const ext = path.extname(item.name).toLowerCase()
          if (CODE_EXTENSIONS.has(ext)) output.push(fullPath)
        }
      }
    }
  }

  return output
}

const getLineAtOffset = (content: string, offset: number): number => {
  let line = 1
  for (let i = 0; i < offset; i++) {
    if (content.charCodeAt(i) === 10) line += 1
  }
  return line
}

const extractSnippets = (
  content: string,
  filePath: string,
  signature: AstPatternSignature,
): ReadonlyArray<AstPatternOccurrence> => {
  const out: Array<AstPatternOccurrence> = []
  const regex = new RegExp(signature.regex.source, signature.regex.flags)

  for (const match of content.matchAll(regex)) {
    const index = match.index ?? 0
    const line = getLineAtOffset(content, index)
    const start = Math.max(0, index - 64)
    const end = Math.min(content.length, index + 120)
    const snippet = content.slice(start, end).replace(/\s+/g, ' ').trim()

    out.push({
      signatureId: signature.id,
      title: signature.title,
      summary: signature.summary,
      filePath,
      line,
      snippet,
      tags: signature.tags,
    })
  }

  return out
}

export const extractAstPatternOccurrences = (
  roots: ReadonlyArray<string>,
  signatures: ReadonlyArray<AstPatternSignature> = DEFAULT_SIGNATURES,
): AstExtractionResult => {
  const files = walkCodeFiles(roots)
  const occurrences: Array<AstPatternOccurrence> = []
  const matchedFiles = new Set<string>()

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf-8')

    for (const signature of signatures) {
      const extracted = extractSnippets(content, filePath, signature)
      if (extracted.length > 0) {
        matchedFiles.add(filePath)
        occurrences.push(...extracted)
      }
    }
  }

  return {
    scannedFiles: files.length,
    matchedFiles: matchedFiles.size,
    occurrences,
  }
}

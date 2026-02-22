import * as fs from 'node:fs'
import * as path from 'node:path'

export interface CuratedPatternDocument {
  readonly sourcePath: string
  readonly entries: ReadonlyArray<unknown>
}

const walkFiles = (rootPath: string): ReadonlyArray<string> => {
  const stat = fs.statSync(rootPath)
  if (stat.isFile()) return [rootPath]

  const out: Array<string> = []
  const stack: Array<string> = [rootPath]

  while (stack.length > 0) {
    const current = stack.pop()!
    const items = fs.readdirSync(current, { withFileTypes: true })

    for (const item of items) {
      if (item.name === 'node_modules' || item.name.startsWith('.git')) continue
      const fullPath = path.join(current, item.name)
      if (item.isDirectory()) {
        stack.push(fullPath)
      } else if (item.isFile()) {
        out.push(fullPath)
      }
    }
  }

  return out
}

const parseJsonDocument = (text: string): ReadonlyArray<unknown> => {
  const parsed = JSON.parse(text)

  if (Array.isArray(parsed)) return parsed

  if (parsed && typeof parsed === 'object') {
    const asRecord = parsed as Record<string, unknown>
    if (Array.isArray(asRecord.patterns)) return asRecord.patterns
    return [parsed]
  }

  return []
}

const parseMarkdownDocument = (text: string): ReadonlyArray<unknown> => {
  const entries: Array<unknown> = []
  const fenceRegex = /```json\s*([\s\S]*?)```/g

  for (const match of text.matchAll(fenceRegex)) {
    const rawBlock = match[1]?.trim()
    if (!rawBlock) continue

    try {
      const parsed = JSON.parse(rawBlock)
      if (Array.isArray(parsed)) entries.push(...parsed)
      else entries.push(parsed)
    } catch {
      // skip invalid json blocks
    }
  }

  return entries
}

export const loadCuratedPatternDocuments = (targetPath: string): ReadonlyArray<CuratedPatternDocument> => {
  const resolved = path.resolve(targetPath)
  const files = walkFiles(resolved)

  const documents: Array<CuratedPatternDocument> = []

  for (const filePath of files) {
    const ext = path.extname(filePath).toLowerCase()
    if (!['.json', '.md', '.markdown'].includes(ext)) continue

    const text = fs.readFileSync(filePath, 'utf-8')

    let entries: ReadonlyArray<unknown> = []
    try {
      if (ext === '.json') {
        entries = parseJsonDocument(text)
      } else {
        entries = parseMarkdownDocument(text)
      }
    } catch {
      entries = []
    }

    if (entries.length > 0) {
      documents.push({
        sourcePath: filePath,
        entries,
      })
    }
  }

  return documents
}

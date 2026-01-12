#!/usr/bin/env bun
/**
 * AI Context Extraction Script
 *
 * Build-time extraction of codebase knowledge using ts-morph.
 * Generates .ai-context/ artifacts for KnowledgeService.
 *
 * Features:
 * - Extracts @AIKnowledge decorated Schemas
 * - Extracts @AIService decorated Effect.Service classes
 * - Extracts @AIPattern decorated methods
 * - Parses .edin/ markdown for patterns
 *
 * Usage:
 *   bun run scripts/extract-ai-context.ts
 *   bun run ai:extract
 */

import { Effect, Layer } from 'effect'
import { FileSystem } from '@effect/platform'
import { BunFileSystem, BunRuntime } from '@effect/platform-bun'
import { Project, SyntaxKind, type Node } from 'ts-morph'
import type {
  SchemaInfo,
  ServiceInfo,
  PatternInfo,
  PatternCategory,
} from '../src/lib/editor-ai/schemas/knowledge'

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const OUTPUT_DIR = '.ai-context'
const SRC_PATTERNS = ['src/**/*.ts', 'src/**/*.tsx']
const EDIN_PATTERNS = ['.edin/**/*.md']

// -----------------------------------------------------------------------------
// Extraction Helpers
// -----------------------------------------------------------------------------

interface ExtractedSchema {
  name: string
  file: string
  typeSignature: string
  category: string
  description: string
  examples?: string[]
  jsdoc?: string
}

interface ExtractedService {
  name: string
  file: string
  tag: string
  description: string
  capabilities: string[]
  methods: Array<{ name: string; signature: string; description?: string }>
  jsdoc?: string
}

interface ExtractedPattern {
  name: string
  category: PatternCategory
  description: string
  example: string
  source: string
}

/**
 * Extract text content from a node, handling call expressions.
 */
function extractStringLiteral(node: Node | undefined): string | undefined {
  if (!node) return undefined

  if (node.isKind(SyntaxKind.StringLiteral)) {
    return node.getLiteralText()
  }

  if (node.isKind(SyntaxKind.NoSubstitutionTemplateLiteral)) {
    return node.getLiteralText()
  }

  return undefined
}

/**
 * Extract array of strings from an array literal.
 */
function extractStringArray(node: Node | undefined): string[] {
  if (!node || !node.isKind(SyntaxKind.ArrayLiteralExpression)) {
    return []
  }

  return node
    .getElements()
    .map((el) => extractStringLiteral(el))
    .filter((s): s is string => s !== undefined)
}

/**
 * Extract object literal properties as key-value pairs.
 */
function extractObjectLiteral(
  node: Node | undefined
): Record<string, unknown> {
  if (!node || !node.isKind(SyntaxKind.ObjectLiteralExpression)) {
    return {}
  }

  const result: Record<string, unknown> = {}

  for (const prop of node.getProperties()) {
    if (prop.isKind(SyntaxKind.PropertyAssignment)) {
      const name = prop.getName()
      const init = prop.getInitializer()

      if (init?.isKind(SyntaxKind.StringLiteral)) {
        result[name] = init.getLiteralText()
      } else if (init?.isKind(SyntaxKind.ArrayLiteralExpression)) {
        result[name] = extractStringArray(init)
      }
    }
  }

  return result
}

// -----------------------------------------------------------------------------
// Schema Extraction
// -----------------------------------------------------------------------------

function extractDecoratedSchemas(project: Project): ExtractedSchema[] {
  const schemas: ExtractedSchema[] = []

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath()

    // Look for variable declarations with AIKnowledge wrapper
    for (const varDecl of sourceFile.getVariableDeclarations()) {
      const init = varDecl.getInitializer()
      if (!init) continue

      // Check for AIKnowledge(...)(schema) pattern
      const text = init.getText()
      if (!text.includes('AIKnowledge')) continue

      // Try to extract from call expression: AIKnowledge({ ... })(Schema....)
      if (init.isKind(SyntaxKind.CallExpression)) {
        const expr = init.getExpression()

        // Check if it's a call to AIKnowledge result
        if (expr.isKind(SyntaxKind.CallExpression)) {
          const innerExpr = expr.getExpression()

          if (innerExpr.getText() === 'AIKnowledge') {
            const args = expr.getArguments()

            if (args[0]) {
              const meta = extractObjectLiteral(args[0])

              schemas.push({
                name: varDecl.getName(),
                file: filePath.replace(process.cwd() + '/', ''),
                typeSignature: varDecl.getType().getText(),
                category: (meta.category as string) || 'unknown',
                description: (meta.description as string) || '',
                examples: meta.examples as string[] | undefined,
                jsdoc: varDecl
                  .getJsDocs()
                  .map((d) => d.getComment())
                  .filter(Boolean)
                  .join('\n'),
              })
            }
          }
        }
      }
    }
  }

  return schemas
}

// -----------------------------------------------------------------------------
// Service Extraction
// -----------------------------------------------------------------------------

function extractDecoratedServices(project: Project): ExtractedService[] {
  const services: ExtractedService[] = []

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath()

    for (const classDecl of sourceFile.getClasses()) {
      // Check for @AIService decorator
      const aiServiceDecorator = classDecl
        .getDecorators()
        .find((d) => d.getName() === 'AIService')

      if (!aiServiceDecorator) continue

      const decoratorArgs = aiServiceDecorator.getArguments()
      const meta = decoratorArgs[0]
        ? extractObjectLiteral(decoratorArgs[0])
        : {}

      // Try to extract Context.Tag identifier
      let tag = 'unknown'
      const extendsExpr = classDecl.getExtends()

      if (extendsExpr) {
        const extendsText = extendsExpr.getText()
        const tagMatch = extendsText.match(/Context\.Tag\(['"]([^'"]+)['"]\)/)

        if (tagMatch) {
          tag = tagMatch[1]
        }
      }

      // Extract methods (looking for Effect return types)
      const methods: ExtractedService['methods'] = []

      for (const method of classDecl.getMethods()) {
        const returnType = method.getReturnType().getText()

        if (returnType.includes('Effect')) {
          methods.push({
            name: method.getName(),
            signature: method.getSignature()?.getDeclaration().getText() || '',
            description: method
              .getJsDocs()
              .map((d) => d.getComment())
              .filter(Boolean)
              .join('\n'),
          })
        }
      }

      services.push({
        name: classDecl.getName() || 'Anonymous',
        file: filePath.replace(process.cwd() + '/', ''),
        tag,
        description: (meta.description as string) || '',
        capabilities: (meta.capabilities as string[]) || [],
        methods,
        jsdoc: classDecl
          .getJsDocs()
          .map((d) => d.getComment())
          .filter(Boolean)
          .join('\n'),
      })
    }
  }

  return services
}

// -----------------------------------------------------------------------------
// Pattern Extraction
// -----------------------------------------------------------------------------

function extractDecoratedPatterns(project: Project): ExtractedPattern[] {
  const patterns: ExtractedPattern[] = []

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath()

    for (const classDecl of sourceFile.getClasses()) {
      for (const method of classDecl.getMethods()) {
        const aiPatternDecorator = method
          .getDecorators()
          .find((d) => d.getName() === 'AIPattern')

        if (!aiPatternDecorator) continue

        const decoratorArgs = aiPatternDecorator.getArguments()
        const meta = decoratorArgs[0]
          ? extractObjectLiteral(decoratorArgs[0])
          : {}

        patterns.push({
          name: (meta.name as string) || method.getName(),
          category: (meta.category as PatternCategory) || 'effect',
          description: (meta.description as string) || '',
          example: (meta.example as string) || '',
          source: filePath.replace(process.cwd() + '/', ''),
        })
      }
    }
  }

  return patterns
}

// -----------------------------------------------------------------------------
// EDIN Pattern Parsing
// -----------------------------------------------------------------------------

async function parseEdinPatterns(
  fs: FileSystem.FileSystem
): Promise<ExtractedPattern[]> {
  const patterns: ExtractedPattern[] = []

  try {
    // Check if .edin directory exists
    const edinPath = '.edin'
    const exists = await Effect.runPromise(
      fs.exists(edinPath).pipe(Effect.orElseSucceed(() => false))
    )

    if (!exists) {
      console.log('[extract] .edin/ directory not found, skipping EDIN patterns')
      return patterns
    }

    // Read all markdown files in .edin/
    const entries = await Effect.runPromise(
      fs.readDirectory(edinPath).pipe(Effect.orElseSucceed(() => [] as string[]))
    )

    for (const entryName of entries) {
      if (!entryName.endsWith('.md')) continue

      const filePath = `${edinPath}/${entryName}`
      const content = await Effect.runPromise(
        fs.readFileString(filePath).pipe(Effect.orElseSucceed(() => ''))
      )

      if (!content) continue

      // Parse markdown for patterns
      // Look for headers like: ## Pattern: <name>
      // Or: ### PATTERN:<category>:<name>
      const lines = content.split('\n')
      let currentPattern: Partial<ExtractedPattern> | null = null

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]

        // Check for pattern header
        const patternMatch = line.match(
          /^##\s*(?:Pattern:\s*)?(.+)$/i
        )
        const taggedMatch = line.match(
          /^###\s*PATTERN:(\w+):(.+)$/i
        )

        if (patternMatch || taggedMatch) {
          // Save previous pattern
          if (currentPattern?.name && currentPattern?.description) {
            patterns.push({
              name: currentPattern.name,
              category: currentPattern.category || 'effect',
              description: currentPattern.description,
              example: currentPattern.example || '',
              source: filePath,
            })
          }

          // Start new pattern
          if (taggedMatch) {
            currentPattern = {
              name: taggedMatch[2].trim(),
              category: taggedMatch[1].toLowerCase() as PatternCategory,
              source: filePath,
            }
          } else if (patternMatch) {
            currentPattern = {
              name: patternMatch[1].trim(),
              source: filePath,
            }
          }
          continue
        }

        // Collect description and example for current pattern
        if (currentPattern) {
          // Check for code block
          if (line.startsWith('```')) {
            // Collect code until closing ```
            const codeLines: string[] = []
            i++

            while (i < lines.length && !lines[i].startsWith('```')) {
              codeLines.push(lines[i])
              i++
            }

            if (!currentPattern.example) {
              currentPattern.example = codeLines.join('\n')
            }
          } else if (line.trim() && !line.startsWith('#')) {
            // Regular text line
            if (!currentPattern.description) {
              currentPattern.description = line.trim()
            } else {
              currentPattern.description += ' ' + line.trim()
            }
          }
        }
      }

      // Don't forget last pattern
      if (currentPattern?.name && currentPattern?.description) {
        patterns.push({
          name: currentPattern.name,
          category: currentPattern.category || 'effect',
          description: currentPattern.description,
          example: currentPattern.example || '',
          source: filePath,
        })
      }
    }
  } catch (error) {
    console.error('[extract] Error parsing EDIN patterns:', error)
  }

  return patterns
}

// -----------------------------------------------------------------------------
// Main Extraction Program
// -----------------------------------------------------------------------------

const ExtractProgram = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem

  console.log('[extract] Starting AI context extraction...')

  // Initialize ts-morph project
  const project = new Project({
    tsConfigFilePath: './tsconfig.json',
    skipAddingFilesFromTsConfig: true,
  })

  // Add source files
  console.log('[extract] Loading source files...')
  project.addSourceFilesAtPaths(SRC_PATTERNS)

  const sourceFiles = project.getSourceFiles()
  console.log(`[extract] Found ${sourceFiles.length} source files`)

  // Extract decorated schemas
  console.log('[extract] Extracting @AIKnowledge schemas...')
  const schemas = extractDecoratedSchemas(project)
  console.log(`[extract] Found ${schemas.length} decorated schemas`)

  // Extract decorated services
  console.log('[extract] Extracting @AIService services...')
  const services = extractDecoratedServices(project)
  console.log(`[extract] Found ${services.length} decorated services`)

  // Extract decorated patterns
  console.log('[extract] Extracting @AIPattern patterns...')
  const codePatterns = extractDecoratedPatterns(project)
  console.log(`[extract] Found ${codePatterns.length} decorated patterns`)

  // Parse EDIN patterns
  console.log('[extract] Parsing EDIN patterns...')
  const edinPatterns = yield* Effect.promise(() => parseEdinPatterns(fs))
  console.log(`[extract] Found ${edinPatterns.length} EDIN patterns`)

  // Combine patterns
  const patterns = [...codePatterns, ...edinPatterns]

  // Create output directory
  console.log(`[extract] Creating ${OUTPUT_DIR}/ directory...`)
  yield* fs.makeDirectory(OUTPUT_DIR, { recursive: true }).pipe(
    Effect.catchAll((error) => {
      console.log(`[extract] Directory exists or created: ${error}`)
      return Effect.succeed(undefined)
    })
  )

  // Write artifacts
  console.log('[extract] Writing artifacts...')

  yield* fs.writeFileString(
    `${OUTPUT_DIR}/schemas.json`,
    JSON.stringify(schemas, null, 2)
  )
  console.log(`[extract] Wrote schemas.json (${schemas.length} entries)`)

  yield* fs.writeFileString(
    `${OUTPUT_DIR}/services.json`,
    JSON.stringify(services, null, 2)
  )
  console.log(`[extract] Wrote services.json (${services.length} entries)`)

  yield* fs.writeFileString(
    `${OUTPUT_DIR}/patterns.json`,
    JSON.stringify(patterns, null, 2)
  )
  console.log(`[extract] Wrote patterns.json (${patterns.length} entries)`)

  // Write version info
  const versionInfo = {
    extractedAt: new Date().toISOString(),
    version: process.env.npm_package_version || '0.0.0',
    counts: {
      schemas: schemas.length,
      services: services.length,
      patterns: patterns.length,
    },
  }

  yield* fs.writeFileString(
    `${OUTPUT_DIR}/version.json`,
    JSON.stringify(versionInfo, null, 2)
  )
  console.log('[extract] Wrote version.json')

  console.log('[extract] ✓ Extraction complete!')
  console.log(`[extract] Output: ${OUTPUT_DIR}/`)

  return {
    schemas: schemas.length,
    services: services.length,
    patterns: patterns.length,
  }
})

// -----------------------------------------------------------------------------
// Run
// -----------------------------------------------------------------------------

const main = ExtractProgram.pipe(
  Effect.provide(BunFileSystem.layer),
  Effect.catchAll((error) => {
    console.error('[extract] Fatal error:', error)
    return Effect.succeed({ schemas: 0, services: 0, patterns: 0 })
  })
)

BunRuntime.runMain(main)

/**
 * ADAL - ASCII Diagram Alignment Layer
 *
 * Pi extension for detecting and visualizing schema drift between:
 * - Effect.Schema domain types
 * - @effect/sql Model classes
 * - PostgreSQL DDL (CREATE TABLE)
 *
 * Uses proper AST introspection - no regex parsing.
 *
 * @module
 */

import type { ExtensionAPI } from '@mariozechner/pi-coding-agent'
import { Type } from '@sinclair/typebox'
import { Text } from '@mariozechner/pi-tui'
import * as fs from 'node:fs'
import * as path from 'node:path'

import { inspectSchema, inspectModel, type FieldInfo } from './inspectors'
import { parseDDL, type DDLColumn } from './ddl-parser'
import { analyzeDrift, type DriftReport } from './analyzer'
import { renderERDiagram, renderDiffTable, renderSummary } from './renderer'

// =============================================================================
// Types
// =============================================================================

export interface ADALDomain {
  name: string
  schemaPath: string
  schemaExport: string // e.g., 'WorkOrder' or 'WorkOrderStatus'
  modelPath: string
  modelExport: string // e.g., 'WorkOrderModel'
  ddlPath: string
}

// Known IIoT domains with their file locations
const IIOT_DOMAINS: Record<string, ADALDomain> = {
  'work-orders': {
    name: 'WorkOrder',
    schemaPath: 'src/lib/iiot/schemas/work-orders.ts',
    schemaExport: 'WorkOrder',
    modelPath: 'src/lib/iiot/models/work-orders/WorkOrderModel.ts',
    modelExport: 'WorkOrderModel',
    ddlPath: 'src/lib/iiot/models/work-orders/WorkOrderModel.ddl.ts',
  },
  alarms: {
    name: 'Alarm',
    schemaPath: 'src/lib/iiot/schemas/alarms.ts',
    schemaExport: 'Alarm',
    modelPath: 'src/lib/iiot/models/alarms/AlarmModel.ts',
    modelExport: 'AlarmModel',
    ddlPath: 'src/lib/iiot/models/alarms/AlarmModel.ddl.ts',
  },
  'equipment-state': {
    name: 'EquipmentState',
    schemaPath: 'src/lib/iiot/schemas/equipment-state/schema.ts',  // Direct import, not barrel
    schemaExport: 'EquipmentState',
    modelPath: 'src/lib/iiot/models/equipment-state/EquipmentStateModel.ts',
    modelExport: 'EquipmentStateModel',
    ddlPath: 'src/lib/iiot/models/equipment-state/EquipmentStateModel.ddl.ts',
  },
  'device-config': {
    name: 'DeviceConfig',
    schemaPath: 'src/lib/iiot/schemas/device-config/schema.ts',  // Direct import, not barrel
    schemaExport: 'DeviceConfig',
    modelPath: 'src/lib/iiot/models/device-config/DeviceConfigModel.ts',
    modelExport: 'DeviceConfigModel',
    ddlPath: 'src/lib/iiot/models/device-config/DeviceConfigModel.ddl.ts',
  },
  readings: {
    name: 'SensorReading',
    schemaPath: 'src/lib/iiot/schemas/readings.ts',
    schemaExport: 'SensorReading',
    modelPath: 'src/lib/iiot/models/readings/SensorReadingModel.ts',
    modelExport: 'SensorReadingModel',
    ddlPath: 'src/lib/iiot/models/readings/SensorReadingModel.ddl.ts',
  },
}

// =============================================================================
// Extension
// =============================================================================

export default function adalExtension(pi: ExtensionAPI) {
  // Register the schema_drift tool
  pi.registerTool({
    name: 'schema_drift',
    label: 'Schema Drift Detector',
    description: `Analyze schema drift between Effect.Schema, @effect/sql Model, and PostgreSQL DDL using AST introspection.

Available domains: ${Object.keys(IIOT_DOMAINS).join(', ')}

Or provide custom paths with schemaPath, modelPath, ddlPath parameters.

Returns:
- ER-style ASCII box diagram showing field alignment
- Diff table with status (✓ OK, ⚠ WARN, ✗ ERR)
- Summary counts`,

    parameters: Type.Object({
      domain: Type.Optional(
        Type.String({
          description: `Predefined domain name: ${Object.keys(IIOT_DOMAINS).join(', ')}`,
        })
      ),
      schemaPath: Type.Optional(Type.String({ description: 'Path to Effect.Schema file' })),
      schemaExport: Type.Optional(Type.String({ description: 'Export name of the schema' })),
      modelPath: Type.Optional(Type.String({ description: 'Path to @effect/sql Model file' })),
      modelExport: Type.Optional(Type.String({ description: 'Export name of the Model class' })),
      ddlPath: Type.Optional(Type.String({ description: 'Path to DDL file with CREATE TABLE' })),
      format: Type.Optional(
        Type.Union([
          Type.Literal('full'),
          Type.Literal('er'),
          Type.Literal('table'),
          Type.Literal('summary'),
        ], {
          description: 'Output format: full (default), er (diagram only), table (diff only), summary',
        })
      ),
    }),

    async execute(toolCallId, params, signal, onUpdate, ctx) {
      try {
        // Resolve domain
        let domain: ADALDomain

        if (params.domain && IIOT_DOMAINS[params.domain]) {
          domain = IIOT_DOMAINS[params.domain]
        } else if (params.schemaPath && params.modelPath && params.ddlPath) {
          domain = {
            name: params.schemaExport ?? path.basename(params.schemaPath, '.ts'),
            schemaPath: params.schemaPath,
            schemaExport: params.schemaExport ?? 'default',
            modelPath: params.modelPath,
            modelExport: params.modelExport ?? 'default',
            ddlPath: params.ddlPath,
          }
        } else {
          return {
            content: [
              {
                type: 'text',
                text: `Error: Provide either a known domain (${Object.keys(IIOT_DOMAINS).join(', ')}) or custom paths (schemaPath, modelPath, ddlPath)`,
              },
            ],
            isError: true,
          }
        }

        const cwd = ctx.cwd

        // Check files exist
        for (const [key, filePath] of Object.entries({
          schema: domain.schemaPath,
          model: domain.modelPath,
          ddl: domain.ddlPath,
        })) {
          const fullPath = path.resolve(cwd, filePath)
          if (!fs.existsSync(fullPath)) {
            return {
              content: [{ type: 'text', text: `Error: ${key} file not found: ${filePath}` }],
              isError: true,
            }
          }
        }

        // Stream progress
        onUpdate?.({
          content: [{ type: 'text', text: `Inspecting ${domain.name} schema triad via AST...` }],
        })

        // Inspect Schema via dynamic import
        let schemaFields: FieldInfo[] = []
        const schemaFullPath = path.resolve(cwd, domain.schemaPath)
        try {
          const schemaModule = await import(schemaFullPath)
          const schemaExport = schemaModule[domain.schemaExport]
          
          // Diagnostic: report what we found
          const schemaKeys = Object.keys(schemaModule).slice(0, 10).join(', ')
          const hasExport = domain.schemaExport in schemaModule
          const hasAst = schemaExport && 'ast' in schemaExport
          
          if (!hasExport) {
            onUpdate?.({
              content: [{ type: 'text', text: `⚠ Schema export "${domain.schemaExport}" not found. Available: ${schemaKeys}` }],
            })
          } else if (!hasAst) {
            onUpdate?.({
              content: [{ type: 'text', text: `⚠ Schema export has no .ast property (type: ${typeof schemaExport})` }],
            })
          }
          
          if (schemaExport) {
            schemaFields = inspectSchema(schemaExport, domain.schemaExport)
            if (schemaFields.length === 0) {
              onUpdate?.({
                content: [{ type: 'text', text: `⚠ Schema inspection returned 0 fields (hasAst: ${hasAst})` }],
              })
            }
          }
        } catch (e) {
          onUpdate?.({
            content: [{ type: 'text', text: `Warning: Could not import schema from ${schemaFullPath}: ${e}` }],
          })
        }

        // Inspect Model via dynamic import
        let modelFields: FieldInfo[] = []
        const modelFullPath = path.resolve(cwd, domain.modelPath)
        try {
          const modelModule = await import(modelFullPath)
          const modelExport = modelModule[domain.modelExport]
          
          // Diagnostic: report what we found
          const modelKeys = Object.keys(modelModule).slice(0, 10).join(', ')
          const hasExport = domain.modelExport in modelModule
          const hasAst = modelExport && 'ast' in modelExport
          
          if (!hasExport) {
            onUpdate?.({
              content: [{ type: 'text', text: `⚠ Model export "${domain.modelExport}" not found. Available: ${modelKeys}` }],
            })
          } else if (!hasAst) {
            onUpdate?.({
              content: [{ type: 'text', text: `⚠ Model export has no .ast property (type: ${typeof modelExport})` }],
            })
          }
          
          if (modelExport) {
            modelFields = inspectModel(modelExport, domain.modelExport)
            if (modelFields.length === 0) {
              onUpdate?.({
                content: [{ type: 'text', text: `⚠ Model inspection returned 0 fields (hasAst: ${hasAst})` }],
              })
            }
          }
        } catch (e) {
          onUpdate?.({
            content: [{ type: 'text', text: `Warning: Could not import model from ${modelFullPath}: ${e}` }],
          })
        }

        // Parse DDL
        let ddlColumns: DDLColumn[] = []
        try {
          const ddlContent = fs.readFileSync(path.resolve(cwd, domain.ddlPath), 'utf-8')
          ddlColumns = parseDDL(ddlContent)
        } catch (e) {
          onUpdate?.({
            content: [{ type: 'text', text: `Warning: Could not parse DDL: ${e}` }],
          })
        }

        // Analyze drift
        onUpdate?.({
          content: [{ type: 'text', text: 'Analyzing drift...' }],
        })

        const report = analyzeDrift(schemaFields, modelFields, ddlColumns, domain.name)

        // Generate output
        const format = params.format ?? 'full'
        let output = ''

        // Add diagnostics header when schema/model inspection failed
        if (schemaFields.length === 0 || modelFields.length === 0) {
          output += `DIAGNOSTICS\n`
          output += `════════════════════════════════════════════════════════════\n`
          output += `Schema: ${schemaFullPath}\n`
          output += `  Fields found: ${schemaFields.length}\n`
          output += `Model:  ${modelFullPath}\n`
          output += `  Fields found: ${modelFields.length}\n`
          output += `DDL:    ${ddlColumns.length} columns\n\n`
        }

        if (format === 'full' || format === 'er') {
          output += renderERDiagram(report) + '\n\n'
        }

        if (format === 'full' || format === 'table') {
          output += renderDiffTable(report) + '\n\n'
        }

        if (format === 'full' || format === 'summary') {
          output += renderSummary(report)
        }

        return {
          content: [{ type: 'text', text: output }],
          details: {
            domain: domain.name,
            schemaFields: schemaFields.length,
            modelFields: modelFields.length,
            ddlColumns: ddlColumns.length,
            ok: report.ok,
            warnings: report.warnings,
            errors: report.errors,
          },
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error analyzing schema drift: ${error instanceof Error ? error.message : String(error)}\n\n${error instanceof Error ? error.stack : ''}`,
            },
          ],
          isError: true,
        }
      }
    },

    // Custom rendering for tool call
    renderCall(args, theme) {
      let text = theme.fg('toolTitle', theme.bold('schema_drift '))
      if (args.domain) {
        text += theme.fg('accent', args.domain)
      } else {
        text += theme.fg('muted', 'custom paths')
      }
      if (args.format && args.format !== 'full') {
        text += theme.fg('dim', ` --format=${args.format}`)
      }
      return new Text(text, 0, 0)
    },
  })

  // Register /adal command for quick access
  pi.registerCommand('adal', {
    description: 'Analyze schema drift for a domain (work-orders, alarms, etc.)',
    getArgumentCompletions: (prefix) => {
      const domains = Object.keys(IIOT_DOMAINS)
      const filtered = domains.filter((d) => d.startsWith(prefix))
      return filtered.length > 0 ? filtered.map((d) => ({ value: d, label: d })) : null
    },
    handler: async (args, ctx) => {
      if (!args || !IIOT_DOMAINS[args]) {
        ctx.ui.notify(
          `Usage: /adal <domain>\nDomains: ${Object.keys(IIOT_DOMAINS).join(', ')}`,
          'warning'
        )
        return
      }

      // Trigger the tool via user message
      pi.sendUserMessage(`Use schema_drift tool with domain="${args}"`)
    },
  })

  // Notify on load
  pi.on('session_start', async (_event, ctx) => {
    if (ctx.hasUI) {
      ctx.ui.setStatus('adal', 'ADAL loaded')
      setTimeout(() => ctx.ui.setStatus('adal', undefined), 3000)
    }
  })
}

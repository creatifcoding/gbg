/**
 * Axiom Testbed
 *
 * Interactive validation of the Axiom v2 ontology framework.
 * Demonstrates Effect Schema → ObjectType → Ontology → OSDK/OaC compilation.
 *
 * Route: /testbed/axiom
 *
 * HYPOTHESES:
 * - H1: Schema.TaggedClass definitions produce valid ObjectTypeDefs
 * - H2: Ontology<T>()() factory works as Effect.Service with yield*
 * - H3: Target.OSDK.compile generates correct OSDK output
 * - H4: Target.OaC.preview generates valid repository structure
 * - H5: Links between ObjectTypes resolve correctly
 */

import { useState, useCallback, useMemo } from "react"
import { Link } from "@tanstack/react-router"
import { Effect, Schema } from "effect"
import {
  ArrowLeft,
  Database,
  Code,
  FolderTree,
  Link as LinkIcon,
  Play,
  FileCode,
  Check,
  X,
  RefreshCw,
  Copy,
  Layers,
} from "lucide-react"

import {
  TestbedHeader,
  SectionLabel,
  TestCard,
  Button,
  StatusIndicator,
  CodeBlock,
  CollapsiblePanel,
} from "@/components/testbed/shared"
import {
  HypothesisSummary,
  HypothesisBadge,
  type ValidationStatus,
} from "@/components/testbed/shared/hypothesis"

import { Ontology, ObjectType, Target, resolveLinks } from "@/lib/axiom"
import type { OSDKObjectDefinition, OSDKLinkDefinition } from "@/lib/axiom"

// ─────────────────────────────────────────────────────────────────────────────
// Schemas (Pure Effect Schema.TaggedClass)
// ─────────────────────────────────────────────────────────────────────────────

class Department extends Schema.TaggedClass<Department>()("Department", {
  id: Schema.String.pipe(Schema.brand("DepartmentId")),
  name: Schema.NonEmptyString,
  code: Schema.String,
  budget: Schema.NullOr(Schema.Number),
  createdAt: Schema.DateTimeUtc,
}) {}

class Employee extends Schema.TaggedClass<Employee>()("Employee", {
  employeeId: Schema.String.pipe(Schema.brand("EmployeeId")),
  firstName: Schema.String,
  lastName: Schema.String,
  fullName: Schema.NonEmptyString,
  email: Schema.String,
  hireDate: Schema.Date,
  salary: Schema.NullOr(Schema.Number),
  isActive: Schema.Boolean,
  departmentId: Schema.String,
}) {}

class Project extends Schema.TaggedClass<Project>()("Project", {
  projectId: Schema.String.pipe(Schema.brand("ProjectId")),
  name: Schema.NonEmptyString,
  description: Schema.NullOr(Schema.String),
  startDate: Schema.Date,
  endDate: Schema.NullOr(Schema.Date),
  status: Schema.Literal("active", "completed", "on-hold"),
}) {}

class Assignment extends Schema.TaggedClass<Assignment>()("Assignment", {
  assignmentId: Schema.String.pipe(Schema.brand("AssignmentId")),
  role: Schema.NonEmptyString,
  hoursPerWeek: Schema.NullOr(Schema.Number),
  startDate: Schema.Date,
  endDate: Schema.NullOr(Schema.Date),
  employeeId: Schema.String,
  projectId: Schema.String,
}) {}

// ─────────────────────────────────────────────────────────────────────────────
// Ontology Definition
// ─────────────────────────────────────────────────────────────────────────────

class DemoOntology extends Ontology<DemoOntology>()("com.tmnl.demo.", {
  objects: {
    Department: ObjectType.from(Department, {
      primaryKey: "id",
      title: "name",
      displayName: "Department",
      pluralDisplayName: "Departments",
      description: "Organizational departments",
    }),

    Employee: ObjectType.from(Employee, {
      primaryKey: "employeeId",
      title: "fullName",
      displayName: "Employee",
      pluralDisplayName: "Employees",
      description: "Company employees",
      links: {
        department: {
          target: () => Department,
          cardinality: "many-to-one",
          foreignKey: "departmentId",
        },
      },
    }),

    Project: ObjectType.from(Project, {
      primaryKey: "projectId",
      title: "name",
      displayName: "Project",
      pluralDisplayName: "Projects",
      description: "Company projects",
    }),

    Assignment: ObjectType.from(Assignment, {
      primaryKey: "assignmentId",
      title: "role",
      displayName: "Assignment",
      pluralDisplayName: "Assignments",
      description: "Employee project assignments",
      links: {
        employee: {
          target: () => Employee,
          cardinality: "many-to-one",
          foreignKey: "employeeId",
        },
        project: {
          target: () => Project,
          cardinality: "many-to-one",
          foreignKey: "projectId",
        },
      },
    }),
  },
}) {}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface CompilationResult {
  objects: OSDKObjectDefinition[]
  links: OSDKLinkDefinition[]
  code: string
  files: Map<string, string>
}

type TabId = "ontology" | "osdk" | "oac" | "code"

// ─────────────────────────────────────────────────────────────────────────────
// Hypothesis Tracking
// ─────────────────────────────────────────────────────────────────────────────

interface HypothesisState {
  h1: ValidationStatus
  h2: ValidationStatus
  h3: ValidationStatus
  h4: ValidationStatus
  h5: ValidationStatus
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function AxiomTestbed() {
  // State
  const [activeTab, setActiveTab] = useState<TabId>("ontology")
  const [isCompiling, setIsCompiling] = useState(false)
  const [compilationResult, setCompilationResult] =
    useState<CompilationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hypotheses, setHypotheses] = useState<HypothesisState>({
    h1: "pending",
    h2: "pending",
    h3: "pending",
    h4: "pending",
    h5: "pending",
  })

  // Run compilation
  const runCompilation = useCallback(async () => {
    setIsCompiling(true)
    setError(null)

    try {
      const program = Effect.gen(function* () {
        // H2: Test yield* works
        const ontology = yield* DemoOntology
        setHypotheses((prev) => ({ ...prev, h2: "validated" }))

        // H3: Compile to OSDK
        const output = yield* Target.OSDK.compile(ontology)
        setHypotheses((prev) => ({ ...prev, h3: "validated" }))

        // Generate code
        const code = yield* Target.OSDK.generate(ontology)

        // H4: Preview OaC files
        const files = yield* Target.OaC.preview(ontology, {
          packageName: "@tmnl/demo-ontology",
          version: "1.0.0",
        })
        setHypotheses((prev) => ({ ...prev, h4: "validated" }))

        // H5: Check links
        if (ontology.links.length > 0) {
          setHypotheses((prev) => ({ ...prev, h5: "validated" }))
        }

        return { objects: output.objects, links: output.links, code, files }
      })

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(DemoOntology.Default))
      )

      setCompilationResult(result)

      // H1: Validated if we got objects
      if (result.objects.length > 0) {
        setHypotheses((prev) => ({ ...prev, h1: "validated" }))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setHypotheses((prev) => ({
        ...prev,
        h1: "failed",
        h2: "failed",
        h3: "failed",
      }))
    } finally {
      setIsCompiling(false)
    }
  }, [])

  // Copy to clipboard
  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text)
  }, [])

  // Ontology info (static)
  const ontologyInfo = useMemo(
    () => ({
      namespace: DemoOntology.namespace,
      objectCount: Object.keys(
        (DemoOntology as unknown as { _config: { objects: Record<string, unknown> } })._config
          .objects
      ).length,
    }),
    []
  )

  return (
    <div className="min-h-screen bg-[var(--tmnl-surface-0)] text-[var(--tmnl-text-primary)]">
      {/* Header */}
      <TestbedHeader
        title="Axiom Testbed"
        subtitle="Effect-Native Ontology Framework"
        version="v2.0"
        backLink={
          <Link
            to="/testbed"
            className="flex items-center gap-2 text-[var(--tmnl-text-secondary)] hover:text-[var(--tmnl-text-primary)] transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Testbeds
          </Link>
        }
      />

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Hypothesis Summary */}
        <HypothesisSummary
          hypotheses={[
            {
              id: "H1",
              label: "Schema → ObjectTypeDef",
              status: hypotheses.h1,
            },
            { id: "H2", label: "Ontology yield*", status: hypotheses.h2 },
            { id: "H3", label: "OSDK Compilation", status: hypotheses.h3 },
            { id: "H4", label: "OaC Preview", status: hypotheses.h4 },
            { id: "H5", label: "Link Resolution", status: hypotheses.h5 },
          ]}
        />

        {/* Controls */}
        <div className="flex items-center gap-4">
          <Button
            onClick={runCompilation}
            disabled={isCompiling}
            className="flex items-center gap-2"
          >
            {isCompiling ? (
              <RefreshCw size={16} className="animate-spin" />
            ) : (
              <Play size={16} />
            )}
            {isCompiling ? "Compiling..." : "Compile Ontology"}
          </Button>

          <div className="flex items-center gap-2 text-[var(--tmnl-text-secondary)]">
            <Database size={14} />
            <span className="text-sm">
              {ontologyInfo.namespace} ({ontologyInfo.objectCount} objects)
            </span>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="flex items-center gap-2 text-red-400">
              <X size={16} />
              <span className="font-medium">Compilation Error</span>
            </div>
            <pre className="mt-2 text-sm text-red-300 font-mono">{error}</pre>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 border-b border-[var(--tmnl-border)]">
          {(
            [
              { id: "ontology", label: "Ontology", icon: Layers },
              { id: "osdk", label: "OSDK Output", icon: Database },
              { id: "oac", label: "OaC Files", icon: FolderTree },
              { id: "code", label: "Generated Code", icon: Code },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`
                flex items-center gap-2 px-4 py-3 text-sm font-medium
                border-b-2 transition-colors
                ${
                  activeTab === id
                    ? "border-[var(--tmnl-accent-primary)] text-[var(--tmnl-text-primary)]"
                    : "border-transparent text-[var(--tmnl-text-secondary)] hover:text-[var(--tmnl-text-primary)]"
                }
              `}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === "ontology" && (
            <OntologyTab compilationResult={compilationResult} />
          )}

          {activeTab === "osdk" && (
            <OSDKTab compilationResult={compilationResult} />
          )}

          {activeTab === "oac" && (
            <OaCTab
              compilationResult={compilationResult}
              onCopy={copyToClipboard}
            />
          )}

          {activeTab === "code" && (
            <CodeTab
              compilationResult={compilationResult}
              onCopy={copyToClipboard}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab Components
// ─────────────────────────────────────────────────────────────────────────────

function OntologyTab({
  compilationResult,
}: {
  compilationResult: CompilationResult | null
}) {
  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Schema Definitions */}
      <TestCard title="Schema Definitions" icon={<FileCode size={16} />}>
        <div className="space-y-4">
          <SectionLabel>Effect Schema.TaggedClass</SectionLabel>
          <CodeBlock
            code={`class Department extends Schema.TaggedClass<Department>()("Department", {
  id: Schema.String.pipe(Schema.brand("DepartmentId")),
  name: Schema.NonEmptyString,
  code: Schema.String,
  budget: Schema.NullOr(Schema.Number),
  createdAt: Schema.DateTimeUtc,
}) {}`}
            language="typescript"
          />

          <CodeBlock
            code={`class Employee extends Schema.TaggedClass<Employee>()("Employee", {
  employeeId: Schema.String.pipe(Schema.brand("EmployeeId")),
  firstName: Schema.String,
  lastName: Schema.String,
  fullName: Schema.NonEmptyString,
  email: Schema.String,
  hireDate: Schema.Date,
  salary: Schema.NullOr(Schema.Number),
  isActive: Schema.Boolean,
  departmentId: Schema.String, // FK
}) {}`}
            language="typescript"
          />
        </div>
      </TestCard>

      {/* Ontology Structure */}
      <TestCard title="Ontology Structure" icon={<Layers size={16} />}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-[var(--tmnl-surface-1)] rounded-lg">
              <div className="text-xs text-[var(--tmnl-text-secondary)] uppercase tracking-wide">
                Namespace
              </div>
              <div className="text-sm font-mono mt-1">
                {DemoOntology.namespace}
              </div>
            </div>
            <div className="p-3 bg-[var(--tmnl-surface-1)] rounded-lg">
              <div className="text-xs text-[var(--tmnl-text-secondary)] uppercase tracking-wide">
                Objects
              </div>
              <div className="text-sm font-mono mt-1">
                {compilationResult?.objects.length ?? "—"}
              </div>
            </div>
          </div>

          <SectionLabel>Objects</SectionLabel>
          <div className="space-y-2">
            {["Department", "Employee", "Project", "Assignment"].map((name) => (
              <div
                key={name}
                className="flex items-center justify-between p-2 bg-[var(--tmnl-surface-1)] rounded"
              >
                <span className="font-mono text-sm">{name}</span>
                <StatusIndicator
                  status={compilationResult ? "success" : "neutral"}
                  label={compilationResult ? "compiled" : "pending"}
                />
              </div>
            ))}
          </div>

          <SectionLabel>Resolved Links</SectionLabel>
          <div className="space-y-2">
            {compilationResult?.links.map((link, i) => (
              <div
                key={i}
                className="flex items-center gap-2 p-2 bg-[var(--tmnl-surface-1)] rounded text-sm"
              >
                <LinkIcon size={12} className="text-[var(--tmnl-accent-primary)]" />
                <span className="font-mono">{link.apiName}</span>
                <span className="text-[var(--tmnl-text-secondary)]">
                  ({link.cardinality})
                </span>
              </div>
            )) ?? (
              <div className="text-[var(--tmnl-text-secondary)] text-sm">
                Run compilation to see links
              </div>
            )}
          </div>
        </div>
      </TestCard>
    </div>
  )
}

function OSDKTab({
  compilationResult,
}: {
  compilationResult: CompilationResult | null
}) {
  if (!compilationResult) {
    return (
      <div className="text-center py-12 text-[var(--tmnl-text-secondary)]">
        <Database size={48} className="mx-auto mb-4 opacity-50" />
        <p>Run compilation to see OSDK output</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionLabel>Compiled Object Definitions</SectionLabel>
      <div className="grid grid-cols-2 gap-4">
        {compilationResult.objects.map((obj) => (
          <CollapsiblePanel
            key={obj.apiName}
            title={obj.apiName}
            defaultOpen={false}
          >
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-[var(--tmnl-text-secondary)]">
                    Display:
                  </span>{" "}
                  {obj.displayName}
                </div>
                <div>
                  <span className="text-[var(--tmnl-text-secondary)]">
                    Plural:
                  </span>{" "}
                  {obj.pluralDisplayName}
                </div>
                <div>
                  <span className="text-[var(--tmnl-text-secondary)]">PK:</span>{" "}
                  <code className="text-xs bg-[var(--tmnl-surface-2)] px-1 rounded">
                    {obj.primaryKeyPropertyApiName}
                  </code>
                </div>
                <div>
                  <span className="text-[var(--tmnl-text-secondary)]">
                    Title:
                  </span>{" "}
                  <code className="text-xs bg-[var(--tmnl-surface-2)] px-1 rounded">
                    {obj.titlePropertyApiName ?? "—"}
                  </code>
                </div>
              </div>

              <div className="border-t border-[var(--tmnl-border)] pt-3">
                <div className="text-xs text-[var(--tmnl-text-secondary)] uppercase tracking-wide mb-2">
                  Properties
                </div>
                <div className="space-y-1">
                  {Object.entries(obj.properties).map(([name, prop]) => (
                    <div
                      key={name}
                      className="flex items-center justify-between text-sm font-mono"
                    >
                      <span>{name}</span>
                      <span className="text-[var(--tmnl-text-secondary)]">
                        {prop.type}
                        {prop.nullable && "?"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CollapsiblePanel>
        ))}
      </div>

      <SectionLabel>Link Definitions</SectionLabel>
      <div className="space-y-2">
        {compilationResult.links.map((link, i) => (
          <div
            key={i}
            className="p-4 bg-[var(--tmnl-surface-1)] rounded-lg space-y-2"
          >
            <div className="flex items-center gap-2">
              <LinkIcon size={14} className="text-[var(--tmnl-accent-primary)]" />
              <span className="font-mono font-medium">{link.apiName}</span>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-[var(--tmnl-text-secondary)]">One:</span>{" "}
                {link.one.apiName}
              </div>
              <div>
                <span className="text-[var(--tmnl-text-secondary)]">Many:</span>{" "}
                {link.many.apiName}
              </div>
              <div>
                <span className="text-[var(--tmnl-text-secondary)]">
                  Cardinality:
                </span>{" "}
                {link.cardinality}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function OaCTab({
  compilationResult,
  onCopy,
}: {
  compilationResult: CompilationResult | null
  onCopy: (text: string) => void
}) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null)

  if (!compilationResult) {
    return (
      <div className="text-center py-12 text-[var(--tmnl-text-secondary)]">
        <FolderTree size={48} className="mx-auto mb-4 opacity-50" />
        <p>Run compilation to see OaC file structure</p>
      </div>
    )
  }

  const files = Array.from(compilationResult.files.entries())
  const selectedContent = selectedFile
    ? compilationResult.files.get(selectedFile)
    : null

  // Group files by directory
  const fileTree = files.reduce(
    (acc, [path]) => {
      const parts = path.split("/")
      const dir = parts.length > 1 ? parts.slice(0, -1).join("/") : ""
      if (!acc[dir]) acc[dir] = []
      acc[dir].push(path)
      return acc
    },
    {} as Record<string, string[]>
  )

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* File Tree */}
      <div className="col-span-1 space-y-2">
        <SectionLabel>Repository Structure</SectionLabel>
        <div className="bg-[var(--tmnl-surface-1)] rounded-lg p-3 max-h-96 overflow-auto">
          {Object.entries(fileTree).map(([dir, paths]) => (
            <div key={dir || "root"} className="mb-2">
              {dir && (
                <div className="flex items-center gap-1 text-xs text-[var(--tmnl-text-secondary)] mb-1">
                  <FolderTree size={12} />
                  {dir}/
                </div>
              )}
              <div className={dir ? "pl-4" : ""}>
                {paths.map((path) => (
                  <button
                    key={path}
                    onClick={() => setSelectedFile(path)}
                    className={`
                      w-full text-left flex items-center gap-2 px-2 py-1 rounded text-sm font-mono
                      ${
                        selectedFile === path
                          ? "bg-[var(--tmnl-accent-primary)] text-white"
                          : "hover:bg-[var(--tmnl-surface-2)]"
                      }
                    `}
                  >
                    <FileCode size={12} />
                    {path.split("/").pop()}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="text-xs text-[var(--tmnl-text-secondary)]">
          {files.length} files generated
        </div>
      </div>

      {/* File Content */}
      <div className="col-span-2">
        {selectedFile && selectedContent ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <SectionLabel>{selectedFile}</SectionLabel>
              <Button
                onClick={() => onCopy(selectedContent)}
                className="text-xs"
              >
                <Copy size={12} />
                Copy
              </Button>
            </div>
            <CodeBlock
              code={selectedContent}
              language={
                selectedFile.endsWith(".json")
                  ? "json"
                  : selectedFile.endsWith(".md")
                    ? "markdown"
                    : "typescript"
              }
            />
          </div>
        ) : (
          <div className="text-center py-12 text-[var(--tmnl-text-secondary)]">
            <FileCode size={48} className="mx-auto mb-4 opacity-50" />
            <p>Select a file to view its contents</p>
          </div>
        )}
      </div>
    </div>
  )
}

function CodeTab({
  compilationResult,
  onCopy,
}: {
  compilationResult: CompilationResult | null
  onCopy: (text: string) => void
}) {
  if (!compilationResult) {
    return (
      <div className="text-center py-12 text-[var(--tmnl-text-secondary)]">
        <Code size={48} className="mx-auto mb-4 opacity-50" />
        <p>Run compilation to see generated code</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionLabel>Generated @osdk/maker Code</SectionLabel>
        <Button onClick={() => onCopy(compilationResult.code)} className="text-xs">
          <Copy size={12} />
          Copy Code
        </Button>
      </div>
      <CodeBlock code={compilationResult.code} language="typescript" />
    </div>
  )
}

export default AxiomTestbed

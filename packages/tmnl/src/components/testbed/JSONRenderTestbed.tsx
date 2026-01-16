/**
 * JSON-Render Testbed
 *
 * EDIN Experiment: Validating Effect-native JSON-driven UI rendering
 * with TMNL component integration.
 *
 * Demonstrates:
 * - Component registry mapping json-render types to TMNL components
 * - Action execution with confirmation dialogs
 * - Visibility conditions based on data model
 * - Data binding and reactive updates
 * - Static tree rendering (no streaming endpoint needed)
 */

"use client"

import { useEffect, useState, useCallback } from "react"
import { Effect, Option } from "effect"
import { RegistryProvider } from "@effect-atom/atom-react"

import {
  JSONRenderProvider,
  Renderer,
  useAction,
  useActions,
  useData,
  useConfirmation,
  type ComponentRegistry
} from "@/lib/json-render/react"
import { UITree, UIElement, Action, EqCondition, PathRef, type VisibilityCondition } from "@/lib/json-render/core"

// TMNL UI Components
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"

// Testbed shared components
import {
  SectionLabel,
  CollapsiblePanel,
  CodeBlock
} from "@/components/testbed/shared"

// =============================================================================
// TMNL Component Registry
// =============================================================================

/**
 * Maps json-render element types to TMNL components
 *
 * Each renderer receives:
 * - element: The UIElement with type and props
 * - children: Pre-rendered child elements
 * - onAction: Callback to execute actions
 * - loading: Whether parent is loading/streaming
 */
const tmnlRegistry: ComponentRegistry = {
  // Layout Components
  Container: ({ children, element }) => (
    <div className={element.props.className as string ?? "space-y-4"}>
      {children}
    </div>
  ),

  Row: ({ children, element }) => (
    <div className={`flex gap-${element.props.gap ?? 4} ${element.props.className ?? ""}`}>
      {children}
    </div>
  ),

  Column: ({ children, element }) => (
    <div className={`flex flex-col gap-${element.props.gap ?? 2} ${element.props.className ?? ""}`}>
      {children}
    </div>
  ),

  // Card Components
  Card: ({ children, element }) => (
    <Card className={element.props.className as string}>
      {children}
    </Card>
  ),

  CardHeader: ({ children }) => <CardHeader>{children}</CardHeader>,

  CardTitle: ({ element }) => (
    <CardTitle>{element.props.text as string}</CardTitle>
  ),

  CardDescription: ({ element }) => (
    <CardDescription>{element.props.text as string}</CardDescription>
  ),

  CardContent: ({ children }) => <CardContent>{children}</CardContent>,

  CardFooter: ({ children }) => <CardFooter>{children}</CardFooter>,

  // Typography
  Text: ({ element }) => (
    <p className={element.props.className as string ?? "text-sm text-muted-foreground"}>
      {element.props.text as string}
    </p>
  ),

  Heading: ({ element }) => {
    const level = (element.props.level as number) ?? 2
    const text = element.props.text as string
    const className = element.props.className as string ?? ""

    switch (level) {
      case 1: return <h1 className={`text-3xl font-bold ${className}`}>{text}</h1>
      case 2: return <h2 className={`text-2xl font-semibold ${className}`}>{text}</h2>
      case 3: return <h3 className={`text-xl font-medium ${className}`}>{text}</h3>
      default: return <h4 className={`text-lg font-medium ${className}`}>{text}</h4>
    }
  },

  // Interactive Components
  Button: ({ element, onAction }) => (
    <Button
      variant={(element.props.variant as "default" | "destructive" | "outline" | "secondary" | "ghost" | "link") ?? "default"}
      size={(element.props.size as "default" | "sm" | "lg" | "icon") ?? "default"}
      onClick={() => {
        if (element.props.action && onAction) {
          onAction(element.props.action as Action)
        }
      }}
    >
      {element.props.label as string}
    </Button>
  ),

  Input: ({ element }) => (
    <div className="space-y-2">
      {element.props.label && (
        <Label>{element.props.label as string}</Label>
      )}
      <Input
        type={(element.props.type as string) ?? "text"}
        placeholder={element.props.placeholder as string}
        defaultValue={element.props.value as string}
      />
    </div>
  ),

  Switch: ({ element }) => (
    <div className="flex items-center space-x-2">
      <Switch id={element.props.id as string} />
      {element.props.label && (
        <Label htmlFor={element.props.id as string}>{element.props.label as string}</Label>
      )}
    </div>
  ),

  // Display Components
  Badge: ({ element }) => (
    <Badge variant={(element.props.variant as "default" | "secondary" | "destructive" | "outline") ?? "default"}>
      {element.props.text as string}
    </Badge>
  ),

  Progress: ({ element }) => (
    <Progress value={element.props.value as number ?? 0} />
  ),

  Alert: ({ element, children }) => (
    <Alert variant={(element.props.variant as "default" | "destructive") ?? "default"}>
      {element.props.title && <AlertTitle>{element.props.title as string}</AlertTitle>}
      {element.props.description && <AlertDescription>{element.props.description as string}</AlertDescription>}
      {children}
    </Alert>
  ),

  Separator: () => <Separator />,

  // Fallback
  Unknown: ({ element, children }) => (
    <div className="p-2 border border-dashed border-yellow-500 rounded">
      <code className="text-xs text-yellow-600">Unknown: {element.type}</code>
      {children}
    </div>
  )
}

// =============================================================================
// Demo Data
// =============================================================================

/**
 * Helper to create UIElement with key
 */
function el(
  key: string,
  type: string,
  props: Record<string, unknown>,
  children?: string[],
  visible?: VisibilityCondition
): UIElement {
  return new UIElement({
    key,
    type,
    props,
    children,
    visible
  })
}

/**
 * Create a demo UI tree that showcases various components and features
 */
function createDemoTree(): UITree {
  const elements: Record<string, UIElement> = {
    // Root container
    root: el("root", "Container", { className: "space-y-6 p-4" }, ["header", "mainCard", "actionsCard", "visibilityCard"]),

    // Header section
    header: el("header", "Column", { gap: 2 }, ["title", "subtitle", "statusBadge"]),
    title: el("title", "Heading", { text: "JSON-Render Demo", level: 1 }),
    subtitle: el("subtitle", "Text", { text: "Effect-native JSON-driven UI with TMNL components" }),
    statusBadge: el("statusBadge", "Badge", { text: "Live", variant: "default" }),

    // Main demo card
    mainCard: el("mainCard", "Card", {}, ["mainCardHeader", "mainCardContent", "mainCardFooter"]),
    mainCardHeader: el("mainCardHeader", "CardHeader", {}, ["mainCardTitle", "mainCardDesc"]),
    mainCardTitle: el("mainCardTitle", "CardTitle", { text: "Component Demo" }),
    mainCardDesc: el("mainCardDesc", "CardDescription", { text: "Various TMNL components rendered from JSON" }),
    mainCardContent: el("mainCardContent", "CardContent", {}, ["inputDemo", "sep1", "switchDemo", "sep2", "progressDemo"]),
    inputDemo: el("inputDemo", "Input", { label: "Name", placeholder: "Enter your name", type: "text" }),
    sep1: el("sep1", "Separator", {}),
    switchDemo: el("switchDemo", "Switch", { id: "notifications", label: "Enable notifications" }),
    sep2: el("sep2", "Separator", {}),
    progressDemo: el("progressDemo", "Progress", { value: 66 }),
    mainCardFooter: el("mainCardFooter", "CardFooter", {}, ["footerRow"]),
    footerRow: el("footerRow", "Row", { gap: 2 }, ["cancelBtn", "saveBtn"]),
    cancelBtn: el("cancelBtn", "Button", {
      label: "Cancel",
      variant: "outline",
      action: new Action({ name: "cancel", params: {} })
    }),
    saveBtn: el("saveBtn", "Button", {
      label: "Save",
      variant: "default",
      action: new Action({ name: "save", params: { formId: "demo" } })
    }),

    // Actions demo card
    actionsCard: el("actionsCard", "Card", {}, ["actionsCardHeader", "actionsCardContent"]),
    actionsCardHeader: el("actionsCardHeader", "CardHeader", {}, ["actionsCardTitle", "actionsCardDesc"]),
    actionsCardTitle: el("actionsCardTitle", "CardTitle", { text: "Actions Demo" }),
    actionsCardDesc: el("actionsCardDesc", "CardDescription", { text: "Click buttons to trigger actions with Effect handlers" }),
    actionsCardContent: el("actionsCardContent", "CardContent", {}, ["actionButtons"]),
    actionButtons: el("actionButtons", "Row", { gap: 2 }, ["greetBtn", "deleteBtn"]),
    greetBtn: el("greetBtn", "Button", {
      label: "Greet",
      variant: "secondary",
      action: new Action({ name: "greet", params: { name: "World" } })
    }),
    deleteBtn: el("deleteBtn", "Button", {
      label: "Delete",
      variant: "destructive",
      action: new Action({
        name: "delete",
        params: { id: "123" },
        confirm: {
          title: "Confirm Delete",
          message: "Are you sure you want to delete this item?",
          confirmLabel: "Delete",
          cancelLabel: "Keep"
        }
      })
    }),

    // Visibility demo card
    visibilityCard: el("visibilityCard", "Card", {}, ["visCardHeader", "visCardContent"]),
    visCardHeader: el("visCardHeader", "CardHeader", {}, ["visCardTitle"]),
    visCardTitle: el("visCardTitle", "CardTitle", { text: "Visibility Conditions" }),
    visCardContent: el("visCardContent", "CardContent", {}, ["visAlert"]),
    visAlert: el(
      "visAlert",
      "Alert",
      {
        title: "Admin Only",
        description: "This alert is visible because isAdmin is true in the data model"
      },
      undefined,
      // Visibility: show only when data.isAdmin === true
      new EqCondition({
        left: new PathRef({ path: "/isAdmin" }),
        right: true
      })
    )
  }

  return new UITree({ root: "root", elements })
}

// =============================================================================
// Action Log Component
// =============================================================================

interface ActionLogEntry {
  timestamp: Date
  action: string
  params: unknown
}

function ActionLog({ entries }: { entries: ActionLogEntry[] }) {
  return (
    <div className="space-y-2">
      <SectionLabel>Action Log</SectionLabel>
      <div className="max-h-48 overflow-auto space-y-1 font-mono text-xs">
        {entries.length === 0 ? (
          <p className="text-muted-foreground">No actions yet...</p>
        ) : (
          entries.map((entry, i) => (
            <div key={i} className="p-2 bg-muted rounded">
              <span className="text-muted-foreground">
                {entry.timestamp.toLocaleTimeString()}
              </span>
              {" "}
              <span className="text-primary font-semibold">{entry.action}</span>
              {" "}
              <span className="text-muted-foreground">
                {JSON.stringify(entry.params)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// =============================================================================
// Data Model Panel
// =============================================================================

function DataModelPanel() {
  const { data, set } = useData()

  return (
    <CollapsiblePanel title="Data Model" defaultOpen>
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Switch
            id="isAdmin"
            checked={data['isAdmin'] as boolean ?? false}
            onCheckedChange={(checked) => set("isAdmin", checked)}
          />
          <Label htmlFor="isAdmin">isAdmin</Label>
        </div>

        <div className="space-y-2">
          <Label>userName</Label>
          <Input
            value={data['userName'] as string ?? ""}
            onChange={(e) => set("userName", e.target.value)}
            placeholder="Enter username..."
          />
        </div>

        <div className="p-2 bg-muted rounded">
          <CodeBlock language="json">
            {JSON.stringify(data, null, 2)}
          </CodeBlock>
        </div>
      </div>
    </CollapsiblePanel>
  )
}

// =============================================================================
// Confirmation Dialog Override
// =============================================================================

function TMNLConfirmationDialog() {
  const { isPending, pendingAction, confirm, cancel } = useConfirmation()

  if (!isPending || Option.isNone(pendingAction)) return null

  const action = pendingAction.value
  const confirmConfig = action.confirm

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{confirmConfig?.title ?? "Confirm"}</CardTitle>
          <CardDescription>{confirmConfig?.message ?? "Are you sure?"}</CardDescription>
        </CardHeader>
        <CardFooter className="flex justify-end gap-2">
          <Button variant="outline" onClick={cancel}>
            {confirmConfig?.cancelLabel ?? "Cancel"}
          </Button>
          <Button variant="destructive" onClick={confirm}>
            {confirmConfig?.confirmLabel ?? "Confirm"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

// =============================================================================
// Inner Testbed (Inside Provider)
// =============================================================================

function JSONRenderTestbedInner() {
  const [tree] = useState(() => createDemoTree())
  const [actionLog, setActionLog] = useState<ActionLogEntry[]>([])
  const { registerAll } = useActions()
  const { execute } = useAction()
  const { setData } = useData()

  // Register action handlers on mount
  useEffect(() => {
    registerAll({
      greet: (params) =>
        Effect.sync(() => {
          const name = (params as { name?: string }).name ?? "Unknown"
          setActionLog((prev) => [
            ...prev,
            { timestamp: new Date(), action: "greet", params }
          ])
          console.log(`Hello, ${name}!`)
        }),

      save: (params) =>
        Effect.sync(() => {
          setActionLog((prev) => [
            ...prev,
            { timestamp: new Date(), action: "save", params }
          ])
          console.log("Saved!", params)
        }),

      cancel: () =>
        Effect.sync(() => {
          setActionLog((prev) => [
            ...prev,
            { timestamp: new Date(), action: "cancel", params: {} }
          ])
          console.log("Cancelled")
        }),

      delete: (params) =>
        Effect.sync(() => {
          setActionLog((prev) => [
            ...prev,
            { timestamp: new Date(), action: "delete", params }
          ])
          console.log("Deleted!", params)
        })
    })

    // Set initial data model
    setData({ isAdmin: true, userName: "Prime" })
  }, [registerAll, setData])

  // Action handler for the Renderer
  const handleAction = useCallback(
    (action: Action) => {
      execute(action)
    },
    [execute]
  )

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main render area */}
      <div className="lg:col-span-2 space-y-4">
        <SectionLabel>Rendered UI</SectionLabel>
        <div className="border rounded-lg p-4 bg-background">
          <Renderer
            tree={tree}
            registry={tmnlRegistry}
            fallback={tmnlRegistry['Unknown']}
            onAction={handleAction}
          />
        </div>
      </div>

      {/* Control panel */}
      <div className="space-y-4">
        <DataModelPanel />
        <ActionLog entries={actionLog} />

        <CollapsiblePanel title="Tree Structure" defaultOpen={false}>
          <CodeBlock language="json">
            {JSON.stringify(
              {
                root: tree.root,
                elementCount: Object.keys(tree.elements).length
              },
              null,
              2
            )}
          </CodeBlock>
        </CollapsiblePanel>
      </div>

      {/* TMNL-styled confirmation dialog */}
      <TMNLConfirmationDialog />
    </div>
  )
}

// =============================================================================
// Main Testbed Export
// =============================================================================

export function JSONRenderTestbed() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">JSON-Render Testbed</h1>
        <p className="text-muted-foreground mt-2">
          Effect-native JSON-driven UI rendering with TMNL component integration
        </p>
        <div className="flex gap-2 mt-4">
          <Badge>Phase 3 Complete</Badge>
          <Badge variant="outline">Effect Schema</Badge>
          <Badge variant="outline">Fiber Cancellation</Badge>
          <Badge variant="outline">Deferred Confirmation</Badge>
        </div>
      </div>

      <RegistryProvider>
        <JSONRenderProvider>
          <JSONRenderTestbedInner />
        </JSONRenderProvider>
      </RegistryProvider>
    </div>
  )
}

export default JSONRenderTestbed

/**
 * JSON-Render Testbed
 *
 * EDIN Experiment: Validating Effect-native JSON-driven UI rendering
 * with TMNL component integration and real AI generation.
 *
 * Demonstrates:
 * - Component registry mapping json-render types to TMNL components
 * - Action execution with confirmation dialogs
 * - Visibility conditions based on data model
 * - Data binding and reactive updates
 * - Real AI generation via Claude (structured output with generateObject)
 * - NDJSON streaming of JsonPatch operations
 */

"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useAtomValue } from "@effect-atom/atom-react"
import { Effect, Option } from "effect"

import {
  JSONRenderProvider,
  Renderer,
  useAction,
  useActions,
  useData,
  useConfirmation,
  useUIStream,
  useUIStreamCluster,
  createGenerativeContainerRenderer,
  layoutRegistry,
  withLayoutRegistry,
  type ComponentRegistry,
  decodeErrorsAtom,
  type DecodeErrorEntry
} from "@/lib/json-render/react"
import { DEFAULT_CLUSTER_BASE_URL } from "@/lib/json-render/react/useUIStreamCluster"
import { UITree, UIElement, Action, EqCondition, PathRef, type VisibilityCondition } from "@/lib/json-render/core"
import { morphCardDomainCatalog } from "@/lib/morph-card/catalog"

// TMNL UI Components
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"

// Chat Shell
import { ChatInput, type ChatInputSubmitParams } from "@/lib/chat-shell"
import { Ban, Trash2 } from "lucide-react"

// Testbed shared components
import {
  SectionLabel,
  CollapsiblePanel,
  CodeBlock
} from "@/components/testbed/shared"

// Autonomous Editor Panel (self-contained collaborative editor)
import { AutonomousEditorPanel } from "@/components/testbed/collaboration/v2"
import { generateUserColor, type CollaborationUser } from "@/lib/editor/v3/services"

// =============================================================================
// Constants
// =============================================================================

// Real AI endpoint on cursor server (uses Claude + generateObject)
const AI_SERVER_URL = "/api/ui-generate"

// Transport mode for A/B testing
type TransportMode = "http" | "cluster"

// Cluster server card ID for routing
const CLUSTER_CARD_ID = "json-render-testbed"
const HELLO_MORPHCARD_PROMPT =
  "Create a MorphCard that says Hello World with a title and a short description. Use initialSizeKey and stateMachineConfig.sizes with compact and expanded sizes."

// =============================================================================
// Editor Wrapper for json-render Registry
// =============================================================================

/**
 * Wrapper for AutonomousEditorPanel in json-render registry.
 *
 * Provides all required context providers:
 * - PanelRegistryProvider: Panel-scoped atom registry for state isolation
 * - DocumentWatchProvider: Real-time document sync (when NATS available)
 *
 * Each editor instance is fully self-contained.
 */
function EditorPanelWrapper({
  element
}: {
  element: { props: Record<string, unknown> }
}) {
  // Generate stable IDs on mount
  const [panelId] = useState(() => `json-render-editor-${Math.random().toString(36).slice(2, 8)}`)
  const [user] = useState<CollaborationUser>(() => ({
    id: `user-${Math.random().toString(36).slice(2, 8)}`,
    name: (element.props['userName'] as string) ?? "Demo User",
    color: generateUserColor(`user-${Date.now()}`)
  }))

  const label = (element.props['label'] as string) ?? "Editor"
  const initialDocId = element.props['docId'] as string | undefined
  const enableLocalFiles = element.props['enableLocalFiles'] !== false

  // Note: AutonomousEditorPanel already includes its own PanelRegistryProvider
  // We only need to provide explicit sizing since the panel uses height: 100%
  return (
    <div style={{ height: 500, position: 'relative' }}>
      <AutonomousEditorPanel
        panelId={panelId}
        user={user}
        label={label}
        initialDocId={initialDocId}
        enableLocalFiles={enableLocalFiles}
      />
    </div>
  )
}

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
/**
 * TMNL UI Components Registry
 *
 * Layout components (Grid, Stack, VStack, HStack, Flex, etc.) are provided by layoutRegistry.
 * This registry provides TMNL UI components (Card, Button, Badge, etc.).
 *
 * Combined via withLayoutRegistry() below.
 */
const tmnlUIRegistry: ComponentRegistry = {
  // Card Components - pass className through to TMNL components
  Card: ({ children, element }) => (
    <Card className={element.props.className as string}>
      {children}
    </Card>
  ),

  CardHeader: ({ children, element }) => (
    <CardHeader className={element.props.className as string}>
      {children}
    </CardHeader>
  ),

  CardTitle: ({ element }) => (
    <CardTitle className={element.props.className as string}>
      {element.props.text as string}
    </CardTitle>
  ),

  CardDescription: ({ element }) => (
    <CardDescription className={element.props.className as string}>
      {element.props.text as string}
    </CardDescription>
  ),

  CardContent: ({ children, element }) => (
    <CardContent className={element.props.className as string}>
      {children}
    </CardContent>
  ),

  CardFooter: ({ children, element }) => (
    <CardFooter className={element.props.className as string}>
      {children}
    </CardFooter>
  ),

  // Typography - let className override defaults
  Text: ({ element }) => (
    <p className={element.props.className as string ?? "text-sm text-muted-foreground"}>
      {element.props.text as string}
    </p>
  ),

  Heading: ({ element }) => {
    const level = (element.props.level as number) ?? 2
    const text = element.props.text as string
    const className = element.props.className as string

    // Use cn pattern if we need to merge
    switch (level) {
      case 1: return <h1 className={className ?? "text-3xl font-bold"}>{text}</h1>
      case 2: return <h2 className={className ?? "text-2xl font-semibold"}>{text}</h2>
      case 3: return <h3 className={className ?? "text-xl font-medium"}>{text}</h3>
      default: return <h4 className={className ?? "text-lg font-medium"}>{text}</h4>
    }
  },

  // Interactive Components - pass through to TMNL components
  Button: ({ element, onAction }) => (
    <Button
      variant={(element.props.variant as "default" | "destructive" | "outline" | "secondary" | "ghost" | "link") ?? "default"}
      size={(element.props.size as "default" | "sm" | "lg" | "icon") ?? "default"}
      className={element.props.className as string}
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
    <div className={element.props.wrapperClassName as string ?? "space-y-2"}>
      {element.props.label && (
        <Label>{element.props.label as string}</Label>
      )}
      <Input
        type={(element.props.type as string) ?? "text"}
        placeholder={element.props.placeholder as string}
        defaultValue={element.props.value as string}
        className={element.props.className as string}
      />
    </div>
  ),

  Switch: ({ element }) => (
    <div className={element.props.wrapperClassName as string ?? "flex items-center space-x-2"}>
      <Switch id={element.props.id as string} />
      {element.props.label && (
        <Label htmlFor={element.props.id as string}>{element.props.label as string}</Label>
      )}
    </div>
  ),

  // Display Components - pass className through
  Badge: ({ element }) => (
    <Badge
      variant={(element.props.variant as "default" | "secondary" | "destructive" | "outline") ?? "default"}
      className={element.props.className as string}
    >
      {element.props.text as string}
    </Badge>
  ),

  Progress: ({ element }) => (
    <Progress
      value={element.props.value as number ?? 0}
      className={element.props.className as string}
    />
  ),

  Alert: ({ element, children }) => (
    <Alert
      variant={(element.props.variant as "default" | "destructive") ?? "default"}
      className={element.props.className as string}
    >
      {element.props.title && <AlertTitle>{element.props.title as string}</AlertTitle>}
      {element.props.description && <AlertDescription>{element.props.description as string}</AlertDescription>}
      {children}
    </Alert>
  ),

  Separator: ({ element }) => (
    <Separator className={element.props.className as string} />
  ),

  // Advanced Components
  Editor: EditorPanelWrapper,

  // Recursive Generative Container (placeholder - resolved below)
  GenerativeContainer: null as any,

  // Fallback - uses TMNL-compatible styling
  Unknown: ({ element, children }) => (
    <div className="p-2 border border-dashed border-amber-500/50 rounded bg-amber-500/5">
      <code className="text-xs text-amber-600 dark:text-amber-400">Unknown: {element.type}</code>
      {children}
    </div>
  )
}

/**
 * Combined registry: Layout primitives + TMNL UI components
 *
 * Layout components from layoutRegistry:
 * - Grid, Stack, VStack, HStack, Flex, FlexItem, Spacer, Divider, Center, AspectRatio, Wrap
 *
 * TMNL UI components from tmnlUIRegistry:
 * - Card, Button, Badge, Alert, Input, Progress, etc.
 * - Legacy aliases (Row → HStack, Column → VStack, Container)
 */
const morphCardRegistry: ComponentRegistry = Object.fromEntries(
  Object.entries(morphCardDomainCatalog.components).map(([key, def]) => [key, def.renderer])
)

const tmnlRegistry: ComponentRegistry = {
  ...withLayoutRegistry(tmnlUIRegistry),
  ...morphCardRegistry,
}

// =============================================================================
// Diagnostics Drawer
// =============================================================================

function DiagnosticsDrawer({
  tree,
  registry,
  side = "right",
}: {
  tree: UITree
  registry: ComponentRegistry
  side?: "left" | "right"
}) {
  const [isOpen, setIsOpen] = useState(false)

  const summary = useMemo(() => {
    const elements = Object.values(tree.elements)
    const counts = new Map<string, number>()
    const missing = new Map<string, number>()
    const samples = elements.slice(0, 8).map((element) => ({
      key: element.key,
      type: element.type,
      childrenCount: element.children?.length ?? 0,
      propsKeys: Object.keys(element.props ?? {}).slice(0, 6),
    }))

    for (const element of elements) {
      const type = element.type
      counts.set(type, (counts.get(type) ?? 0) + 1)
      if (!registry[type]) {
        missing.set(type, (missing.get(type) ?? 0) + 1)
      }
    }

    const sortedCounts = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
    const sortedMissing = Array.from(missing.entries()).sort((a, b) => b[1] - a[1])

    return {
      elementCount: elements.length,
      registryCount: Object.keys(registry).length,
      rootKey: tree.root,
      rootType: tree.root ? tree.elements[tree.root]?.type ?? null : null,
      counts: sortedCounts,
      missing: sortedMissing,
      samples,
    }
  }, [tree, registry])

  return (
    <div className="flex items-center justify-end">
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
        Diagnostics
      </Button>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side={side} className="w-[420px] sm:w-[520px]">
          <SheetHeader>
            <SheetTitle className="text-base">JSON Render Diagnostics</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-6 text-sm">
            <div className="space-y-2">
              <div className="font-medium">Tree Summary</div>
              <div className="flex flex-col gap-1 text-muted-foreground">
                <span>Root: {summary.rootKey || "—"} {summary.rootType ? `(${summary.rootType})` : ""}</span>
                <span>Elements: {summary.elementCount}</span>
                <span>Registry entries: {summary.registryCount}</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="font-medium">Missing Renderers</div>
              {summary.missing.length === 0 ? (
                <div className="text-muted-foreground">None</div>
              ) : (
                <div className="space-y-1 text-muted-foreground">
                  {summary.missing.map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span>{type}</span>
                      <span>x{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <div className="font-medium">Element Type Counts</div>
              <div className="space-y-1 text-muted-foreground">
                {summary.counts.map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span>{type}</span>
                    <span>x{count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <div className="font-medium">Sample Elements</div>
              <div className="space-y-2 text-muted-foreground">
                {summary.samples.length === 0 ? (
                  <div>None</div>
                ) : (
                  summary.samples.map((sample) => (
                    <div key={sample.key} className="rounded border px-2 py-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs">{sample.key}</span>
                        <span className="text-xs">children: {sample.childrenCount}</span>
                      </div>
                      <div className="text-xs">{sample.type}</div>
                      <div className="text-xs">
                        props: {sample.propsKeys.length ? sample.propsKeys.join(", ") : "—"}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  console.log("[JSONRender Diagnostics] tree", tree)
                }}
              >
                Log Tree to Console
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

// Fix circular reference: GenerativeContainer needs registry, registry needs GenerativeContainer
tmnlRegistry['GenerativeContainer'] = createGenerativeContainerRenderer(tmnlRegistry, "/api/ui-generate")

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
    // Root container - using VStack layout primitive with VANTA spacing token
    root: el("root", "VStack", { gap: 24, className: "p-4" }, ["header", "mainCard", "actionsCard", "visibilityCard"]),

    // Header section - VStack (vertical stack)
    header: el("header", "VStack", { gap: 8 }, ["title", "subtitle", "statusBadge"]),
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
    footerRow: el("footerRow", "HStack", { gap: 8 }, ["cancelBtn", "saveBtn"]),
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
    actionButtons: el("actionButtons", "HStack", { gap: 8 }, ["greetBtn", "deleteBtn"]),
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
// Decode Error Panel (Aggregated)
// =============================================================================

function DecodeErrorsPanel() {
  const errors = useAtomValue(decodeErrorsAtom)
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<DecodeErrorEntry | null>(null)

  if (errors.length === 0) {
    return (
      <div className="space-y-2">
        <SectionLabel>Decode Errors</SectionLabel>
        <div className="rounded border border-dashed p-3 text-sm text-muted-foreground">
          No decode errors recorded.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <SectionLabel>Decode Errors ({errors.length})</SectionLabel>
      <div className="space-y-2">
        {errors.map((error, index) => (
          <div
            key={`${error.timestamp}-${index}`}
            className="flex items-center justify-between rounded border p-2"
          >
            <div className="space-y-1">
              <div className="text-sm font-medium">
                {error.stage} error at line {error.lineIndex ?? "?"}
              </div>
              <div className="text-xs text-muted-foreground">
                {new Date(error.timestamp).toLocaleTimeString()} • {error.streamId ?? "unknown-stream"}
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSelected(error)
                setOpen(true)
              }}
            >
              Inspect
            </Button>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Decode Error Details</DialogTitle>
            <DialogDescription>
              Raw line, parsed object, and stream context for the failed chunk.
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Stage:</span> {selected.stage}</div>
                <div><span className="text-muted-foreground">Stream:</span> {selected.streamId ?? "unknown"}</div>
                <div><span className="text-muted-foreground">Line Index:</span> {selected.lineIndex ?? "?"}</div>
                <div><span className="text-muted-foreground">Time:</span> {new Date(selected.timestamp).toLocaleTimeString()}</div>
              </div>

              <div className="space-y-2">
                <Label>Raw Line</Label>
                <CodeBlock language="json">{selected.line}</CodeBlock>
              </div>

              <div className="space-y-2">
                <Label>Parsed Object</Label>
                <CodeBlock language="json">{JSON.stringify(selected.parsed ?? null, null, 2)}</CodeBlock>
              </div>

              <div className="space-y-2">
                <Label>Chunk</Label>
                <CodeBlock language="text">{selected.chunk}</CodeBlock>
              </div>

              <div className="space-y-2">
                <Label>Context</Label>
                <CodeBlock language="json">{JSON.stringify(selected.context ?? null, null, 2)}</CodeBlock>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
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
// Streaming Demo Component (with Transport Toggle)
// =============================================================================

interface StreamingDemoProps {
  transportMode: TransportMode
  onTransportModeChange: (mode: TransportMode) => void
}

/**
 * HTTP Transport Streaming - uses useUIStream with fetch to cursor-server
 */
function HTTPStreamingDemo({ transportMode, onTransportModeChange }: StreamingDemoProps) {
  const [actionLog, setActionLog] = useState<ActionLogEntry[]>([])
  const [useHybrid, setUseHybrid] = useState(true) // TreeWorkerPool for main thread offloading
  const { registerAll } = useActions()
  const { execute } = useAction()

  const {
    tree,
    isStreaming,
    error,
    send,
    clear,
    cancel
  } = useUIStream({
    api: AI_SERVER_URL,
    hybrid: useHybrid, // Enable Effect Platform TreeWorkerPool
    batchSize: 1,      // Immediate processing (default); future: dynamic batching by component boundaries
    onComplete: (finalTree) => {
      console.log("[HTTP Streaming] Complete:", finalTree)
    },
    onError: (err) => {
      console.error("[HTTP Streaming] Error:", err)
    }
  })

  // Handle ChatInput submit
  const handleChatSubmit = useCallback(
    ({ value, mode, thinkingLevel }: ChatInputSubmitParams) => {
      // Enhance prompt with mode/thinking context if needed
      const enhancedPrompt = mode === 'ai' && thinkingLevel !== 'none'
        ? `[Thinking: ${thinkingLevel}] ${value}`
        : value
      send(enhancedPrompt)
    },
    [send]
  )

  // DEBUG: Log every time tree changes (React re-renders)
  useEffect(() => {
    console.log(`[StreamingDemo RENDER] tree changed: ${Object.keys(tree.elements).length} elements, root: ${tree.root}`)
  }, [tree])

  // Register action handlers
  useEffect(() => {
    registerAll({
      notify: (params) =>
        Effect.sync(() => {
          setActionLog((prev) => [...prev, { timestamp: new Date(), action: "notify", params }])
          console.log("Notification:", params)
        }),
      danger: (params) =>
        Effect.sync(() => {
          setActionLog((prev) => [...prev, { timestamp: new Date(), action: "danger", params }])
          console.log("Danger action executed:", params)
        })
    })
  }, [registerAll])

  const handleAction = useCallback(
    (action: Action) => execute(action),
    [execute]
  )

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Streaming Controls</CardTitle>
          <CardDescription>
            Real AI generation via Claude at {AI_SERVER_URL}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Transport Mode Toggle */}
          <div className="flex items-center justify-between p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">Transport:</span>
              <div className="flex gap-1">
                <Button
                  variant={transportMode === "http" ? "default" : "outline"}
                  size="sm"
                  onClick={() => onTransportModeChange("http")}
                  disabled={isStreaming}
                >
                  HTTP
                </Button>
                <Button
                  variant={transportMode === "cluster" ? "default" : "outline"}
                  size="sm"
                  onClick={() => onTransportModeChange("cluster")}
                  disabled={isStreaming}
                >
                  Cluster
                </Button>
              </div>
            </div>
            <Badge variant={transportMode === "http" ? "default" : "secondary"}>
              {transportMode === "http" ? "fetch → :7682" : "RPC → :8100"}
            </Badge>
          </div>

          {/* Worker Mode Toggle */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Switch
                id="hybrid-mode"
                checked={useHybrid}
                onCheckedChange={setUseHybrid}
                disabled={isStreaming}
              />
              <Label htmlFor="hybrid-mode" className="font-medium">
                TreeWorkerPool (hybrid mode)
              </Label>
            </div>
            <Badge variant={useHybrid ? "default" : "secondary"}>
              {useHybrid ? "Worker Thread" : "Main Thread"}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => send(HELLO_MORPHCARD_PROMPT)}
              disabled={isStreaming}
            >
              Hello MorphCard
            </Button>
            <span className="text-sm text-muted-foreground">
              Quick prompt for the JSON render testbed
            </span>
          </div>

          {/* ChatInput compound component */}
          <ChatInput
            onSubmit={handleChatSubmit}
            defaultMode="ai"
            defaultThinkingLevel="none"
            className="bg-card"
          >
            <ChatInput.TextArea
              placeholder="Describe the UI you want to generate..."
              minHeight={56}
              maxHeight={160}
            />
            <ChatInput.Toolbar>
              <ChatInput.ToolbarGroup>
                <ChatInput.ModeToggle />
                <ChatInput.Divider />
                <ChatInput.ThinkingLevel />
              </ChatInput.ToolbarGroup>
              <ChatInput.ToolbarGroup>
                {isStreaming && (
                  <ChatInput.ActionButton
                    icon={<Ban size={14} />}
                    title="Cancel streaming"
                    onClick={cancel}
                  />
                )}
                <ChatInput.ActionButton
                  icon={<Trash2 size={14} />}
                  title="Clear output"
                  onClick={clear}
                  disabled={isStreaming}
                />
                <ChatInput.SendButton />
              </ChatInput.ToolbarGroup>
            </ChatInput.Toolbar>
          </ChatInput>

          {Option.isSome(error) && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error.value.message}</AlertDescription>
            </Alert>
          )}

          {isStreaming && (
            <div className="flex items-center gap-2">
              <Progress value={undefined} className="flex-1" />
              <span className="text-sm text-muted-foreground">Streaming...</span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-end">
        <DiagnosticsDrawer tree={tree} registry={tmnlRegistry} side="right" />
      </div>

      {/* Rendered output - Full width renderer */}
      <div className="space-y-4">
        <SectionLabel>Streamed UI ({Object.keys(tree.elements).length} elements)</SectionLabel>
        <div className="border rounded-lg p-6 bg-background min-h-[400px]">
          {tree.root ? (
            <Renderer
              tree={tree}
              registry={tmnlRegistry}
              fallback={tmnlRegistry['Unknown']}
              onAction={handleAction}
            />
          ) : (
            <p className="text-muted-foreground text-center py-16">
              Click "Send" to generate UI with Claude AI
            </p>
          )}
        </div>
      </div>

      {/* Bottom row - Tree Structure | Action Log */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <CollapsiblePanel title="Tree Structure" defaultOpen>
          <CodeBlock language="json">
            {JSON.stringify(
              {
                root: tree.root,
                elementCount: Object.keys(tree.elements).length,
                elementKeys: Object.keys(tree.elements)
              },
              null,
              2
            )}
          </CodeBlock>
        </CollapsiblePanel>

        <ActionLog entries={actionLog} />
      </div>

      <DecodeErrorsPanel />

      <TMNLConfirmationDialog />
    </div>
  )
}

/**
 * Cluster Transport Streaming - uses useUIStreamCluster with Effect RPC
 */
function ClusterStreamingDemo({ transportMode, onTransportModeChange }: StreamingDemoProps) {
  const [actionLog, setActionLog] = useState<ActionLogEntry[]>([])
  const { registerAll } = useActions()
  const { execute } = useAction()

  const {
    tree,
    isStreaming,
    error,
    send,
    clear,
    cancel
  } = useUIStreamCluster({
    cardId: CLUSTER_CARD_ID,
    baseUrl: DEFAULT_CLUSTER_BASE_URL,
    onComplete: (finalTree) => {
      console.log("[Cluster Streaming] Complete:", finalTree)
    },
    onError: (err) => {
      console.error("[Cluster Streaming] Error:", err)
    }
  })

  // Handle ChatInput submit
  const handleChatSubmit = useCallback(
    ({ value, mode, thinkingLevel }: ChatInputSubmitParams) => {
      const enhancedPrompt = mode === 'ai' && thinkingLevel !== 'none'
        ? `[Thinking: ${thinkingLevel}] ${value}`
        : value
      send(enhancedPrompt)
    },
    [send]
  )

  // Register action handlers
  useEffect(() => {
    registerAll({
      notify: (params) =>
        Effect.sync(() => {
          setActionLog((prev) => [...prev, { timestamp: new Date(), action: "notify", params }])
          console.log("Notification:", params)
        }),
      danger: (params) =>
        Effect.sync(() => {
          setActionLog((prev) => [...prev, { timestamp: new Date(), action: "danger", params }])
          console.log("Danger action executed:", params)
        })
    })
  }, [registerAll])

  const handleAction = useCallback(
    (action: Action) => execute(action),
    [execute]
  )

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Streaming Controls</CardTitle>
          <CardDescription>
            Effect Cluster RPC via CardEntity at localhost:8100
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Transport Mode Toggle */}
          <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg border border-green-500/20">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">Transport:</span>
              <div className="flex gap-1">
                <Button
                  variant={transportMode === "http" ? "default" : "outline"}
                  size="sm"
                  onClick={() => onTransportModeChange("http")}
                  disabled={isStreaming}
                >
                  HTTP
                </Button>
                <Button
                  variant={transportMode === "cluster" ? "default" : "outline"}
                  size="sm"
                  onClick={() => onTransportModeChange("cluster")}
                  disabled={isStreaming}
                >
                  Cluster
                </Button>
              </div>
            </div>
            <Badge variant="secondary" className="bg-green-500/20 text-green-700 dark:text-green-300">
              RPC → :8100
            </Badge>
          </div>

          {/* Cluster Info */}
          <div className="flex items-center gap-2 p-2 bg-muted/50 rounded text-sm">
            <Badge variant="outline">CardEntity</Badge>
            <span className="text-muted-foreground">
              Shard routing via cardId: <code className="bg-muted px-1 rounded">{CLUSTER_CARD_ID}</code>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => send(HELLO_MORPHCARD_PROMPT)}
              disabled={isStreaming}
            >
              Hello MorphCard
            </Button>
            <span className="text-sm text-muted-foreground">
              Quick prompt for the RPC testbed
            </span>
          </div>

          {/* ChatInput compound component */}
          <ChatInput
            onSubmit={handleChatSubmit}
            defaultMode="ai"
            defaultThinkingLevel="none"
            className="bg-card"
          >
            <ChatInput.TextArea
              placeholder="Describe the UI you want to generate (via Cluster RPC)..."
              minHeight={56}
              maxHeight={160}
            />
            <ChatInput.Toolbar>
              <ChatInput.ToolbarGroup>
                <ChatInput.ModeToggle />
                <ChatInput.Divider />
                <ChatInput.ThinkingLevel />
              </ChatInput.ToolbarGroup>
              <ChatInput.ToolbarGroup>
                {isStreaming && (
                  <ChatInput.ActionButton
                    icon={<Ban size={14} />}
                    title="Cancel streaming"
                    onClick={cancel}
                  />
                )}
                <ChatInput.ActionButton
                  icon={<Trash2 size={14} />}
                  title="Clear output"
                  onClick={clear}
                  disabled={isStreaming}
                />
                <ChatInput.SendButton />
              </ChatInput.ToolbarGroup>
            </ChatInput.Toolbar>
          </ChatInput>

          {Option.isSome(error) && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error.value.message}</AlertDescription>
            </Alert>
          )}

          {isStreaming && (
            <div className="flex items-center gap-2">
              <Progress value={undefined} className="flex-1" />
              <span className="text-sm text-muted-foreground">Streaming via Cluster...</span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-end">
        <DiagnosticsDrawer tree={tree} registry={tmnlRegistry} side="right" />
      </div>

      {/* Rendered output */}
      <div className="space-y-4">
        <SectionLabel>Streamed UI ({Object.keys(tree.elements).length} elements)</SectionLabel>
        <div className="border rounded-lg p-6 bg-background min-h-[400px]">
          {tree.root ? (
            <Renderer
              tree={tree}
              registry={tmnlRegistry}
              fallback={tmnlRegistry['Unknown']}
              onAction={handleAction}
            />
          ) : (
            <p className="text-muted-foreground text-center py-16">
              Click "Send" to generate UI with Effect Cluster RPC
            </p>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <CollapsiblePanel title="Tree Structure" defaultOpen>
          <CodeBlock language="json">
            {JSON.stringify(
              {
                root: tree.root,
                elementCount: Object.keys(tree.elements).length,
                elementKeys: Object.keys(tree.elements)
              },
              null,
              2
            )}
          </CodeBlock>
        </CollapsiblePanel>

        <ActionLog entries={actionLog} />
      </div>

      <DecodeErrorsPanel />

      <TMNLConfirmationDialog />
    </div>
  )
}

/**
 * StreamingDemo - Wrapper that manages transport mode and switches between HTTP/Cluster
 */
function StreamingDemo() {
  const [transportMode, setTransportMode] = useState<TransportMode>("http")

  return transportMode === "http" ? (
    <HTTPStreamingDemo
      transportMode={transportMode}
      onTransportModeChange={setTransportMode}
    />
  ) : (
    <ClusterStreamingDemo
      transportMode={transportMode}
      onTransportModeChange={setTransportMode}
    />
  )
}

// =============================================================================
// Static Demo Component (Original)
// =============================================================================

function StaticDemo() {
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
    <div className="space-y-6">
      {/* Full-width renderer */}
      <div className="space-y-4">
        <SectionLabel>Rendered UI</SectionLabel>
        <div className="border rounded-lg p-6 bg-background min-h-[400px]">
          <Renderer
            tree={tree}
            registry={tmnlRegistry}
            fallback={tmnlRegistry['Unknown']}
            onAction={handleAction}
          />
        </div>
      </div>

      {/* Bottom row - Tree Structure | Data Model | Action Log */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

        <DataModelPanel />

        <ActionLog entries={actionLog} />
      </div>

      {/* TMNL-styled confirmation dialog */}
      <TMNLConfirmationDialog />
    </div>
  )
}

// =============================================================================
// Main Testbed Export
// =============================================================================

type DemoMode = "streaming" | "static"

export function JSONRenderTestbed() {
  const [mode, setMode] = useState<DemoMode>("streaming")

  return (
    <div className="w-full max-w-[1800px] mx-auto px-6 py-8">
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

      {/* Mode selector */}
      <div className="flex gap-2 mb-6">
        <Button
          variant={mode === "streaming" ? "default" : "outline"}
          onClick={() => setMode("streaming")}
        >
          Streaming Demo
        </Button>
        <Button
          variant={mode === "static" ? "default" : "outline"}
          onClick={() => setMode("static")}
        >
          Static Demo
        </Button>
      </div>

      <JSONRenderProvider>
        {mode === "streaming" ? <StreamingDemo /> : <StaticDemo />}
      </JSONRenderProvider>

      {mode === "streaming" && (
        <Alert className="mt-6">
          <AlertTitle>Server Requirements</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              <strong>HTTP mode:</strong> Run <code className="bg-muted px-1 rounded">bun run scripts/cursor-server.ts</code> to start the AI server on port 7682.
            </p>
            <p>
              <strong>Cluster mode:</strong> Run <code className="bg-muted px-1 rounded">bun run scripts/cursor-cluster-node.ts</code> to start the Effect Cluster runner on port 8100.
            </p>
            <p className="text-xs text-muted-foreground">
              Ensure Claude Code CLI is authenticated (<code className="bg-muted px-1 rounded">claude login</code>).
            </p>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

export default JSONRenderTestbed

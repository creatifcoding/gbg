/**
 * Genifer Mock Streaming Server
 *
 * Simulates an AI backend that streams NDJSON patches to build UI.
 * Used for testing the genifer streaming integration.
 *
 * Usage: bun run scripts/genifer-mock-server.ts
 * Endpoint: POST http://localhost:7683/stream
 *
 * Request body: { prompt: string, context?: object, currentTree?: object }
 * Response: Stream of NDJSON lines, each a JsonPatch
 */

const PORT = 7683

/**
 * Demo UI tree patches - builds a complete TMNL card UI
 */
const DEMO_PATCHES = [
  // Set root
  { op: "set", path: "/root", value: "container" },

  // Container
  {
    op: "add",
    path: "/elements/container",
    value: {
      key: "container",
      type: "Container",
      props: { className: "space-y-6 p-4" },
      children: ["header", "mainCard", "actionsCard"]
    }
  },

  // Header section
  {
    op: "add",
    path: "/elements/header",
    value: {
      key: "header",
      type: "Column",
      props: { gap: 2 },
      children: ["title", "subtitle", "badge"]
    }
  },
  {
    op: "add",
    path: "/elements/title",
    value: {
      key: "title",
      type: "Heading",
      props: { text: "Streaming Demo", level: 1 }
    }
  },
  {
    op: "add",
    path: "/elements/subtitle",
    value: {
      key: "subtitle",
      type: "Text",
      props: { text: "UI generated via NDJSON streaming" }
    }
  },
  {
    op: "add",
    path: "/elements/badge",
    value: {
      key: "badge",
      type: "Badge",
      props: { text: "Streaming", variant: "secondary" }
    }
  },

  // Main card
  {
    op: "add",
    path: "/elements/mainCard",
    value: {
      key: "mainCard",
      type: "Card",
      props: {},
      children: ["mainCardHeader", "mainCardContent"]
    }
  },
  {
    op: "add",
    path: "/elements/mainCardHeader",
    value: {
      key: "mainCardHeader",
      type: "CardHeader",
      props: {},
      children: ["mainCardTitle", "mainCardDesc"]
    }
  },
  {
    op: "add",
    path: "/elements/mainCardTitle",
    value: {
      key: "mainCardTitle",
      type: "CardTitle",
      props: { text: "Generated Content" }
    }
  },
  {
    op: "add",
    path: "/elements/mainCardDesc",
    value: {
      key: "mainCardDesc",
      type: "CardDescription",
      props: { text: "This card was built incrementally via patches" }
    }
  },
  {
    op: "add",
    path: "/elements/mainCardContent",
    value: {
      key: "mainCardContent",
      type: "CardContent",
      props: {},
      children: ["progressLabel", "progress"]
    }
  },
  {
    op: "add",
    path: "/elements/progressLabel",
    value: {
      key: "progressLabel",
      type: "Text",
      props: { text: "Generation Progress:" }
    }
  },
  {
    op: "add",
    path: "/elements/progress",
    value: {
      key: "progress",
      type: "Progress",
      props: { value: 100 }
    }
  },

  // Actions card
  {
    op: "add",
    path: "/elements/actionsCard",
    value: {
      key: "actionsCard",
      type: "Card",
      props: {},
      children: ["actionsHeader", "actionsContent"]
    }
  },
  {
    op: "add",
    path: "/elements/actionsHeader",
    value: {
      key: "actionsHeader",
      type: "CardHeader",
      props: {},
      children: ["actionsTitle"]
    }
  },
  {
    op: "add",
    path: "/elements/actionsTitle",
    value: {
      key: "actionsTitle",
      type: "CardTitle",
      props: { text: "Interactive Actions" }
    }
  },
  {
    op: "add",
    path: "/elements/actionsContent",
    value: {
      key: "actionsContent",
      type: "CardContent",
      props: {},
      children: ["actionButtons"]
    }
  },
  {
    op: "add",
    path: "/elements/actionButtons",
    value: {
      key: "actionButtons",
      type: "Row",
      props: { gap: 2 },
      children: ["successBtn", "warningBtn"]
    }
  },
  {
    op: "add",
    path: "/elements/successBtn",
    value: {
      key: "successBtn",
      type: "Button",
      props: {
        label: "Success Action",
        variant: "default",
        action: { name: "notify", params: { type: "success", message: "It works!" } }
      }
    }
  },
  {
    op: "add",
    path: "/elements/warningBtn",
    value: {
      key: "warningBtn",
      type: "Button",
      props: {
        label: "Danger Zone",
        variant: "destructive",
        action: {
          name: "danger",
          params: { id: "test" },
          confirm: {
            title: "Are you sure?",
            message: "This action cannot be undone.",
            confirmLabel: "Yes, do it",
            cancelLabel: "Cancel"
          }
        }
      }
    }
  }
]

/**
 * Sleep utility
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Stream patches with delays to simulate generation
 */
async function* streamPatches(prompt: string): AsyncGenerator<string> {
  console.log(`[genifer-mock] Received prompt: "${prompt}"`)

  // Simulate thinking delay
  await sleep(200)

  for (let i = 0; i < DEMO_PATCHES.length; i++) {
    const patch = DEMO_PATCHES[i]

    // Yield the patch as NDJSON line
    yield JSON.stringify(patch) + "\n"

    // Simulate streaming delay (faster at start, slower for complex elements)
    const delay = i < 5 ? 50 : 100
    await sleep(delay)
  }

  console.log(`[genifer-mock] Stream complete (${DEMO_PATCHES.length} patches)`)
}

/**
 * Handle POST /stream
 */
async function handleStream(req: Request): Promise<Response> {
  // Parse request
  const body = await req.json().catch(() => ({})) as { prompt?: string }
  const prompt = body.prompt ?? "Generate a demo UI"

  // Create readable stream
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of streamPatches(prompt)) {
          controller.enqueue(encoder.encode(chunk))
        }
        controller.close()
      } catch (error) {
        controller.error(error)
      }
    }
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  })
}

/**
 * Main server
 */
const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)

    // CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      })
    }

    // Health check
    if (url.pathname === "/health") {
      return new Response("OK")
    }

    // Stream endpoint
    if (url.pathname === "/stream" && req.method === "POST") {
      return handleStream(req)
    }

    return new Response("Not Found", { status: 404 })
  }
})

console.log(`
╔════════════════════════════════════════════════════════════╗
║  Genifer Mock Streaming Server                         ║
╠════════════════════════════════════════════════════════════╣
║  Endpoint: POST http://localhost:${PORT}/stream               ║
║  Health:   GET  http://localhost:${PORT}/health               ║
║                                                            ║
║  Request body: { "prompt": "your prompt here" }            ║
║  Response: NDJSON stream of JSON patches                   ║
╚════════════════════════════════════════════════════════════╝
`)

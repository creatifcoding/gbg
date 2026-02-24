import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'

const servers = {"exa":{"type":"http","url":"https://mcp.exa.ai/mcp?tools=web_search_exa,get_code_context_exa,crawling_exa,company_research_exa,linkedin_search_exa,deep_researcher_start,deep_researcher_check&exaApiKey=1fb06823-dbc5-4807-a918-4bad42c80221"},"deepwiki":{"type":"http","url":"https://mcp.deepwiki.com/mcp"},"context7":{"type":"http","url":"https://mcp.context7.com/mcp"},"effect-docs":{"type":"stdio","command":"bunx","args":["effect-mcp@latest"],"env":{}},"anime-js":{"type":"stdio","command":"bunx","args":["anime-js-mcp-server"],"env":{}},"nia":{"type":"http","url":"https://apigcp.trynia.ai/mcp","headers":{"Authorization":"Bearer nk_ckU9ikCxZBVBhwaY4bKDIBBfrbRyJSK8"}},"firecrawl":{"type":"stdio","command":"bunx","args":["firecrawl-mcp"],"env":{"FIRECRAWL_API_KEY":"fc-a27a281ff25446b799fe521044eefe65"}},"agentation":{"type":"stdio","command":"bunx","args":["agentation-mcp","server"],"env":{}}}
const result: Record<string, any[]> = {}
const TIMEOUT = 15000

for (const [name, cfg] of Object.entries(servers) as any[]) {
  try {
    let transport: any
    if (cfg.type === 'http') {
      transport = new StreamableHTTPClientTransport(new URL(cfg.url), {
        requestInit: cfg.headers ? { headers: cfg.headers } : undefined,
      })
    } else if (cfg.type === 'sse') {
      transport = new SSEClientTransport(new URL(cfg.url), {
        requestInit: cfg.headers ? { headers: cfg.headers } : undefined,
      })
    } else {
      transport = new StdioClientTransport({
        command: cfg.command,
        args: cfg.args ?? [],
        env: { ...process.env, ...cfg.env },
      })
    }

    const client = new Client(
      { name: 'pi-mcp-discovery', version: '0.1.0' },
      { capabilities: {} }
    )

    await Promise.race([
      client.connect(transport),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), TIMEOUT))
    ])

    const toolsResult: any = await Promise.race([
      client.listTools(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000))
    ])

    result[name] = (toolsResult.tools ?? []).map((t: any) => ({
      name: t.name,
      description: t.description ?? '',
      params: Object.fromEntries(
        Object.entries(t.inputSchema?.properties ?? {}).map(([k, v]: any) => [
          k,
          {
            type: v.type ?? 'string',
            description: v.description ?? undefined,
            required: (t.inputSchema?.required ?? []).includes(k),
          }
        ])
      ),
    }))

    try { await transport.close() } catch {}
  } catch (e) {
    result[name] = []
  }
}

console.log('__MCP_DISCOVERY_RESULT__' + JSON.stringify(result))
process.exit(0)
import { AuthStorage } from '@mariozechner/pi-coding-agent'

type BridgeInput = {
  provider?: string
  model: string
  prompt: string
  options?: Record<string, unknown>
}

type BridgeOutput =
  | {
      ok: true
      result: {
        provider: string
        model: string
        content: string
        usage?: unknown
        id?: string
      }
    }
  | {
      ok: false
      error: string
      details?: unknown
    }

const AUTH_PATH_ENV = 'ORDER_MODEL_AUTH_STORAGE_PATH'
const OPENAI_BASE_URL_ENV = 'ORDER_OPENAI_BASE_URL'
const ANTHROPIC_BASE_URL_ENV = 'ORDER_ANTHROPIC_BASE_URL'
const GATEWAY_URL_ENV = 'ORDER_MODEL_GATEWAY_URL'

const truthy = new Set(['1', 'true', 'yes', 'on'])

async function readStdin(): Promise<string> {
  return await new Response(Bun.stdin.stream()).text()
}

function writeJson(output: BridgeOutput): never {
  process.stdout.write(`${JSON.stringify(output)}\n`)
  process.exit(output.ok ? 0 : 1)
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function numberOption(options: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = options[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number.parseInt(value, 10)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return undefined
}

function resolveRequestTimeout(options: Record<string, unknown>): number {
  const candidate = numberOption(options, 'timeout_ms', 'timeout')
  if (typeof candidate === 'number' && candidate > 0) return candidate
  return 90_000
}

async function parseResponseBody(response: Response): Promise<{ body: unknown; bodyText: string }> {
  const bodyText = await response.text()

  if (!bodyText) return { body: {}, bodyText }

  try {
    return { body: JSON.parse(bodyText), bodyText }
  } catch {
    return { body: { raw: bodyText }, bodyText }
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort('request-timeout'), timeoutMs)

  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

function compactErrorBody(body: unknown): string {
  if (typeof body === 'string') return body
  if (body && typeof body === 'object' && 'raw' in body && typeof (body as any).raw === 'string') {
    return (body as any).raw
  }
  return JSON.stringify(body)
}

function parseProviderAndModel(
  provider: string | undefined,
  rawModel: string
): { provider: string; model: string } {
  if (provider && provider.trim().length > 0) {
    const resolvedProvider = provider.trim()
    const candidateModel = rawModel.trim()

    if (candidateModel.startsWith(`${resolvedProvider}/`)) {
      return { provider: resolvedProvider, model: candidateModel.slice(resolvedProvider.length + 1) }
    }

    if (candidateModel.startsWith(`${resolvedProvider}:`)) {
      return { provider: resolvedProvider, model: candidateModel.slice(resolvedProvider.length + 1) }
    }

    return { provider: resolvedProvider, model: candidateModel }
  }

  const model = rawModel.trim()

  if (model.includes('/')) {
    const [p, ...rest] = model.split('/')
    if (p && rest.length > 0) {
      return { provider: p, model: rest.join('/') }
    }
  }

  if (model.includes(':')) {
    const [p, ...rest] = model.split(':')
    if (p && rest.length > 0) {
      return { provider: p, model: rest.join(':') }
    }
  }

  const fallbackProvider = process.env.ORDER_LIVE_PROVIDER?.trim()
  return { provider: fallbackProvider || 'openai', model }
}

function normalizeError(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return JSON.stringify(error)
}

function providerCredentialCandidates(provider: string): string[] {
  if (provider === 'openai') return ['openai', 'openai-codex']
  if (provider === 'openai-codex') return ['openai-codex', 'openai']
  return [provider]
}

async function getCredential(provider: string): Promise<{ credential: string; resolvedProvider: string }> {
  const authPath = process.env[AUTH_PATH_ENV]
  const storage = authPath ? new AuthStorage(authPath) : new AuthStorage()

  for (const candidate of providerCredentialCandidates(provider)) {
    const credential = await storage.getApiKey(candidate)
    if (credential) {
      return { credential, resolvedProvider: candidate }
    }
  }

  throw new Error(
    `No credential found in AuthStorage for provider '${provider}' (candidates: ${providerCredentialCandidates(provider).join(', ')}). Configure via pi login/API key first.`
  )
}

async function callOpenAI(
  token: string,
  model: string,
  prompt: string,
  options: Record<string, unknown>
) {
  const baseUrl = process.env[OPENAI_BASE_URL_ENV] || 'https://api.openai.com/v1'
  const response = await fetchWithTimeout(
    `${baseUrl.replace(/\/$/, '')}/responses`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        model,
        input: prompt,
        temperature: typeof options.temperature === 'number' ? options.temperature : undefined,
        max_output_tokens:
          typeof options.max_output_tokens === 'number'
            ? options.max_output_tokens
            : typeof options.max_tokens === 'number'
              ? options.max_tokens
              : 256,
      }),
    },
    resolveRequestTimeout(options)
  )

  const { body } = await parseResponseBody(response)
  const payload = body as any

  if (!response.ok) {
    throw new Error(`OpenAI request failed (${response.status}): ${compactErrorBody(payload)}`)
  }

  const outputText =
    typeof payload?.output_text === 'string'
      ? payload.output_text
      : Array.isArray(payload?.output)
        ? payload.output
            .flatMap((block: any) => (Array.isArray(block?.content) ? block.content : []))
            .filter((content: any) => content?.type === 'output_text')
            .map((content: any) => content?.text)
            .filter((text: unknown) => typeof text === 'string')
            .join('\n')
        : ''

  if (!outputText || outputText.trim().length === 0) {
    throw new Error('OpenAI response contained no output text')
  }

  return {
    content: outputText,
    usage: payload?.usage,
    id: payload?.id,
  }
}

function isLikelyAnthropicApiKey(token: string) {
  return token.startsWith('sk-') || token.startsWith('rk-')
}

async function callAnthropic(
  token: string,
  model: string,
  prompt: string,
  options: Record<string, unknown>
) {
  const baseUrl = process.env[ANTHROPIC_BASE_URL_ENV] || 'https://api.anthropic.com/v1'
  const useApiKey = isLikelyAnthropicApiKey(token)

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'anthropic-version': '2023-06-01',
  }

  if (useApiKey) {
    headers['x-api-key'] = token
  } else {
    headers.authorization = `Bearer ${token}`
    headers['anthropic-beta'] = 'oauth-2025-04-20'
  }

  const response = await fetchWithTimeout(
    `${baseUrl.replace(/\/$/, '')}/messages`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        max_tokens:
          typeof options.max_tokens === 'number'
            ? options.max_tokens
            : typeof options.max_output_tokens === 'number'
              ? options.max_output_tokens
              : 256,
        temperature: typeof options.temperature === 'number' ? options.temperature : undefined,
        messages: [{ role: 'user', content: prompt }],
      }),
    },
    resolveRequestTimeout(options)
  )

  const { body } = await parseResponseBody(response)
  const payload = body as any

  if (!response.ok) {
    throw new Error(`Anthropic request failed (${response.status}): ${compactErrorBody(payload)}`)
  }

  const text = Array.isArray(payload?.content)
    ? payload.content
        .filter((part: any) => part?.type === 'text')
        .map((part: any) => part?.text)
        .filter((v: unknown) => typeof v === 'string')
        .join('\n')
    : ''

  if (!text || text.trim().length === 0) {
    throw new Error('Anthropic response contained no text content')
  }

  return {
    content: text,
    usage: payload?.usage,
    id: payload?.id,
  }
}

async function callGateway(
  token: string,
  provider: string,
  model: string,
  prompt: string,
  options: Record<string, unknown>
) {
  const gatewayUrl = process.env[GATEWAY_URL_ENV]
  if (!gatewayUrl) {
    throw new Error(
      `Provider '${provider}' requires ${GATEWAY_URL_ENV} for gateway dispatch.`
    )
  }

  const response = await fetchWithTimeout(
    gatewayUrl,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ provider, model, prompt, options }),
    },
    resolveRequestTimeout(options)
  )

  const { body } = await parseResponseBody(response)
  const payload = body as any

  if (!response.ok) {
    throw new Error(`Gateway request failed (${response.status}): ${compactErrorBody(payload)}`)
  }

  const content =
    typeof payload?.content === 'string'
      ? payload.content
      : typeof payload?.result?.content === 'string'
        ? payload.result.content
        : ''

  if (!content || content.trim().length === 0) {
    throw new Error('Gateway response contained no content')
  }

  return {
    content,
    usage: payload?.usage ?? payload?.result?.usage,
    id: payload?.id ?? payload?.result?.id,
  }
}

async function main() {
  const envInput = (process.env.ORDER_MODEL_BRIDGE_INPUT || '').trim()
  const stdinInput = envInput ? '' : (await readStdin()).trim()
  const rawInput = envInput || stdinInput

  if (!rawInput) {
    writeJson({ ok: false, error: 'order-model-bridge expected JSON payload on stdin or ORDER_MODEL_BRIDGE_INPUT' })
  }

  let parsed: BridgeInput
  try {
    parsed = JSON.parse(rawInput) as BridgeInput
  } catch (error) {
    writeJson({ ok: false, error: `Invalid JSON payload: ${normalizeError(error)}` })
  }

  if (!parsed?.model || !parsed?.prompt) {
    writeJson({ ok: false, error: 'Payload must include model and prompt' })
  }

  const options = asObject(parsed.options)
  const parsedTarget = parseProviderAndModel(parsed.provider, parsed.model)

  try {
    const { credential, resolvedProvider } = await getCredential(parsedTarget.provider)
    const dispatchProvider =
      resolvedProvider === 'openai-codex' ? 'openai' : parsedTarget.provider

    const result =
      dispatchProvider === 'openai'
        ? await callOpenAI(credential, parsedTarget.model, parsed.prompt, options)
        : dispatchProvider === 'anthropic'
          ? await callAnthropic(credential, parsedTarget.model, parsed.prompt, options)
          : await callGateway(
              credential,
              dispatchProvider,
              parsedTarget.model,
              parsed.prompt,
              options
            )

    writeJson({
      ok: true,
      result: {
        provider: parsedTarget.provider,
        model: parsedTarget.model,
        content: result.content,
        usage: result.usage,
        id: result.id,
      },
    })
  } catch (error) {
    const debug = truthy.has((process.env.ORDER_MODEL_BRIDGE_DEBUG || '').toLowerCase())
    writeJson({
      ok: false,
      error: normalizeError(error),
      details: debug ? { stack: error instanceof Error ? error.stack : undefined } : undefined,
    })
  }
}

await main()

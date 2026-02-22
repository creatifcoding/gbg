# Pi Coding Agent SDK Reference

> **Package**: `@mariozechner/pi-coding-agent`  
> **Location**: `node_modules/@mariozechner/pi-coding-agent/dist/core/`

Complete API reference for the pi coding agent SDK. All types, interfaces, classes, functions, and constants are documented with full signatures.

---

## Table of Contents

1. [sdk.ts](#sdkts---main-entry-point)
2. [agent-session.ts](#agent-sessionts---core-session-management)
3. [auth-storage.ts](#auth-storagets---credential-management)
4. [bash-executor.ts](#bash-executorts---command-execution)
5. [defaults.ts](#defaultsts---default-values)
6. [diagnostics.ts](#diagnosticsts---resource-diagnostics)
7. [event-bus.ts](#event-busts---event-communication)
8. [exec.ts](#exects---shell-execution)
9. [footer-data-provider.ts](#footer-data-providerts---ui-data)
10. [keybindings.ts](#keybindingsts---keyboard-shortcuts)
11. [messages.ts](#messagests---custom-message-types)
12. [model-registry.ts](#model-registryts---model-management)
13. [model-resolver.ts](#model-resolverts---model-resolution)
14. [package-manager.ts](#package-managerts---package-management)
15. [prompt-templates.ts](#prompt-templatests---prompt-expansion)
16. [resolve-config-value.ts](#resolve-config-valuets---config-resolution)
17. [resource-loader.ts](#resource-loaderts---resource-discovery)
18. [session-manager.ts](#session-managerts---session-persistence)
19. [settings-manager.ts](#settings-managerts---settings-persistence)
20. [skills.ts](#skillsts---skill-loading)
21. [slash-commands.ts](#slash-commandsts---slash-command-types)
22. [system-prompt.ts](#system-promptts---system-prompt-construction)
23. [timings.ts](#timingsts---performance-profiling)
24. [extensions/](#extensions---extension-system)
    - [types.ts](#extensionstypests---extension-type-definitions)
    - [loader.ts](#extensionsloaderts---extension-loading)
    - [runner.ts](#extensionsrunnerts---extension-execution)
    - [wrapper.ts](#extensionswrapperts---tool-wrapping)
25. [compaction/](#compaction---context-compaction)
    - [compaction.ts](#compactioncompactionts---core-compaction)
    - [branch-summarization.ts](#compactionbranch-summarizationts---branch-summaries)
    - [utils.ts](#compactionutilsts---shared-utilities)
26. [tools/](#tools---built-in-tools)
    - [index.ts](#toolsindexts---tool-exports)
    - [bash.ts](#toolsbashts---bash-tool)
    - [read.ts](#toolsreadts---read-tool)
    - [edit.ts](#toolseditts---edit-tool)
    - [write.ts](#toolswritets---write-tool)
    - [grep.ts](#toolsgreepts---grep-tool)
    - [find.ts](#toolsfindts---find-tool)
    - [ls.ts](#toolslsts---ls-tool)
    - [truncate.ts](#toolstruncatets---output-truncation)
    - [path-utils.ts](#toolspath-utilsts---path-utilities)
    - [edit-diff.ts](#toolsedit-diffts---diff-computation)
27. [export-html/](#export-html---html-export)
    - [index.ts](#export-htmlindexts---session-export)
    - [ansi-to-html.ts](#export-htmlansi-to-htmlts---ansi-conversion)
    - [tool-renderer.ts](#export-htmltool-rendererts---tool-rendering)

---

## sdk.ts — Main Entry Point

The main SDK entry point for creating agent sessions.

### Interfaces

#### `CreateAgentSessionOptions`

```typescript
interface CreateAgentSessionOptions {
    /** Working directory for project-local discovery. Default: process.cwd() */
    cwd?: string;
    /** Global config directory. Default: ~/.pi/agent */
    agentDir?: string;
    /** Auth storage for credentials. Default: new AuthStorage(agentDir/auth.json) */
    authStorage?: AuthStorage;
    /** Model registry. Default: new ModelRegistry(authStorage, agentDir/models.json) */
    modelRegistry?: ModelRegistry;
    /** Model to use. Default: from settings, else first available */
    model?: Model<any>;
    /** Thinking level. Default: from settings, else 'medium' (clamped to model capabilities) */
    thinkingLevel?: ThinkingLevel;
    /** Models available for cycling (Ctrl+P in interactive mode) */
    scopedModels?: Array<{
        model: Model<any>;
        thinkingLevel: ThinkingLevel;
    }>;
    /** Built-in tools to use. Default: codingTools [read, bash, edit, write] */
    tools?: Tool[];
    /** Custom tools to register (in addition to built-in tools). */
    customTools?: ToolDefinition[];
    /** Resource loader. When omitted, DefaultResourceLoader is used. */
    resourceLoader?: ResourceLoader;
    /** Session manager. Default: SessionManager.create(cwd) */
    sessionManager?: SessionManager;
    /** Settings manager. Default: SettingsManager.create(cwd, agentDir) */
    settingsManager?: SettingsManager;
}
```

#### `CreateAgentSessionResult`

```typescript
interface CreateAgentSessionResult {
    /** The created session */
    session: AgentSession;
    /** Extensions result (for UI context setup in interactive mode) */
    extensionsResult: LoadExtensionsResult;
    /** Warning if session was restored with a different model than saved */
    modelFallbackMessage?: string;
}
```

### Functions

#### `createAgentSession`

```typescript
function createAgentSession(options?: CreateAgentSessionOptions): Promise<CreateAgentSessionResult>
```

Create an AgentSession with the specified options.

**Example:**
```typescript
// Minimal - uses defaults
const { session } = await createAgentSession();

// With explicit model
import { getModel } from '@mariozechner/pi-ai';
const { session } = await createAgentSession({
  model: getModel('anthropic', 'claude-opus-4-5'),
  thinkingLevel: 'high',
});

// Continue previous session
const { session, modelFallbackMessage } = await createAgentSession({
  continueSession: true,
});

// Full control
const loader = new DefaultResourceLoader({
  cwd: process.cwd(),
  agentDir: getAgentDir(),
  settingsManager: SettingsManager.create(),
});
await loader.reload();
const { session } = await createAgentSession({
  model: myModel,
  tools: [readTool, bashTool],
  resourceLoader: loader,
  sessionManager: SessionManager.inMemory(),
});
```

### Tool Exports

```typescript
export {
    readTool,
    bashTool,
    editTool,
    writeTool,
    grepTool,
    findTool,
    lsTool,
    codingTools,
    readOnlyTools,
    allBuiltInTools,
    createCodingTools,
    createReadOnlyTools,
    createReadTool,
    createBashTool,
    createEditTool,
    createWriteTool,
    createGrepTool,
    createFindTool,
    createLsTool,
}
```

### Type Re-exports

```typescript
export type { ExtensionAPI, ExtensionCommandContext, ExtensionContext, ExtensionFactory, SlashCommandInfo, SlashCommandLocation, SlashCommandSource, ToolDefinition } from "./extensions/index.js";
export type { PromptTemplate } from "./prompt-templates.js";
export type { Skill } from "./skills.js";
export type { Tool } from "./tools/index.js";
```

---

## agent-session.ts — Core Session Management

Core abstraction for agent lifecycle and session management. Shared between all run modes (interactive, print, rpc).

### Interfaces

#### `ParsedSkillBlock`

```typescript
interface ParsedSkillBlock {
    name: string;
    location: string;
    content: string;
    userMessage: string | undefined;
}
```

#### `AgentSessionConfig`

```typescript
interface AgentSessionConfig {
    agent: Agent;
    sessionManager: SessionManager;
    settingsManager: SettingsManager;
    cwd: string;
    /** Models to cycle through with Ctrl+P (from --models flag) */
    scopedModels?: Array<{
        model: Model<any>;
        thinkingLevel: ThinkingLevel;
    }>;
    /** Resource loader for skills, prompts, themes, context files, system prompt */
    resourceLoader: ResourceLoader;
    /** SDK custom tools registered outside extensions */
    customTools?: ToolDefinition[];
    /** Model registry for API key resolution and model discovery */
    modelRegistry: ModelRegistry;
    /** Initial active built-in tool names. Default: [read, bash, edit, write] */
    initialActiveToolNames?: string[];
    /** Override base tools (useful for custom runtimes). */
    baseToolsOverride?: Record<string, AgentTool>;
    /** Mutable ref used by Agent to access the current ExtensionRunner */
    extensionRunnerRef?: {
        current?: ExtensionRunner;
    };
}
```

#### `ExtensionBindings`

```typescript
interface ExtensionBindings {
    uiContext?: ExtensionUIContext;
    commandContextActions?: ExtensionCommandContextActions;
    shutdownHandler?: ShutdownHandler;
    onError?: ExtensionErrorListener;
}
```

#### `PromptOptions`

```typescript
interface PromptOptions {
    /** Whether to expand file-based prompt templates (default: true) */
    expandPromptTemplates?: boolean;
    /** Image attachments */
    images?: ImageContent[];
    /** When streaming, how to queue the message: "steer" (interrupt) or "followUp" (wait). Required if streaming. */
    streamingBehavior?: "steer" | "followUp";
    /** Source of input for extension input event handlers. Defaults to "interactive". */
    source?: InputSource;
}
```

#### `ModelCycleResult`

```typescript
interface ModelCycleResult {
    model: Model<any>;
    thinkingLevel: ThinkingLevel;
    /** Whether cycling through scoped models (--models flag) or all available */
    isScoped: boolean;
}
```

#### `SessionStats`

```typescript
interface SessionStats {
    sessionFile: string | undefined;
    sessionId: string;
    userMessages: number;
    assistantMessages: number;
    toolCalls: number;
    toolResults: number;
    totalMessages: number;
    tokens: {
        input: number;
        output: number;
        cacheRead: number;
        cacheWrite: number;
        total: number;
    };
    cost: number;
}
```

### Types

#### `AgentSessionEvent`

```typescript
type AgentSessionEvent = AgentEvent | {
    type: "auto_compaction_start";
    reason: "threshold" | "overflow";
} | {
    type: "auto_compaction_end";
    result: CompactionResult | undefined;
    aborted: boolean;
    willRetry: boolean;
    errorMessage?: string;
} | {
    type: "auto_retry_start";
    attempt: number;
    maxAttempts: number;
    delayMs: number;
    errorMessage: string;
} | {
    type: "auto_retry_end";
    success: boolean;
    attempt: number;
    finalError?: string;
};
```

#### `AgentSessionEventListener`

```typescript
type AgentSessionEventListener = (event: AgentSessionEvent) => void;
```

### Functions

#### `parseSkillBlock`

```typescript
function parseSkillBlock(text: string): ParsedSkillBlock | null
```

Parse a skill block from message text. Returns null if the text doesn't contain a skill block.

### Class: `AgentSession`

```typescript
class AgentSession {
    readonly agent: Agent;
    readonly sessionManager: SessionManager;
    readonly settingsManager: SettingsManager;
    
    constructor(config: AgentSessionConfig);
    
    // Properties
    get modelRegistry(): ModelRegistry;
    get state(): AgentState;
    get model(): Model<any> | undefined;
    get thinkingLevel(): ThinkingLevel;
    get isStreaming(): boolean;
    get systemPrompt(): string;
    get retryAttempt(): number;
    get isCompacting(): boolean;
    get messages(): AgentMessage[];
    get steeringMode(): "all" | "one-at-a-time";
    get followUpMode(): "all" | "one-at-a-time";
    get sessionFile(): string | undefined;
    get sessionId(): string;
    get sessionName(): string | undefined;
    get scopedModels(): ReadonlyArray<{ model: Model<any>; thinkingLevel: ThinkingLevel }>;
    get promptTemplates(): ReadonlyArray<PromptTemplate>;
    get pendingMessageCount(): number;
    get resourceLoader(): ResourceLoader;
    get autoCompactionEnabled(): boolean;
    get isRetrying(): boolean;
    get autoRetryEnabled(): boolean;
    get isBashRunning(): boolean;
    get hasPendingBashMessages(): boolean;
    get extensionRunner(): ExtensionRunner | undefined;
    
    // Event Subscription
    subscribe(listener: AgentSessionEventListener): () => void;
    dispose(): void;
    
    // Tools
    getActiveToolNames(): string[];
    getAllTools(): ToolInfo[];
    setActiveToolsByName(toolNames: string[]): void;
    
    // Prompts & Messages
    prompt(text: string, options?: PromptOptions): Promise<void>;
    steer(text: string, images?: ImageContent[]): Promise<void>;
    followUp(text: string, images?: ImageContent[]): Promise<void>;
    sendCustomMessage<T = unknown>(
        message: Pick<CustomMessage<T>, "customType" | "content" | "display" | "details">,
        options?: { triggerTurn?: boolean; deliverAs?: "steer" | "followUp" | "nextTurn" }
    ): Promise<void>;
    sendUserMessage(
        content: string | (TextContent | ImageContent)[],
        options?: { deliverAs?: "steer" | "followUp" }
    ): Promise<void>;
    clearQueue(): { steering: string[]; followUp: string[] };
    getSteeringMessages(): readonly string[];
    getFollowUpMessages(): readonly string[];
    
    // Model Management
    setModel(model: Model<any>): Promise<void>;
    cycleModel(direction?: "forward" | "backward"): Promise<ModelCycleResult | undefined>;
    setScopedModels(scopedModels: Array<{ model: Model<any>; thinkingLevel: ThinkingLevel }>): void;
    
    // Thinking Level
    setThinkingLevel(level: ThinkingLevel): void;
    cycleThinkingLevel(): ThinkingLevel | undefined;
    getAvailableThinkingLevels(): ThinkingLevel[];
    supportsXhighThinking(): boolean;
    supportsThinking(): boolean;
    
    // Message Modes
    setSteeringMode(mode: "all" | "one-at-a-time"): void;
    setFollowUpMode(mode: "all" | "one-at-a-time"): void;
    
    // Compaction
    compact(customInstructions?: string): Promise<CompactionResult>;
    abortCompaction(): void;
    abortBranchSummary(): void;
    setAutoCompactionEnabled(enabled: boolean): void;
    
    // Retry
    abortRetry(): void;
    setAutoRetryEnabled(enabled: boolean): void;
    
    // Session Management
    abort(): Promise<void>;
    newSession(options?: { parentSession?: string; setup?: (sessionManager: SessionManager) => Promise<void> }): Promise<boolean>;
    switchSession(sessionPath: string): Promise<boolean>;
    setSessionName(name: string): void;
    fork(entryId: string): Promise<{ selectedText: string; cancelled: boolean }>;
    navigateTree(
        targetId: string,
        options?: {
            summarize?: boolean;
            customInstructions?: string;
            replaceInstructions?: boolean;
            label?: string;
        }
    ): Promise<{ editorText?: string; cancelled: boolean; aborted?: boolean; summaryEntry?: BranchSummaryEntry }>;
    getUserMessagesForForking(): Array<{ entryId: string; text: string }>;
    getSessionStats(): SessionStats;
    getContextUsage(): ContextUsage | undefined;
    
    // Bash Execution
    executeBash(
        command: string,
        onChunk?: (chunk: string) => void,
        options?: { excludeFromContext?: boolean; operations?: BashOperations }
    ): Promise<BashResult>;
    recordBashResult(
        command: string,
        result: BashResult,
        options?: { excludeFromContext?: boolean }
    ): void;
    abortBash(): void;
    
    // Extensions
    bindExtensions(bindings: ExtensionBindings): Promise<void>;
    reload(): Promise<void>;
    hasExtensionHandlers(eventType: string): boolean;
    
    // Export
    exportToHtml(outputPath?: string): Promise<string>;
    getLastAssistantText(): string | undefined;
}
```

---

## auth-storage.ts — Credential Management

Credential storage for API keys and OAuth tokens.

### Types

#### `ApiKeyCredential`

```typescript
type ApiKeyCredential = {
    type: "api_key";
    key: string;
};
```

#### `OAuthCredential`

```typescript
type OAuthCredential = {
    type: "oauth";
} & OAuthCredentials;
```

#### `AuthCredential`

```typescript
type AuthCredential = ApiKeyCredential | OAuthCredential;
```

#### `AuthStorageData`

```typescript
type AuthStorageData = Record<string, AuthCredential>;
```

### Class: `AuthStorage`

```typescript
class AuthStorage {
    constructor(authPath?: string);
    
    /** Set a runtime API key override (not persisted to disk). Used for CLI --api-key flag. */
    setRuntimeApiKey(provider: string, apiKey: string): void;
    
    /** Remove a runtime API key override. */
    removeRuntimeApiKey(provider: string): void;
    
    /** Set a fallback resolver for API keys not found in auth.json or env vars. */
    setFallbackResolver(resolver: (provider: string) => string | undefined): void;
    
    /** Reload credentials from disk. */
    reload(): void;
    
    /** Get credential for a provider. */
    get(provider: string): AuthCredential | undefined;
    
    /** Set credential for a provider. */
    set(provider: string, credential: AuthCredential): void;
    
    /** Remove credential for a provider. */
    remove(provider: string): void;
    
    /** List all providers with credentials. */
    list(): string[];
    
    /** Check if credentials exist for a provider in auth.json. */
    has(provider: string): boolean;
    
    /** Check if any form of auth is configured for a provider. */
    hasAuth(provider: string): boolean;
    
    /** Get all credentials (for passing to getOAuthApiKey). */
    getAll(): AuthStorageData;
    
    /** Login to an OAuth provider. */
    login(providerId: OAuthProviderId, callbacks: OAuthLoginCallbacks): Promise<void>;
    
    /** Logout from a provider. */
    logout(provider: string): void;
    
    /**
     * Get API key for a provider.
     * Priority:
     * 1. Runtime override (CLI --api-key)
     * 2. API key from auth.json
     * 3. OAuth token from auth.json (auto-refreshed with locking)
     * 4. Environment variable
     * 5. Fallback resolver (models.json custom providers)
     */
    getApiKey(providerId: string): Promise<string | undefined>;
    
    /** Get all registered OAuth providers */
    getOAuthProviders(): OAuthProviderInterface[];
}
```

---

## bash-executor.ts — Command Execution

Bash command execution with streaming support and cancellation.

### Interfaces

#### `BashExecutorOptions`

```typescript
interface BashExecutorOptions {
    /** Callback for streaming output chunks (already sanitized) */
    onChunk?: (chunk: string) => void;
    /** AbortSignal for cancellation */
    signal?: AbortSignal;
}
```

#### `BashResult`

```typescript
interface BashResult {
    /** Combined stdout + stderr output (sanitized, possibly truncated) */
    output: string;
    /** Process exit code (undefined if killed/cancelled) */
    exitCode: number | undefined;
    /** Whether the command was cancelled via signal */
    cancelled: boolean;
    /** Whether the output was truncated */
    truncated: boolean;
    /** Path to temp file containing full output (if output exceeded truncation threshold) */
    fullOutputPath?: string;
}
```

### Functions

#### `executeBash`

```typescript
function executeBash(command: string, options?: BashExecutorOptions): Promise<BashResult>
```

Execute a bash command with optional streaming and cancellation support.

**Features:**
- Streams sanitized output via onChunk callback
- Writes large output to temp file for later retrieval
- Supports cancellation via AbortSignal
- Sanitizes output (strips ANSI, removes binary garbage, normalizes newlines)
- Truncates output if it exceeds the default max bytes

#### `executeBashWithOperations`

```typescript
function executeBashWithOperations(
    command: string,
    cwd: string,
    operations: BashOperations,
    options?: BashExecutorOptions
): Promise<BashResult>
```

Execute a bash command using custom BashOperations. Used for remote execution (SSH, containers, etc.).

---

## defaults.ts — Default Values

### Constants

#### `DEFAULT_THINKING_LEVEL`

```typescript
const DEFAULT_THINKING_LEVEL: ThinkingLevel;
```

---

## diagnostics.ts — Resource Diagnostics

### Interfaces

#### `ResourceCollision`

```typescript
interface ResourceCollision {
    resourceType: "extension" | "skill" | "prompt" | "theme";
    name: string;
    winnerPath: string;
    loserPath: string;
    winnerSource?: string;
    loserSource?: string;
}
```

#### `ResourceDiagnostic`

```typescript
interface ResourceDiagnostic {
    type: "warning" | "error" | "collision";
    message: string;
    path?: string;
    collision?: ResourceCollision;
}
```

---

## event-bus.ts — Event Communication

### Interfaces

#### `EventBus`

```typescript
interface EventBus {
    emit(channel: string, data: unknown): void;
    on(channel: string, handler: (data: unknown) => void): () => void;
}
```

#### `EventBusController`

```typescript
interface EventBusController extends EventBus {
    clear(): void;
}
```

### Functions

#### `createEventBus`

```typescript
function createEventBus(): EventBusController
```

---

## exec.ts — Shell Execution

Shared command execution utilities for extensions and custom tools.

### Interfaces

#### `ExecOptions`

```typescript
interface ExecOptions {
    /** AbortSignal to cancel the command */
    signal?: AbortSignal;
    /** Timeout in milliseconds */
    timeout?: number;
    /** Working directory */
    cwd?: string;
}
```

#### `ExecResult`

```typescript
interface ExecResult {
    stdout: string;
    stderr: string;
    code: number;
    killed: boolean;
}
```

### Functions

#### `execCommand`

```typescript
function execCommand(
    command: string,
    args: string[],
    cwd: string,
    options?: ExecOptions
): Promise<ExecResult>
```

Execute a shell command and return stdout/stderr/code. Supports timeout and abort signal.

---

## footer-data-provider.ts — UI Data

Provides git branch and extension statuses.

### Class: `FooterDataProvider`

```typescript
class FooterDataProvider {
    constructor();
    
    /** Current git branch, null if not in repo, "detached" if detached HEAD */
    getGitBranch(): string | null;
    
    /** Extension status texts set via ctx.ui.setStatus() */
    getExtensionStatuses(): ReadonlyMap<string, string>;
    
    /** Subscribe to git branch changes. Returns unsubscribe function. */
    onBranchChange(callback: () => void): () => void;
    
    /** Internal: set extension status */
    setExtensionStatus(key: string, text: string | undefined): void;
    
    /** Internal: clear extension statuses */
    clearExtensionStatuses(): void;
    
    /** Number of unique providers with available models (for footer display) */
    getAvailableProviderCount(): number;
    
    /** Internal: update available provider count */
    setAvailableProviderCount(count: number): void;
    
    /** Internal: cleanup */
    dispose(): void;
}
```

### Types

#### `ReadonlyFooterDataProvider`

```typescript
type ReadonlyFooterDataProvider = Pick<FooterDataProvider, 
    "getGitBranch" | "getExtensionStatuses" | "getAvailableProviderCount" | "onBranchChange"
>;
```

---

## keybindings.ts — Keyboard Shortcuts

### Types

#### `AppAction`

```typescript
type AppAction = 
    | "interrupt" 
    | "clear" 
    | "exit" 
    | "suspend" 
    | "cycleThinkingLevel" 
    | "cycleModelForward" 
    | "cycleModelBackward" 
    | "selectModel" 
    | "expandTools" 
    | "toggleThinking" 
    | "toggleSessionNamedFilter" 
    | "externalEditor" 
    | "followUp" 
    | "dequeue" 
    | "pasteImage" 
    | "newSession" 
    | "tree" 
    | "fork" 
    | "resume";
```

#### `KeyAction`

```typescript
type KeyAction = AppAction | EditorAction;
```

#### `KeybindingsConfig`

```typescript
type KeybindingsConfig = {
    [K in KeyAction]?: KeyId | KeyId[];
};
```

### Constants

#### `DEFAULT_APP_KEYBINDINGS`

```typescript
const DEFAULT_APP_KEYBINDINGS: Record<AppAction, KeyId | KeyId[]>;
```

#### `DEFAULT_KEYBINDINGS`

```typescript
const DEFAULT_KEYBINDINGS: Required<KeybindingsConfig>;
```

### Class: `KeybindingsManager`

```typescript
class KeybindingsManager {
    /** Create from config file and set up editor keybindings. */
    static create(agentDir?: string): KeybindingsManager;
    
    /** Create in-memory. */
    static inMemory(config?: KeybindingsConfig): KeybindingsManager;
    
    /** Check if input matches an app action. */
    matches(data: string, action: AppAction): boolean;
    
    /** Get keys bound to an app action. */
    getKeys(action: AppAction): KeyId[];
    
    /** Get the full effective config. */
    getEffectiveConfig(): Required<KeybindingsConfig>;
}
```

---

## messages.ts — Custom Message Types

Custom message types and transformers for the coding agent.

### Constants

```typescript
const COMPACTION_SUMMARY_PREFIX = "The conversation history before this point was compacted into the following summary:\n\n<summary>\n";
const COMPACTION_SUMMARY_SUFFIX = "\n</summary>";
const BRANCH_SUMMARY_PREFIX = "The following is a summary of a branch that this conversation came back from:\n\n<summary>\n";
const BRANCH_SUMMARY_SUFFIX = "</summary>";
```

### Interfaces

#### `BashExecutionMessage`

```typescript
interface BashExecutionMessage {
    role: "bashExecution";
    command: string;
    output: string;
    exitCode: number | undefined;
    cancelled: boolean;
    truncated: boolean;
    fullOutputPath?: string;
    timestamp: number;
    /** If true, this message is excluded from LLM context (!! prefix) */
    excludeFromContext?: boolean;
}
```

#### `CustomMessage<T>`

```typescript
interface CustomMessage<T = unknown> {
    role: "custom";
    customType: string;
    content: string | (TextContent | ImageContent)[];
    display: boolean;
    details?: T;
    timestamp: number;
}
```

#### `BranchSummaryMessage`

```typescript
interface BranchSummaryMessage {
    role: "branchSummary";
    summary: string;
    fromId: string;
    timestamp: number;
}
```

#### `CompactionSummaryMessage`

```typescript
interface CompactionSummaryMessage {
    role: "compactionSummary";
    summary: string;
    tokensBefore: number;
    timestamp: number;
}
```

### Functions

#### `bashExecutionToText`

```typescript
function bashExecutionToText(msg: BashExecutionMessage): string
```

Convert a BashExecutionMessage to user message text for LLM context.

#### `createBranchSummaryMessage`

```typescript
function createBranchSummaryMessage(
    summary: string,
    fromId: string,
    timestamp: string
): BranchSummaryMessage
```

#### `createCompactionSummaryMessage`

```typescript
function createCompactionSummaryMessage(
    summary: string,
    tokensBefore: number,
    timestamp: string
): CompactionSummaryMessage
```

#### `createCustomMessage`

```typescript
function createCustomMessage(
    customType: string,
    content: string | (TextContent | ImageContent)[],
    display: boolean,
    details: unknown | undefined,
    timestamp: string
): CustomMessage
```

#### `convertToLlm`

```typescript
function convertToLlm(messages: AgentMessage[]): Message[]
```

Transform AgentMessages (including custom types) to LLM-compatible Messages.

---

## model-registry.ts — Model Management

Model registry - manages built-in and custom models, provides API key resolution.

### Interfaces

#### `ProviderConfigInput`

```typescript
interface ProviderConfigInput {
    baseUrl?: string;
    apiKey?: string;
    api?: Api;
    streamSimple?: (model: Model<Api>, context: Context, options?: SimpleStreamOptions) => AssistantMessageEventStream;
    headers?: Record<string, string>;
    authHeader?: boolean;
    /** OAuth provider for /login support */
    oauth?: Omit<OAuthProviderInterface, "id">;
    models?: Array<{
        id: string;
        name: string;
        api?: Api;
        reasoning: boolean;
        input: ("text" | "image")[];
        cost: {
            input: number;
            output: number;
            cacheRead: number;
            cacheWrite: number;
        };
        contextWindow: number;
        maxTokens: number;
        headers?: Record<string, string>;
        compat?: Model<Api>["compat"];
    }>;
}
```

### Functions

#### `clearApiKeyCache`

```typescript
const clearApiKeyCache: typeof clearConfigValueCache;
```

Clear the config value command cache. Exported for testing.

### Class: `ModelRegistry`

```typescript
class ModelRegistry {
    readonly authStorage: AuthStorage;
    
    constructor(authStorage: AuthStorage, modelsJsonPath?: string | undefined);
    
    /** Reload models from disk (built-in + custom from models.json). */
    refresh(): void;
    
    /** Get any error from loading models.json (undefined if no error). */
    getError(): string | undefined;
    
    /** Get all models (built-in + custom). */
    getAll(): Model<Api>[];
    
    /** Get only models that have auth configured. */
    getAvailable(): Model<Api>[];
    
    /** Find a model by provider and ID. */
    find(provider: string, modelId: string): Model<Api> | undefined;
    
    /** Get API key for a model. */
    getApiKey(model: Model<Api>): Promise<string | undefined>;
    
    /** Get API key for a provider. */
    getApiKeyForProvider(provider: string): Promise<string | undefined>;
    
    /** Check if a model is using OAuth credentials (subscription). */
    isUsingOAuth(model: Model<Api>): boolean;
    
    /**
     * Register a provider dynamically (from extensions).
     * If provider has models: replaces all existing models for this provider.
     * If provider has only baseUrl/headers: overrides existing models' URLs.
     * If provider has oauth: registers OAuth provider for /login support.
     */
    registerProvider(providerName: string, config: ProviderConfigInput): void;
}
```

---

## model-resolver.ts — Model Resolution

Model resolution, scoping, and initial selection.

### Constants

#### `defaultModelPerProvider`

```typescript
const defaultModelPerProvider: Record<KnownProvider, string>;
```

### Interfaces

#### `ScopedModel`

```typescript
interface ScopedModel {
    model: Model<Api>;
    /** Thinking level if explicitly specified in pattern (e.g., "model:high"), undefined otherwise */
    thinkingLevel?: ThinkingLevel;
}
```

#### `ParsedModelResult`

```typescript
interface ParsedModelResult {
    model: Model<Api> | undefined;
    /** Thinking level if explicitly specified in pattern, undefined otherwise */
    thinkingLevel?: ThinkingLevel;
    warning: string | undefined;
}
```

#### `ResolveCliModelResult`

```typescript
interface ResolveCliModelResult {
    model: Model<Api> | undefined;
    thinkingLevel?: ThinkingLevel;
    warning: string | undefined;
    /** Error message suitable for CLI display. When set, model will be undefined. */
    error: string | undefined;
}
```

#### `InitialModelResult`

```typescript
interface InitialModelResult {
    model: Model<Api> | undefined;
    thinkingLevel: ThinkingLevel;
    fallbackMessage: string | undefined;
}
```

### Functions

#### `parseModelPattern`

```typescript
function parseModelPattern(
    pattern: string,
    availableModels: Model<Api>[],
    options?: { allowInvalidThinkingLevelFallback?: boolean }
): ParsedModelResult
```

Parse a pattern to extract model and thinking level.

#### `resolveModelScope`

```typescript
function resolveModelScope(
    patterns: string[],
    modelRegistry: ModelRegistry
): Promise<ScopedModel[]>
```

Resolve model patterns to actual Model objects with optional thinking levels.

#### `resolveCliModel`

```typescript
function resolveCliModel(options: {
    cliProvider?: string;
    cliModel?: string;
    modelRegistry: ModelRegistry;
}): ResolveCliModelResult
```

Resolve a single model from CLI flags.

#### `findInitialModel`

```typescript
function findInitialModel(options: {
    cliProvider?: string;
    cliModel?: string;
    scopedModels: ScopedModel[];
    isContinuing: boolean;
    defaultProvider?: string;
    defaultModelId?: string;
    defaultThinkingLevel?: ThinkingLevel;
    modelRegistry: ModelRegistry;
}): Promise<InitialModelResult>
```

Find the initial model to use based on priority.

#### `restoreModelFromSession`

```typescript
function restoreModelFromSession(
    savedProvider: string,
    savedModelId: string,
    currentModel: Model<Api> | undefined,
    shouldPrintMessages: boolean,
    modelRegistry: ModelRegistry
): Promise<{ model: Model<Api> | undefined; fallbackMessage: string | undefined }>
```

Restore model from session, with fallback to available models.

---

## package-manager.ts — Package Management

### Interfaces

#### `PathMetadata`

```typescript
interface PathMetadata {
    source: string;
    scope: SourceScope;
    origin: "package" | "top-level";
    baseDir?: string;
}
```

#### `ResolvedResource`

```typescript
interface ResolvedResource {
    path: string;
    enabled: boolean;
    metadata: PathMetadata;
}
```

#### `ResolvedPaths`

```typescript
interface ResolvedPaths {
    extensions: ResolvedResource[];
    skills: ResolvedResource[];
    prompts: ResolvedResource[];
    themes: ResolvedResource[];
}
```

#### `ProgressEvent`

```typescript
interface ProgressEvent {
    type: "start" | "progress" | "complete" | "error";
    action: "install" | "remove" | "update" | "clone" | "pull";
    source: string;
    message?: string;
}
```

#### `PackageManager`

```typescript
interface PackageManager {
    resolve(onMissing?: (source: string) => Promise<MissingSourceAction>): Promise<ResolvedPaths>;
    install(source: string, options?: { local?: boolean }): Promise<void>;
    remove(source: string, options?: { local?: boolean }): Promise<void>;
    update(source?: string): Promise<void>;
    resolveExtensionSources(sources: string[], options?: { local?: boolean; temporary?: boolean }): Promise<ResolvedPaths>;
    addSourceToSettings(source: string, options?: { local?: boolean }): boolean;
    removeSourceFromSettings(source: string, options?: { local?: boolean }): boolean;
    setProgressCallback(callback: ProgressCallback | undefined): void;
    getInstalledPath(source: string, scope: "user" | "project"): string | undefined;
}
```

### Types

#### `MissingSourceAction`

```typescript
type MissingSourceAction = "install" | "skip" | "error";
```

#### `ProgressCallback`

```typescript
type ProgressCallback = (event: ProgressEvent) => void;
```

### Class: `DefaultPackageManager`

```typescript
class DefaultPackageManager implements PackageManager {
    constructor(options: PackageManagerOptions);
    
    setProgressCallback(callback: ProgressCallback | undefined): void;
    addSourceToSettings(source: string, options?: { local?: boolean }): boolean;
    removeSourceFromSettings(source: string, options?: { local?: boolean }): boolean;
    getInstalledPath(source: string, scope: "user" | "project"): string | undefined;
    resolve(onMissing?: (source: string) => Promise<MissingSourceAction>): Promise<ResolvedPaths>;
    resolveExtensionSources(sources: string[], options?: { local?: boolean; temporary?: boolean }): Promise<ResolvedPaths>;
    install(source: string, options?: { local?: boolean }): Promise<void>;
    remove(source: string, options?: { local?: boolean }): Promise<void>;
    update(source?: string): Promise<void>;
}
```

---

## prompt-templates.ts — Prompt Expansion

### Interfaces

#### `PromptTemplate`

```typescript
interface PromptTemplate {
    name: string;
    description: string;
    content: string;
    source: string;
    filePath: string;
}
```

#### `LoadPromptTemplatesOptions`

```typescript
interface LoadPromptTemplatesOptions {
    /** Working directory for project-local templates. Default: process.cwd() */
    cwd?: string;
    /** Agent config directory for global templates. Default: from getPromptsDir() */
    agentDir?: string;
    /** Explicit prompt template paths (files or directories) */
    promptPaths?: string[];
    /** Include default prompt directories. Default: true */
    includeDefaults?: boolean;
}
```

### Functions

#### `parseCommandArgs`

```typescript
function parseCommandArgs(argsString: string): string[]
```

Parse command arguments respecting quoted strings (bash-style).

#### `substituteArgs`

```typescript
function substituteArgs(content: string, args: string[]): string
```

Substitute argument placeholders in template content.

Supports:
- `$1`, `$2`, ... for positional args
- `$@` and `$ARGUMENTS` for all args
- `${@:N}` for args from Nth onwards (bash-style slicing)
- `${@:N:L}` for L args starting from Nth

#### `loadPromptTemplates`

```typescript
function loadPromptTemplates(options?: LoadPromptTemplatesOptions): PromptTemplate[]
```

Load all prompt templates from global, project, and explicit paths.

#### `expandPromptTemplate`

```typescript
function expandPromptTemplate(text: string, templates: PromptTemplate[]): string
```

Expand a prompt template if it matches a template name.

---

## resolve-config-value.ts — Config Resolution

### Functions

#### `resolveConfigValue`

```typescript
function resolveConfigValue(config: string): string | undefined
```

Resolve a config value (API key, header value, etc.) to an actual value.
- If starts with "!", executes the rest as a shell command and uses stdout (cached)
- Otherwise checks environment variable first, then treats as literal (not cached)

#### `resolveHeaders`

```typescript
function resolveHeaders(headers: Record<string, string> | undefined): Record<string, string> | undefined
```

Resolve all header values using the same resolution logic as API keys.

#### `clearConfigValueCache`

```typescript
function clearConfigValueCache(): void
```

Clear the config value command cache.

---

## resource-loader.ts — Resource Discovery

### Interfaces

#### `ResourceExtensionPaths`

```typescript
interface ResourceExtensionPaths {
    skillPaths?: Array<{ path: string; metadata: PathMetadata }>;
    promptPaths?: Array<{ path: string; metadata: PathMetadata }>;
    themePaths?: Array<{ path: string; metadata: PathMetadata }>;
}
```

#### `ResourceLoader`

```typescript
interface ResourceLoader {
    getExtensions(): LoadExtensionsResult;
    getSkills(): { skills: Skill[]; diagnostics: ResourceDiagnostic[] };
    getPrompts(): { prompts: PromptTemplate[]; diagnostics: ResourceDiagnostic[] };
    getThemes(): { themes: Theme[]; diagnostics: ResourceDiagnostic[] };
    getAgentsFiles(): { agentsFiles: Array<{ path: string; content: string }> };
    getSystemPrompt(): string | undefined;
    getAppendSystemPrompt(): string[];
    getPathMetadata(): Map<string, PathMetadata>;
    extendResources(paths: ResourceExtensionPaths): void;
    reload(): Promise<void>;
}
```

#### `DefaultResourceLoaderOptions`

```typescript
interface DefaultResourceLoaderOptions {
    cwd?: string;
    agentDir?: string;
    settingsManager?: SettingsManager;
    eventBus?: EventBus;
    additionalExtensionPaths?: string[];
    additionalSkillPaths?: string[];
    additionalPromptTemplatePaths?: string[];
    additionalThemePaths?: string[];
    extensionFactories?: ExtensionFactory[];
    noExtensions?: boolean;
    noSkills?: boolean;
    noPromptTemplates?: boolean;
    noThemes?: boolean;
    systemPrompt?: string;
    appendSystemPrompt?: string;
    extensionsOverride?: (base: LoadExtensionsResult) => LoadExtensionsResult;
    skillsOverride?: (base: { skills: Skill[]; diagnostics: ResourceDiagnostic[] }) => { skills: Skill[]; diagnostics: ResourceDiagnostic[] };
    promptsOverride?: (base: { prompts: PromptTemplate[]; diagnostics: ResourceDiagnostic[] }) => { prompts: PromptTemplate[]; diagnostics: ResourceDiagnostic[] };
    themesOverride?: (base: { themes: Theme[]; diagnostics: ResourceDiagnostic[] }) => { themes: Theme[]; diagnostics: ResourceDiagnostic[] };
    agentsFilesOverride?: (base: { agentsFiles: Array<{ path: string; content: string }> }) => { agentsFiles: Array<{ path: string; content: string }> };
    systemPromptOverride?: (base: string | undefined) => string | undefined;
    appendSystemPromptOverride?: (base: string[]) => string[];
}
```

### Class: `DefaultResourceLoader`

```typescript
class DefaultResourceLoader implements ResourceLoader {
    constructor(options: DefaultResourceLoaderOptions);
    
    getExtensions(): LoadExtensionsResult;
    getSkills(): { skills: Skill[]; diagnostics: ResourceDiagnostic[] };
    getPrompts(): { prompts: PromptTemplate[]; diagnostics: ResourceDiagnostic[] };
    getThemes(): { themes: Theme[]; diagnostics: ResourceDiagnostic[] };
    getAgentsFiles(): { agentsFiles: Array<{ path: string; content: string }> };
    getSystemPrompt(): string | undefined;
    getAppendSystemPrompt(): string[];
    getPathMetadata(): Map<string, PathMetadata>;
    extendResources(paths: ResourceExtensionPaths): void;
    reload(): Promise<void>;
}
```

---

## session-manager.ts — Session Persistence

### Constants

```typescript
const CURRENT_SESSION_VERSION = 3;
```

### Interfaces

#### `SessionHeader`

```typescript
interface SessionHeader {
    type: "session";
    version?: number;
    id: string;
    timestamp: string;
    cwd: string;
    parentSession?: string;
}
```

#### `NewSessionOptions`

```typescript
interface NewSessionOptions {
    parentSession?: string;
}
```

#### `SessionEntryBase`

```typescript
interface SessionEntryBase {
    type: string;
    id: string;
    parentId: string | null;
    timestamp: string;
}
```

#### `SessionMessageEntry`

```typescript
interface SessionMessageEntry extends SessionEntryBase {
    type: "message";
    message: AgentMessage;
}
```

#### `ThinkingLevelChangeEntry`

```typescript
interface ThinkingLevelChangeEntry extends SessionEntryBase {
    type: "thinking_level_change";
    thinkingLevel: string;
}
```

#### `ModelChangeEntry`

```typescript
interface ModelChangeEntry extends SessionEntryBase {
    type: "model_change";
    provider: string;
    modelId: string;
}
```

#### `CompactionEntry<T>`

```typescript
interface CompactionEntry<T = unknown> extends SessionEntryBase {
    type: "compaction";
    summary: string;
    firstKeptEntryId: string;
    tokensBefore: number;
    details?: T;
    fromHook?: boolean;
}
```

#### `BranchSummaryEntry<T>`

```typescript
interface BranchSummaryEntry<T = unknown> extends SessionEntryBase {
    type: "branch_summary";
    fromId: string;
    summary: string;
    details?: T;
    fromHook?: boolean;
}
```

#### `CustomEntry<T>`

```typescript
interface CustomEntry<T = unknown> extends SessionEntryBase {
    type: "custom";
    customType: string;
    data?: T;
}
```

#### `LabelEntry`

```typescript
interface LabelEntry extends SessionEntryBase {
    type: "label";
    targetId: string;
    label: string | undefined;
}
```

#### `SessionInfoEntry`

```typescript
interface SessionInfoEntry extends SessionEntryBase {
    type: "session_info";
    name?: string;
}
```

#### `CustomMessageEntry<T>`

```typescript
interface CustomMessageEntry<T = unknown> extends SessionEntryBase {
    type: "custom_message";
    customType: string;
    content: string | (TextContent | ImageContent)[];
    details?: T;
    display: boolean;
}
```

#### `SessionTreeNode`

```typescript
interface SessionTreeNode {
    entry: SessionEntry;
    children: SessionTreeNode[];
    label?: string;
}
```

#### `SessionContext`

```typescript
interface SessionContext {
    messages: AgentMessage[];
    thinkingLevel: string;
    model: { provider: string; modelId: string } | null;
}
```

#### `SessionInfo`

```typescript
interface SessionInfo {
    path: string;
    id: string;
    cwd: string;
    name?: string;
    parentSessionPath?: string;
    created: Date;
    modified: Date;
    messageCount: number;
    firstMessage: string;
    allMessagesText: string;
}
```

### Types

#### `SessionEntry`

```typescript
type SessionEntry = 
    | SessionMessageEntry 
    | ThinkingLevelChangeEntry 
    | ModelChangeEntry 
    | CompactionEntry 
    | BranchSummaryEntry 
    | CustomEntry 
    | CustomMessageEntry 
    | LabelEntry 
    | SessionInfoEntry;
```

#### `FileEntry`

```typescript
type FileEntry = SessionHeader | SessionEntry;
```

#### `ReadonlySessionManager`

```typescript
type ReadonlySessionManager = Pick<SessionManager, 
    "getCwd" | "getSessionDir" | "getSessionId" | "getSessionFile" | "getLeafId" | 
    "getLeafEntry" | "getEntry" | "getLabel" | "getBranch" | "getHeader" | 
    "getEntries" | "getTree" | "getSessionName"
>;
```

#### `SessionListProgress`

```typescript
type SessionListProgress = (loaded: number, total: number) => void;
```

### Functions

#### `migrateSessionEntries`

```typescript
function migrateSessionEntries(entries: FileEntry[]): void
```

#### `parseSessionEntries`

```typescript
function parseSessionEntries(content: string): FileEntry[]
```

#### `getLatestCompactionEntry`

```typescript
function getLatestCompactionEntry(entries: SessionEntry[]): CompactionEntry | null
```

#### `buildSessionContext`

```typescript
function buildSessionContext(
    entries: SessionEntry[],
    leafId?: string | null,
    byId?: Map<string, SessionEntry>
): SessionContext
```

Build the session context from entries using tree traversal.

#### `loadEntriesFromFile`

```typescript
function loadEntriesFromFile(filePath: string): FileEntry[]
```

#### `findMostRecentSession`

```typescript
function findMostRecentSession(sessionDir: string): string | null
```

### Class: `SessionManager`

```typescript
class SessionManager {
    /** Switch to a different session file (used for resume and branching) */
    setSessionFile(sessionFile: string): void;
    
    newSession(options?: NewSessionOptions): string | undefined;
    
    isPersisted(): boolean;
    getCwd(): string;
    getSessionDir(): string;
    getSessionId(): string;
    getSessionFile(): string | undefined;
    
    /** Append a message as child of current leaf, then advance leaf. Returns entry id. */
    appendMessage(message: Message | CustomMessage | BashExecutionMessage): string;
    
    /** Append a thinking level change as child of current leaf, then advance leaf. Returns entry id. */
    appendThinkingLevelChange(thinkingLevel: string): string;
    
    /** Append a model change as child of current leaf, then advance leaf. Returns entry id. */
    appendModelChange(provider: string, modelId: string): string;
    
    /** Append a compaction summary as child of current leaf, then advance leaf. Returns entry id. */
    appendCompaction<T = unknown>(
        summary: string,
        firstKeptEntryId: string,
        tokensBefore: number,
        details?: T,
        fromHook?: boolean
    ): string;
    
    /** Append a custom entry (for extensions) as child of current leaf, then advance leaf. Returns entry id. */
    appendCustomEntry(customType: string, data?: unknown): string;
    
    /** Append a session info entry (e.g., display name). Returns entry id. */
    appendSessionInfo(name: string): string;
    
    /** Get the current session name from the latest session_info entry, if any. */
    getSessionName(): string | undefined;
    
    /**
     * Append a custom message entry (for extensions) that participates in LLM context.
     */
    appendCustomMessageEntry<T = unknown>(
        customType: string,
        content: string | (TextContent | ImageContent)[],
        display: boolean,
        details?: T
    ): string;
    
    getLeafId(): string | null;
    getLeafEntry(): SessionEntry | undefined;
    getEntry(id: string): SessionEntry | undefined;
    getChildren(parentId: string): SessionEntry[];
    getLabel(id: string): string | undefined;
    appendLabelChange(targetId: string, label: string | undefined): string;
    getBranch(fromId?: string): SessionEntry[];
    buildSessionContext(): SessionContext;
    getHeader(): SessionHeader | null;
    getEntries(): SessionEntry[];
    getTree(): SessionTreeNode[];
    
    /**
     * Start a new branch from an earlier entry.
     */
    branch(branchFromId: string): void;
    
    /**
     * Reset the leaf pointer to null (before any entries).
     */
    resetLeaf(): void;
    
    /**
     * Start a new branch with a summary of the abandoned path.
     */
    branchWithSummary(
        branchFromId: string | null,
        summary: string,
        details?: unknown,
        fromHook?: boolean
    ): string;
    
    /**
     * Create a new session file containing only the path from root to the specified leaf.
     */
    createBranchedSession(leafId: string): string | undefined;
    
    /** Create a new session. */
    static create(cwd: string, sessionDir?: string): SessionManager;
    
    /** Open a specific session file. */
    static open(path: string, sessionDir?: string): SessionManager;
    
    /** Continue the most recent session, or create new if none. */
    static continueRecent(cwd: string, sessionDir?: string): SessionManager;
    
    /** Create an in-memory session (no file persistence) */
    static inMemory(cwd?: string): SessionManager;
    
    /**
     * Fork a session from another project directory into the current project.
     */
    static forkFrom(sourcePath: string, targetCwd: string, sessionDir?: string): SessionManager;
    
    /** List all sessions for a directory. */
    static list(cwd: string, sessionDir?: string, onProgress?: SessionListProgress): Promise<SessionInfo[]>;
    
    /** List all sessions across all project directories. */
    static listAll(onProgress?: SessionListProgress): Promise<SessionInfo[]>;
}
```

---

## settings-manager.ts — Settings Persistence

### Interfaces

#### `CompactionSettings`

```typescript
interface CompactionSettings {
    enabled?: boolean;
    reserveTokens?: number;
    keepRecentTokens?: number;
}
```

#### `BranchSummarySettings`

```typescript
interface BranchSummarySettings {
    reserveTokens?: number;
}
```

#### `RetrySettings`

```typescript
interface RetrySettings {
    enabled?: boolean;
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
}
```

#### `TerminalSettings`

```typescript
interface TerminalSettings {
    showImages?: boolean;
    clearOnShrink?: boolean;
}
```

#### `ImageSettings`

```typescript
interface ImageSettings {
    autoResize?: boolean;
    blockImages?: boolean;
}
```

#### `ThinkingBudgetsSettings`

```typescript
interface ThinkingBudgetsSettings {
    minimal?: number;
    low?: number;
    medium?: number;
    high?: number;
}
```

#### `MarkdownSettings`

```typescript
interface MarkdownSettings {
    codeBlockIndent?: string;
}
```

#### `Settings`

```typescript
interface Settings {
    lastChangelogVersion?: string;
    defaultProvider?: string;
    defaultModel?: string;
    defaultThinkingLevel?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
    transport?: TransportSetting;
    steeringMode?: "all" | "one-at-a-time";
    followUpMode?: "all" | "one-at-a-time";
    theme?: string;
    compaction?: CompactionSettings;
    branchSummary?: BranchSummarySettings;
    retry?: RetrySettings;
    hideThinkingBlock?: boolean;
    shellPath?: string;
    quietStartup?: boolean;
    shellCommandPrefix?: string;
    collapseChangelog?: boolean;
    packages?: PackageSource[];
    extensions?: string[];
    skills?: string[];
    prompts?: string[];
    themes?: string[];
    enableSkillCommands?: boolean;
    terminal?: TerminalSettings;
    images?: ImageSettings;
    enabledModels?: string[];
    doubleEscapeAction?: "fork" | "tree" | "none";
    thinkingBudgets?: ThinkingBudgetsSettings;
    editorPaddingX?: number;
    autocompleteMaxVisible?: number;
    showHardwareCursor?: boolean;
    markdown?: MarkdownSettings;
}
```

### Types

#### `TransportSetting`

```typescript
type TransportSetting = Transport;
```

#### `PackageSource`

```typescript
type PackageSource = string | {
    source: string;
    extensions?: string[];
    skills?: string[];
    prompts?: string[];
    themes?: string[];
};
```

### Class: `SettingsManager`

```typescript
class SettingsManager {
    /** Create a SettingsManager that loads from files */
    static create(cwd?: string, agentDir?: string): SettingsManager;
    
    /** Create an in-memory SettingsManager (no file I/O) */
    static inMemory(settings?: Partial<Settings>): SettingsManager;
    
    getGlobalSettings(): Settings;
    getProjectSettings(): Settings;
    reload(): void;
    applyOverrides(overrides: Partial<Settings>): void;
    
    // Changelog
    getLastChangelogVersion(): string | undefined;
    setLastChangelogVersion(version: string): void;
    
    // Model defaults
    getDefaultProvider(): string | undefined;
    getDefaultModel(): string | undefined;
    setDefaultProvider(provider: string): void;
    setDefaultModel(modelId: string): void;
    setDefaultModelAndProvider(provider: string, modelId: string): void;
    
    // Message modes
    getSteeringMode(): "all" | "one-at-a-time";
    setSteeringMode(mode: "all" | "one-at-a-time"): void;
    getFollowUpMode(): "all" | "one-at-a-time";
    setFollowUpMode(mode: "all" | "one-at-a-time"): void;
    
    // Theme
    getTheme(): string | undefined;
    setTheme(theme: string): void;
    
    // Thinking
    getDefaultThinkingLevel(): "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | undefined;
    setDefaultThinkingLevel(level: "off" | "minimal" | "low" | "medium" | "high" | "xhigh"): void;
    
    // Transport
    getTransport(): TransportSetting;
    setTransport(transport: TransportSetting): void;
    
    // Compaction
    getCompactionEnabled(): boolean;
    setCompactionEnabled(enabled: boolean): void;
    getCompactionReserveTokens(): number;
    getCompactionKeepRecentTokens(): number;
    getCompactionSettings(): { enabled: boolean; reserveTokens: number; keepRecentTokens: number };
    getBranchSummarySettings(): { reserveTokens: number };
    
    // Retry
    getRetryEnabled(): boolean;
    setRetryEnabled(enabled: boolean): void;
    getRetrySettings(): { enabled: boolean; maxRetries: number; baseDelayMs: number; maxDelayMs: number };
    
    // Thinking block
    getHideThinkingBlock(): boolean;
    setHideThinkingBlock(hide: boolean): void;
    
    // Shell
    getShellPath(): string | undefined;
    setShellPath(path: string | undefined): void;
    getShellCommandPrefix(): string | undefined;
    setShellCommandPrefix(prefix: string | undefined): void;
    
    // Startup
    getQuietStartup(): boolean;
    setQuietStartup(quiet: boolean): void;
    getCollapseChangelog(): boolean;
    setCollapseChangelog(collapse: boolean): void;
    
    // Packages and paths
    getPackages(): PackageSource[];
    setPackages(packages: PackageSource[]): void;
    setProjectPackages(packages: PackageSource[]): void;
    getExtensionPaths(): string[];
    setExtensionPaths(paths: string[]): void;
    setProjectExtensionPaths(paths: string[]): void;
    getSkillPaths(): string[];
    setSkillPaths(paths: string[]): void;
    setProjectSkillPaths(paths: string[]): void;
    getPromptTemplatePaths(): string[];
    setPromptTemplatePaths(paths: string[]): void;
    setProjectPromptTemplatePaths(paths: string[]): void;
    getThemePaths(): string[];
    setThemePaths(paths: string[]): void;
    setProjectThemePaths(paths: string[]): void;
    
    // Skills
    getEnableSkillCommands(): boolean;
    setEnableSkillCommands(enabled: boolean): void;
    
    // Thinking budgets
    getThinkingBudgets(): ThinkingBudgetsSettings | undefined;
    
    // Terminal
    getShowImages(): boolean;
    setShowImages(show: boolean): void;
    getClearOnShrink(): boolean;
    setClearOnShrink(enabled: boolean): void;
    
    // Images
    getImageAutoResize(): boolean;
    setImageAutoResize(enabled: boolean): void;
    getBlockImages(): boolean;
    setBlockImages(blocked: boolean): void;
    
    // Models
    getEnabledModels(): string[] | undefined;
    setEnabledModels(patterns: string[] | undefined): void;
    
    // Navigation
    getDoubleEscapeAction(): "fork" | "tree" | "none";
    setDoubleEscapeAction(action: "fork" | "tree" | "none"): void;
    
    // UI
    getShowHardwareCursor(): boolean;
    setShowHardwareCursor(enabled: boolean): void;
    getEditorPaddingX(): number;
    setEditorPaddingX(padding: number): void;
    getAutocompleteMaxVisible(): number;
    setAutocompleteMaxVisible(maxVisible: number): void;
    
    // Markdown
    getCodeBlockIndent(): string;
}
```

---

## skills.ts — Skill Loading

### Interfaces

#### `SkillFrontmatter`

```typescript
interface SkillFrontmatter {
    name?: string;
    description?: string;
    "disable-model-invocation"?: boolean;
    [key: string]: unknown;
}
```

#### `Skill`

```typescript
interface Skill {
    name: string;
    description: string;
    filePath: string;
    baseDir: string;
    source: string;
    disableModelInvocation: boolean;
}
```

#### `LoadSkillsResult`

```typescript
interface LoadSkillsResult {
    skills: Skill[];
    diagnostics: ResourceDiagnostic[];
}
```

#### `LoadSkillsFromDirOptions`

```typescript
interface LoadSkillsFromDirOptions {
    /** Directory to scan for skills */
    dir: string;
    /** Source identifier for these skills */
    source: string;
}
```

#### `LoadSkillsOptions`

```typescript
interface LoadSkillsOptions {
    /** Working directory for project-local skills. Default: process.cwd() */
    cwd?: string;
    /** Agent config directory for global skills. Default: ~/.pi/agent */
    agentDir?: string;
    /** Explicit skill paths (files or directories) */
    skillPaths?: string[];
    /** Include default skills directories. Default: true */
    includeDefaults?: boolean;
}
```

### Functions

#### `loadSkillsFromDir`

```typescript
function loadSkillsFromDir(options: LoadSkillsFromDirOptions): LoadSkillsResult
```

Load skills from a directory.

Discovery rules:
- direct .md children in the root
- recursive SKILL.md under subdirectories

#### `formatSkillsForPrompt`

```typescript
function formatSkillsForPrompt(skills: Skill[]): string
```

Format skills for inclusion in a system prompt. Uses XML format per Agent Skills standard.

#### `loadSkills`

```typescript
function loadSkills(options?: LoadSkillsOptions): LoadSkillsResult
```

Load skills from all configured locations.

---

## slash-commands.ts — Slash Command Types

### Types

#### `SlashCommandSource`

```typescript
type SlashCommandSource = "extension" | "prompt" | "skill";
```

#### `SlashCommandLocation`

```typescript
type SlashCommandLocation = "user" | "project" | "path";
```

### Interfaces

#### `SlashCommandInfo`

```typescript
interface SlashCommandInfo {
    name: string;
    description?: string;
    source: SlashCommandSource;
    location?: SlashCommandLocation;
    path?: string;
}
```

#### `BuiltinSlashCommand`

```typescript
interface BuiltinSlashCommand {
    name: string;
    description: string;
}
```

### Constants

#### `BUILTIN_SLASH_COMMANDS`

```typescript
const BUILTIN_SLASH_COMMANDS: ReadonlyArray<BuiltinSlashCommand>;
```

---

## system-prompt.ts — System Prompt Construction

### Interfaces

#### `BuildSystemPromptOptions`

```typescript
interface BuildSystemPromptOptions {
    /** Custom system prompt (replaces default). */
    customPrompt?: string;
    /** Tools to include in prompt. Default: [read, bash, edit, write] */
    selectedTools?: string[];
    /** Text to append to system prompt. */
    appendSystemPrompt?: string;
    /** Working directory. Default: process.cwd() */
    cwd?: string;
    /** Pre-loaded context files. */
    contextFiles?: Array<{ path: string; content: string }>;
    /** Pre-loaded skills. */
    skills?: Skill[];
}
```

### Functions

#### `buildSystemPrompt`

```typescript
function buildSystemPrompt(options?: BuildSystemPromptOptions): string
```

Build the system prompt with tools, guidelines, and context.

---

## timings.ts — Performance Profiling

### Functions

#### `time`

```typescript
function time(label: string): void
```

Central timing instrumentation for startup profiling. Enable with `PI_TIMING=1` environment variable.

#### `printTimings`

```typescript
function printTimings(): void
```

---

## extensions/ — Extension System

### extensions/types.ts — Extension Type Definitions

The complete type definitions for the extension system.

#### UI Context

```typescript
interface ExtensionUIDialogOptions {
    signal?: AbortSignal;
    timeout?: number;
}

type WidgetPlacement = "aboveEditor" | "belowEditor";

interface ExtensionWidgetOptions {
    placement?: WidgetPlacement;
}

type TerminalInputHandler = (data: string) => { consume?: boolean; data?: string } | undefined;

interface ExtensionUIContext {
    select(title: string, options: string[], opts?: ExtensionUIDialogOptions): Promise<string | undefined>;
    confirm(title: string, message: string, opts?: ExtensionUIDialogOptions): Promise<boolean>;
    input(title: string, placeholder?: string, opts?: ExtensionUIDialogOptions): Promise<string | undefined>;
    notify(message: string, type?: "info" | "warning" | "error"): void;
    onTerminalInput(handler: TerminalInputHandler): () => void;
    setStatus(key: string, text: string | undefined): void;
    setWorkingMessage(message?: string): void;
    setWidget(key: string, content: string[] | undefined, options?: ExtensionWidgetOptions): void;
    setWidget(key: string, content: ((tui: TUI, theme: Theme) => Component & { dispose?(): void }) | undefined, options?: ExtensionWidgetOptions): void;
    setFooter(factory: ((tui: TUI, theme: Theme, footerData: ReadonlyFooterDataProvider) => Component & { dispose?(): void }) | undefined): void;
    setHeader(factory: ((tui: TUI, theme: Theme) => Component & { dispose?(): void }) | undefined): void;
    setTitle(title: string): void;
    custom<T>(
        factory: (tui: TUI, theme: Theme, keybindings: KeybindingsManager, done: (result: T) => void) => (Component & { dispose?(): void }) | Promise<Component & { dispose?(): void }>,
        options?: { overlay?: boolean; overlayOptions?: OverlayOptions | (() => OverlayOptions); onHandle?: (handle: OverlayHandle) => void }
    ): Promise<T>;
    pasteToEditor(text: string): void;
    setEditorText(text: string): void;
    getEditorText(): string;
    editor(title: string, prefill?: string): Promise<string | undefined>;
    setEditorComponent(factory: ((tui: TUI, theme: EditorTheme, keybindings: KeybindingsManager) => EditorComponent) | undefined): void;
    readonly theme: Theme;
    getAllThemes(): { name: string; path: string | undefined }[];
    getTheme(name: string): Theme | undefined;
    setTheme(theme: string | Theme): { success: boolean; error?: string };
    getToolsExpanded(): boolean;
    setToolsExpanded(expanded: boolean): void;
}

interface ContextUsage {
    tokens: number | null;
    contextWindow: number;
    percent: number | null;
}

interface CompactOptions {
    customInstructions?: string;
    onComplete?: (result: CompactionResult) => void;
    onError?: (error: Error) => void;
}
```

#### Extension Context

```typescript
interface ExtensionContext {
    ui: ExtensionUIContext;
    hasUI: boolean;
    cwd: string;
    sessionManager: ReadonlySessionManager;
    modelRegistry: ModelRegistry;
    model: Model<any> | undefined;
    isIdle(): boolean;
    abort(): void;
    hasPendingMessages(): boolean;
    shutdown(): void;
    getContextUsage(): ContextUsage | undefined;
    compact(options?: CompactOptions): void;
    getSystemPrompt(): string;
}

interface ExtensionCommandContext extends ExtensionContext {
    waitForIdle(): Promise<void>;
    newSession(options?: { parentSession?: string; setup?: (sessionManager: SessionManager) => Promise<void> }): Promise<{ cancelled: boolean }>;
    fork(entryId: string): Promise<{ cancelled: boolean }>;
    navigateTree(targetId: string, options?: { summarize?: boolean; customInstructions?: string; replaceInstructions?: boolean; label?: string }): Promise<{ cancelled: boolean }>;
    switchSession(sessionPath: string): Promise<{ cancelled: boolean }>;
    reload(): Promise<void>;
}
```

#### Tool Definition

```typescript
interface ToolDefinition<TParams extends TSchema = TSchema, TDetails = unknown> {
    name: string;
    label: string;
    description: string;
    parameters: TParams;
    execute(
        toolCallId: string,
        params: Static<TParams>,
        signal: AbortSignal | undefined,
        onUpdate: AgentToolUpdateCallback<TDetails> | undefined,
        ctx: ExtensionContext
    ): Promise<AgentToolResult<TDetails>>;
    renderCall?: (args: Static<TParams>, theme: Theme) => Component;
    renderResult?: (result: AgentToolResult<TDetails>, options: ToolRenderResultOptions, theme: Theme) => Component;
}

interface ToolRenderResultOptions {
    expanded: boolean;
    isPartial: boolean;
}

type ToolInfo = Pick<ToolDefinition, "name" | "description" | "parameters">;
```

#### Session Events

```typescript
interface ResourcesDiscoverEvent { type: "resources_discover"; cwd: string; reason: "startup" | "reload"; }
interface ResourcesDiscoverResult { skillPaths?: string[]; promptPaths?: string[]; themePaths?: string[]; }

interface SessionStartEvent { type: "session_start"; }
interface SessionBeforeSwitchEvent { type: "session_before_switch"; reason: "new" | "resume"; targetSessionFile?: string; }
interface SessionSwitchEvent { type: "session_switch"; reason: "new" | "resume"; previousSessionFile: string | undefined; }
interface SessionBeforeForkEvent { type: "session_before_fork"; entryId: string; }
interface SessionForkEvent { type: "session_fork"; previousSessionFile: string | undefined; }
interface SessionBeforeCompactEvent { type: "session_before_compact"; preparation: CompactionPreparation; branchEntries: SessionEntry[]; customInstructions?: string; signal: AbortSignal; }
interface SessionCompactEvent { type: "session_compact"; compactionEntry: CompactionEntry; fromExtension: boolean; }
interface SessionShutdownEvent { type: "session_shutdown"; }

interface TreePreparation {
    targetId: string;
    oldLeafId: string | null;
    commonAncestorId: string | null;
    entriesToSummarize: SessionEntry[];
    userWantsSummary: boolean;
    customInstructions?: string;
    replaceInstructions?: boolean;
    label?: string;
}
interface SessionBeforeTreeEvent { type: "session_before_tree"; preparation: TreePreparation; signal: AbortSignal; }
interface SessionTreeEvent { type: "session_tree"; newLeafId: string | null; oldLeafId: string | null; summaryEntry?: BranchSummaryEntry; fromExtension?: boolean; }
```

#### Agent Events

```typescript
interface ContextEvent { type: "context"; messages: AgentMessage[]; }
interface BeforeAgentStartEvent { type: "before_agent_start"; prompt: string; images?: ImageContent[]; systemPrompt: string; }
interface AgentStartEvent { type: "agent_start"; }
interface AgentEndEvent { type: "agent_end"; messages: AgentMessage[]; }
interface TurnStartEvent { type: "turn_start"; turnIndex: number; timestamp: number; }
interface TurnEndEvent { type: "turn_end"; turnIndex: number; message: AgentMessage; toolResults: ToolResultMessage[]; }
interface MessageStartEvent { type: "message_start"; message: AgentMessage; }
interface MessageUpdateEvent { type: "message_update"; message: AgentMessage; assistantMessageEvent: AssistantMessageEvent; }
interface MessageEndEvent { type: "message_end"; message: AgentMessage; }
interface ToolExecutionStartEvent { type: "tool_execution_start"; toolCallId: string; toolName: string; args: any; }
interface ToolExecutionUpdateEvent { type: "tool_execution_update"; toolCallId: string; toolName: string; args: any; partialResult: any; }
interface ToolExecutionEndEvent { type: "tool_execution_end"; toolCallId: string; toolName: string; result: any; isError: boolean; }

type ModelSelectSource = "set" | "cycle" | "restore";
interface ModelSelectEvent { type: "model_select"; model: Model<any>; previousModel: Model<any> | undefined; source: ModelSelectSource; }

interface UserBashEvent { type: "user_bash"; command: string; excludeFromContext: boolean; cwd: string; }

type InputSource = "interactive" | "rpc" | "extension";
interface InputEvent { type: "input"; text: string; images?: ImageContent[]; source: InputSource; }
type InputEventResult = { action: "continue" } | { action: "transform"; text: string; images?: ImageContent[] } | { action: "handled" };
```

#### Tool Call/Result Events

```typescript
interface ToolCallEventBase { type: "tool_call"; toolCallId: string; }
interface BashToolCallEvent extends ToolCallEventBase { toolName: "bash"; input: BashToolInput; }
interface ReadToolCallEvent extends ToolCallEventBase { toolName: "read"; input: ReadToolInput; }
interface EditToolCallEvent extends ToolCallEventBase { toolName: "edit"; input: EditToolInput; }
interface WriteToolCallEvent extends ToolCallEventBase { toolName: "write"; input: WriteToolInput; }
interface GrepToolCallEvent extends ToolCallEventBase { toolName: "grep"; input: GrepToolInput; }
interface FindToolCallEvent extends ToolCallEventBase { toolName: "find"; input: FindToolInput; }
interface LsToolCallEvent extends ToolCallEventBase { toolName: "ls"; input: LsToolInput; }
interface CustomToolCallEvent extends ToolCallEventBase { toolName: string; input: Record<string, unknown>; }

type ToolCallEvent = BashToolCallEvent | ReadToolCallEvent | EditToolCallEvent | WriteToolCallEvent | GrepToolCallEvent | FindToolCallEvent | LsToolCallEvent | CustomToolCallEvent;

interface ToolResultEventBase { type: "tool_result"; toolCallId: string; input: Record<string, unknown>; content: (TextContent | ImageContent)[]; isError: boolean; }
interface BashToolResultEvent extends ToolResultEventBase { toolName: "bash"; details: BashToolDetails | undefined; }
interface ReadToolResultEvent extends ToolResultEventBase { toolName: "read"; details: ReadToolDetails | undefined; }
interface EditToolResultEvent extends ToolResultEventBase { toolName: "edit"; details: EditToolDetails | undefined; }
interface WriteToolResultEvent extends ToolResultEventBase { toolName: "write"; details: undefined; }
interface GrepToolResultEvent extends ToolResultEventBase { toolName: "grep"; details: GrepToolDetails | undefined; }
interface FindToolResultEvent extends ToolResultEventBase { toolName: "find"; details: FindToolDetails | undefined; }
interface LsToolResultEvent extends ToolResultEventBase { toolName: "ls"; details: LsToolDetails | undefined; }
interface CustomToolResultEvent extends ToolResultEventBase { toolName: string; details: unknown; }

type ToolResultEvent = BashToolResultEvent | ReadToolResultEvent | EditToolResultEvent | WriteToolResultEvent | GrepToolResultEvent | FindToolResultEvent | LsToolResultEvent | CustomToolResultEvent;
```

#### Event Result Types

```typescript
interface ContextEventResult { messages?: AgentMessage[]; }
interface ToolCallEventResult { block?: boolean; reason?: string; }
interface UserBashEventResult { operations?: BashOperations; result?: BashResult; }
interface ToolResultEventResult { content?: (TextContent | ImageContent)[]; details?: unknown; isError?: boolean; }
interface BeforeAgentStartEventResult { message?: Pick<CustomMessage, "customType" | "content" | "display" | "details">; systemPrompt?: string; }
interface SessionBeforeSwitchResult { cancel?: boolean; }
interface SessionBeforeForkResult { cancel?: boolean; skipConversationRestore?: boolean; }
interface SessionBeforeCompactResult { cancel?: boolean; compaction?: CompactionResult; }
interface SessionBeforeTreeResult { cancel?: boolean; summary?: { summary: string; details?: unknown }; customInstructions?: string; replaceInstructions?: boolean; label?: string; }
```

#### Extension API

```typescript
interface ExtensionAPI {
    // Event handlers
    on(event: "resources_discover", handler: ExtensionHandler<ResourcesDiscoverEvent, ResourcesDiscoverResult>): void;
    on(event: "session_start", handler: ExtensionHandler<SessionStartEvent>): void;
    on(event: "session_before_switch", handler: ExtensionHandler<SessionBeforeSwitchEvent, SessionBeforeSwitchResult>): void;
    on(event: "session_switch", handler: ExtensionHandler<SessionSwitchEvent>): void;
    on(event: "session_before_fork", handler: ExtensionHandler<SessionBeforeForkEvent, SessionBeforeForkResult>): void;
    on(event: "session_fork", handler: ExtensionHandler<SessionForkEvent>): void;
    on(event: "session_before_compact", handler: ExtensionHandler<SessionBeforeCompactEvent, SessionBeforeCompactResult>): void;
    on(event: "session_compact", handler: ExtensionHandler<SessionCompactEvent>): void;
    on(event: "session_shutdown", handler: ExtensionHandler<SessionShutdownEvent>): void;
    on(event: "session_before_tree", handler: ExtensionHandler<SessionBeforeTreeEvent, SessionBeforeTreeResult>): void;
    on(event: "session_tree", handler: ExtensionHandler<SessionTreeEvent>): void;
    on(event: "context", handler: ExtensionHandler<ContextEvent, ContextEventResult>): void;
    on(event: "before_agent_start", handler: ExtensionHandler<BeforeAgentStartEvent, BeforeAgentStartEventResult>): void;
    on(event: "agent_start", handler: ExtensionHandler<AgentStartEvent>): void;
    on(event: "agent_end", handler: ExtensionHandler<AgentEndEvent>): void;
    on(event: "turn_start", handler: ExtensionHandler<TurnStartEvent>): void;
    on(event: "turn_end", handler: ExtensionHandler<TurnEndEvent>): void;
    on(event: "message_start", handler: ExtensionHandler<MessageStartEvent>): void;
    on(event: "message_update", handler: ExtensionHandler<MessageUpdateEvent>): void;
    on(event: "message_end", handler: ExtensionHandler<MessageEndEvent>): void;
    on(event: "tool_execution_start", handler: ExtensionHandler<ToolExecutionStartEvent>): void;
    on(event: "tool_execution_update", handler: ExtensionHandler<ToolExecutionUpdateEvent>): void;
    on(event: "tool_execution_end", handler: ExtensionHandler<ToolExecutionEndEvent>): void;
    on(event: "model_select", handler: ExtensionHandler<ModelSelectEvent>): void;
    on(event: "tool_call", handler: ExtensionHandler<ToolCallEvent, ToolCallEventResult>): void;
    on(event: "tool_result", handler: ExtensionHandler<ToolResultEvent, ToolResultEventResult>): void;
    on(event: "user_bash", handler: ExtensionHandler<UserBashEvent, UserBashEventResult>): void;
    on(event: "input", handler: ExtensionHandler<InputEvent, InputEventResult>): void;
    
    // Tool registration
    registerTool<TParams extends TSchema = TSchema, TDetails = unknown>(tool: ToolDefinition<TParams, TDetails>): void;
    
    // Command registration
    registerCommand(name: string, options: Omit<RegisteredCommand, "name">): void;
    
    // Shortcut registration
    registerShortcut(shortcut: KeyId, options: { description?: string; handler: (ctx: ExtensionContext) => Promise<void> | void }): void;
    
    // Flag registration
    registerFlag(name: string, options: { description?: string; type: "boolean" | "string"; default?: boolean | string }): void;
    getFlag(name: string): boolean | string | undefined;
    
    // Message rendering
    registerMessageRenderer<T = unknown>(customType: string, renderer: MessageRenderer<T>): void;
    
    // Messaging
    sendMessage<T = unknown>(message: Pick<CustomMessage<T>, "customType" | "content" | "display" | "details">, options?: { triggerTurn?: boolean; deliverAs?: "steer" | "followUp" | "nextTurn" }): void;
    sendUserMessage(content: string | (TextContent | ImageContent)[], options?: { deliverAs?: "steer" | "followUp" }): void;
    
    // Session operations
    appendEntry<T = unknown>(customType: string, data?: T): void;
    setSessionName(name: string): void;
    getSessionName(): string | undefined;
    setLabel(entryId: string, label: string | undefined): void;
    
    // Execution
    exec(command: string, args: string[], options?: ExecOptions): Promise<ExecResult>;
    
    // Tools
    getActiveTools(): string[];
    getAllTools(): ToolInfo[];
    setActiveTools(toolNames: string[]): void;
    getCommands(): SlashCommandInfo[];
    
    // Model
    setModel(model: Model<any>): Promise<boolean>;
    getThinkingLevel(): ThinkingLevel;
    setThinkingLevel(level: ThinkingLevel): void;
    
    // Provider registration
    registerProvider(name: string, config: ProviderConfig): void;
    
    // Event bus
    events: EventBus;
}

type ExtensionFactory = (pi: ExtensionAPI) => void | Promise<void>;
type ExtensionHandler<E, R = undefined> = (event: E, ctx: ExtensionContext) => Promise<R | void> | R | void;
```

#### Provider Config

```typescript
interface ProviderConfig {
    baseUrl?: string;
    apiKey?: string;
    api?: Api;
    streamSimple?: (model: Model<Api>, context: Context, options?: SimpleStreamOptions) => AssistantMessageEventStream;
    headers?: Record<string, string>;
    authHeader?: boolean;
    models?: ProviderModelConfig[];
    oauth?: {
        name: string;
        login(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials>;
        refreshToken(credentials: OAuthCredentials): Promise<OAuthCredentials>;
        getApiKey(credentials: OAuthCredentials): string;
        modifyModels?(models: Model<Api>[], credentials: OAuthCredentials): Model<Api>[];
    };
}

interface ProviderModelConfig {
    id: string;
    name: string;
    api?: Api;
    reasoning: boolean;
    input: ("text" | "image")[];
    cost: { input: number; output: number; cacheRead: number; cacheWrite: number };
    contextWindow: number;
    maxTokens: number;
    headers?: Record<string, string>;
    compat?: Model<Api>["compat"];
}
```

#### Registered Types

```typescript
interface RegisteredTool { definition: ToolDefinition; extensionPath: string; }
interface ExtensionFlag { name: string; description?: string; type: "boolean" | "string"; default?: boolean | string; extensionPath: string; }
interface ExtensionShortcut { shortcut: KeyId; description?: string; handler: (ctx: ExtensionContext) => Promise<void> | void; extensionPath: string; }
interface RegisteredCommand { name: string; description?: string; getArgumentCompletions?: (argumentPrefix: string) => AutocompleteItem[] | null; handler: (args: string, ctx: ExtensionCommandContext) => Promise<void>; }
type MessageRenderer<T = unknown> = (message: CustomMessage<T>, options: MessageRenderOptions, theme: Theme) => Component | undefined;
interface MessageRenderOptions { expanded: boolean; }
```

#### Extension Type

```typescript
interface Extension {
    path: string;
    resolvedPath: string;
    handlers: Map<string, HandlerFn[]>;
    tools: Map<string, RegisteredTool>;
    messageRenderers: Map<string, MessageRenderer>;
    commands: Map<string, RegisteredCommand>;
    flags: Map<string, ExtensionFlag>;
    shortcuts: Map<KeyId, ExtensionShortcut>;
}

interface LoadExtensionsResult {
    extensions: Extension[];
    errors: Array<{ path: string; error: string }>;
    runtime: ExtensionRuntime;
}

interface ExtensionError {
    extensionPath: string;
    event: string;
    error: string;
    stack?: string;
}
```

#### Type Guards

```typescript
function isBashToolResult(e: ToolResultEvent): e is BashToolResultEvent;
function isReadToolResult(e: ToolResultEvent): e is ReadToolResultEvent;
function isEditToolResult(e: ToolResultEvent): e is EditToolResultEvent;
function isWriteToolResult(e: ToolResultEvent): e is WriteToolResultEvent;
function isGrepToolResult(e: ToolResultEvent): e is GrepToolResultEvent;
function isFindToolResult(e: ToolResultEvent): e is FindToolResultEvent;
function isLsToolResult(e: ToolResultEvent): e is LsToolResultEvent;

function isToolCallEventType(toolName: "bash", event: ToolCallEvent): event is BashToolCallEvent;
function isToolCallEventType(toolName: "read", event: ToolCallEvent): event is ReadToolCallEvent;
function isToolCallEventType(toolName: "edit", event: ToolCallEvent): event is EditToolCallEvent;
function isToolCallEventType(toolName: "write", event: ToolCallEvent): event is WriteToolCallEvent;
function isToolCallEventType(toolName: "grep", event: ToolCallEvent): event is GrepToolCallEvent;
function isToolCallEventType(toolName: "find", event: ToolCallEvent): event is FindToolCallEvent;
function isToolCallEventType(toolName: "ls", event: ToolCallEvent): event is LsToolCallEvent;
function isToolCallEventType<TName extends string, TInput extends Record<string, unknown>>(toolName: TName, event: ToolCallEvent): event is ToolCallEvent & { toolName: TName; input: TInput };
```

---

### extensions/loader.ts — Extension Loading

#### Functions

```typescript
function createExtensionRuntime(): ExtensionRuntime
```

Create a runtime with throwing stubs for action methods. Runner.bindCore() replaces these with real implementations.

```typescript
function loadExtensionFromFactory(
    factory: ExtensionFactory,
    cwd: string,
    eventBus: EventBus,
    runtime: ExtensionRuntime,
    extensionPath?: string
): Promise<Extension>
```

Create an Extension from an inline factory function.

```typescript
function loadExtensions(
    paths: string[],
    cwd: string,
    eventBus?: EventBus
): Promise<LoadExtensionsResult>
```

Load extensions from paths.

```typescript
function discoverAndLoadExtensions(
    configuredPaths: string[],
    cwd: string,
    agentDir?: string,
    eventBus?: EventBus
): Promise<LoadExtensionsResult>
```

Discover and load extensions from standard locations.

---

### extensions/runner.ts — Extension Execution

#### Types

```typescript
type ExtensionErrorListener = (error: ExtensionError) => void;
type NewSessionHandler = (options?: { parentSession?: string; setup?: (sessionManager: SessionManager) => Promise<void> }) => Promise<{ cancelled: boolean }>;
type ForkHandler = (entryId: string) => Promise<{ cancelled: boolean }>;
type NavigateTreeHandler = (targetId: string, options?: { summarize?: boolean; customInstructions?: string; replaceInstructions?: boolean; label?: string }) => Promise<{ cancelled: boolean }>;
type SwitchSessionHandler = (sessionPath: string) => Promise<{ cancelled: boolean }>;
type ReloadHandler = () => Promise<void>;
type ShutdownHandler = () => void;
```

#### Functions

```typescript
function emitSessionShutdownEvent(extensionRunner: ExtensionRunner | undefined): Promise<boolean>
```

Helper function to emit session_shutdown event to extensions.

#### Class: `ExtensionRunner`

```typescript
class ExtensionRunner {
    constructor(
        extensions: Extension[],
        runtime: ExtensionRuntime,
        cwd: string,
        sessionManager: SessionManager,
        modelRegistry: ModelRegistry
    );
    
    bindCore(actions: ExtensionActions, contextActions: ExtensionContextActions): void;
    bindCommandContext(actions?: ExtensionCommandContextActions): void;
    setUIContext(uiContext?: ExtensionUIContext): void;
    getUIContext(): ExtensionUIContext;
    hasUI(): boolean;
    getExtensionPaths(): string[];
    getAllRegisteredTools(): RegisteredTool[];
    getToolDefinition(toolName: string): RegisteredTool["definition"] | undefined;
    getFlags(): Map<string, ExtensionFlag>;
    setFlagValue(name: string, value: boolean | string): void;
    getFlagValues(): Map<string, boolean | string>;
    getShortcuts(effectiveKeybindings: Required<KeybindingsConfig>): Map<KeyId, ExtensionShortcut>;
    getShortcutDiagnostics(): ResourceDiagnostic[];
    onError(listener: ExtensionErrorListener): () => void;
    emitError(error: ExtensionError): void;
    hasHandlers(eventType: string): boolean;
    getMessageRenderer(customType: string): MessageRenderer | undefined;
    getRegisteredCommands(reserved?: Set<string>): RegisteredCommand[];
    getCommandDiagnostics(): ResourceDiagnostic[];
    getRegisteredCommandsWithPaths(): Array<{ command: RegisteredCommand; extensionPath: string }>;
    getCommand(name: string): RegisteredCommand | undefined;
    shutdown(): void;
    createContext(): ExtensionContext;
    createCommandContext(): ExtensionCommandContext;
    emit<TEvent extends RunnerEmitEvent>(event: TEvent): Promise<RunnerEmitResult<TEvent>>;
    emitToolResult(event: ToolResultEvent): Promise<ToolResultEventResult | undefined>;
    emitToolCall(event: ToolCallEvent): Promise<ToolCallEventResult | undefined>;
    emitUserBash(event: UserBashEvent): Promise<UserBashEventResult | undefined>;
    emitContext(messages: AgentMessage[]): Promise<AgentMessage[]>;
    emitBeforeAgentStart(prompt: string, images: ImageContent[] | undefined, systemPrompt: string): Promise<BeforeAgentStartCombinedResult | undefined>;
    emitResourcesDiscover(cwd: string, reason: ResourcesDiscoverEvent["reason"]): Promise<{ skillPaths: Array<{ path: string; extensionPath: string }>; promptPaths: Array<{ path: string; extensionPath: string }>; themePaths: Array<{ path: string; extensionPath: string }> }>;
    emitInput(text: string, images: ImageContent[] | undefined, source: InputSource): Promise<InputEventResult>;
}
```

---

### extensions/wrapper.ts — Tool Wrapping

#### Functions

```typescript
function wrapRegisteredTool(registeredTool: RegisteredTool, runner: ExtensionRunner): AgentTool
```

Wrap a RegisteredTool into an AgentTool.

```typescript
function wrapRegisteredTools(registeredTools: RegisteredTool[], runner: ExtensionRunner): AgentTool[]
```

Wrap all registered tools into AgentTools.

```typescript
function wrapToolWithExtensions<T>(tool: AgentTool<any, T>, runner: ExtensionRunner): AgentTool<any, T>
```

Wrap a tool with extension callbacks for interception.

```typescript
function wrapToolsWithExtensions<T>(tools: AgentTool<any, T>[], runner: ExtensionRunner): AgentTool<any, T>[]
```

Wrap all tools with extension callbacks.

---

## compaction/ — Context Compaction

### compaction/compaction.ts — Core Compaction

#### Interfaces

```typescript
interface CompactionDetails {
    readFiles: string[];
    modifiedFiles: string[];
}

interface CompactionResult<T = unknown> {
    summary: string;
    firstKeptEntryId: string;
    tokensBefore: number;
    details?: T;
}

interface CompactionSettings {
    enabled: boolean;
    reserveTokens: number;
    keepRecentTokens: number;
}

interface CutPointResult {
    firstKeptEntryIndex: number;
    turnStartIndex: number;
    isSplitTurn: boolean;
}

interface CompactionPreparation {
    firstKeptEntryId: string;
    messagesToSummarize: AgentMessage[];
    turnPrefixMessages: AgentMessage[];
    isSplitTurn: boolean;
    tokensBefore: number;
    previousSummary?: string;
    fileOps: FileOperations;
    settings: CompactionSettings;
}
```

#### Constants

```typescript
const DEFAULT_COMPACTION_SETTINGS: CompactionSettings;
```

#### Functions

```typescript
function calculateContextTokens(usage: Usage): number
```

Calculate total context tokens from usage.

```typescript
function getLastAssistantUsage(entries: SessionEntry[]): Usage | undefined
```

Find the last non-aborted assistant message usage from session entries.

```typescript
function estimateContextTokens(messages: AgentMessage[]): ContextUsageEstimate
```

Estimate context tokens from messages.

```typescript
function shouldCompact(contextTokens: number, contextWindow: number, settings: CompactionSettings): boolean
```

Check if compaction should trigger based on context usage.

```typescript
function estimateTokens(message: AgentMessage): number
```

Estimate token count for a message using chars/4 heuristic.

```typescript
function findTurnStartIndex(entries: SessionEntry[], entryIndex: number, startIndex: number): number
```

Find the user message that starts the turn containing the given entry index.

```typescript
function findCutPoint(entries: SessionEntry[], startIndex: number, endIndex: number, keepRecentTokens: number): CutPointResult
```

Find the cut point in session entries that keeps approximately `keepRecentTokens`.

```typescript
function generateSummary(
    currentMessages: AgentMessage[],
    model: Model<any>,
    reserveTokens: number,
    apiKey: string,
    signal?: AbortSignal,
    customInstructions?: string,
    previousSummary?: string
): Promise<string>
```

Generate a summary of the conversation using the LLM.

```typescript
function prepareCompaction(pathEntries: SessionEntry[], settings: CompactionSettings): CompactionPreparation | undefined
```

Prepare data for compaction.

```typescript
function compact(
    preparation: CompactionPreparation,
    model: Model<any>,
    apiKey: string,
    customInstructions?: string,
    signal?: AbortSignal
): Promise<CompactionResult>
```

Generate summaries for compaction using prepared data.

---

### compaction/branch-summarization.ts — Branch Summaries

#### Interfaces

```typescript
interface BranchSummaryResult {
    summary?: string;
    readFiles?: string[];
    modifiedFiles?: string[];
    aborted?: boolean;
    error?: string;
}

interface BranchSummaryDetails {
    readFiles: string[];
    modifiedFiles: string[];
}

interface BranchPreparation {
    messages: AgentMessage[];
    fileOps: FileOperations;
    totalTokens: number;
}

interface CollectEntriesResult {
    entries: SessionEntry[];
    commonAncestorId: string | null;
}

interface GenerateBranchSummaryOptions {
    model: Model<any>;
    apiKey: string;
    signal: AbortSignal;
    customInstructions?: string;
    replaceInstructions?: boolean;
    reserveTokens?: number;
}
```

#### Functions

```typescript
function collectEntriesForBranchSummary(
    session: ReadonlySessionManager,
    oldLeafId: string | null,
    targetId: string
): CollectEntriesResult
```

Collect entries that should be summarized when navigating from one position to another.

```typescript
function prepareBranchEntries(entries: SessionEntry[], tokenBudget?: number): BranchPreparation
```

Prepare entries for summarization with token budget.

```typescript
function generateBranchSummary(
    entries: SessionEntry[],
    options: GenerateBranchSummaryOptions
): Promise<BranchSummaryResult>
```

Generate a summary of abandoned branch entries.

---

### compaction/utils.ts — Shared Utilities

#### Interfaces

```typescript
interface FileOperations {
    read: Set<string>;
    written: Set<string>;
    edited: Set<string>;
}
```

#### Constants

```typescript
const SUMMARIZATION_SYSTEM_PROMPT = "You are a context summarization assistant...";
```

#### Functions

```typescript
function createFileOps(): FileOperations
```

```typescript
function extractFileOpsFromMessage(message: AgentMessage, fileOps: FileOperations): void
```

Extract file operations from tool calls in an assistant message.

```typescript
function computeFileLists(fileOps: FileOperations): { readFiles: string[]; modifiedFiles: string[] }
```

Compute final file lists from file operations.

```typescript
function formatFileOperations(readFiles: string[], modifiedFiles: string[]): string
```

Format file operations as XML tags for summary.

```typescript
function serializeConversation(messages: Message[]): string
```

Serialize LLM messages to text for summarization.

---

## tools/ — Built-in Tools

### tools/index.ts — Tool Exports

#### Types

```typescript
type Tool = AgentTool<any>;
type ToolName = keyof typeof allTools;
```

#### Interfaces

```typescript
interface ToolsOptions {
    read?: ReadToolOptions;
    bash?: BashToolOptions;
}
```

#### Constants

```typescript
const codingTools: Tool[];
const readOnlyTools: Tool[];
const allTools: {
    read: AgentTool<...>;
    bash: AgentTool<...>;
    edit: AgentTool<...>;
    write: AgentTool<...>;
    grep: AgentTool<...>;
    find: AgentTool<...>;
    ls: AgentTool<...>;
};
```

#### Functions

```typescript
function createCodingTools(cwd: string, options?: ToolsOptions): Tool[]
```

Create coding tools configured for a specific working directory.

```typescript
function createReadOnlyTools(cwd: string, options?: ToolsOptions): Tool[]
```

Create read-only tools configured for a specific working directory.

```typescript
function createAllTools(cwd: string, options?: ToolsOptions): Record<ToolName, Tool>
```

Create all tools configured for a specific working directory.

---

### tools/bash.ts — Bash Tool

#### Types

```typescript
type BashToolInput = { command: string; timeout?: number };
```

#### Interfaces

```typescript
interface BashToolDetails {
    truncation?: TruncationResult;
    fullOutputPath?: string;
}

interface BashOperations {
    exec: (command: string, cwd: string, options: {
        onData: (data: Buffer) => void;
        signal?: AbortSignal;
        timeout?: number;
        env?: NodeJS.ProcessEnv;
    }) => Promise<{ exitCode: number | null }>;
}

interface BashSpawnContext {
    command: string;
    cwd: string;
    env: NodeJS.ProcessEnv;
}

type BashSpawnHook = (context: BashSpawnContext) => BashSpawnContext;

interface BashToolOptions {
    operations?: BashOperations;
    commandPrefix?: string;
    spawnHook?: BashSpawnHook;
}
```

#### Functions

```typescript
function createBashTool(cwd: string, options?: BashToolOptions): AgentTool<typeof bashSchema>
```

#### Constants

```typescript
const bashTool: AgentTool<...>;
```

---

### tools/read.ts — Read Tool

#### Types

```typescript
type ReadToolInput = { path: string; offset?: number; limit?: number };
```

#### Interfaces

```typescript
interface ReadToolDetails {
    truncation?: TruncationResult;
}

interface ReadOperations {
    readFile: (absolutePath: string) => Promise<Buffer>;
    access: (absolutePath: string) => Promise<void>;
    detectImageMimeType?: (absolutePath: string) => Promise<string | null | undefined>;
}

interface ReadToolOptions {
    autoResizeImages?: boolean;
    operations?: ReadOperations;
}
```

#### Functions

```typescript
function createReadTool(cwd: string, options?: ReadToolOptions): AgentTool<typeof readSchema>
```

#### Constants

```typescript
const readTool: AgentTool<...>;
```

---

### tools/edit.ts — Edit Tool

#### Types

```typescript
type EditToolInput = { path: string; oldText: string; newText: string };
```

#### Interfaces

```typescript
interface EditToolDetails {
    diff: string;
    firstChangedLine?: number;
}

interface EditOperations {
    readFile: (absolutePath: string) => Promise<Buffer>;
    writeFile: (absolutePath: string, content: string) => Promise<void>;
    access: (absolutePath: string) => Promise<void>;
}

interface EditToolOptions {
    operations?: EditOperations;
}
```

#### Functions

```typescript
function createEditTool(cwd: string, options?: EditToolOptions): AgentTool<typeof editSchema>
```

#### Constants

```typescript
const editTool: AgentTool<...>;
```

---

### tools/write.ts — Write Tool

#### Types

```typescript
type WriteToolInput = { path: string; content: string };
```

#### Interfaces

```typescript
interface WriteOperations {
    writeFile: (absolutePath: string, content: string) => Promise<void>;
    mkdir: (dir: string) => Promise<void>;
}

interface WriteToolOptions {
    operations?: WriteOperations;
}
```

#### Functions

```typescript
function createWriteTool(cwd: string, options?: WriteToolOptions): AgentTool<typeof writeSchema>
```

#### Constants

```typescript
const writeTool: AgentTool<...>;
```

---

### tools/grep.ts — Grep Tool

#### Types

```typescript
type GrepToolInput = {
    pattern: string;
    path?: string;
    glob?: string;
    ignoreCase?: boolean;
    literal?: boolean;
    context?: number;
    limit?: number;
};
```

#### Interfaces

```typescript
interface GrepToolDetails {
    truncation?: TruncationResult;
    matchLimitReached?: number;
    linesTruncated?: boolean;
}

interface GrepOperations {
    isDirectory: (absolutePath: string) => Promise<boolean> | boolean;
    readFile: (absolutePath: string) => Promise<string> | string;
}

interface GrepToolOptions {
    operations?: GrepOperations;
}
```

#### Functions

```typescript
function createGrepTool(cwd: string, options?: GrepToolOptions): AgentTool<typeof grepSchema>
```

#### Constants

```typescript
const grepTool: AgentTool<...>;
```

---

### tools/find.ts — Find Tool

#### Types

```typescript
type FindToolInput = { pattern: string; path?: string; limit?: number };
```

#### Interfaces

```typescript
interface FindToolDetails {
    truncation?: TruncationResult;
    resultLimitReached?: number;
}

interface FindOperations {
    exists: (absolutePath: string) => Promise<boolean> | boolean;
    glob: (pattern: string, cwd: string, options: { ignore: string[]; limit: number }) => Promise<string[]> | string[];
}

interface FindToolOptions {
    operations?: FindOperations;
}
```

#### Functions

```typescript
function createFindTool(cwd: string, options?: FindToolOptions): AgentTool<typeof findSchema>
```

#### Constants

```typescript
const findTool: AgentTool<...>;
```

---

### tools/ls.ts — Ls Tool

#### Types

```typescript
type LsToolInput = { path?: string; limit?: number };
```

#### Interfaces

```typescript
interface LsToolDetails {
    truncation?: TruncationResult;
    entryLimitReached?: number;
}

interface LsOperations {
    exists: (absolutePath: string) => Promise<boolean> | boolean;
    stat: (absolutePath: string) => Promise<{ isDirectory: () => boolean }> | { isDirectory: () => boolean };
    readdir: (absolutePath: string) => Promise<string[]> | string[];
}

interface LsToolOptions {
    operations?: LsOperations;
}
```

#### Functions

```typescript
function createLsTool(cwd: string, options?: LsToolOptions): AgentTool<typeof lsSchema>
```

#### Constants

```typescript
const lsTool: AgentTool<...>;
```

---

### tools/truncate.ts — Output Truncation

#### Constants

```typescript
const DEFAULT_MAX_LINES = 2000;
const DEFAULT_MAX_BYTES: number; // 50KB
const GREP_MAX_LINE_LENGTH = 500;
```

#### Interfaces

```typescript
interface TruncationResult {
    content: string;
    truncated: boolean;
    truncatedBy: "lines" | "bytes" | null;
    totalLines: number;
    totalBytes: number;
    outputLines: number;
    outputBytes: number;
    lastLinePartial: boolean;
    firstLineExceedsLimit: boolean;
    maxLines: number;
    maxBytes: number;
}

interface TruncationOptions {
    maxLines?: number;
    maxBytes?: number;
}
```

#### Functions

```typescript
function formatSize(bytes: number): string
```

Format bytes as human-readable size.

```typescript
function truncateHead(content: string, options?: TruncationOptions): TruncationResult
```

Truncate content from the head (keep first N lines/bytes).

```typescript
function truncateTail(content: string, options?: TruncationOptions): TruncationResult
```

Truncate content from the tail (keep last N lines/bytes).

```typescript
function truncateLine(line: string, maxChars?: number): { text: string; wasTruncated: boolean }
```

Truncate a single line to max characters.

---

### tools/path-utils.ts — Path Utilities

#### Functions

```typescript
function expandPath(filePath: string): string
```

```typescript
function resolveToCwd(filePath: string, cwd: string): string
```

Resolve a path relative to the given cwd. Handles ~ expansion and absolute paths.

```typescript
function resolveReadPath(filePath: string, cwd: string): string
```

---

### tools/edit-diff.ts — Diff Computation

#### Interfaces

```typescript
interface FuzzyMatchResult {
    found: boolean;
    index: number;
    matchLength: number;
    usedFuzzyMatch: boolean;
    contentForReplacement: string;
}

interface EditDiffResult {
    diff: string;
    firstChangedLine: number | undefined;
}

interface EditDiffError {
    error: string;
}
```

#### Functions

```typescript
function detectLineEnding(content: string): "\r\n" | "\n"
```

```typescript
function normalizeToLF(text: string): string
```

```typescript
function restoreLineEndings(text: string, ending: "\r\n" | "\n"): string
```

```typescript
function normalizeForFuzzyMatch(text: string): string
```

Normalize text for fuzzy matching.

```typescript
function fuzzyFindText(content: string, oldText: string): FuzzyMatchResult
```

Find oldText in content, trying exact match first, then fuzzy match.

```typescript
function stripBom(content: string): { bom: string; text: string }
```

Strip UTF-8 BOM if present.

```typescript
function generateDiffString(oldContent: string, newContent: string, contextLines?: number): { diff: string; firstChangedLine: number | undefined }
```

Generate a unified diff string with line numbers and context.

```typescript
function computeEditDiff(path: string, oldText: string, newText: string, cwd: string): Promise<EditDiffResult | EditDiffError>
```

Compute the diff for an edit operation without applying it.

---

## export-html/ — HTML Export

### export-html/index.ts — Session Export

#### Interfaces

```typescript
interface ToolHtmlRenderer {
    renderCall(toolName: string, args: unknown): string | undefined;
    renderResult(
        toolName: string,
        result: Array<{ type: string; text?: string; data?: string; mimeType?: string }>,
        details: unknown,
        isError: boolean
    ): string | undefined;
}

interface ExportOptions {
    outputPath?: string;
    themeName?: string;
    toolRenderer?: ToolHtmlRenderer;
}
```

#### Functions

```typescript
function exportSessionToHtml(
    sm: SessionManager,
    state?: AgentState,
    options?: ExportOptions | string
): Promise<string>
```

Export session to HTML using SessionManager and AgentState.

```typescript
function exportFromFile(inputPath: string, options?: ExportOptions | string): Promise<string>
```

Export session file to HTML (standalone, without AgentState).

---

### export-html/ansi-to-html.ts — ANSI Conversion

#### Functions

```typescript
function ansiToHtml(text: string): string
```

Convert ANSI-escaped text to HTML with inline styles.

Supports:
- Standard foreground colors (30-37) and bright variants (90-97)
- Standard background colors (40-47) and bright variants (100-107)
- 256-color palette (38;5;N and 48;5;N)
- RGB true color (38;2;R;G;B and 48;2;R;G;B)
- Text styles: bold (1), dim (2), italic (3), underline (4)
- Reset (0)

```typescript
function ansiLinesToHtml(lines: string[]): string
```

Convert array of ANSI-escaped lines to HTML.

---

### export-html/tool-renderer.ts — Tool Rendering

#### Interfaces

```typescript
interface ToolHtmlRendererDeps {
    getToolDefinition: (name: string) => ToolDefinition | undefined;
    theme: Theme;
    width?: number;
}

interface ToolHtmlRenderer {
    renderCall(toolName: string, args: unknown): string | undefined;
    renderResult(
        toolName: string,
        result: Array<{ type: string; text?: string; data?: string; mimeType?: string }>,
        details: unknown,
        isError: boolean
    ): string | undefined;
}
```

#### Functions

```typescript
function createToolHtmlRenderer(deps: ToolHtmlRendererDeps): ToolHtmlRenderer
```

Create a tool HTML renderer.

---

## Index Re-exports (index.d.ts)

The main `index.d.ts` re-exports all core modules:

```typescript
export { 
    AgentSession, 
    type AgentSessionConfig, 
    type AgentSessionEvent, 
    type AgentSessionEventListener, 
    type ModelCycleResult, 
    type PromptOptions, 
    type SessionStats 
} from "./agent-session.js";

export { 
    type BashExecutorOptions, 
    type BashResult, 
    executeBash, 
    executeBashWithOperations 
} from "./bash-executor.js";

export type { CompactionResult } from "./compaction/index.js";

export { 
    createEventBus, 
    type EventBus, 
    type EventBusController 
} from "./event-bus.js";

// Plus all extension types from ./extensions/index.js
export {
    type AgentEndEvent,
    type AgentStartEvent,
    type AgentToolResult,
    type AgentToolUpdateCallback,
    type BeforeAgentStartEvent,
    type ContextEvent,
    discoverAndLoadExtensions,
    type ExecOptions,
    type ExecResult,
    type Extension,
    type ExtensionAPI,
    type ExtensionCommandContext,
    type ExtensionContext,
    type ExtensionError,
    type ExtensionEvent,
    type ExtensionFactory,
    type ExtensionFlag,
    type ExtensionHandler,
    ExtensionRunner,
    type ExtensionShortcut,
    type ExtensionUIContext,
    type LoadExtensionsResult,
    type MessageRenderer,
    type RegisteredCommand,
    type SessionBeforeCompactEvent,
    type SessionBeforeForkEvent,
    type SessionBeforeSwitchEvent,
    type SessionBeforeTreeEvent,
    type SessionCompactEvent,
    type SessionForkEvent,
    type SessionShutdownEvent,
    type SessionStartEvent,
    type SessionSwitchEvent,
    type SessionTreeEvent,
    type ToolCallEvent,
    type ToolDefinition,
    type ToolRenderResultOptions,
    type ToolResultEvent,
    type TurnEndEvent,
    type TurnStartEvent,
    wrapToolsWithExtensions,
} from "./extensions/index.js";
```

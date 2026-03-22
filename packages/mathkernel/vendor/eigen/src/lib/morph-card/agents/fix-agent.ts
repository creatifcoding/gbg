/**
 * DecodeError Fix Agent
 *
 * Auto-triggered agent that fixes UITree decode failures with minimal patches.
 * Uses a focused toolset to identify and fix parse errors without redesigning the UI.
 *
 * @module morph-card/agents/fix-agent
 */

import { streamText, stepCountIs } from 'ai';
import { claudeCode } from 'ai-sdk-provider-claude-code';
import { fixAgentTools, setFixAgentContext, clearFixAgentContext } from './tools/fix-agent-tools';
import type { FixAgentRequest, JsonPatch } from '../schemas/patch-protocol';

// =============================================================================
// System Prompt
// =============================================================================

const FIX_AGENT_SYSTEM_PROMPT = `You are a UITree fix agent. Your job is to fix decode errors in UI trees.

## WORKFLOW

1. Call get_error_context to understand the error
2. Call patch_element to fix the broken element (minimal changes only)
3. Call validate_tree to verify the fix
4. If valid, call emit_fix_patch to emit the fix
5. If invalid, iterate with patch_element

## RULES

- Make MINIMAL changes to fix the decode error
- Do NOT redesign or improve the UI
- Focus only on making the tree valid
- Preserve existing structure and data
- Common fixes:
  - Missing required props (add defaults)
  - Invalid prop types (coerce to correct type)
  - Invalid children references (remove broken refs)
  - Missing parent/child relationships (fix references)

## COMMON ERROR PATTERNS

1. Missing "key" prop: Add the element key as the key prop value
2. Missing "type" prop: Infer from context or use "Container" as fallback
3. Invalid children array: Ensure children contains only string keys
4. Circular references: Remove the circular child reference
5. Missing props object: Add empty props {}

## OUTPUT

After successfully fixing the tree, you MUST call emit_fix_patch with:
- The patches that fix the error
- A brief description of what was fixed`;

// =============================================================================
// Agent Implementation
// =============================================================================

export interface FixAgentResult {
  success: boolean;
  patches: JsonPatch[];
  description?: string;
  error?: string;
}

/**
 * Run the fix agent to repair a decode error in a UITree.
 *
 * The agent will:
 * 1. Analyze the error context
 * 2. Generate minimal patches to fix the decode error
 * 3. Validate the patched tree
 * 4. Emit the fix to the durable stream
 *
 * @param request - The fix request with card context and error details
 * @param emitPatch - Callback to emit the patch to durable stream
 * @returns Result with patches and success status
 */
export async function runFixAgent(
  request: FixAgentRequest,
  emitPatch: (patches: JsonPatch[], description?: string) => Promise<{ success: boolean; seq?: number }>
): Promise<FixAgentResult> {
  // Set up tool context
  setFixAgentContext({
    cardId: request.cardId,
    currentTree: request.currentTree,
    errorPath: request.errorPath,
    emitPatch,
  });

  try {
    const result = streamText({
      model: claudeCode('sonnet'),
      system: FIX_AGENT_SYSTEM_PROMPT,
      prompt: `Fix this decode error:

Card ID: ${request.cardId}
Error: ${request.errorMessage}
Error Path: ${request.errorPath}
Original Prompt: ${request.originalPrompt}

Current tree (partial):
${JSON.stringify(request.currentTree, null, 2)}`,
      tools: fixAgentTools,
      stopWhen: stepCountIs(10), // Limit iterations
    });

    // Collect tool calls to find emitted patches
    const toolCalls: Array<{ toolName: string; input: unknown; output: unknown }> = [];
    for await (const event of result.fullStream) {
      if (event.type === 'tool-result') {
        toolCalls.push({
          toolName: event.toolName,
          input: 'input' in event ? event.input : undefined,
          output: 'output' in event ? event.output : undefined,
        });
      }
    }

    // Find the emit_fix_patch call
    const emitCall = toolCalls.find((tc) => tc.toolName === 'emit_fix_patch');
    if (emitCall) {
      const emitResult = emitCall.output as { success: boolean; seq?: number };
      const emitArgs = emitCall.input as { patches: JsonPatch[]; description?: string };
      return {
        success: emitResult.success,
        patches: emitArgs.patches,
        description: emitArgs.description,
      };
    }

    // No emit call - check if any patches were generated
    const patchCall = toolCalls.find((tc) => tc.toolName === 'patch_element');
    if (patchCall) {
      const patchResult = patchCall.output as { success: boolean; patches: JsonPatch[] };
      if (patchResult.success && patchResult.patches.length > 0) {
        return {
          success: false,
          patches: patchResult.patches,
          error: 'Agent generated patches but did not emit them',
        };
      }
    }

    return {
      success: false,
      patches: [],
      error: 'Agent did not produce any fixes',
    };
  } catch (e) {
    return {
      success: false,
      patches: [],
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    clearFixAgentContext();
  }
}

/**
 * Create a streaming fix agent for real-time UI updates.
 *
 * Returns an async generator that yields tool call events and final result.
 * Use this for progressive UI feedback during fix operations.
 */
export async function* streamFixAgent(
  request: FixAgentRequest,
  emitPatch: (patches: JsonPatch[], description?: string) => Promise<{ success: boolean; seq?: number }>
): AsyncGenerator<
  | { type: 'tool-call'; toolName: string; input: unknown }
  | { type: 'tool-result'; toolName: string; output: unknown }
  | { type: 'text-delta'; text: string }
  | { type: 'complete'; result: FixAgentResult }
> {
  setFixAgentContext({
    cardId: request.cardId,
    currentTree: request.currentTree,
    errorPath: request.errorPath,
    emitPatch,
  });

  try {
    const result = streamText({
      model: claudeCode('sonnet'),
      system: FIX_AGENT_SYSTEM_PROMPT,
      prompt: `Fix this decode error:

Card ID: ${request.cardId}
Error: ${request.errorMessage}
Error Path: ${request.errorPath}
Original Prompt: ${request.originalPrompt}

Current tree (partial):
${JSON.stringify(request.currentTree, null, 2)}`,
      tools: fixAgentTools,
      stopWhen: stepCountIs(10),
    });

    let emittedPatches: JsonPatch[] = [];
    let emittedDescription: string | undefined;
    let emitSuccess = false;

    for await (const event of result.fullStream) {
      switch (event.type) {
        case 'tool-call':
          yield {
            type: 'tool-call',
            toolName: event.toolName,
            input: 'input' in event ? event.input : undefined,
          };
          break;
        case 'tool-result':
          yield {
            type: 'tool-result',
            toolName: event.toolName,
            output: 'output' in event ? event.output : undefined,
          };
          if (event.toolName === 'emit_fix_patch') {
            const emitResult = ('output' in event ? event.output : {}) as { success: boolean };
            const emitArgs = ('input' in event ? event.input : {}) as { patches: JsonPatch[]; description?: string };
            emittedPatches = emitArgs.patches ?? [];
            emittedDescription = emitArgs.description;
            emitSuccess = emitResult.success;
          }
          break;
        case 'text-delta':
          yield { type: 'text-delta', text: 'text' in event ? event.text : '' };
          break;
      }
    }

    yield {
      type: 'complete',
      result: {
        success: emitSuccess,
        patches: emittedPatches,
        description: emittedDescription,
      },
    };
  } catch (e) {
    yield {
      type: 'complete',
      result: {
        success: false,
        patches: [],
        error: e instanceof Error ? e.message : String(e),
      },
    };
  } finally {
    clearFixAgentContext();
  }
}

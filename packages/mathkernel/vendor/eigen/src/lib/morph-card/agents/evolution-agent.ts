/**
 * MorphCard Evolution Agent
 *
 * User-triggered agent for modifying and improving MorphCard content.
 * Provides full tree control with semantic region targeting.
 *
 * @module morph-card/agents/evolution-agent
 */

import { streamText, stepCountIs } from 'ai';
import { claudeCode } from 'ai-sdk-provider-claude-code';
import {
  evolutionAgentTools,
  setEvolutionAgentContext,
  clearEvolutionAgentContext,
} from './tools/evolution-agent-tools';
import type { EvolutionAgentRequest, JsonPatch, SemanticMap } from '../schemas/patch-protocol';

// =============================================================================
// System Prompt
// =============================================================================

const EVOLUTION_AGENT_SYSTEM_PROMPT = `You are a MorphCard evolution agent. You help users modify and improve their UI cards.

## WORKFLOW

1. Call get_semantic_map to understand the card structure
2. Identify which regions/elements need modification based on user request
3. Use add_element, update_element, remove_element for fine-grained changes
4. Use transform_region for complex regeneration of semantic areas
5. Call emit_patch when all changes are ready

## CAPABILITIES

- Add new elements (charts, cards, buttons, text, etc.)
- Update existing element props
- Remove elements
- Regenerate entire semantic regions with natural language
- Full tree control

## RULES

- Always call get_semantic_map first to understand the structure
- Use semantic region IDs when targeting areas
- Describe changes clearly in emit_patch
- Validate changes make sense for the card's purpose
- Prefer targeted updates over full regeneration when possible
- When adding a MorphCard in UITree, include:
  - initialSizeKey (string)
  - stateMachineConfig.sizes (sizeKey -> { width, height })
- Do NOT add transitionStrategy to UITree props (it is injected at render-time)

## ELEMENT TYPES

Common types you can add:
- Layout: VStack, HStack, Grid, Container
- Content: Heading, Text, Badge, Alert
- Interactive: Button, Input, Checkbox, Select
- Cards: Card, CardHeader, CardTitle, CardContent, CardDescription
- Visualization: FoldablePanel (with chart/map/3d tags)

## SEMANTIC REGIONS

SemanticRegion wraps logical areas. Use get_semantic_map to discover them.
Target regions by their data-semantic-id for transform_region operations.

## OUTPUT

After making all changes, you MUST call emit_patch with:
- The accumulated patches from your operations
- A clear description of what was changed`;

// =============================================================================
// Agent Implementation
// =============================================================================

export interface EvolutionAgentResult {
  success: boolean;
  patches: JsonPatch[];
  description?: string;
  error?: string;
}

/**
 * Run the evolution agent to modify a MorphCard based on user request.
 *
 * The agent will:
 * 1. Analyze the card structure via semantic map
 * 2. Generate patches based on user message
 * 3. Emit patches to the durable stream
 *
 * @param request - The evolution request with card context and user message
 * @param emitPatch - Callback to emit the patch to durable stream
 * @param regenerateSubtree - Callback to regenerate a subtree via /ui-generate
 * @returns Result with patches and success status
 */
export async function runEvolutionAgent(
  request: EvolutionAgentRequest,
  emitPatch: (patches: JsonPatch[], description: string) => Promise<{ success: boolean; seq?: number }>,
  regenerateSubtree: (prompt: string) => Promise<{ root: string; elements: Record<string, unknown> }>
): Promise<EvolutionAgentResult> {
  // Set up tool context
  setEvolutionAgentContext({
    cardId: request.cardId,
    userId: request.userId,
    currentTree: request.currentTree,
    semanticMap: request.semanticMap as SemanticMap | undefined,
    emitPatch,
    regenerateSubtree,
  });

  try {
    // Build context string
    const patchHistoryStr = request.patchHistory?.length
      ? `\n\nPatch History (recent):\n${JSON.stringify(request.patchHistory.slice(-5), null, 2)}`
      : '';

    const result = streamText({
      model: claudeCode('sonnet'),
      system: EVOLUTION_AGENT_SYSTEM_PROMPT,
      prompt: `User request: ${request.userMessage}

Card ID: ${request.cardId}

Current tree:
${JSON.stringify(request.currentTree, null, 2)}
${patchHistoryStr}`,
      tools: evolutionAgentTools,
      stopWhen: stepCountIs(20), // Allow more iterations for complex changes
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

    // Find the emit_patch call
    const emitCall = toolCalls.find((tc) => tc.toolName === 'emit_patch');
    if (emitCall) {
      const emitResult = emitCall.output as { success: boolean; seq?: number };
      const emitArgs = emitCall.input as { patches: JsonPatch[]; description: string };
      return {
        success: emitResult.success,
        patches: emitArgs.patches,
        description: emitArgs.description,
      };
    }

    // Collect patches from individual operations if no emit call
    const collectedPatches: JsonPatch[] = [];
    for (const tc of toolCalls) {
      if (['add_element', 'update_element', 'remove_element', 'transform_region'].includes(tc.toolName)) {
        const output = tc.output as { success: boolean; patches: JsonPatch[] };
        if (output.success && output.patches?.length) {
          collectedPatches.push(...output.patches);
        }
      }
    }

    if (collectedPatches.length > 0) {
      return {
        success: false,
        patches: collectedPatches,
        error: 'Agent generated patches but did not emit them',
      };
    }

    return {
      success: false,
      patches: [],
      error: 'Agent did not produce any changes',
    };
  } catch (e) {
    return {
      success: false,
      patches: [],
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    clearEvolutionAgentContext();
  }
}

/**
 * Create a streaming evolution agent for real-time UI updates.
 *
 * Returns an async generator that yields tool call events and final result.
 * Use this for progressive UI feedback during evolution operations.
 */
export async function* streamEvolutionAgent(
  request: EvolutionAgentRequest,
  emitPatch: (patches: JsonPatch[], description: string) => Promise<{ success: boolean; seq?: number }>,
  regenerateSubtree: (prompt: string) => Promise<{ root: string; elements: Record<string, unknown> }>
): AsyncGenerator<
  | { type: 'tool-call'; toolName: string; input: unknown }
  | { type: 'tool-result'; toolName: string; output: unknown }
  | { type: 'text-delta'; text: string }
  | { type: 'semantic-map'; map: SemanticMap }
  | { type: 'complete'; result: EvolutionAgentResult }
> {
  setEvolutionAgentContext({
    cardId: request.cardId,
    userId: request.userId,
    currentTree: request.currentTree,
    semanticMap: request.semanticMap as SemanticMap | undefined,
    emitPatch,
    regenerateSubtree,
  });

  try {
    const patchHistoryStr = request.patchHistory?.length
      ? `\n\nPatch History (recent):\n${JSON.stringify(request.patchHistory.slice(-5), null, 2)}`
      : '';

    const result = streamText({
      model: claudeCode('sonnet'),
      system: EVOLUTION_AGENT_SYSTEM_PROMPT,
      prompt: `User request: ${request.userMessage}

Card ID: ${request.cardId}

Current tree:
${JSON.stringify(request.currentTree, null, 2)}
${patchHistoryStr}`,
      tools: evolutionAgentTools,
      stopWhen: stepCountIs(20),
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
        case 'tool-result': {
          const output = 'output' in event ? event.output : undefined;
          yield {
            type: 'tool-result',
            toolName: event.toolName,
            output,
          };

          // Emit semantic map when discovered
          if (event.toolName === 'get_semantic_map') {
            yield { type: 'semantic-map', map: output as SemanticMap };
          }

          // Capture emit_patch result
          if (event.toolName === 'emit_patch') {
            const emitResult = output as { success: boolean };
            const emitArgs = ('input' in event ? event.input : {}) as {
              patches: JsonPatch[];
              description: string;
            };
            emittedPatches = emitArgs.patches ?? [];
            emittedDescription = emitArgs.description;
            emitSuccess = emitResult.success;
          }
          break;
        }
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
    clearEvolutionAgentContext();
  }
}

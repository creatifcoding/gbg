/**
 * ModelSelectorView — morphchat view resolver for the model selector.
 *
 * Reads adapter state, composes ModelSelector compound component
 * into the header band's center slot.
 *
 * @module morphchat/components/model-selector-view
 */

import * as React from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import { useMorphChatContext } from './surface-context'
import { ModelSelector, type ModelOption } from '@/lib/chat/shell/header-band'

// =============================================================================
// Default model catalog (when adapter doesn't provide models)
// =============================================================================

const DEFAULT_MODELS: ReadonlyArray<ModelOption> = [
  { id: 'gpt-5.3-codex', label: 'GPT-5.3 Codex', provider: 'OpenAI', description: 'Optimized for code generation' },
  { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4', provider: 'Anthropic', description: 'Fast, intelligent' },
  { id: 'claude-opus-4-20250514', label: 'Claude Opus 4', provider: 'Anthropic', description: 'Most capable' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', provider: 'Google', description: 'Multimodal reasoning' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'Google', description: 'Fast inference' },
  { id: 'llama-4-maverick', label: 'Llama 4 Maverick', provider: 'Meta', description: 'Open source' },
]

// =============================================================================
// View Resolver
// =============================================================================

export function ModelSelectorView() {
  const { adapter } = useMorphChatContext()

  // Read model atoms if adapter exposes them
  const availableModels = adapter.availableModels$
    ? useAtomValue(adapter.availableModels$)
    : null
  const selectedModelId = adapter.selectedModel$
    ? useAtomValue(adapter.selectedModel$)
    : null

  const models = (availableModels && availableModels.length > 0)
    ? availableModels as ModelOption[]
    : DEFAULT_MODELS

  const currentModelId = selectedModelId ?? 'gpt-5.3-codex'

  const handleSelect = React.useCallback(
    (modelId: string) => { adapter.selectModel?.(modelId) },
    [adapter],
  )

  return (
    <ModelSelector.Root models={models} selectedId={currentModelId} onSelect={handleSelect}>
      <ModelSelector.Trigger />
      <ModelSelector.Content>
        <ModelSelector.Search />
        <ModelSelector.List />
        <ModelSelector.Footer />
      </ModelSelector.Content>
    </ModelSelector.Root>
  )
}

ModelSelectorView.displayName = 'MorphChat.ModelSelectorView'

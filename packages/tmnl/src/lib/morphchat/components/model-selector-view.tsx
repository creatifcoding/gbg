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
// View Resolver
// =============================================================================

export function ModelSelectorView() {
  const { adapter } = useMorphChatContext()

  // Read model atoms from adapter — harness adapter wires these
  const availableModels = adapter.availableModels$
    ? useAtomValue(adapter.availableModels$)
    : null
  const selectedModelId = adapter.selectedModel$
    ? useAtomValue(adapter.selectedModel$)
    : null

  // No models available yet — show nothing (loading state)
  if (!availableModels || availableModels.length === 0) {
    return null
  }

  const models = availableModels as ModelOption[]
  const currentModelId = selectedModelId ?? models[0]?.id ?? ''

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

/**
 * ModelSelectorView — morphchat view resolver for the model selector.
 *
 * Reads adapter state, composes ModelSelector compound component
 * into the header band's center slot.
 *
 * @module morphchat/components/model-selector-view
 */

import * as React from 'react'
import { Atom, useAtomValue } from '@effect-atom/atom-react'
import { useMorphChatContext } from './surface-context'
import { ModelSelector, type ModelOption } from '@/lib/chat/shell/header-band'

// Stable sentinel atoms — hooks always called, no conditional branching
const EMPTY_MODELS = Atom.make<ReadonlyArray<ModelOption>>([])
const NULL_MODEL = Atom.make<string | null>(null)

export function ModelSelectorView() {
  const { adapter } = useMorphChatContext()

  const modelsAtom = adapter.availableModels$ ?? EMPTY_MODELS
  const selectedAtom = adapter.selectedModel$ ?? NULL_MODEL

  const availableModels = useAtomValue(modelsAtom)
  const selectedModelId = useAtomValue(selectedAtom)

  const handleSelect = React.useCallback(
    (modelId: string) => { adapter.selectModel?.(modelId) },
    [adapter],
  )

  if (availableModels.length === 0) return null

  const models = availableModels as ModelOption[]
  const currentModelId = selectedModelId ?? models[0]?.id ?? ''

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

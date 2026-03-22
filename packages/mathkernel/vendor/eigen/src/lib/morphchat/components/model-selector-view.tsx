/**
 * ModelSelectorView — composes ModelSelector compound component
 * into the dual-zone header strip's right zone.
 *
 * Passes through loading/error state from adapter to drive
 * the Full Capsule Morph trigger states.
 *
 * Inherits `group-hover/right` from FrameChromeView for idle
 * text brightening on zone hover.
 *
 * @module morphchat/components/model-selector-view
 */

import { useCallback } from 'react'
import { Atom, useAtomValue } from '@effect-atom/atom-react'
import { useMorphChatContext } from './surface-context'
import { ModelSelector, type ModelOption } from '@/lib/chat/shell/header-band'

// Stable sentinel atoms
const EMPTY_MODELS = Atom.make<ReadonlyArray<ModelOption>>([])
const NULL_MODEL = Atom.make<string | null>(null)
const FALSE_ATOM = Atom.make<boolean>(false)
const NULL_STRING_ATOM = Atom.make<string | null>(null)

export function ModelSelectorView() {
  const { adapter, surfaceId } = useMorphChatContext()

  const modelsAtom = adapter.availableModels$ ?? EMPTY_MODELS
  const selectedAtom = adapter.selectedModel$ ?? NULL_MODEL

  const availableModels = useAtomValue(modelsAtom)
  const selectedModelId = useAtomValue(selectedAtom)

  // Model loading/error state (typed optional from adapter interface)
  const modelLoading = useAtomValue(adapter.modelsLoading$ ?? FALSE_ATOM)
  const modelError = useAtomValue(adapter.modelsError$ ?? NULL_STRING_ATOM)

  const handleSelect = useCallback(
    (modelId: string) => {
      // Model override is per-message: the engine applies it on the next
      // send() call. No reconnection, no session tear-down, no fiber
      // interruption needed. Just write the two atoms.
      adapter.selectModel?.(modelId)
    },
    [adapter],
  )

  const handleRetry = useCallback(() => {
    adapter.retryModelCatalog?.()
  }, [adapter])

  if (availableModels.length === 0 && !modelLoading && !modelError) return null

  const models = availableModels as ModelOption[]
  const currentModelId = selectedModelId ?? models[0]?.id ?? ''

  return (
    <ModelSelector.Root
      models={models}
      selectedId={currentModelId}
      onSelect={handleSelect}
      loading={modelLoading}
      error={modelError}
      onRetry={modelError ? handleRetry : null}
    >
      <ModelSelector.Trigger className="text-neutral-700 group-hover/right:text-neutral-500 [&_[data-name]]:text-neutral-700 [&_[data-name]]:group-hover/right:text-neutral-500" />
      <ModelSelector.Content>
        <ModelSelector.Search />
        <ModelSelector.List />
        <ModelSelector.Footer />
      </ModelSelector.Content>
    </ModelSelector.Root>
  )
}

ModelSelectorView.displayName = 'MorphChat.ModelSelectorView'

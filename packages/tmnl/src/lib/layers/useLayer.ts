import { useAtomValue, useAtomSet } from "@effect-atom/atom-react";
import * as Result from "@effect-atom/atom/Result";
import { layerAtom, layersAtom, layerIndexAtom, layerOpsAtom } from "./atoms";
import type { LayerInstance } from "./types";

/**
 * Helper to unwrap Result types from runtime atoms
 * Returns the value if Success, or a default if Failure
 */
function unwrapResult<T>(result: Result.Result<T>, defaultValue: T): T {
  return Result.isSuccess(result) ? result.value : defaultValue;
}

/**
 * useLayer Hook
 *
 * Provides access to layer state and operations
 *
 * @param layerId - Optional layer ID. If not provided, returns all layers
 * @returns Layer state and operations
 */
export function useLayer(layerId?: string) {
  // Get specific layer or all layers (unwrap Result types)
  const layerResult = layerId ? useAtomValue(layerAtom(layerId)) : undefined;
  const allLayersResult = useAtomValue(layersAtom);
  const layerIndexResult = useAtomValue(layerIndexAtom);

  // Unwrap Results to raw values
  const layer = layerResult ? unwrapResult(layerResult, undefined) : undefined;
  const allLayers = unwrapResult(allLayersResult, [] as readonly LayerInstance[]);
  const layerIndex = unwrapResult(layerIndexResult, [] as readonly LayerInstance[]);

  // Layer operations
  const bringToFront = useAtomSet(layerOpsAtom.bringToFront);
  const sendToBack = useAtomSet(layerOpsAtom.sendToBack);
  const setVisible = useAtomSet(layerOpsAtom.setVisible);
  const setOpacity = useAtomSet(layerOpsAtom.setOpacity);
  const setLocked = useAtomSet(layerOpsAtom.setLocked);
  const removeLayer = useAtomSet(layerOpsAtom.removeLayer);

  return {
    // State
    layer,
    allLayers,
    layerIndex,

    // Operations (bound to current layer if layerId provided)
    bringToFront: layerId ? () => bringToFront(layerId) : bringToFront,
    sendToBack: layerId ? () => sendToBack(layerId) : sendToBack,
    setVisible: layerId
      ? (visible: boolean) => setVisible({ id: layerId, visible })
      : (id: string, visible: boolean) => setVisible({ id, visible }),
    setOpacity: layerId
      ? (opacity: number) => setOpacity({ id: layerId, opacity })
      : (id: string, opacity: number) => setOpacity({ id, opacity }),
    setLocked: layerId
      ? (locked: boolean) => setLocked({ id: layerId, locked })
      : (id: string, locked: boolean) => setLocked({ id, locked }),
    remove: layerId ? () => removeLayer(layerId) : removeLayer,
  };
}

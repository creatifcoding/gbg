import { useAtomValue, useAtomSet } from "@effect-atom/atom-react";
import { layerAtom, layersAtom, layerIndexAtom, layerOpsAtom } from "./atoms";
import type { LayerInstance } from "./types";

/**
 * useLayer Hook
 *
 * Provides access to layer state and operations
 *
 * @param layerId - Optional layer ID. If not provided, returns all layers
 * @returns Layer state and operations
 */
export function useLayer(layerId?: string) {
  // Get specific layer or all layers
  const layer = layerId ? useAtomValue(layerAtom(layerId)) : undefined;
  const allLayers = useAtomValue(layersAtom);
  const layerIndex = useAtomValue(layerIndexAtom);

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

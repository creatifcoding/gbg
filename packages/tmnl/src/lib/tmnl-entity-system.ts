// ===========================================
// ENTITY SYSTEM IMPLEMENTATION
// Runtime management of controllables and controllers
// ===========================================

import type { TLShapeId } from "tldraw"
import type { EntityMetadata, IControllable, IController, EntityRegistry } from "./types"

// --- Singleton Entity Registry ---
class TmnlEntityRegistry implements EntityRegistry {
  controllables = new Map<TLShapeId, IControllable>()
  controllers = new Map<TLShapeId, IController>()
  bindings = new Map<TLShapeId, TLShapeId>()

  registerControllable(id: TLShapeId, entity: IControllable) {
    this.controllables.set(id, entity)
  }

  registerController(id: TLShapeId, controller: IController) {
    this.controllers.set(id, controller)
  }

  unregister(id: TLShapeId) {
    this.controllables.delete(id)
    this.controllers.delete(id)
    this.bindings.delete(id)
    for (const [controllerId, targetId] of this.bindings) {
      if (targetId === id) this.bindings.delete(controllerId)
    }
  }

  bind(controllerId: TLShapeId, controllableId: TLShapeId): boolean {
    const controller = this.controllers.get(controllerId)
    const controllable = this.controllables.get(controllableId)

    if (!controller || !controllable) return false
    if (!controllable.acceptVisitor(controller.visitorId)) return false

    const existingTarget = this.bindings.get(controllerId)
    if (existingTarget) {
      controller.unbind()
    }

    controller.bind(controllable)
    this.bindings.set(controllerId, controllableId)
    return true
  }

  unbind(controllerId: TLShapeId) {
    const controller = this.controllers.get(controllerId)
    if (controller) {
      controller.unbind()
    }
    this.bindings.delete(controllerId)
  }

  getBinding(controllerId: TLShapeId): TLShapeId | undefined {
    return this.bindings.get(controllerId)
  }

  getControllable(id: TLShapeId): IControllable | undefined {
    return this.controllables.get(id)
  }

  getController(id: TLShapeId): IController | undefined {
    return this.controllers.get(id)
  }
}

export const entityRegistry = new TmnlEntityRegistry()

// --- Factory functions for creating entity implementations ---
export function createControllable(
  entityId: string,
  metadata: EntityMetadata,
  parameters: Record<string, any>,
  onParameterChange: (params: Record<string, any>) => void,
): IControllable {
  return {
    entityId,
    metadata,
    parameters,
    acceptVisitor(visitorId: string): boolean {
      return visitorId.startsWith("param-setter") || visitorId.startsWith("controller")
    },
    applyParameters(params: Record<string, any>) {
      Object.assign(this.parameters, params)
      onParameterChange(this.parameters)
    },
  }
}

export function createController(
  controllerId: string,
  onBindingChange: (targetId: string | null, metadata: EntityMetadata | null) => void,
  onParameterDispatch: (targetId: string, key: string, value: any) => void,
): IController {
  return {
    controllerId,
    visitorId: `controller-${controllerId}`,
    targetId: null,
    targetMetadata: null,
    canControl(entity: IControllable): boolean {
      return entity.acceptVisitor(this.visitorId)
    },
    bind(entity: IControllable) {
      this.targetId = entity.entityId as TLShapeId
      this.targetMetadata = JSON.parse(JSON.stringify(entity.metadata))
      Object.keys(this.targetMetadata!.parameters).forEach((key) => {
        this.targetMetadata!.parameters[key].value = entity.parameters[key]
      })
      if (this.targetMetadata!.parameters.syncGlow?.value) {
        this.targetMetadata!.parameters.glowColor.hidden = true
      }
      onBindingChange(this.targetId, this.targetMetadata)
    },
    unbind() {
      this.targetId = null
      this.targetMetadata = null
      onBindingChange(null, null)
    },
    setParameter(key: string, value: any) {
      if (!this.targetId || !this.targetMetadata) return

      if (this.targetMetadata.parameters[key]) {
        this.targetMetadata.parameters[key].value = value
      }

      if (key === "syncGlow") {
        this.targetMetadata.parameters.glowColor.hidden = value
        if (value && this.targetMetadata.parameters.lineColor) {
          this.targetMetadata.parameters.glowColor.value = this.targetMetadata.parameters.lineColor.value
        }
      }
      if (key === "lineColor" && this.targetMetadata.parameters.syncGlow?.value) {
        this.targetMetadata.parameters.glowColor.value = value
      }

      onParameterDispatch(this.targetId, key, value)
    },
  }
}

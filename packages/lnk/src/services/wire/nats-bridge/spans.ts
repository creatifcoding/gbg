/** Observability span names for the LNK MSH bridge. */

export const MshBridgeSpan = {
  Port: {
    create: "lnk.mshBridge.port.create",
    append: "lnk.mshBridge.port.append",
    read: "lnk.mshBridge.port.read",
    metadata: "lnk.mshBridge.port.metadata",
    delete: "lnk.mshBridge.port.delete",
  },
  CAS: {
    append: "lnk.mshBridge.cas.append",
    attempt: "lnk.mshBridge.cas.attempt",
  },
  MetadataStore: {
    get: "lnk.mshBridge.metadata.get",
    create: "lnk.mshBridge.metadata.create",
    updateIfRevision: "lnk.mshBridge.metadata.updateIfRevision",
    deleteIfRevision: "lnk.mshBridge.metadata.deleteIfRevision",
  },
  Publisher: {
    publish: "lnk.mshBridge.publisher.publish",
  },
} as const

export type MshBridgeSpanName =
  | (typeof MshBridgeSpan.Port)[keyof typeof MshBridgeSpan.Port]
  | (typeof MshBridgeSpan.CAS)[keyof typeof MshBridgeSpan.CAS]
  | (typeof MshBridgeSpan.MetadataStore)[keyof typeof MshBridgeSpan.MetadataStore]
  | (typeof MshBridgeSpan.Publisher)[keyof typeof MshBridgeSpan.Publisher]

export type ObservedRpcName = string;

export type EmptyAttachWell = {
  readonly kind: 'empty-well';
  readonly attachCallable: false;
  readonly reason: 'specimendb-attach-unavailable';
  readonly observedRpcNames: readonly ObservedRpcName[];
};

export type GatedAttachWell = {
  readonly kind: 'gated-well';
  readonly attachCallable: true;
  readonly reason: 'attach-not-live-in-a5';
  readonly observedRpcNames: readonly ObservedRpcName[];
};

export type AttachWell = EmptyAttachWell | GatedAttachWell;

export const PUBLISHED_SPECIMEN_RPCS = ['Intake', 'Get', 'List', 'Promote'] as const;

const functionNames = (port: object): readonly ObservedRpcName[] =>
  Object.getOwnPropertyNames(port).filter((name) => {
    const value = (port as Record<string, unknown>)[name];
    return typeof value === 'function';
  });

export function probeAttachWell(port: unknown): AttachWell {
  if (typeof port !== 'object' || port === null) {
    return {
      kind: 'empty-well',
      attachCallable: false,
      reason: 'specimendb-attach-unavailable',
      observedRpcNames: [],
    };
  }
  const observedRpcNames = functionNames(port);
  const candidate = port as { readonly attach?: unknown; readonly Attach?: unknown };
  if (typeof candidate.attach === 'function' || typeof candidate.Attach === 'function') {
    return {
      kind: 'gated-well',
      attachCallable: true,
      reason: 'attach-not-live-in-a5',
      observedRpcNames,
    };
  }
  return {
    kind: 'empty-well',
    attachCallable: false,
    reason: 'specimendb-attach-unavailable',
    observedRpcNames,
  };
}

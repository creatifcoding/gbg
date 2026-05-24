/** Query client and BCS codec contracts. */

export interface BcsCodecLike<A = unknown> {
  readonly parse?: (bytes: Uint8Array) => A;
  readonly fromBytes?: (bytes: Uint8Array) => A;
  readonly serialize?: (value: A) => { readonly toBytes: () => Uint8Array } | Uint8Array;
}

export interface ClientWithCoreReads {
  readonly core: {
    readonly getObject: (options: {
      readonly objectId: string;
      readonly include?: {
        readonly content?: boolean;
        readonly json?: boolean;
        readonly previousTransaction?: boolean;
        readonly objectBcs?: boolean;
      };
    }) => Promise<{ readonly object: SuiCoreObject }>;
  };
}

export interface SuiCoreObject {
  readonly objectId: string;
  readonly version: string | number;
  readonly digest: string;
  readonly owner?: SuiCoreObjectOwner;
  readonly type?: string;
  readonly content?: Uint8Array;
  readonly json?: Record<string, unknown> | null;
  readonly objectBcs?: Uint8Array;
}

export type SuiCoreObjectOwner =
  | { readonly $kind: 'Shared'; readonly Shared: { readonly initialSharedVersion: string | number } }
  | { readonly $kind: 'AddressOwner'; readonly AddressOwner: string }
  | { readonly $kind: 'ObjectOwner'; readonly ObjectOwner: string }
  | { readonly $kind: 'Immutable'; readonly Immutable: true }
  | { readonly $kind: 'ConsensusAddressOwner'; readonly ConsensusAddressOwner: unknown }
  | { readonly $kind: 'Unknown' };

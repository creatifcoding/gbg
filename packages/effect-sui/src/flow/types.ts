/** Client and signer contracts consumed by SuiFlow edge services. */

export interface ClientWithCoreGas {
  readonly core: {
    readonly getReferenceGasPrice?: () => Promise<{ readonly referenceGasPrice: string | number | bigint }>;
  };
}

export interface ClientWithTransactionBuild extends ClientWithCoreGas {
  readonly core: ClientWithCoreGas['core'];
}

export interface ClientWithTransactionLifecycle extends ClientWithTransactionBuild {
  readonly core: ClientWithTransactionBuild['core'] & {
    readonly simulateTransaction?: (options: {
      readonly transaction: Uint8Array;
      readonly include?: { readonly effects?: boolean; readonly transaction?: boolean; readonly events?: boolean; readonly balanceChanges?: boolean };
    }) => Promise<unknown>;
    readonly executeTransaction?: (options: {
      readonly transaction: Uint8Array;
      readonly signatures: ReadonlyArray<string>;
      readonly include?: { readonly effects?: boolean; readonly transaction?: boolean; readonly events?: boolean; readonly balanceChanges?: boolean };
    }) => Promise<unknown>;
    readonly waitForTransaction?: (options: {
      readonly digest: string;
      readonly include?: { readonly effects?: boolean; readonly transaction?: boolean; readonly events?: boolean; readonly balanceChanges?: boolean };
      readonly timeout?: number;
    }) => Promise<unknown>;
  };
}

export interface SignerLike {
  readonly signTransaction: (bytes: Uint8Array) => Promise<{ readonly signature: string; readonly bytes?: string }>;
  readonly toSuiAddress?: () => string;
  readonly getPublicKey?: () => { readonly toSuiAddress: () => string };
}

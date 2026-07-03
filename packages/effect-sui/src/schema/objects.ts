/** Sui object reference schemas and object argument nouns. */

import * as Schema from 'effect/Schema';

import { SuiObjectDigest, SuiObjectId, SuiObjectVersion } from './strings';

export class SuiObjectRef extends Schema.Class<SuiObjectRef>('SuiObjectRef')({
  objectId: SuiObjectId,
  version: SuiObjectVersion,
  digest: SuiObjectDigest,
}) {
  get key(): string {
    return `${this.objectId}@${this.version}:${this.digest}`;
  }

  toMysten(): { readonly objectId: string; readonly version: string; readonly digest: string } {
    return {
      objectId: this.objectId,
      version: this.version,
      digest: this.digest,
    };
  }
}

export class SharedObjectRef extends Schema.Class<SharedObjectRef>('SharedObjectRef')({
  objectId: SuiObjectId,
  initialSharedVersion: SuiObjectVersion,
  mutable: Schema.Boolean,
}) {
  toMysten(): {
    readonly objectId: string;
    readonly initialSharedVersion: string;
    readonly mutable: boolean;
  } {
    return {
      objectId: this.objectId,
      initialSharedVersion: this.initialSharedVersion,
      mutable: this.mutable,
    };
  }
}

export const SuiObjectArg = Schema.Union([
  Schema.TaggedStruct('ImmOrOwnedObject', { ref: SuiObjectRef }),
  Schema.TaggedStruct('SharedObject', { ref: SharedObjectRef }),
  Schema.TaggedStruct('Receiving', { ref: SuiObjectRef }),
]);
export type SuiObjectArg = typeof SuiObjectArg.Type;

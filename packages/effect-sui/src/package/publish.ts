import { fromBase64 } from '@mysten/bcs';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';

import { SuiPTB, SuiTx } from '../effectable';
import { input, make as makePtb, pure, result, SuiPtbAst, SuiPtbPublish, SuiPtbTransferObjects } from '../ptb';
import {
  decodeSuiObjectId,
  decodeSuiTypeTagString,
  SuiAddress,
  type SuiAuthPolicy,
  SuiGasPolicy,
  SuiObjectId,
  SuiPackageDescriptor,
  SuiPackageError,
  SuiPaymentPolicy,
  SuiTransactionDigest,
} from '../schema';
import { SuiPackageRegistry, SuiTxRunner, type SuiTxLifecycleResult } from '../services';

export class SuiPackagePublishRequest extends Schema.TaggedClass<SuiPackagePublishRequest>()('SuiPackagePublishRequest', {
  name: Schema.String,
  sender: SuiAddress,
  modules: Schema.Array(Schema.Uint8Array),
  dependencies: Schema.Array(SuiObjectId),
  moduleNames: Schema.optional(Schema.Array(Schema.String)),
  upgradeCapRecipient: Schema.optional(SuiAddress),
  register: Schema.optional(Schema.Boolean),
}) {}

export class SuiPackagePublishResult extends Schema.TaggedClass<SuiPackagePublishResult>()('SuiPackagePublishResult', {
  packageId: SuiObjectId,
  digest: SuiTransactionDigest,
  upgradeCapId: Schema.optional(SuiObjectId),
  publisherObjectId: Schema.optional(SuiObjectId),
  descriptor: SuiPackageDescriptor,
  lifecycle: Schema.optional(Schema.Unknown),
}) {}

export interface CompiledMovePackageInput {
  readonly name: string;
  readonly modules: ReadonlyArray<string | Uint8Array>;
  readonly dependencies: ReadonlyArray<string>;
  readonly moduleNames?: ReadonlyArray<string>;
  readonly sender: typeof SuiAddress.Type;
  readonly upgradeCapRecipient?: typeof SuiAddress.Type;
  readonly register?: boolean;
}

export interface PublishMovePackageOptions {
  readonly request: SuiPackagePublishRequest;
  readonly authPolicy: SuiAuthPolicy;
  readonly gasPolicy?: SuiGasPolicy;
  readonly paymentPolicy?: SuiPaymentPolicy;
  readonly label?: string;
}

export const publishRequestFromCompiled = (input: CompiledMovePackageInput): SuiPackagePublishRequest =>
  new SuiPackagePublishRequest({
    name: input.name,
    sender: input.sender,
    modules: input.modules.map((module) => typeof module === 'string' ? fromBase64(module) : module),
    dependencies: input.dependencies.map((dependency) => decodeSuiObjectId(dependency)),
    moduleNames: input.moduleNames,
    upgradeCapRecipient: input.upgradeCapRecipient,
    register: input.register,
  });

export const makePublishPtb = (request: SuiPackagePublishRequest): SuiPTB<unknown, unknown, unknown> => {
  const recipient = request.upgradeCapRecipient ?? request.sender;
  return makePtb(new SuiPtbAst({
    label: `publish.${request.name}`,
    inputs: [pure({ name: 'upgradeCapRecipient', typeTag: decodeSuiTypeTagString('address'), value: recipient })],
    commands: [
      new SuiPtbPublish({ name: 'publishPackage', modules: request.modules, dependencies: request.dependencies }),
      new SuiPtbTransferObjects({ name: 'transferUpgradeCap', objects: [result(0)], address: input(0, 'pure') }),
    ],
  }));
};

export const makePublishTx = (options: PublishMovePackageOptions): SuiTx<unknown, unknown, unknown> => new SuiTx({
  label: options.label ?? `publish.${options.request.name}.tx`,
  ptb: makePublishPtb(options.request),
  sender: options.request.sender,
  buildMode: 'execute',
  gasPolicy: options.gasPolicy,
  paymentPolicy: options.paymentPolicy,
  authPolicy: options.authPolicy,
  execute: (self) => SuiTxRunner.use((runner) => runner.run(self)),
});

export const publishMovePackage = (
  options: PublishMovePackageOptions,
): Effect.Effect<SuiPackagePublishResult, unknown, SuiTxRunner | SuiPackageRegistry> => Effect.gen(function* () {
  const lifecycle = yield* SuiTxRunner.use((runner) => runner.run(makePublishTx(options)));
  const result = yield* extractPublishResult(options.request, lifecycle);
  if (options.request.register !== false) {
    yield* SuiPackageRegistry.use((registry) => registry.register(result.descriptor));
  }
  return result;
});

export const extractPublishResult = (
  request: SuiPackagePublishRequest,
  lifecycle: SuiTxLifecycleResult,
): Effect.Effect<SuiPackagePublishResult, SuiPackageError> => Effect.gen(function* () {
  const digest = lifecycle.execution?.digest;
  if (!digest) return yield* packagePublishError(request, 'Publish lifecycle did not produce a transaction digest', lifecycle);

  const changedObjects = changedObjectsOf(lifecycle.finality?.effects);
  const published = changedObjects.find((change) => change.outputState === 'PackageWrite');
  if (!published?.objectId) return yield* packagePublishError(request, 'Publish finality did not include a PackageWrite object', lifecycle.finality);

  const packageId = decodeSuiObjectId(published.objectId);
  const objectTypes = lifecycle.finality?.objectTypes ?? objectTypesOf(lifecycle.finality?.transaction);
  const upgradeCapId = findCreatedObjectByType(changedObjects, objectTypes, '::package::UpgradeCap');
  const publisherObjectId = findCreatedObjectByType(changedObjects, objectTypes, '::package::Publisher');
  const descriptor = new SuiPackageDescriptor({
    packageId,
    modules: [...(request.moduleNames ?? [request.name])],
  });

  return new SuiPackagePublishResult({
    packageId,
    digest,
    upgradeCapId,
    publisherObjectId,
    descriptor,
    lifecycle,
  });
});

const packagePublishError = (
  request: SuiPackagePublishRequest,
  message: string,
  cause: unknown,
): Effect.Effect<never, SuiPackageError> => Effect.fail(new SuiPackageError({
  kind: 'publish',
  message: `${request.name}: ${message}`,
  cause,
}));

type ChangedObjectLike = {
  readonly objectId?: string;
  readonly outputState?: string;
  readonly idOperation?: string;
};

function changedObjectsOf(effects: unknown): ReadonlyArray<ChangedObjectLike> {
  const changedObjects = (effects as { readonly changedObjects?: unknown } | undefined)?.changedObjects;
  return Array.isArray(changedObjects) ? changedObjects as ReadonlyArray<ChangedObjectLike> : [];
}

function objectTypesOf(transaction: unknown): Record<string, string> {
  const envelope = transaction as { readonly Transaction?: { readonly objectTypes?: Record<string, string> }; readonly objectTypes?: Record<string, string> } | undefined;
  return envelope?.Transaction?.objectTypes ?? envelope?.objectTypes ?? {};
}

function findCreatedObjectByType(
  changedObjects: ReadonlyArray<ChangedObjectLike>,
  objectTypes: Record<string, string>,
  typeSuffix: string,
): typeof SuiObjectId.Type | undefined {
  const object = changedObjects.find((change) =>
    change.objectId &&
    change.idOperation === 'Created' &&
    objectTypes[change.objectId]?.includes(typeSuffix),
  );
  return object?.objectId ? decodeSuiObjectId(object.objectId) : undefined;
}

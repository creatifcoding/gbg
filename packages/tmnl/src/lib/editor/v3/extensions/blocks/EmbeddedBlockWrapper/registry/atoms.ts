import { Atom } from '@effect-atom/atom';
import { Effect, Layer, Option } from 'effect';
import {
  BlockId,
  BlockName,
  BlockRef,
  BlockType,
  DocumentId,
  EditorContext,
} from '../shared';
import type { BlockRegistryError } from './schemas';
import { BlockRegistry } from './BlockRegistry';

export const blocksAtom = Atom.make<ReadonlyArray<BlockRef>>([]);
export const namedBlocksAtom = Atom.make<ReadonlyArray<BlockRef>>([]);

export const blockByIdAtom = Atom.family((_id: BlockId) =>
  Atom.make<Option.Option<BlockRef>>(Option.none())
);

export const blockByNameAtom = Atom.family((_name: BlockName) =>
  Atom.make<Option.Option<BlockRef>>(Option.none())
);

export const renameErrorAtom = Atom.make<Option.Option<BlockRegistryError>>(
  Option.none()
);

export const isRenamingAtom = Atom.make<Option.Option<BlockId>>(Option.none());

export const createBlockRegistryLayer = (documentId: string) =>
  Layer.provideMerge(
    BlockRegistry.Default,
    EditorContext.layer(documentId as DocumentId)
  );

export const createBlockRegistryRuntime = (documentId: string) =>
  Atom.runtime(
    createBlockRegistryLayer(documentId) as Layer.Layer<BlockRegistry>
  );

type BlockRegistryRuntime = ReturnType<typeof createBlockRegistryRuntime>;

interface RegisterInput {
  id: BlockId;
  type: BlockType;
  name?: BlockName;
}

interface RenameInput {
  id: BlockId;
  newName: string;
}

interface UnregisterInput {
  id: BlockId;
}

export const createBlockRegistryOps = (runtime: BlockRegistryRuntime) => ({
  register: runtime.fn<RegisterInput>()(({ id, type, name }, ctx) =>
    Effect.gen(function* () {
      const registry = yield* BlockRegistry;
      const block = yield* registry.register(id, type, name);

      ctx.set(blocksAtom, registry.getAll());
      ctx.set(namedBlocksAtom, registry.getAllNamed());
      ctx.set(blockByIdAtom(id), Option.some(block));
      if (name) {
        ctx.set(blockByNameAtom(name), Option.some(block));
      }

      return block;
    })
  ),

  rename: runtime.fn<RenameInput>()(({ id, newName }, ctx) =>
    Effect.gen(function* () {
      ctx.set(isRenamingAtom, Option.some(id));
      ctx.set(renameErrorAtom, Option.none());

      const registry = yield* BlockRegistry;
      const result = yield* Effect.either(registry.rename(id, newName));

      if (result._tag === 'Left') {
        ctx.set(renameErrorAtom, Option.some(result.left));
        ctx.set(isRenamingAtom, Option.none());
        yield* Effect.fail(result.left);
        throw new Error('unreachable');
      }

      const block = result.right;
      ctx.set(blocksAtom, registry.getAll());
      ctx.set(namedBlocksAtom, registry.getAllNamed());
      ctx.set(blockByIdAtom(id), Option.some(block));
      if (Option.isSome(block.name)) {
        ctx.set(blockByNameAtom(block.name.value), Option.some(block));
      }
      ctx.set(isRenamingAtom, Option.none());

      return block;
    })
  ),

  unregister: runtime.fn<UnregisterInput>()(({ id }, ctx) =>
    Effect.gen(function* () {
      const registry = yield* BlockRegistry;
      const maybeBlock = registry.getById(id);

      yield* registry.unregister(id);

      ctx.set(blocksAtom, registry.getAll());
      ctx.set(namedBlocksAtom, registry.getAllNamed());
      ctx.set(blockByIdAtom(id), Option.none());

      if (Option.isSome(maybeBlock) && Option.isSome(maybeBlock.value.name)) {
        ctx.set(blockByNameAtom(maybeBlock.value.name.value), Option.none());
      }
    })
  ),

  clearRenameError: runtime.fn<void>()((_, ctx) =>
    Effect.sync(() => {
      ctx.set(renameErrorAtom, Option.none());
    })
  ),
});

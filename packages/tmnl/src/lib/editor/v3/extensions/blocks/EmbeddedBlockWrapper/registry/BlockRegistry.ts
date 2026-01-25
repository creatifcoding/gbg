import { Effect, HashMap, Option, PubSub, Schema } from 'effect';
import {
  BlockId,
  BlockName,
  BlockRef,
  BlockType,
  EditorContext,
} from '../shared';
import {
  BlockRegistryError,
  BlockRegistryEvent,
  createBlockNameConflictError,
  createBlockNotFoundError,
  createInvalidBlockNameError,
} from './schemas';

interface BlockRegistryState {
  readonly blocks: HashMap.HashMap<BlockId, BlockRef>;
  readonly nameIndex: HashMap.HashMap<BlockName, BlockId>;
}

const emptyState: BlockRegistryState = {
  blocks: HashMap.empty(),
  nameIndex: HashMap.empty(),
};

export class BlockRegistry extends Effect.Service<BlockRegistry>()(
  'editor/BlockRegistry',
  {
    effect: Effect.gen(function* () {
      const documentId = yield* EditorContext;
      const eventHub = yield* PubSub.unbounded<BlockRegistryEvent>();

      let state: BlockRegistryState = emptyState;

      const publishEvent = (event: BlockRegistryEvent) =>
        Effect.flatMap(PubSub.publish(eventHub, event), () => Effect.void);

      const validateName = (name: string) =>
        Effect.gen(function* () {
          const result = Schema.decodeUnknownOption(BlockName)(name);
          if (Option.isNone(result)) {
            yield* Effect.fail(
              createInvalidBlockNameError(
                name,
                'Must start with lowercase letter, contain only lowercase letters, numbers, and dashes'
              )
            );
            throw new Error('unreachable');
          }
          return result.value;
        });

      const register = (id: BlockId, type: BlockType, name?: BlockName) =>
        Effect.gen(function* () {
          if (name) {
            const existing = HashMap.get(state.nameIndex, name);
            if (Option.isSome(existing)) {
              yield* Effect.fail(
                createBlockNameConflictError(name, existing.value)
              );
              throw new Error('unreachable');
            }
          }

          const now = new Date();
          const block = new BlockRef({
            id,
            name: name ? Option.some(name) : Option.none(),
            type,
            documentId,
            registeredAt: now,
            namedAt: name ? Option.some(now) : Option.none(),
          });

          state = {
            blocks: HashMap.set(state.blocks, id, block),
            nameIndex: name
              ? HashMap.set(state.nameIndex, name, id)
              : state.nameIndex,
          };

          yield* publishEvent({
            _tag: 'BlockRegistered',
            blockId: id,
            blockType: type,
            documentId,
            timestamp: now,
          });

          return block;
        });

      const rename = (id: BlockId, newName: string) =>
        Effect.gen(function* () {
          const maybeBlock = HashMap.get(state.blocks, id);
          if (Option.isNone(maybeBlock)) {
            yield* Effect.fail(createBlockNotFoundError(id));
            throw new Error('unreachable');
          }

          const block = maybeBlock.value;
          const validatedName = yield* validateName(newName);

          const existingWithName = HashMap.get(state.nameIndex, validatedName);
          if (
            Option.isSome(existingWithName) &&
            existingWithName.value !== id
          ) {
            yield* Effect.fail(
              createBlockNameConflictError(
                validatedName,
                existingWithName.value
              )
            );
            throw new Error('unreachable');
          }

          const oldName = block.name;
          const now = new Date();
          const updated = new BlockRef({
            ...block,
            name: Option.some(validatedName),
            namedAt: Option.some(now),
          });

          let newNameIndex = state.nameIndex;
          if (Option.isSome(oldName)) {
            newNameIndex = HashMap.remove(newNameIndex, oldName.value);
          }
          newNameIndex = HashMap.set(newNameIndex, validatedName, id);

          state = {
            blocks: HashMap.set(state.blocks, id, updated),
            nameIndex: newNameIndex,
          };

          yield* publishEvent({
            _tag: 'BlockRenamed',
            blockId: id,
            oldName: Option.getOrNull(oldName),
            newName: validatedName,
            timestamp: now,
          });

          return updated;
        });

      const unregister = (id: BlockId) =>
        Effect.gen(function* () {
          const maybeBlock = HashMap.get(state.blocks, id);
          if (Option.isNone(maybeBlock)) {
            yield* Effect.fail(createBlockNotFoundError(id));
            throw new Error('unreachable');
          }

          const block = maybeBlock.value;
          let newNameIndex = state.nameIndex;
          if (Option.isSome(block.name)) {
            newNameIndex = HashMap.remove(newNameIndex, block.name.value);
          }

          state = {
            blocks: HashMap.remove(state.blocks, id),
            nameIndex: newNameIndex,
          };

          yield* publishEvent({
            _tag: 'BlockUnregistered',
            blockId: id,
            timestamp: new Date(),
          });
        });

      const getById = (id: BlockId): Option.Option<BlockRef> =>
        HashMap.get(state.blocks, id);

      const getByName = (name: BlockName): Option.Option<BlockRef> => {
        const maybeId = HashMap.get(state.nameIndex, name);
        if (Option.isNone(maybeId)) return Option.none();
        return HashMap.get(state.blocks, maybeId.value);
      };

      const getAll = (): ReadonlyArray<BlockRef> =>
        Array.from(HashMap.values(state.blocks));

      const getAllNamed = (): ReadonlyArray<BlockRef> =>
        getAll().filter((block) => Option.isSome(block.name));

      const subscribeEvents = () => PubSub.subscribe(eventHub);

      return {
        register,
        rename,
        unregister,
        getById,
        getByName,
        getAll,
        getAllNamed,
        subscribeEvents,
        documentId,
      } as const;
    }),
    dependencies: [],
  }
) {}

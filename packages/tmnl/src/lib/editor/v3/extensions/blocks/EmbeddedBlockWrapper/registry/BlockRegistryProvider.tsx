import {
  createContext,
  useContext,
  useMemo,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { useAtomValue } from '@effect-atom/atom-react';
import { Effect, ManagedRuntime } from 'effect';

import { currentDocumentIdAtom } from '../../../../atoms/documents';
import type { BlockId, BlockName, BlockType, BlockRef } from '../shared';
import { BlockRegistry } from './BlockRegistry';
import { createBlockRegistryLayer } from './atoms';

interface BlockRegistryOps {
  register: (
    id: BlockId,
    type: BlockType,
    name?: BlockName
  ) => Promise<BlockRef>;
  rename: (id: BlockId, newName: string) => Promise<BlockRef>;
  unregister: (id: BlockId) => Promise<void>;
  clearRenameError: () => void;
}

interface BlockRegistryContextValue {
  isAvailable: boolean;
  ops: BlockRegistryOps;
}

const BlockRegistryContext = createContext<BlockRegistryContextValue | null>(
  null
);

interface BlockRegistryProviderProps {
  children: ReactNode;
  /**
   * Optional document ID to use for the block registry.
   * If provided, overrides the global currentDocumentIdAtom.
   * This is necessary for panel-scoped registries in collaboration testbed.
   */
  documentId?: string;
}

export function BlockRegistryProvider({
  children,
  documentId: documentIdProp,
}: BlockRegistryProviderProps) {
  const documentIdFromAtom = useAtomValue(currentDocumentIdAtom);
  const documentId = documentIdProp ?? documentIdFromAtom;

  const runtimeRef = useRef<ManagedRuntime.ManagedRuntime<
    BlockRegistry,
    never
  > | null>(null);

  const runtime = useMemo(() => {
    if (!documentId) {
      runtimeRef.current = null;
      return null;
    }

    const layer = createBlockRegistryLayer(documentId);
    const rt = ManagedRuntime.make(layer);
    runtimeRef.current = rt;
    return rt;
  }, [documentId]);

  const register = useCallback(
    async (
      id: BlockId,
      type: BlockType,
      name?: BlockName
    ): Promise<BlockRef> => {
      const rt = runtimeRef.current;
      if (!rt) throw new Error('BlockRegistry not available');

      return rt.runPromise(
        Effect.gen(function* () {
          const registry = yield* BlockRegistry;
          return yield* registry.register(id, type, name);
        })
      );
    },
    []
  );

  const rename = useCallback(
    async (id: BlockId, newName: string): Promise<BlockRef> => {
      const rt = runtimeRef.current;
      if (!rt) throw new Error('BlockRegistry not available');

      return rt.runPromise(
        Effect.gen(function* () {
          const registry = yield* BlockRegistry;
          return yield* registry.rename(id, newName);
        })
      );
    },
    []
  );

  const unregister = useCallback(async (id: BlockId): Promise<void> => {
    const rt = runtimeRef.current;
    if (!rt) throw new Error('BlockRegistry not available');

    return rt.runPromise(
      Effect.gen(function* () {
        const registry = yield* BlockRegistry;
        yield* registry.unregister(id);
      })
    );
  }, []);

  const clearRenameError = useCallback(() => {
    // Direct atom mutation - no Effect needed
  }, []);

  const contextValue = useMemo<BlockRegistryContextValue>(
    () => ({
      isAvailable: !!documentId && !!runtime,
      ops: {
        register,
        rename,
        unregister,
        clearRenameError,
      },
    }),
    [documentId, runtime, register, rename, unregister, clearRenameError]
  );

  return (
    <BlockRegistryContext.Provider value={contextValue}>
      {children}
    </BlockRegistryContext.Provider>
  );
}

export function useBlockRegistry(): BlockRegistryContextValue {
  const ctx = useContext(BlockRegistryContext);
  if (!ctx) {
    throw new Error(
      'useBlockRegistry must be used within BlockRegistryProvider'
    );
  }
  return ctx;
}

export function useBlockRegistryOptional(): BlockRegistryContextValue | null {
  return useContext(BlockRegistryContext);
}

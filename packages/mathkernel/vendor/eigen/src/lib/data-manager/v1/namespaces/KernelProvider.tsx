/**
 * TMNL DataManager v1 - KernelProvider
 *
 * React context provider for scoped kernel access.
 * Enables tree-scoped kernel instances without prop drilling.
 *
 * Usage:
 * ```tsx
 * <KernelProvider type="search" instance="movies">
 *   <MovieSearch />
 *   <MovieResults />
 * </KernelProvider>
 * ```
 *
 * @experimental v1 API - additive extension to existing v1
 */

import React, {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react"
import { Atom } from "@effect-atom/atom"

import type {
  KernelType,
  NamespaceKey,
  NamespaceAtoms,
} from "./types"
import {
  getNamespaceAtoms,
  getNamespaceDerivedAtoms,
  makeNamespaceKey,
} from "./atoms"
import {
  useSearchKernel,
  type UseSearchKernel,
} from "./useKernel"
import type { Indexable } from "@/lib/search/types"

// ─────────────────────────────────────────────────────────────────────────────
// Context Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Kernel context value
 */
interface KernelContextValue<T = unknown> {
  readonly type: KernelType
  readonly instance: string
  readonly namespaceKey: NamespaceKey
  readonly atoms: NamespaceAtoms<T>
  readonly derived: ReturnType<typeof getNamespaceDerivedAtoms>
}

/**
 * Search kernel context (extended)
 */
interface SearchKernelContextValue<T extends Indexable = Indexable>
  extends KernelContextValue<T> {
  readonly kernel: UseSearchKernel<T>
}

// ─────────────────────────────────────────────────────────────────────────────
// Contexts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generic kernel context (atoms only)
 */
const KernelContext = createContext<KernelContextValue | null>(null)

/**
 * Search kernel context (with operations)
 */
const SearchKernelContext = createContext<SearchKernelContextValue | null>(null)

// ─────────────────────────────────────────────────────────────────────────────
// Providers
// ─────────────────────────────────────────────────────────────────────────────

interface KernelProviderProps<T = unknown> {
  type: KernelType
  instance: string
  children: ReactNode
}

/**
 * Generic KernelProvider - atoms only
 *
 * Use when you need to scope atoms but manage operations elsewhere.
 */
export function KernelProvider<T = unknown>({
  type,
  instance,
  children,
}: KernelProviderProps<T>) {
  const namespaceKey = useMemo(
    () => makeNamespaceKey(type, instance),
    [type, instance]
  )

  const atoms = useMemo(
    () => getNamespaceAtoms<T>(namespaceKey),
    [namespaceKey]
  )

  const derived = useMemo(
    () => getNamespaceDerivedAtoms(namespaceKey),
    [namespaceKey]
  )

  const value = useMemo<KernelContextValue<T>>(
    () => ({
      type,
      instance,
      namespaceKey,
      atoms,
      derived,
    }),
    [type, instance, namespaceKey, atoms, derived]
  )

  return (
    <KernelContext.Provider value={value as KernelContextValue}>
      {children}
    </KernelContext.Provider>
  )
}

interface SearchKernelProviderProps<T extends Indexable> {
  instance: string
  driver?: "flex" | "linear"
  warmUp?: boolean
  autoDispose?: boolean
  children: ReactNode
}

/**
 * SearchKernelProvider - full search kernel with operations
 *
 * Initializes a SearchKernel instance and provides it to the tree.
 *
 * @example
 * ```tsx
 * <SearchKernelProvider instance="movies" driver="flex">
 *   <MovieSearch />
 * </SearchKernelProvider>
 * ```
 */
export function SearchKernelProvider<T extends Indexable>({
  instance,
  driver = "flex",
  warmUp = false,
  autoDispose = false,
  children,
}: SearchKernelProviderProps<T>) {
  const kernel = useSearchKernel<T>(instance, {
    driver,
    warmUp,
    autoDispose,
  })

  const value = useMemo<SearchKernelContextValue<T>>(
    () => ({
      type: "search",
      instance,
      namespaceKey: kernel.namespaceKey,
      atoms: kernel.atoms,
      derived: kernel.derived,
      kernel,
    }),
    [instance, kernel]
  )

  return (
    <SearchKernelContext.Provider value={value as SearchKernelContextValue}>
      {/* Also provide to generic context for useKernelContext */}
      <KernelContext.Provider value={value as unknown as KernelContextValue}>
        {children}
      </KernelContext.Provider>
    </SearchKernelContext.Provider>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Consumer Hooks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Access kernel context (generic)
 *
 * Throws if not inside a KernelProvider.
 */
export function useKernelContext<T = unknown>(): KernelContextValue<T> {
  const context = useContext(KernelContext)

  if (!context) {
    throw new Error("useKernelContext must be used within a KernelProvider")
  }

  return context as KernelContextValue<T>
}

/**
 * Access search kernel context
 *
 * Throws if not inside a SearchKernelProvider.
 */
export function useSearchKernelContext<
  T extends Indexable = Indexable
>(): SearchKernelContextValue<T> {
  const context = useContext(SearchKernelContext)

  if (!context) {
    throw new Error(
      "useSearchKernelContext must be used within a SearchKernelProvider"
    )
  }

  return context as SearchKernelContextValue<T>
}

/**
 * Access kernel atoms from context
 *
 * Convenience hook for accessing atoms without destructuring.
 */
export function useKernelAtomsFromContext<T = unknown>(): NamespaceAtoms<T> {
  const { atoms } = useKernelContext<T>()
  return atoms
}

/**
 * Access search operations from context
 *
 * Returns { index, search, setDriver, isReady }
 */
export function useSearchOpsFromContext<T extends Indexable = Indexable>() {
  const { kernel } = useSearchKernelContext<T>()
  return {
    index: kernel.index,
    search: kernel.search,
    setDriver: kernel.setDriver,
    isReady: kernel.isReady,
  }
}

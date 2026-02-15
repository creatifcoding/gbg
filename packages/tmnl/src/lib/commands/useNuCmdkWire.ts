import { useEffect, useRef, useState, useCallback } from 'react'
import { Data, Effect } from 'effect'
import {
  COMMAND_PROVIDER_ID,
  registerCommandProvider,
} from './CommandProvider'
import {
  TESTBED_WINDOW_PROVIDER_ID,
  registerTestbedWindowProvider,
  WindowManagerService,
  WindowManagerServiceDefault,
} from '@/lib/tauri-windows'
import {
  DOCUMENT_PROVIDER_ID,
  registerDocumentProvider,
} from '@/lib/editor/v3/providers/DocumentProvider'
import { providerRegistry } from '@/lib/minibuffer/v2/providers'

export class NuCmdkProviderRegistrationError extends Data.TaggedError('NuCmdkProviderRegistrationError')<{
  readonly providerId: string
  readonly cause: unknown
}> {}

export interface UseNuCmdkWireOptions {
  readonly debug?: boolean
  readonly onReady?: (providers: ReadonlyArray<string>) => void
  readonly onError?: (error: unknown) => void
}

export interface UseNuCmdkWireResult {
  readonly isReady: boolean
  readonly providers: ReadonlyArray<string>
  readonly rewire: () => void
}

const ensureProviderRegistered = (params: {
  readonly providerId: string
  readonly register: () => void
}): Effect.Effect<boolean, NuCmdkProviderRegistrationError> =>
  Effect.try({
    try: () => {
      const existing = providerRegistry.get(params.providerId as never)
      if (existing) {
        return false
      }
      params.register()
      return true
    },
    catch: (cause) =>
      new NuCmdkProviderRegistrationError({
        providerId: params.providerId,
        cause,
      }),
  })

const checkWindowPoolHealth = (): Effect.Effect<void, never, never> =>
  Effect.gen(function* () {
    const svc = yield* WindowManagerService
    const status = yield* svc.getPoolStatus()

    console.log(`[WindowPool] 🎱 Status: ${status.available}/${status.target_size} windows available`)
    if (status.available === 0) {
      console.error('[WindowPool] ❌ Pool EMPTY - fast path will not work!')
      return
    }

    if (status.available < status.target_size) {
      console.warn(`[WindowPool] ⚠️ Pool partially filled (${status.available}/${status.target_size})`)
      return
    }

    console.log('[WindowPool] ✅ Pool healthy - fast path ready')
  }).pipe(
    Effect.provide(WindowManagerServiceDefault),
    Effect.catchAll((error) => {
      console.warn('[WindowPool] Could not check pool status:', error)
      return Effect.void
    }),
  )

let hasNuCmdkWired = false
let lastNuCmdkProviders: ReadonlyArray<string> = []

export function useNuCmdkWire(options: UseNuCmdkWireOptions = {}): UseNuCmdkWireResult {
  const { debug = false, onReady, onError } = options
  const [isReady, setIsReady] = useState(hasNuCmdkWired)
  const [providers, setProviders] = useState<ReadonlyArray<string>>(lastNuCmdkProviders)
  const wiringRef = useRef(false)

  const wire = useCallback(() => {
    if (wiringRef.current) {
      return
    }
    wiringRef.current = true

    const wireEffect = Effect.gen(function* () {
      const commandRegistered = yield* ensureProviderRegistered({
        providerId: COMMAND_PROVIDER_ID,
        register: () => registerCommandProvider(),
      })

      const testbedRegistered = yield* ensureProviderRegistered({
        providerId: TESTBED_WINDOW_PROVIDER_ID,
        register: () => registerTestbedWindowProvider(),
      })

      const documentRegistered = yield* ensureProviderRegistered({
        providerId: DOCUMENT_PROVIDER_ID,
        register: () => registerDocumentProvider(),
      })

      const registered: Array<string> = []
      if (commandRegistered) registered.push(COMMAND_PROVIDER_ID)
      if (testbedRegistered) registered.push(TESTBED_WINDOW_PROVIDER_ID)
      if (documentRegistered) registered.push(DOCUMENT_PROVIDER_ID)

      if (debug) {
        yield* Effect.log('[useNuCmdkWire] Providers ensured for NuCmdk:', {
          commandRegistered,
          testbedRegistered,
          documentRegistered,
        })
      }

      if (testbedRegistered) {
        setTimeout(() => {
          void Effect.runPromise(checkWindowPoolHealth())
        }, 1500)
      }

      return registered as ReadonlyArray<string>
    }).pipe(
      Effect.catchTag('NuCmdkProviderRegistrationError', (error) =>
        Effect.gen(function* () {
          yield* Effect.logError('[useNuCmdkWire] Provider registration failed', {
            providerId: error.providerId,
            cause: error.cause,
          })
          return [] as ReadonlyArray<string>
        }),
      ),
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          yield* Effect.logError('[useNuCmdkWire] Unexpected wiring error', error)
          return [] as ReadonlyArray<string>
        }),
      ),
    )

    void Effect.runPromise(wireEffect).then((registered) => {
      hasNuCmdkWired = true
      lastNuCmdkProviders = registered

      setProviders(registered)
      setIsReady(true)
      onReady?.(registered)
    }).catch((error) => {
      onError?.(error)
      setIsReady(true)
    })
  }, [debug, onError, onReady])

  useEffect(() => {
    if (hasNuCmdkWired) {
      setIsReady(true)
      setProviders(lastNuCmdkProviders)
      return
    }

    wire()
  }, [wire])

  const rewire = useCallback(() => {
    hasNuCmdkWired = false
    lastNuCmdkProviders = []
    wiringRef.current = false
    setIsReady(false)
    setProviders([])
    wire()
  }, [wire])

  return {
    isReady,
    providers,
    rewire,
  }
}

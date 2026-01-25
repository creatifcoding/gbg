/**
 * Lock Screen Controller
 *
 * Orchestrates the lock screen lifecycle:
 * - Monitors idle state
 * - Shows ASCII wallpaper when locked
 * - Handles authentication flow
 * - Manages unlock transition
 *
 * @module
 */

import { useState, useEffect, useCallback, type ReactNode } from "react"
import { Effect, Schema, Either } from "effect"
import { useAtomValue } from "@effect-atom/atom-react"
import { AsciiScene } from "../aberration"
import {
  idleStateAtom,
  forceLockAtom,
  AuthenticationService,
  type AuthenticationServiceShape,
} from "../services"
import { Atom } from "@effect-atom/atom"
import {
  PasswordCredentials,
  type LoginFormState,
  initialLoginFormState,
} from "../schemas"

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type LockState = "active" | "locked" | "authenticating" | "unlocking"

interface LockScreenControllerProps {
  /** Content to render when unlocked */
  children: ReactNode
  /** Enable lock screen functionality */
  enabled?: boolean
  /** Callback when lock state changes */
  onStateChange?: (state: LockState) => void
  /** Custom authentication service (for DI) */
  authService?: AuthenticationServiceShape
}

// ─────────────────────────────────────────────────────────────
// Authentication Form Component
// ─────────────────────────────────────────────────────────────

interface AuthFormProps {
  onSuccess: () => void
  onCancel: () => void
}

function AuthenticationForm({ onSuccess, onCancel }: AuthFormProps) {
  const [formState, setFormState] = useState<LoginFormState>(initialLoginFormState)

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setFormState((s) => ({ ...s, isSubmitting: true, errors: {} }))

      // Validate with Schema
      const result = Schema.decodeUnknownEither(PasswordCredentials)({
        _tag: "PasswordCredentials",
        email: formState.email,
        password: formState.password,
        rememberMe: formState.rememberMe,
      })

      if (Either.isLeft(result)) {
        // Extract validation errors
        const errors: Record<string, string> = {}
        // Simplified error extraction
        if (!formState.email) errors.email = "Email is required"
        if (!formState.password) errors.password = "Password is required"
        if (formState.password.length < 8)
          errors.password = "Password must be at least 8 characters"

        setFormState((s) => ({ ...s, isSubmitting: false, errors }))
        return
      }

      // Attempt authentication
      const authResult = await Effect.runPromise(
        Effect.gen(function* () {
          const authService = yield* AuthenticationService
          return yield* authService.authenticate(result.right)
        }).pipe(Effect.provide(AuthenticationService.Default))
      ).catch(() => ({
        _tag: "AuthFailure" as const,
        reason: "network_error" as const,
        message: "Network error occurred",
        retryAfter: { _tag: "None" as const },
        attemptsRemaining: { _tag: "None" as const },
      }))

      if (authResult._tag === "AuthSuccess") {
        onSuccess()
      } else if (authResult._tag === "AuthFailure") {
        setFormState((s) => ({
          ...s,
          isSubmitting: false,
          errors: { form: authResult.message },
        }))
      }
    },
    [formState.email, formState.password, formState.rememberMe, onSuccess]
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border border-zinc-700 bg-zinc-900 p-8 shadow-2xl">
        <h2
          className="mb-6 text-center font-mono text-2xl font-bold text-zinc-100"
          style={{ fontFamily: "var(--font-display)" }}
        >
          UNLOCK TERMINAL
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {formState.errors.form && (
            <div className="rounded border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-400">
              {formState.errors.form}
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm text-zinc-400"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={formState.email}
              onChange={(e) =>
                setFormState((s) => ({ ...s, email: e.target.value }))
              }
              className="w-full rounded border border-zinc-700 bg-zinc-800 px-4 py-2 font-mono text-zinc-100 focus:border-cyan-500 focus:outline-none"
              placeholder="demo@selfcharters.com"
              disabled={formState.isSubmitting}
            />
            {formState.errors.email && (
              <p className="mt-1 text-xs text-red-400">
                {formState.errors.email}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm text-zinc-400"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={formState.password}
              onChange={(e) =>
                setFormState((s) => ({ ...s, password: e.target.value }))
              }
              className="w-full rounded border border-zinc-700 bg-zinc-800 px-4 py-2 font-mono text-zinc-100 focus:border-cyan-500 focus:outline-none"
              placeholder="password123"
              disabled={formState.isSubmitting}
            />
            {formState.errors.password && (
              <p className="mt-1 text-xs text-red-400">
                {formState.errors.password}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              id="rememberMe"
              type="checkbox"
              checked={formState.rememberMe}
              onChange={(e) =>
                setFormState((s) => ({ ...s, rememberMe: e.target.checked }))
              }
              className="rounded border-zinc-600 bg-zinc-800"
              disabled={formState.isSubmitting}
            />
            <label htmlFor="rememberMe" className="text-sm text-zinc-400">
              Remember me
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded border border-zinc-600 px-4 py-2 text-zinc-400 transition hover:bg-zinc-800"
              disabled={formState.isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 rounded bg-cyan-600 px-4 py-2 font-medium text-white transition hover:bg-cyan-500 disabled:opacity-50"
              disabled={formState.isSubmitting}
            >
              {formState.isSubmitting ? "Unlocking..." : "Unlock"}
            </button>
          </div>
        </form>

        <p className="mt-6 text-center text-xs text-zinc-500">
          Demo credentials: demo@selfcharters.com / password123
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Lock Screen Controller
// ─────────────────────────────────────────────────────────────

export function LockScreenController({
  children,
  enabled = true,
  onStateChange,
}: LockScreenControllerProps) {
  const [lockState, setLockState] = useState<LockState>("active")
  const idleState = useAtomValue(idleStateAtom)

  // Watch forceLock atom (set by system.lockScreen command)
  const forceLock = useAtomValue(forceLockAtom)

  // Sync with idle detection
  useEffect(() => {
    if (!enabled) return

    if (idleState === "idle" && lockState === "active") {
      setLockState("locked")
    }
  }, [idleState, lockState, enabled])

  // Sync with force lock (from command)
  useEffect(() => {
    if (!enabled) return

    if (forceLock && lockState === "active") {
      setLockState("locked")
      // Reset the atom so it can be triggered again
      Atom.set(forceLockAtom, false)
    }
  }, [forceLock, lockState, enabled])

  // Notify parent of state changes
  useEffect(() => {
    onStateChange?.(lockState)
  }, [lockState, onStateChange])

  // Handle successful authentication
  const handleAuthSuccess = useCallback(() => {
    setLockState("unlocking")
    // Transition animation
    setTimeout(() => {
      setLockState("active")
    }, 500)
  }, [])

  // Handle cancel (return to wallpaper)
  const handleAuthCancel = useCallback(() => {
    setLockState("locked")
  }, [])

  // Handle click on wallpaper to show auth
  const handleWallpaperInteract = useCallback(() => {
    setLockState("authenticating")
  }, [])

  // Keyboard shortcut to lock (Ctrl+L or Super+L)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "l") {
        e.preventDefault()
        if (lockState === "active") {
          setLockState("locked")
        }
      }
      // Escape to cancel auth
      if (e.key === "Escape" && lockState === "authenticating") {
        setLockState("locked")
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [lockState])

  // Render based on state
  if (!enabled || lockState === "active") {
    return <>{children}</>
  }

  if (lockState === "unlocking") {
    return (
      <div className="fixed inset-0 z-50 animate-fade-out bg-black">
        {children}
      </div>
    )
  }

  return (
    <>
      {/* Wallpaper - always visible when locked */}
      <div
        className="fixed inset-0 z-40 cursor-pointer"
        onClick={handleWallpaperInteract}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && handleWallpaperInteract()}
        aria-label="Click to unlock"
      >
        <AsciiScene />

        {/* Unlock hint */}
        {lockState === "locked" && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-pulse">
            <p className="font-mono text-sm text-zinc-400">
              Click anywhere or press any key to unlock
            </p>
          </div>
        )}
      </div>

      {/* Auth overlay */}
      {lockState === "authenticating" && (
        <AuthenticationForm
          onSuccess={handleAuthSuccess}
          onCancel={handleAuthCancel}
        />
      )}
    </>
  )
}

export default LockScreenController

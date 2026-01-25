# Selfcharters Splash / Lock Screen Architecture

## Overview

A wallpaper/splash subsystem that activates on idle, displays the ASCII aberration scene, and requires authentication to unlock. Supports multiple auth strategies via dependency injection.

---

## System Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         TMNL Application                             │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      IdleDetectionService                            │
│  ─────────────────────────────────────────────────────────────────  │
│  • Monitors: mousemove, keydown, scroll, touchstart                  │
│  • Configurable timeout (default: 5 minutes)                         │
│  • Emits: onIdle, onActive                                           │
└─────────────────────────────────────────────────────────────────────┘
                                    │ onIdle
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        LockScreenController                          │
│  ─────────────────────────────────────────────────────────────────  │
│  States: active | locked | authenticating | unlocking                │
│  Transitions via XState machine                                      │
└─────────────────────────────────────────────────────────────────────┘
                                    │
              ┌─────────────────────┴─────────────────────┐
              ▼                                           ▼
┌─────────────────────────┐               ┌─────────────────────────┐
│     AsciiScene          │               │   AuthenticationForm    │
│   (Wallpaper Mode)      │               │  (Unlock Interface)     │
│                         │               │                         │
│  • TorusKnot geometry   │               │  • Schema-validated     │
│  • ASCII postprocessing │               │  • Multiple strategies  │
│  • Hand gesture control │               │  • Effect-based errors  │
└─────────────────────────┘               └─────────────────────────┘
              │                                           │
              ▼                                           ▼
┌─────────────────────────┐               ┌─────────────────────────┐
│   MediaPipeService      │               │ AuthenticationService   │
│                         │               │                         │
│  • Hand landmark detect │               │  ┌──────────────────┐   │
│  • Gesture recognition  │               │  │PasswordStrategy  │   │
│  • 3D rotation control  │               │  ├──────────────────┤   │
└─────────────────────────┘               │  │BiometricStrategy │   │
                                          │  ├──────────────────┤   │
                                          │  │FacialRecogStrategy│  │
                                          │  └──────────────────┘   │
                                          │  (Swappable via Layer)  │
                                          └─────────────────────────┘
```

---

## Services

### 1. IdleDetectionService

Monitors user activity and triggers lock screen after configurable timeout.

```typescript
class IdleDetectionService extends Effect.Service<IdleDetectionService>()(
  "tmnl/splash/IdleDetectionService",
  {
    effect: Effect.gen(function* () {
      const config = yield* IdleConfig

      return {
        start: () => Effect.sync(() => { /* attach listeners */ }),
        stop: () => Effect.sync(() => { /* detach listeners */ }),
        onIdle: Stream.async<void>(...),
        onActive: Stream.async<void>(...),
        resetTimer: () => Effect.sync(() => { /* reset timeout */ }),
      }
    }),
    dependencies: [IdleConfig.Default],
  }
) {}
```

### 2. AuthenticationService (Strategy Pattern)

Swappable authentication implementations via Layer injection.

```typescript
// Core interface
interface Authenticator {
  readonly authenticate: (credentials: unknown) => Effect.Effect<User, AuthError>
  readonly supports: (type: AuthType) => boolean
}

class AuthenticatorTag extends Context.Tag("tmnl/auth/Authenticator")<
  AuthenticatorTag,
  Authenticator
>() {}

// Strategy implementations as Layers
const PasswordAuthenticator = Layer.succeed(AuthenticatorTag, { ... })
const BiometricAuthenticator = Layer.succeed(AuthenticatorTag, { ... })
const FacialRecognitionAuthenticator = Layer.succeed(AuthenticatorTag, { ... })

// Dynamic selection via LayerMap
class AuthStrategies extends LayerMap.Service<AuthStrategies>()(
  "tmnl/auth/Strategies",
  {
    provides: AuthenticatorTag,
    lookup: (strategy: string) => {
      switch (strategy) {
        case "password": return PasswordAuthenticator
        case "biometric": return BiometricAuthenticator
        case "facial": return FacialRecognitionAuthenticator
      }
    },
  }
) {}
```

### 3. MediaPipeService

Hand tracking and gesture recognition for 3D control.

```typescript
class MediaPipeService extends Effect.Service<MediaPipeService>()(
  "tmnl/splash/MediaPipeService",
  {
    effect: Effect.gen(function* () {
      return {
        // Initialize MediaPipe Hands
        initialize: () => Effect.tryPromise(() => import("@mediapipe/hands")),

        // Start tracking from video element
        startTracking: (videoEl: HTMLVideoElement) => Effect.async(...),

        // Stop tracking
        stopTracking: () => Effect.sync(...),

        // Stream of hand landmarks (21 points per hand)
        landmarks$: Stream.async<HandLandmarks>(...),

        // Derived gesture stream (pinch, swipe, rotate)
        gestures$: Stream.async<Gesture>(...),
      }
    }),
  }
) {}
```

---

## Schemas

### LoginCredentials

```typescript
import { Schema } from "effect"

const Email = Schema.String.pipe(
  Schema.nonEmptyString({ message: () => "Email is required" }),
  Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, {
    message: () => "Invalid email format"
  })
)

const Password = Schema.String.pipe(
  Schema.nonEmptyString({ message: () => "Password is required" }),
  Schema.minLength(8, {
    message: () => "Password must be at least 8 characters"
  })
)

const LoginCredentials = Schema.Struct({
  email: Email,
  password: Password,
})

type LoginCredentials = typeof LoginCredentials.Type
```

### BiometricCredentials

```typescript
const BiometricCredentials = Schema.Struct({
  type: Schema.Literal("fingerprint", "face"),
  token: Schema.String,
  timestamp: Schema.DateFromNumber,
})
```

### AuthResult

```typescript
const AuthResult = Schema.Union(
  Schema.TaggedStruct("Success", {
    user: User,
    sessionToken: Schema.String,
  }),
  Schema.TaggedStruct("Failure", {
    reason: Schema.Literal("invalid_credentials", "locked_out", "expired"),
    message: Schema.String,
  })
)
```

---

## XState Lock Screen Machine

```typescript
const lockScreenMachine = createMachine({
  id: "lockScreen",
  initial: "active",
  states: {
    active: {
      on: { IDLE_TIMEOUT: "locked" },
    },
    locked: {
      initial: "wallpaper",
      states: {
        wallpaper: {
          // ASCII scene with hand gesture control
          on: {
            INTERACT: "authenticate",
            GESTURE_DETECTED: { actions: "updateRotation" },
          },
        },
        authenticate: {
          // Show auth form overlay
          on: {
            AUTH_SUCCESS: "#lockScreen.unlocking",
            AUTH_FAILURE: { actions: "showError" },
            CANCEL: "wallpaper",
          },
        },
      },
    },
    unlocking: {
      // Transition animation
      after: { 500: "active" },
    },
  },
})
```

---

## MediaPipe Hand Gesture Control

Based on research from [Codrops](https://tympanus.net/codrops/2024/10/24/creating-a-3d-hand-controller-using-a-webcam-with-mediapipe-and-three-js/) and [threejs-handtracking-101](https://github.com/collidingScopes/threejs-handtracking-101):

### Gesture Mapping

| Gesture | Action |
|---------|--------|
| Open palm | Enable tracking |
| Closed fist | Disable tracking |
| Pinch (thumb + index) | Zoom |
| Rotate palm | Rotate 3D scene |
| Swipe left/right | Cycle effects |
| Point up | Trigger unlock UI |

### Implementation Pattern

```typescript
const useHandGestures = (meshRef: RefObject<Mesh>) => {
  const mediaPipe = useService(MediaPipeService)

  useEffect(() => {
    const subscription = mediaPipe.gestures$.pipe(
      Stream.filter((g) => g.type === "rotate"),
      Stream.map((g) => g.rotation),
    ).subscribe((rotation) => {
      if (meshRef.current) {
        meshRef.current.rotation.y = rotation.y
        meshRef.current.rotation.x = rotation.x
      }
    })

    return () => subscription.unsubscribe()
  }, [])
}
```

---

## File Structure

```
src/components/splash/
├── SPLASH_ARCHITECTURE.md     # This document
├── aberration/
│   ├── ascii-effect.tsx       # ✓ Created - Shader + Effect class
│   ├── ascii-scene.tsx        # ✓ Created - Canvas + EffectComposer
│   └── index.ts               # ✓ Created - Exports
├── lock/
│   ├── LockScreenController.tsx   # XState machine + orchestration
│   ├── LockScreenOverlay.tsx      # Full-screen lock UI
│   ├── AuthenticationForm.tsx     # Schema-validated form
│   └── index.ts
├── gestures/
│   ├── MediaPipeService.ts        # Hand tracking service
│   ├── useHandGestures.ts         # React hook for 3D control
│   ├── GestureRecognizer.ts       # Gesture classification
│   └── index.ts
├── services/
│   ├── IdleDetectionService.ts    # Activity monitoring
│   ├── AuthenticationService.ts   # DI-based auth
│   ├── strategies/
│   │   ├── PasswordStrategy.ts
│   │   ├── BiometricStrategy.ts
│   │   └── FacialRecognitionStrategy.ts
│   └── index.ts
├── schemas/
│   ├── credentials.ts         # Login, Biometric schemas
│   ├── auth-result.ts         # Success/Failure union
│   └── index.ts
├── atoms/
│   └── index.ts               # Lock screen state atoms
└── index.ts                   # Public exports
```

---

## Dependencies

### Installed
- `three` - 3D rendering
- `@react-three/fiber` - React renderer for Three.js
- `@react-three/drei` - Useful helpers
- `@react-three/postprocessing` - Post-processing effects
- `postprocessing` - Effect composer

### To Install
- `@mediapipe/hands` - Hand landmark detection
- `@mediapipe/tasks-vision` - Modern MediaPipe API (recommended)
- `react-idle-timer` - Idle detection (or custom hook)

---

## Next Steps

1. **[DONE]** Create ascii-effect.tsx and ascii-scene.tsx
2. **[IN PROGRESS]** Create schemas for form validation
3. Create AuthenticationService with strategy pattern
4. Create IdleDetectionService
5. Create LockScreenController with XState
6. Install and integrate MediaPipe
7. Create useHandGestures hook
8. Wire everything together in LockScreenOverlay
9. Add route or global wrapper for lock screen

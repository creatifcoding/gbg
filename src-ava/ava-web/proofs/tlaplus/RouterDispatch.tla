-------------------------- MODULE RouterDispatch -------------------------
(*
 * Router dispatch pipeline specification.
 *
 * Models the complete request dispatch path through the ava-web Router
 * (router.rs:314-377), including:
 *   1. State injection into extensions
 *   2. Middleware chain execution (LIFO order)
 *   3. Radix tree route matching (matchit)
 *   4. Method-based handler dispatch
 *   5. Nested router delegation
 *   6. Fallback handler
 *
 * This module focuses on the DISPATCH DECISION TREE rather than
 * individual connection lifecycle. It verifies:
 *   - Exactly one response is produced per request
 *   - Route matching precedence is correct
 *   - State is available before middleware runs
 *   - Method not allowed vs not found distinction
 *
 * Reference:
 *   router.rs:314-377  — Router.handle() + dispatch_inner()
 *   router.rs:35-52    — Route.dispatch() (method matching)
 *   router.rs:364-369  — Nested router delegation
 *)
EXTENDS Naturals, Sequences, FiniteSets

------------------------------------------------------------------------
(* ── Constants ─────────────────────────────────────────────────────── *)

CONSTANTS
    NumRoutes,         \* Number of registered routes in the radix tree
    NumNestedRouters,  \* Number of nested sub-routers
    HasFallback,       \* Whether a fallback handler is configured
    HasState,          \* Whether with_state() was called
    NumMiddlewares     \* Number of middleware layers

ASSUME NumRoutes \in Nat
ASSUME NumNestedRouters \in Nat
ASSUME HasFallback \in BOOLEAN
ASSUME HasState \in BOOLEAN
ASSUME NumMiddlewares \in Nat

------------------------------------------------------------------------
(* ── Variables ─────────────────────────────────────────────────────── *)

VARIABLES
    phase,             \* Current dispatch phase
    stateInjected,     \* Whether state was injected into extensions
    middlewareRun,     \* Whether middleware chain was executed
    routeMatched,      \* Whether matchit found a route
    methodMatched,     \* Whether the method was valid for the matched route
    nestedMatched,     \* Whether a nested router handled the request
    responseProduced,  \* Whether a response was produced
    responseStatus     \* The response status class

vars == <<phase, stateInjected, middlewareRun, routeMatched,
          methodMatched, nestedMatched, responseProduced, responseStatus>>

------------------------------------------------------------------------
(* ── Phases ────────────────────────────────────────────────────────── *)

Phases == {
    "INIT",
    "STATE_INJECTION",
    "MIDDLEWARE",
    "ROUTE_MATCH",
    "METHOD_DISPATCH",
    "NESTED_CHECK",
    "FALLBACK",
    "RESPONSE",
    "DONE"
}

StatusClasses == {"2xx", "4xx_NOT_FOUND", "4xx_METHOD_NOT_ALLOWED",
                  "4xx_BAD_REQUEST", "5xx_ERROR", "MIDDLEWARE_RESPONSE"}

------------------------------------------------------------------------
(* ── Type Invariant ────────────────────────────────────────────────── *)

TypeInvariant ==
    /\ phase \in Phases
    /\ stateInjected \in BOOLEAN
    /\ middlewareRun \in BOOLEAN
    /\ routeMatched \in BOOLEAN
    /\ methodMatched \in BOOLEAN
    /\ nestedMatched \in BOOLEAN
    /\ responseProduced \in BOOLEAN
    /\ responseStatus \in StatusClasses \cup {"NONE"}

------------------------------------------------------------------------
(* ── Initial State ─────────────────────────────────────────────────── *)

Init ==
    /\ phase = "INIT"
    /\ stateInjected = FALSE
    /\ middlewareRun = FALSE
    /\ routeMatched = FALSE
    /\ methodMatched = FALSE
    /\ nestedMatched = FALSE
    /\ responseProduced = FALSE
    /\ responseStatus = "NONE"

------------------------------------------------------------------------
(* ── Actions ───────────────────────────────────────────────────────── *)

(*
 * InjectState: If configured, inject typed state into request extensions.
 * Reference: router.rs:316-318
 * "Inject state into extensions (before middleware, so middleware can see it)"
 *)
InjectState ==
    /\ phase = "INIT"
    /\ phase' = "STATE_INJECTION"
    /\ stateInjected' = HasState  \* Injected iff configured
    /\ UNCHANGED <<middlewareRun, routeMatched, methodMatched,
                   nestedMatched, responseProduced, responseStatus>>

(*
 * RunMiddleware: Execute the middleware chain.
 * If no middleware, skip to route matching.
 * Reference: router.rs:321-329
 *)
RunMiddleware ==
    /\ phase = "STATE_INJECTION"
    /\ NumMiddlewares > 0
    /\ phase' = "MIDDLEWARE"
    /\ middlewareRun' = TRUE
    /\ UNCHANGED <<stateInjected, routeMatched, methodMatched,
                   nestedMatched, responseProduced, responseStatus>>

SkipMiddleware ==
    /\ phase = "STATE_INJECTION"
    /\ NumMiddlewares = 0
    /\ phase' = "ROUTE_MATCH"
    /\ UNCHANGED <<stateInjected, middlewareRun, routeMatched, methodMatched,
                   nestedMatched, responseProduced, responseStatus>>

(*
 * MiddlewareShortCircuit: Middleware returned a response directly.
 * Examples: RateLimiter (429), MaxBodySize (413), auth middleware (403).
 *)
MiddlewareShortCircuit ==
    /\ phase = "MIDDLEWARE"
    /\ phase' = "RESPONSE"
    /\ responseProduced' = TRUE
    /\ responseStatus' = "MIDDLEWARE_RESPONSE"
    /\ UNCHANGED <<stateInjected, middlewareRun, routeMatched,
                   methodMatched, nestedMatched>>

(*
 * MiddlewarePassthrough: Middleware called next.run() — proceed to routing.
 *)
MiddlewarePassthrough ==
    /\ phase = "MIDDLEWARE"
    /\ phase' = "ROUTE_MATCH"
    /\ UNCHANGED <<stateInjected, middlewareRun, routeMatched, methodMatched,
                   nestedMatched, responseProduced, responseStatus>>

(*
 * RouteMatch: matchit radix tree lookup.
 * Reference: router.rs:352-361
 *)
RouteMatchFound ==
    /\ phase = "ROUTE_MATCH"
    /\ NumRoutes > 0
    /\ phase' = "METHOD_DISPATCH"
    /\ routeMatched' = TRUE
    /\ UNCHANGED <<stateInjected, middlewareRun, methodMatched,
                   nestedMatched, responseProduced, responseStatus>>

RouteMatchMiss ==
    /\ phase = "ROUTE_MATCH"
    /\ phase' = "NESTED_CHECK"
    /\ routeMatched' = FALSE
    /\ UNCHANGED <<stateInjected, middlewareRun, methodMatched,
                   nestedMatched, responseProduced, responseStatus>>

(*
 * MethodDispatch: Check if the matched route has a handler for this method.
 * Reference: router.rs:35-52 (Route.dispatch)
 *)
MethodFound ==
    /\ phase = "METHOD_DISPATCH"
    /\ phase' = "RESPONSE"
    /\ methodMatched' = TRUE
    /\ responseProduced' = TRUE
    /\ responseStatus' = "2xx"  \* Handler produces a success response
    /\ UNCHANGED <<stateInjected, middlewareRun, routeMatched, nestedMatched>>

MethodNotAllowed ==
    /\ phase = "METHOD_DISPATCH"
    /\ phase' = "RESPONSE"
    /\ methodMatched' = FALSE
    /\ responseProduced' = TRUE
    /\ responseStatus' = "4xx_METHOD_NOT_ALLOWED"
    /\ UNCHANGED <<stateInjected, middlewareRun, routeMatched, nestedMatched>>

(*
 * NestedRouterCheck: Try nested sub-routers.
 * Reference: router.rs:364-369
 *)
NestedRouterHit ==
    /\ phase = "NESTED_CHECK"
    /\ NumNestedRouters > 0
    /\ phase' = "RESPONSE"
    /\ nestedMatched' = TRUE
    /\ responseProduced' = TRUE
    /\ responseStatus' = "2xx"  \* Nested router handled it
    /\ UNCHANGED <<stateInjected, middlewareRun, routeMatched, methodMatched>>

NestedRouterMiss ==
    /\ phase = "NESTED_CHECK"
    /\ phase' = "FALLBACK"
    /\ nestedMatched' = FALSE
    /\ UNCHANGED <<stateInjected, middlewareRun, routeMatched, methodMatched,
                   responseProduced, responseStatus>>

(*
 * Fallback: Use fallback handler or return 404.
 * Reference: router.rs:372-376
 *)
FallbackHandler ==
    /\ phase = "FALLBACK"
    /\ HasFallback = TRUE
    /\ phase' = "RESPONSE"
    /\ responseProduced' = TRUE
    /\ responseStatus' = "2xx"  \* Fallback handler ran
    /\ UNCHANGED <<stateInjected, middlewareRun, routeMatched,
                   methodMatched, nestedMatched>>

NotFound ==
    /\ phase = "FALLBACK"
    /\ HasFallback = FALSE
    /\ phase' = "RESPONSE"
    /\ responseProduced' = TRUE
    /\ responseStatus' = "4xx_NOT_FOUND"
    /\ UNCHANGED <<stateInjected, middlewareRun, routeMatched,
                   methodMatched, nestedMatched>>

(*
 * Done: Response has been produced — terminal.
 *)
Done ==
    /\ phase = "RESPONSE"
    /\ responseProduced = TRUE
    /\ phase' = "DONE"
    /\ UNCHANGED <<stateInjected, middlewareRun, routeMatched,
                   methodMatched, nestedMatched, responseProduced, responseStatus>>

------------------------------------------------------------------------
(* ── Next-State Relation ───────────────────────────────────────────── *)

(*
 * Terminal: DONE is an absorbing state — explicit stuttering step.
 *)
Terminal ==
    /\ phase = "DONE"
    /\ UNCHANGED vars

Next ==
    \/ InjectState
    \/ RunMiddleware
    \/ SkipMiddleware
    \/ MiddlewareShortCircuit
    \/ MiddlewarePassthrough
    \/ RouteMatchFound
    \/ RouteMatchMiss
    \/ MethodFound
    \/ MethodNotAllowed
    \/ NestedRouterHit
    \/ NestedRouterMiss
    \/ FallbackHandler
    \/ NotFound
    \/ Done
    \/ Terminal

------------------------------------------------------------------------
(* ── Fairness ──────────────────────────────────────────────────────── *)

Fairness == WF_vars(Next)

------------------------------------------------------------------------
(* ── Specification ─────────────────────────────────────────────────── *)

Spec == Init /\ [][Next]_vars /\ Fairness

------------------------------------------------------------------------
(* ── Safety Properties ─────────────────────────────────────────────── *)

(*
 * S1: Exactly one response per request.
 * Once responseProduced is TRUE, responseStatus is not NONE.
 *)
ExactlyOneResponse ==
    responseProduced => responseStatus # "NONE"

(*
 * S2: State injection happens before middleware.
 * If middleware ran, state was already injected (if configured).
 *)
StateBeforeMiddleware ==
    middlewareRun => (HasState => stateInjected)

(*
 * S3: Middleware runs before route dispatch.
 * If route was matched, either middleware ran or was skipped.
 *)
MiddlewareBeforeRouting ==
    routeMatched => (middlewareRun \/ NumMiddlewares = 0)

(*
 * S4: Dispatch precedence: route match > nested > fallback > 404.
 * If a route matched, nested routers were not consulted.
 *)
DispatchPrecedence ==
    /\ (routeMatched => ~nestedMatched)
    /\ (nestedMatched => ~routeMatched)

(*
 * S5: 405 only when route exists but method doesn't.
 * Reference: router.rs:43-48
 *)
MethodNotAllowedRequiresRoute ==
    responseStatus = "4xx_METHOD_NOT_ALLOWED" => routeMatched

(*
 * S6: 404 only when nothing matched and no fallback.
 * Reference: router.rs:376
 *)
NotFoundRequiresNoMatch ==
    responseStatus = "4xx_NOT_FOUND" =>
        /\ ~routeMatched
        /\ ~nestedMatched
        /\ ~HasFallback

------------------------------------------------------------------------
(* ── Liveness Properties ───────────────────────────────────────────── *)

(*
 * L1: Every request eventually produces a response.
 *)
EventualResponse ==
    phase = "INIT" ~> phase = "DONE"

==========================================================================

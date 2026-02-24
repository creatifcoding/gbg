import AvaWeb.Types

/-!
# Middleware Monoid Proof

Proves that `Middleware := Handler -> Handler` forms a **monoid** under
function composition, with `id` as the identity element.

## Correspondence to Rust

The Rust middleware system (middleware.rs:19) uses trait objects.
The `MiddlewareStack` (middleware.rs:375) composes middlewares by chaining
`handle` calls. We model the *denotational semantics*: after awaiting all
futures, a middleware is equivalent to `Handler -> Handler`.

## Key Results

1. **Monoid laws** -- associativity + left/right identity
2. **StatusPreserving composition** -- composition preserves status codes
3. **HeaderPreserving composition** -- composition preserves specific headers
4. **Short-circuit isolation** -- short-circuiting ignores inner handler
-/

namespace AvaWeb.Middleware

open AvaWeb

-- ── Core Definition ──────────────────────────────────────────────────────────

/-- Middleware transforms a handler into a new handler.
    This is the denotational model of the async Rust trait. -/
def Middleware := Handler → Handler

-- ── Monoid Structure ─────────────────────────────────────────────────────────

/-- Middleware composition: apply `m1` after `m2`.
    Matches Rust `MiddlewareStack` layering order. -/
def Middleware.comp (m1 m2 : Middleware) : Middleware :=
  fun h => m1 (m2 h)

/-- Identity middleware: pass through to the inner handler unchanged. -/
def Middleware.identity : Middleware := id

/-- Middleware composition is associative. -/
theorem comp_assoc (f g h : Middleware) :
    Middleware.comp (Middleware.comp f g) h = Middleware.comp f (Middleware.comp g h) := by
  rfl

/-- Left identity: `identity.comp f = f`. -/
theorem identity_comp (f : Middleware) : Middleware.comp Middleware.identity f = f := by
  rfl

/-- Right identity: `f.comp identity = f`. -/
theorem comp_identity (f : Middleware) : Middleware.comp f Middleware.identity = f := by
  rfl

-- ── Semantic Property: Status Preservation ──────────────────────────────────

/-- A middleware preserves HTTP status codes if, for every handler and request,
    the wrapped handler returns the same status as the unwrapped one. -/
def StatusPreserving (m : Middleware) : Prop :=
  ∀ (h : Handler) (req : Request), (m h req).status = (h req).status

/-- If both m1 and m2 preserve status, then their composition preserves status. -/
theorem compose_preserves_status (m1 m2 : Middleware)
    (h1 : StatusPreserving m1) (h2 : StatusPreserving m2) :
    StatusPreserving (Middleware.comp m1 m2) := by
  intro h req
  show (m1 (m2 h) req).status = (h req).status
  have step1 : (m1 (m2 h) req).status = ((m2 h) req).status := h1 (m2 h) req
  have step2 : ((m2 h) req).status = (h req).status := h2 h req
  rw [step1, step2]

/-- Identity middleware trivially preserves status. -/
theorem id_preserves_status : StatusPreserving Middleware.identity := by
  intro h req
  rfl

-- ── Semantic Property: Header Preservation ──────────────────────────────────

/-- A middleware preserves a specific header if the header value in the
    response is unchanged after wrapping. -/
def HeaderPreserving (m : Middleware) (headerKey : String) : Prop :=
  ∀ (h : Handler) (req : Request),
    HeaderMap.get (m h req).headers headerKey = HeaderMap.get (h req).headers headerKey

/-- Composition of header-preserving middlewares preserves the header. -/
theorem compose_preserves_header (m1 m2 : Middleware) (key : String)
    (h1 : HeaderPreserving m1 key) (h2 : HeaderPreserving m2 key) :
    HeaderPreserving (Middleware.comp m1 m2) key := by
  intro h req
  show HeaderMap.get (m1 (m2 h) req).headers key = HeaderMap.get (h req).headers key
  have step1 := h1 (m2 h) req
  have step2 := h2 h req
  rw [step1, step2]

-- ── Semantic Property: Body Preservation ────────────────────────────────────

/-- A middleware preserves the response body. -/
def BodyPreserving (m : Middleware) : Prop :=
  ∀ (h : Handler) (req : Request), (m h req).body = (h req).body

/-- Composition of body-preserving middlewares preserves the body. -/
theorem compose_preserves_body (m1 m2 : Middleware)
    (h1 : BodyPreserving m1) (h2 : BodyPreserving m2) :
    BodyPreserving (Middleware.comp m1 m2) := by
  intro h req
  show (m1 (m2 h) req).body = (h req).body
  rw [h1 (m2 h) req, h2 h req]

-- ── Short-Circuit Model ─────────────────────────────────────────────────────

/-- A middleware short-circuits if it never calls the inner handler. -/
def ShortCircuits (m : Middleware) : Prop :=
  ∃ (fixedResp : Request → Response), ∀ (h : Handler) (req : Request),
    m h req = fixedResp req

/-- If a middleware short-circuits, its output is independent of the
    inner handler. -/
theorem short_circuit_ignores_handler (m : Middleware)
    (hsc : ShortCircuits m) (h1 h2 : Handler) (req : Request) :
    m h1 req = m h2 req := by
  obtain ⟨fixedResp, hfixed⟩ := hsc
  rw [hfixed h1 req, hfixed h2 req]

-- ── Stack Composition (n-ary) ───────────────────────────────────────────────

/-- Compose a list of middlewares into a single middleware.
    Empty stack = identity. Order: first in list = outermost. -/
def stack : List Middleware → Middleware
  | [] => Middleware.identity
  | m :: ms => Middleware.comp m (stack ms)

/-- Empty stack is identity. -/
theorem stack_nil : stack [] = Middleware.identity := by
  rfl

/-- Singleton stack is the middleware itself. -/
theorem stack_singleton (m : Middleware) : stack [m] = m := by
  simp [stack, Middleware.comp, Middleware.identity]
  funext h
  rfl

/-- If all middlewares in a list preserve status, the composed stack
    preserves status. -/
theorem stack_preserves_status :
    ∀ (ms : List Middleware),
    (∀ (m : Middleware), m ∈ ms → StatusPreserving m) →
    StatusPreserving (stack ms)
  | [], _ => id_preserves_status
  | m :: ms, hall => by
    have hm : StatusPreserving m := hall m (List.mem_cons_self m ms)
    have hrest : StatusPreserving (stack ms) :=
      stack_preserves_status ms (fun m' hm' => hall m' (List.mem_cons_of_mem m hm'))
    exact compose_preserves_status m (stack ms) hm hrest

end AvaWeb.Middleware

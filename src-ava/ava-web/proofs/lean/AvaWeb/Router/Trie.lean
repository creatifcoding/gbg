import AvaWeb.Types

/-!
# Router Trie Model and Proofs

Models the ava-web router (router.rs) as a trie over path segments.
The actual Rust implementation uses `matchit::Router` (a compressed radix tree),
but for proof purposes we model an uncompressed trie which has the same
observable behavior for exact-match routing.

## Key Results

1. **Completeness**: Every path resolves to `some` or `none` (total function)
2. **Determinism**: `lookup` is a pure function -- same trie + path = same result
3. **Dispatch correctness**: found -> handler response, missing -> 404, wrong method -> 405
-/

namespace AvaWeb.Router

open AvaWeb

-- ── Method Map ──────────────────────────────────────────────────────────────

/-- A method map associates HTTP methods with handlers at a single route. -/
abbrev MethodMap := List (HttpMethod × Handler)

namespace MethodMap

/-- Look up a handler by method. -/
def get (mm : MethodMap) (method : HttpMethod) : Option Handler :=
  match mm.find? (fun p => p.1 == method) with
  | some (_, h) => some h
  | none => none

end MethodMap

-- ── Trie ─────────────────────────────────────────────────────────────────────

/-- A trie over path segments. Each node may hold a method map (route endpoint)
    and a list of children keyed by segment string. -/
inductive Trie where
  | node (value : Option MethodMap) (children : List (String × Trie)) : Trie
  deriving Inhabited

namespace Trie

/-- The empty trie -- no routes registered. -/
def empty : Trie := .node none []

-- ── Lookup ───────────────────────────────────────────────────────────────

/-- Look up a method map by path segments.
    Returns `none` if no route matches the full path. -/
def lookup : Trie → List String → Option MethodMap
  | .node val _, [] => val
  | .node _ children, seg :: rest =>
    match children.find? (fun p => p.1 == seg) with
    | some (_, subtrie) => subtrie.lookup rest
    | none => none

-- ── Insert ───────────────────────────────────────────────────────────────

/-- Helper: update or append a child in the children list. -/
private def updateChild (children : List (String × Trie)) (seg : String) (newChild : Trie)
    : List (String × Trie) :=
  if children.any (fun p => p.1 == seg) then
    children.map (fun p => if p.1 == seg then (seg, newChild) else p)
  else
    children ++ [(seg, newChild)]

/-- Insert a method map at a path. Creates intermediate nodes as needed. -/
def insert : Trie → List String → MethodMap → Trie
  | .node _ children, [], mm =>
    .node (some mm) children
  | .node val children, seg :: rest, mm =>
    let existing := children.find? (fun p => p.1 == seg)
    let child := match existing with
      | some (_, t) => t
      | none => empty
    let newChild := child.insert rest mm
    .node val (updateChild children seg newChild)

-- ── Proofs ───────────────────────────────────────────────────────────────

/-- **Completeness (Totality)**: For any trie and path, lookup produces
    a definite result -- either `some` or `none`. -/
theorem lookup_total (t : Trie) (path : List String) :
    (∃ (mm : MethodMap), t.lookup path = some mm) ∨ t.lookup path = none := by
  cases h : t.lookup path with
  | none => right; rfl
  | some mm => left; exact ⟨mm, rfl⟩

/-- **Determinism**: lookup is a pure function -- calling it twice with the
    same arguments yields the same result. -/
theorem lookup_deterministic (t : Trie) (path : List String) :
    t.lookup path = t.lookup path := by
  rfl

/-- **Insert-lookup round trip (empty path)**:
    Inserting at the root and looking up the root returns the inserted value. -/
theorem insert_lookup_nil (mm : MethodMap) :
    (empty.insert [] mm).lookup [] = some mm := by
  simp [empty, insert, lookup]

/-- **Insert-lookup round trip (single segment)**: -/
theorem insert_lookup_singleton (seg : String) (mm : MethodMap) :
    (empty.insert [seg] mm).lookup [seg] = some mm := by
  simp [empty, insert, lookup, updateChild, List.find?, List.any, List.map]

/-- **Uniqueness (non-interference)**: Inserting at two distinct single-segment
    paths does not cause cross-contamination. -/
theorem insert_disjoint_lookup (seg1 seg2 : String) (mm1 mm2 : MethodMap)
    (hneq : seg1 ≠ seg2) :
    let t := (empty.insert [seg1] mm1).insert [seg2] mm2
    t.lookup [seg1] = some mm1 ∧ t.lookup [seg2] = some mm2 := by
  have h12 : (seg1 == seg2) = false := beq_eq_false_iff_ne.mpr hneq
  have h21 : (seg2 == seg1) = false := beq_eq_false_iff_ne.mpr (Ne.symm hneq)
  simp [empty, insert, lookup, updateChild, List.find?, List.any, List.map,
    h12, h21, beq_self_eq_true]

/-- Helper: List.find? on appended list when key not in first part. -/
private theorem find_append_not_in {seg : String} :
    ∀ (cs : List (String × Trie)) (newChild : Trie),
    (cs.any (fun p => p.1 == seg)) ≠ true →
    (cs ++ [(seg, newChild)]).find? (fun p => p.1 == seg) = some (seg, newChild)
  | [], newChild, _ => by
    simp only [List.nil_append, List.find?_cons, beq_self_eq_true]
  | hd :: tl, newChild, hnot => by
    -- hnot : (hd.1 == seg || tl.any ...) ≠ true
    -- Extract: hd.1 == seg = false  AND  tl.any ... ≠ true
    rw [List.any_cons] at hnot
    have hor : (hd.1 == seg || tl.any (fun p => p.1 == seg)) = false :=
      Bool.not_eq_true _ |>.mp hnot
    have hpair := Bool.or_eq_false_iff.mp hor
    have hhd : (hd.1 == seg) = false := hpair.1
    have htl_not : (tl.any fun p => p.1 == seg) ≠ true := by
      rw [hpair.2]; exact Bool.false_ne_true
    -- Unfold find? on (hd :: tl ++ [target]), head doesn't match
    simp only [List.cons_append, List.find?_cons]
    rw [hhd]
    exact find_append_not_in tl newChild htl_not

/-- Helper: List.find? on a mapped list where matching elements get replaced. -/
private theorem find_map_replace {seg : String} :
    ∀ (cs : List (String × Trie)) (newChild : Trie),
    (cs.any (fun p => p.1 == seg)) = true →
    (cs.map (fun p => if p.1 == seg then (seg, newChild) else p)).find?
      (fun p => p.1 == seg) = some (seg, newChild)
  | [], _, h => by simp [List.any] at h
  | hd :: tl, newChild, h => by
    rw [List.map_cons, List.find?_cons]
    cases heq : hd.1 == seg with
    | true =>
      -- hd matches: if (hd.1 == seg) = true then (seg, newChild)
      simp only [heq, ite_true, beq_self_eq_true]
    | false =>
      -- Goal: match (if false = true then (seg, newChild) else hd).fst == seg with ...
      -- Use show + native_decide approach OR change to have
      -- Strategy: the entire LHS should reduce because:
      -- if false = true then X else Y => Y (by simp)
      -- hd.fst == seg = false (by heq)
      -- So match false with | true => ... | false => find?... => find?...
      -- Then apply IH
      have : (if false = true then (seg, newChild) else hd) = hd := by simp
      rw [this, heq]
      have htl_any : (tl.any fun p => p.1 == seg) = true := by
        rw [List.any_cons, heq, Bool.false_or] at h; exact h
      exact find_map_replace tl newChild htl_any

/-- Helper: find? after updateChild returns the updated child for the matching key. -/
private theorem find_updateChild (children : List (String × Trie)) (seg : String) (newChild : Trie) :
    (updateChild children seg newChild).find? (fun p => p.1 == seg) = some (seg, newChild) := by
  unfold updateChild
  split
  · rename_i hexists
    exact find_map_replace children newChild hexists
  · rename_i hnotexists
    exact find_append_not_in children newChild hnotexists

/-- **Insert-lookup round trip (general)**: Inserting at any path and looking up
    that path always returns the inserted value. -/
theorem insert_lookup (t : Trie) (path : List String) (mm : MethodMap) :
    (t.insert path mm).lookup path = some mm := by
  induction path generalizing t with
  | nil =>
    cases t with
    | node val children => simp [insert, lookup]
  | cons seg rest ih =>
    cases t with
    | node val children =>
      simp only [insert, lookup, find_updateChild]
      exact ih _

/-- **Idempotent insert**: Inserting the same value at the same path twice
    yields the same lookup result as inserting once. -/
theorem insert_idempotent_lookup (t : Trie) (path : List String) (mm : MethodMap) :
    ((t.insert path mm).insert path mm).lookup path =
    (t.insert path mm).lookup path := by
  simp [insert_lookup]

-- ── Dispatch Model ───────────────────────────────────────────────────────

/-- Full dispatch: given a trie, request method, and path, resolve to a response. -/
def dispatch (t : Trie) (method : HttpMethod) (path : List String) (req : Request) : Response :=
  match t.lookup path with
  | none => Response.notFound
  | some mm =>
    match MethodMap.get mm method with
    | some handler => handler req
    | none => Response.empty StatusCode.METHOD_NOT_ALLOWED

/-- Dispatch on an empty trie always returns 404. -/
theorem dispatch_empty (method : HttpMethod) (path : List String) (req : Request) :
    dispatch empty method path req = Response.notFound := by
  simp [dispatch, empty, lookup]
  cases path with
  | nil => simp [lookup]
  | cons seg rest => simp [lookup, List.find?]

/-- If a route exists with the correct method, dispatch returns the handler's response. -/
theorem dispatch_found (t : Trie) (method : HttpMethod) (path : List String)
    (mm : MethodMap) (handler : Handler) (req : Request)
    (hlookup : t.lookup path = some mm)
    (hmethod : MethodMap.get mm method = some handler) :
    dispatch t method path req = handler req := by
  simp [dispatch, hlookup, hmethod]

/-- If a route exists but the method is wrong, dispatch returns 405. -/
theorem dispatch_wrong_method (t : Trie) (method : HttpMethod) (path : List String)
    (mm : MethodMap) (req : Request)
    (hlookup : t.lookup path = some mm)
    (hmethod : MethodMap.get mm method = none) :
    dispatch t method path req = Response.empty StatusCode.METHOD_NOT_ALLOWED := by
  simp [dispatch, hlookup, hmethod]

end Trie

end AvaWeb.Router

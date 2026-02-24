import AvaWeb.Types

/-!
# Extractor Safety Proofs

Models the ava-web extractor system (extractor.rs) and proves that
extractor composition preserves safety guarantees.

## Key Results

1. Pair composition preserves success
2. Triple composition preserves success
3. Error short-circuiting: first failure determines the error response
4. Total extractors never hit the fallback path
-/

namespace AvaWeb.Extractors

open AvaWeb

-- ── Extraction Result ────────────────────────────────────────────────────────

/-- Extraction error -- models `ExtractionError` (extractor.rs:353). -/
structure ExtractionError where
  status : StatusCode
  message : String
  deriving Repr, BEq

namespace ExtractionError

def badRequest (msg : String) : ExtractionError :=
  { status := StatusCode.BAD_REQUEST, message := msg }

def internalError (msg : String) : ExtractionError :=
  { status := StatusCode.INTERNAL_SERVER_ERROR, message := msg }

/-- Convert extraction error to HTTP response. -/
def toResponse (e : ExtractionError) : Response :=
  Response.new e.status (String.toUTF8 e.message)

end ExtractionError

-- ── Extractor Types ──────────────────────────────────────────────────────────

/-- An extractor pulls a value of type `a` from a request.
    Models `FromRequestParts` (extractor.rs:398). -/
structure Extractor (a : Type) where
  extract : Request → Except ExtractionError a

/-- A body extractor consumes the request body to produce a value.
    Models `FromRequest` (extractor.rs:403). -/
structure BodyExtractor (a : Type) where
  extract : Request → Except ExtractionError a

-- ── Predicate: Total Extractor ──────────────────────────────────────────────

/-- An extractor is total if it succeeds on every request. -/
def Extractor.isTotal {a : Type} (e : Extractor a) : Prop :=
  ∀ (req : Request), ∃ (v : a), e.extract req = .ok v

-- ── Pair Composition ─────────────────────────────────────────────────────────

/-- Compose two extractors into a pair extractor. -/
def Extractor.and {a b : Type} (e1 : Extractor a) (e2 : Extractor b) : Extractor (a × b) where
  extract req := do
    let x ← e1.extract req
    let y ← e2.extract req
    return (x, y)

/-- **Core safety theorem**: If both extractors succeed on all requests,
    their composition also succeeds on all requests. -/
theorem and_preserves_success {a b : Type} (e1 : Extractor a) (e2 : Extractor b)
    (h1 : e1.isTotal) (h2 : e2.isTotal) :
    (e1.and e2).isTotal := by
  intro req
  obtain ⟨v1, hv1⟩ := h1 req
  obtain ⟨v2, hv2⟩ := h2 req
  exact ⟨(v1, v2), by simp [Extractor.and, hv1, hv2, bind, Except.bind, pure, Except.pure]⟩

-- ── Triple Composition ──────────────────────────────────────────────────────

/-- Compose three extractors. Models `FnHandler3` expansion. -/
def Extractor.and3 {a b c : Type} (e1 : Extractor a) (e2 : Extractor b) (e3 : Extractor c)
    : Extractor (a × b × c) where
  extract req := do
    let x ← e1.extract req
    let y ← e2.extract req
    let z ← e3.extract req
    return (x, y, z)

/-- Triple composition preserves success. -/
theorem and3_preserves_success {a b c : Type}
    (e1 : Extractor a) (e2 : Extractor b) (e3 : Extractor c)
    (h1 : e1.isTotal) (h2 : e2.isTotal) (h3 : e3.isTotal) :
    (e1.and3 e2 e3).isTotal := by
  intro req
  obtain ⟨v1, hv1⟩ := h1 req
  obtain ⟨v2, hv2⟩ := h2 req
  obtain ⟨v3, hv3⟩ := h3 req
  exact ⟨(v1, v2, v3), by simp [Extractor.and3, hv1, hv2, hv3, bind, Except.bind, pure, Except.pure]⟩

-- ── N-ary Composition (via List) ────────────────────────────────────────────

/-- Unityped extractor list: extract a list of values of the same type. -/
def Extractor.all {a : Type} (extractors : List (Extractor a)) : Extractor (List a) where
  extract req := extractors.foldlM (init := []) fun acc e => do
    let v ← e.extract req
    return acc ++ [v]

/-- Helper: if all extractors in a list are total, foldlM over them succeeds
    for any initial accumulator. -/
private theorem foldlM_total {a : Type} (req : Request)
    (acc : List a) :
    ∀ (es : List (Extractor a)),
    (∀ (e : Extractor a), e ∈ es → e.isTotal) →
    ∃ (result : List a),
      List.foldlM (m := Except ExtractionError)
        (fun acc' e' => (fun v => acc' ++ [v]) <$> e'.extract req) acc es = .ok result
  | [], _ => ⟨acc, rfl⟩
  | e :: es, hall => by
    have he : e.isTotal := hall e (List.mem_cons_self e es)
    have hes : ∀ (e' : Extractor a), e' ∈ es → e'.isTotal :=
      fun e' he' => hall e' (List.mem_cons_of_mem e he')
    obtain ⟨v, hv⟩ := he req
    simp [List.foldlM_cons, bind, Except.bind, hv, Functor.map, Except.map, pure, Except.pure]
    exact foldlM_total req (acc ++ [v]) es hes

/-- If all extractors in a list are total, the composed list extractor is total. -/
theorem all_preserves_success {a : Type} :
    ∀ (es : List (Extractor a)),
    (∀ (e : Extractor a), e ∈ es → e.isTotal) →
    (Extractor.all es).isTotal
  | es, hall => by
    intro req
    have h := foldlM_total req [] es hall
    obtain ⟨result, hr⟩ := h
    exact ⟨result, by simp [Extractor.all, hr]⟩

-- ── Error Short-Circuit ─────────────────────────────────────────────────────

/-- **Error short-circuit**: If the first extractor fails, the pair returns
    that error regardless of the second extractor. -/
theorem and_short_circuits_on_first_error {a b : Type}
    (e1 : Extractor a) (e2 : Extractor b)
    (err : ExtractionError)
    (req : Request)
    (h1 : e1.extract req = .error err) :
    (e1.and e2).extract req = .error err := by
  simp [Extractor.and, h1, bind, Except.bind]

/-- If the first extractor succeeds but the second fails, the second's error
    is returned. -/
theorem and_propagates_second_error {a b : Type}
    (e1 : Extractor a) (e2 : Extractor b)
    (v1 : a) (err : ExtractionError)
    (req : Request)
    (h1 : e1.extract req = .ok v1)
    (h2 : e2.extract req = .error err) :
    (e1.and e2).extract req = .error err := by
  simp [Extractor.and, h1, h2, bind, Except.bind]

-- ── Handler Safety ──────────────────────────────────────────────────────────

/-- A handler dispatch model: extract then apply. -/
def dispatchWith {a : Type} (extractor : Extractor a) (handler : a → Response)
    (fallback : ExtractionError → Response)
    (req : Request) : Response :=
  match extractor.extract req with
  | .ok v => handler v
  | .error e => fallback e

/-- If the extractor is total, the fallback is never reached. -/
theorem dispatch_total_never_falls_back {a : Type}
    (extractor : Extractor a) (handler : a → Response)
    (fallback : ExtractionError → Response)
    (req : Request)
    (htotal : extractor.isTotal) :
    ∃ (v : a), extractor.extract req = .ok v ∧
         dispatchWith extractor handler fallback req = handler v := by
  obtain ⟨v, hv⟩ := htotal req
  exact ⟨v, hv, by simp [dispatchWith, hv]⟩

-- ── Concrete Extractor Models ───────────────────────────────────────────────

/-- Path<HashMap> extractor -- always succeeds (clones path_params). -/
def pathMapExtractor : Extractor (List (String × String)) where
  extract req := .ok req.pathParams

/-- Path<HashMap> is total. -/
theorem pathMap_total : pathMapExtractor.isTotal := by
  intro req
  exact ⟨req.pathParams, rfl⟩

/-- Query<HashMap> extractor -- always succeeds (parses query or returns empty). -/
def queryMapExtractor : Extractor (List (String × String)) where
  extract _req := .ok []

/-- Query<HashMap> is total. -/
theorem queryMap_total : queryMapExtractor.isTotal := by
  intro _req
  exact ⟨[], rfl⟩

/-- Composing two infallible extractors (Path + Query) is infallible. -/
theorem path_query_composition_safe :
    (pathMapExtractor.and queryMapExtractor).isTotal :=
  and_preserves_success pathMapExtractor queryMapExtractor pathMap_total queryMap_total

end AvaWeb.Extractors

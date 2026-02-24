/-!
# AvaWeb HTTP Primitives

Lean 4 model of core HTTP types from `ava-web/src/extractor.rs` and
`ava-web/src/response.rs`. These types form the foundation for all proofs.

## Correspondence to Rust

| Lean Type    | Rust Type                  | Source File      |
|-------------|---------------------------|------------------|
| HttpMethod  | enum Method               | extractor.rs:22  |
| HeaderMap   | struct HeaderMap (Vec)     | extractor.rs:238 |
| Request     | struct Request             | extractor.rs:94  |
| StatusCode  | struct StatusCode(u16)     | response.rs:14   |
| Response    | struct Response            | response.rs      |
-/

namespace AvaWeb

-- ── HTTP Method ──────────────────────────────────────────────────────────────

/-- HTTP request method — mirrors Rust `Method` enum (extractor.rs:22).
    We model the 7 standard methods as discrete constructors.
    The Rust `Custom(String)` variant is omitted for tractability;
    proofs over standard methods cover the common case. -/
inductive HttpMethod where
  | GET
  | POST
  | PUT
  | DELETE
  | PATCH
  | HEAD
  | OPTIONS
  deriving DecidableEq, Repr, BEq, Hashable

-- ── Status Code ──────────────────────────────────────────────────────────────

/-- HTTP status code — a natural number wrapping a u16 (response.rs:14).
    We use `Nat` rather than `UInt16` for proof ergonomics. -/
structure StatusCode where
  code : Nat
  deriving DecidableEq, Repr, BEq

namespace StatusCode

-- 2xx
def OK : StatusCode := ⟨200⟩
def CREATED : StatusCode := ⟨201⟩
def NO_CONTENT : StatusCode := ⟨204⟩

-- 4xx
def BAD_REQUEST : StatusCode := ⟨400⟩
def FORBIDDEN : StatusCode := ⟨403⟩
def NOT_FOUND : StatusCode := ⟨404⟩
def METHOD_NOT_ALLOWED : StatusCode := ⟨405⟩
def PAYLOAD_TOO_LARGE : StatusCode := ⟨413⟩
def TOO_MANY_REQUESTS : StatusCode := ⟨429⟩

-- 5xx
def INTERNAL_SERVER_ERROR : StatusCode := ⟨500⟩
def GATEWAY_TIMEOUT : StatusCode := ⟨504⟩

def isSuccess (sc : StatusCode) : Bool :=
  sc.code >= 200 && sc.code < 300

def isClientError (sc : StatusCode) : Bool :=
  sc.code >= 400 && sc.code < 500

def isServerError (sc : StatusCode) : Bool :=
  sc.code >= 500 && sc.code < 600

end StatusCode

-- ── Header Map ───────────────────────────────────────────────────────────────

/-- Header map — models the Vec-backed `HeaderMap` (extractor.rs:238).
    List of key-value pairs with case-sensitive lookup (matching Rust behavior). -/
abbrev HeaderMap := List (String × String)

namespace HeaderMap

/-- Lookup a header value by key. Returns the first match. -/
def get (headers : HeaderMap) (key : String) : Option String :=
  match headers.find? (fun p => p.1 == key) with
  | some (_, v) => some v
  | none => none

/-- Check if a key exists. -/
def containsKey (headers : HeaderMap) (key : String) : Bool :=
  headers.any (fun p => p.1 == key)

/-- Insert or overwrite a header. Replaces first occurrence if key exists,
    otherwise appends. -/
def insert (headers : HeaderMap) (key : String) (value : String) : HeaderMap :=
  if headers.any (fun p => p.1 == key) then
    headers.map (fun p => if p.1 == key then (key, value) else p)
  else
    headers ++ [(key, value)]

end HeaderMap

-- ── Request ──────────────────────────────────────────────────────────────────

/-- HTTP request — simplified model of `Request` (extractor.rs:94).
    We model the path as a list of segments for trie-based routing proofs.
    `pathRaw` preserves the original string path for display. -/
structure Request where
  method : HttpMethod
  path : List String          -- path segments (split on '/')
  pathRaw : String            -- original path string
  headers : HeaderMap
  body : Option ByteArray     -- None = empty body
  pathParams : List (String × String)

namespace Request

def new (method : HttpMethod) (pathRaw : String) : Request :=
  { method := method
  , path := pathRaw.splitOn "/" |>.filter (· ≠ "")
  , pathRaw := pathRaw
  , headers := []
  , body := none
  , pathParams := []
  }

def withHeader (req : Request) (key : String) (value : String) : Request :=
  { req with headers := HeaderMap.insert req.headers key value }

def withBody (req : Request) (body : ByteArray) : Request :=
  { req with body := some body }

end Request

-- ── Response ─────────────────────────────────────────────────────────────────

/-- HTTP response — simplified model of `Response` (response.rs). -/
structure Response where
  status : StatusCode
  headers : HeaderMap
  body : ByteArray

namespace Response

def new (status : StatusCode) (body : ByteArray) : Response :=
  { status := status, headers := [], body := body }

def empty (status : StatusCode) : Response :=
  { status := status, headers := [], body := ByteArray.empty }

def ok (body : ByteArray) : Response :=
  new StatusCode.OK body

def notFound : Response :=
  empty StatusCode.NOT_FOUND

def withHeader (resp : Response) (key : String) (value : String) : Response :=
  { resp with headers := HeaderMap.insert resp.headers key value }

end Response

-- ── Handler ──────────────────────────────────────────────────────────────────

/-- A handler is a pure function from Request to Response.
    This is the synchronous, pure model — the Rust version is async,
    but for proof purposes we model the completed computation. -/
def Handler := Request → Response

end AvaWeb

import AvaWeb.Types
import AvaWeb.Middleware.Monoid
import AvaWeb.Router.Trie
import AvaWeb.Extractors.Safety
import AvaWeb.Session.Duality
import AvaWeb.Auth.Macaroon
import AvaWeb.SourceAdapter.CircuitBreaker

/-!
# AvaWeb Formal Verification

Lean 4 proofs for the ava-web HTTP framework.
Models core abstractions and proves key properties:

- **Types**: HTTP primitives (Method, Request, Response, StatusCode, HeaderMap)
- **Middleware/Monoid**: Middleware forms a monoid under composition; semantic preservation
- **Router/Trie**: Determinism, completeness, and uniqueness of path-based dispatch
- **Extractors/Safety**: Extractor composition preserves success guarantees
- **Session/Duality**: Session type duality, drop bomb correctness, protocol completion witnesses
- **Auth/Macaroon**: HMAC chain monotonicity, caveat conjunction, serialization roundtrip
- **SourceAdapter/CircuitBreaker**: State machine determinism, trip monotonicity, no stuck states
-/

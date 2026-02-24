------------------------ MODULE ExtractorPipeline ------------------------
(*
 * Extractor composition pipeline specification.
 *
 * Models the sequential extractor execution as implemented in ava-web's
 * handler macros (handler.rs:154-232). The key protocol:
 *
 *   For N extractors (N >= 2):
 *     T1..T(N-1) use FromRequestParts (borrow &req, non-consuming)
 *     TN uses FromRequest (consumes req, takes body)
 *
 *   Execution is strictly sequential:
 *     1. Extract T1 from &req → Ok(t1) or Err → short-circuit
 *     2. Extract T2 from &req → Ok(t2) or Err → short-circuit
 *     ...
 *     N-1. Extract T(N-1) from &req → Ok(...) or Err → short-circuit
 *     N. Extract TN from req (consumed) → Ok(tN) or Err → short-circuit
 *     N+1. Call handler(t1, ..., tN) → response
 *
 *   The blanket impl (extractor.rs:408-412) means FromRequestParts
 *   types can also serve as the final FromRequest position.
 *
 * Properties verified:
 *   - First failure short-circuits (no further extractors run)
 *   - Every request eventually produces a response (no hangs)
 *   - Error propagation is deterministic
 *   - At most one extractor consumes the request body
 *   - Handler runs iff all extractors succeed
 *
 * Reference:
 *   handler.rs:154-191  — impl_sync_handler_n macro
 *   handler.rs:195-232  — impl_async_handler_n macro
 *   extractor.rs:397-412 — FromRequestParts, FromRequest, blanket impl
 *)
EXTENDS Naturals, Sequences, FiniteSets

------------------------------------------------------------------------
(* ── Constants ─────────────────────────────────────────────────────── *)

CONSTANT NumExtractors  \* Total extractors in the pipeline (N >= 1)

ASSUME NumExtractors \in Nat /\ NumExtractors >= 1

------------------------------------------------------------------------
(* ── Variables ─────────────────────────────────────────────────────── *)

VARIABLES
    phase,             \* Current pipeline phase
    currentExtractor,  \* Index of extractor being run (1..NumExtractors)
    results,           \* Sequence of extraction results: "OK" or "ERR"
    requestConsumed,   \* Whether the request body has been consumed
    handlerRan,        \* Whether the handler function executed
    responseStatus,    \* Final response status class
    errorExtractor     \* Index of first failing extractor (0 = no error)

vars == <<phase, currentExtractor, results, requestConsumed,
          handlerRan, responseStatus, errorExtractor>>

------------------------------------------------------------------------
(* ── Phases ────────────────────────────────────────────────────────── *)

Phases == {
    "INIT",
    "EXTRACTING_PARTS",  \* Running FromRequestParts (T1..T(N-1))
    "EXTRACTING_BODY",   \* Running FromRequest (TN, consumes body)
    "HANDLING",           \* Calling the handler function
    "ERROR_RESPONSE",     \* An extractor failed, producing error response
    "SUCCESS_RESPONSE",   \* Handler completed, producing success response
    "DONE"                \* Terminal
}

------------------------------------------------------------------------
(* ── Type Invariant ────────────────────────────────────────────────── *)

TypeInvariant ==
    /\ phase \in Phases
    /\ currentExtractor \in 0..NumExtractors
    /\ requestConsumed \in BOOLEAN
    /\ handlerRan \in BOOLEAN
    /\ responseStatus \in {"NONE", "2xx", "4xx", "5xx"}
    /\ errorExtractor \in 0..NumExtractors

------------------------------------------------------------------------
(* ── Initial State ─────────────────────────────────────────────────── *)

Init ==
    /\ phase = "INIT"
    /\ currentExtractor = 0
    /\ results = <<>>
    /\ requestConsumed = FALSE
    /\ handlerRan = FALSE
    /\ responseStatus = "NONE"
    /\ errorExtractor = 0

------------------------------------------------------------------------
(* ── Actions ───────────────────────────────────────────────────────── *)

(*
 * BeginExtraction: Start the extraction pipeline.
 *)
BeginExtraction ==
    /\ phase = "INIT"
    /\ NumExtractors >= 2
    /\ phase' = "EXTRACTING_PARTS"
    /\ currentExtractor' = 1
    /\ UNCHANGED <<results, requestConsumed, handlerRan, responseStatus, errorExtractor>>

(*
 * BeginSingleExtraction: Special case for N=1 (only FromRequest).
 * Reference: handler.rs:88-113 (impl_sync_handler_1 macro)
 *)
BeginSingleExtraction ==
    /\ phase = "INIT"
    /\ NumExtractors = 1
    /\ phase' = "EXTRACTING_BODY"
    /\ currentExtractor' = 1
    /\ UNCHANGED <<results, requestConsumed, handlerRan, responseStatus, errorExtractor>>

(*
 * ExtractPartsOk: Current FromRequestParts extractor succeeds.
 * Reference: handler.rs:177 — from_request_parts(&req) returns Ok
 * The request is borrowed (&req), NOT consumed.
 *)
ExtractPartsOk ==
    /\ phase = "EXTRACTING_PARTS"
    /\ currentExtractor < NumExtractors  \* Not the last extractor
    /\ results' = Append(results, "OK")
    /\ ~requestConsumed  \* Request must not yet be consumed
    /\ IF currentExtractor + 1 < NumExtractors
       THEN \* More FromRequestParts extractors to go
            /\ currentExtractor' = currentExtractor + 1
            /\ phase' = "EXTRACTING_PARTS"
       ELSE \* Next is the final extractor (FromRequest)
            /\ currentExtractor' = currentExtractor + 1
            /\ phase' = "EXTRACTING_BODY"
    /\ UNCHANGED <<requestConsumed, handlerRan, responseStatus, errorExtractor>>

(*
 * ExtractPartsFail: Current FromRequestParts extractor fails.
 * Reference: handler.rs:179 — from_request_parts returns Err(e)
 * Short-circuits: no further extractors run.
 *)
ExtractPartsFail ==
    /\ phase = "EXTRACTING_PARTS"
    /\ currentExtractor < NumExtractors
    /\ results' = Append(results, "ERR")
    /\ errorExtractor' = currentExtractor
    /\ phase' = "ERROR_RESPONSE"
    /\ UNCHANGED <<currentExtractor, requestConsumed, handlerRan, responseStatus>>

(*
 * ExtractBodyOk: Final FromRequest extractor succeeds.
 * Reference: handler.rs:182 — from_request(req) returns Ok
 * This CONSUMES the request (takes ownership).
 *)
ExtractBodyOk ==
    /\ phase = "EXTRACTING_BODY"
    /\ currentExtractor = NumExtractors  \* Must be the last one
    /\ ~requestConsumed  \* Body not yet consumed
    /\ results' = Append(results, "OK")
    /\ requestConsumed' = TRUE
    /\ phase' = "HANDLING"
    /\ UNCHANGED <<currentExtractor, handlerRan, responseStatus, errorExtractor>>

(*
 * ExtractBodyFail: Final FromRequest extractor fails.
 * Reference: handler.rs:184 — from_request returns Err(e)
 *)
ExtractBodyFail ==
    /\ phase = "EXTRACTING_BODY"
    /\ currentExtractor = NumExtractors
    /\ results' = Append(results, "ERR")
    /\ errorExtractor' = currentExtractor
    /\ requestConsumed' = TRUE  \* Request was consumed even on failure
    /\ phase' = "ERROR_RESPONSE"
    /\ UNCHANGED <<currentExtractor, handlerRan, responseStatus>>

(*
 * HandleRequest: All extractors succeeded, call the handler.
 * Reference: handler.rs:186 — (self.0)(t1, ..., tN).into_response()
 *)
HandleRequest ==
    /\ phase = "HANDLING"
    /\ handlerRan' = TRUE
    /\ responseStatus' = "2xx"  \* Handler produces success response
    /\ phase' = "SUCCESS_RESPONSE"
    /\ UNCHANGED <<currentExtractor, results, requestConsumed, errorExtractor>>

(*
 * ProduceErrorResponse: Extraction failure → error response.
 * Reference: handler.rs:179,184 — Err(e) => e.into_response()
 * ExtractionError carries a status code (400, 413, 415, 422, 500).
 *)
ProduceErrorResponse ==
    /\ phase = "ERROR_RESPONSE"
    /\ responseStatus' \in {"4xx", "5xx"}  \* Non-deterministic error class
    /\ phase' = "DONE"
    /\ UNCHANGED <<currentExtractor, results, requestConsumed, handlerRan, errorExtractor>>

(*
 * ProduceSuccessResponse: Handler completed → success response.
 *)
ProduceSuccessResponse ==
    /\ phase = "SUCCESS_RESPONSE"
    /\ phase' = "DONE"
    /\ UNCHANGED <<currentExtractor, results, requestConsumed,
                   handlerRan, responseStatus, errorExtractor>>

(*
 * Terminal: DONE is absorbing.
 *)
Terminal ==
    /\ phase = "DONE"
    /\ UNCHANGED vars

------------------------------------------------------------------------
(* ── Next-State Relation ───────────────────────────────────────────── *)

Next ==
    \/ BeginExtraction
    \/ BeginSingleExtraction
    \/ ExtractPartsOk
    \/ ExtractPartsFail
    \/ ExtractBodyOk
    \/ ExtractBodyFail
    \/ HandleRequest
    \/ ProduceErrorResponse
    \/ ProduceSuccessResponse
    \/ Terminal

------------------------------------------------------------------------
(* ── Fairness ──────────────────────────────────────────────────────── *)

Fairness ==
    /\ WF_vars(BeginExtraction)
    /\ WF_vars(BeginSingleExtraction)
    /\ WF_vars(ExtractPartsOk)
    /\ WF_vars(ExtractBodyOk)
    /\ WF_vars(HandleRequest)
    /\ WF_vars(ProduceErrorResponse)
    /\ WF_vars(ProduceSuccessResponse)

------------------------------------------------------------------------
(* ── Specification ─────────────────────────────────────────────────── *)

Spec == Init /\ [][Next]_vars /\ Fairness

------------------------------------------------------------------------
(* ── Safety Properties ─────────────────────────────────────────────── *)

(*
 * S1: First failure short-circuits — no extractors run after a failure.
 * If results contains an "ERR", no subsequent "OK" or "ERR" follows it.
 *)
FirstFailureShortCircuits ==
    \A i \in 1..Len(results) :
        results[i] = "ERR" =>
            \A j \in (i+1)..Len(results) :
                FALSE  \* No entries should exist after the error

(*
 * S2: Handler runs iff all extractors succeed.
 * The forward direction: handler ran implies all results are OK.
 * The reverse: if pipeline completed with all OK results for all N extractors,
 * then the handler must have run.
 *)
HandlerIffAllSucceed ==
    /\ (handlerRan => \A i \in 1..Len(results) : results[i] = "OK")
    /\ ((phase = "DONE" /\ Len(results) = NumExtractors
         /\ (\A i \in 1..Len(results) : results[i] = "OK"))
         => handlerRan)

(*
 * S3: At most one extractor consumes the request body.
 * The body is consumed exactly when we reach EXTRACTING_BODY (the last extractor).
 * FromRequestParts extractors only borrow &req.
 *)
BodyConsumedAtMostOnce ==
    requestConsumed =>
        (currentExtractor = NumExtractors \/ phase \in {"HANDLING", "ERROR_RESPONSE",
         "SUCCESS_RESPONSE", "DONE"})

(*
 * S4: Error propagation is deterministic — errorExtractor records
 * the first (and only) failing extractor index.
 *)
ErrorDeterministic ==
    errorExtractor > 0 =>
        /\ errorExtractor <= NumExtractors
        /\ Len(results) = errorExtractor
        /\ results[errorExtractor] = "ERR"

(*
 * S5: Extraction order is sequential (1, 2, ..., N).
 * The results sequence length equals the number of extractors processed.
 *)
SequentialOrder ==
    Len(results) <= NumExtractors

(*
 * S6: FromRequestParts extractors do not consume the body.
 *)
PartsDoNotConsumeBody ==
    phase = "EXTRACTING_PARTS" => ~requestConsumed

(*
 * S7: Response status is consistent with outcome.
 *)
ResponseConsistency ==
    /\ (responseStatus = "2xx" => handlerRan)
    /\ (responseStatus \in {"4xx", "5xx"} => errorExtractor > 0)
    /\ (phase = "DONE" => responseStatus # "NONE")

(*
 * S8: Pipeline produces exactly one response.
 *)
ExactlyOneResponse ==
    phase = "DONE" => responseStatus \in {"2xx", "4xx", "5xx"}

------------------------------------------------------------------------
(* ── Liveness Properties ───────────────────────────────────────────── *)

(*
 * L1: Every request eventually produces a response (no extractor hangs).
 * This is THE critical liveness property — extraction pipeline must terminate.
 *)
EventualResponse ==
    phase = "INIT" ~> phase = "DONE"

(*
 * L2: If all extractors are infallible, the handler eventually runs.
 *)
EventualHandler ==
    (phase = "HANDLING") ~> (handlerRan = TRUE)

(*
 * L3: Error responses are eventually produced after failure.
 *)
EventualErrorResponse ==
    (phase = "ERROR_RESPONSE") ~> (phase = "DONE")

==========================================================================

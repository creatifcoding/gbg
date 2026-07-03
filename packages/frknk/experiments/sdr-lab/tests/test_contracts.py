from sdr_lab.contracts import (
    CandidateEvidence,
    FrequencyRangeHz,
    QuiskSuggestion,
    SignalCandidate,
    SignalClass,
    SketchKind,
    SuggestionAction,
    TimeRangeSeconds,
)


def test_candidate_and_suggestion_dump_to_camel_case_contract() -> None:
    candidate = SignalCandidate(
        candidateId="cand-1",
        frameId="frame-1",
        sourceId="synthetic/noise-plus-tone",
        timeRange=TimeRangeSeconds(startSeconds=0.0, endSeconds=1.0),
        frequencyRangeHz=FrequencyRangeHz(lowHz=7_101_000.0, highHz=7_101_250.0),
        classLabel=SignalClass.CW,
        confidence=0.8,
        evidence=[
            CandidateEvidence(
                laneId="waterfall-32x64",
                kind=SketchKind.LOW_RES_WATERFALL,
                score=0.8,
            )
        ],
        verifierStatus="unverified",
    )

    suggestion = QuiskSuggestion(
        suggestionId="sugg-1",
        candidateId=candidate.candidate_id,
        sourceId=candidate.source_id,
        action=SuggestionAction.RUN_CLEAN_VERIFIER,
        label="Inspect candidate",
        rationale="Sketch evidence is not truth; verify in clean DSP.",
        centerFrequencyHz=7_101_125.0,
        bandwidthHz=250.0,
        timeRange=candidate.time_range,
        confidence=candidate.confidence,
        requiresVerification=True,
    )

    dumped = suggestion.model_dump(by_alias=True)
    assert dumped["_tag"] == "QuiskSuggestion"
    assert dumped["candidateId"] == "cand-1"
    assert dumped["requiresVerification"] is True
    assert dumped["timeRange"] == {"startSeconds": 0.0, "endSeconds": 1.0}

#!/usr/bin/env python3
"""
Benchmark Test Suite: Keyphrase-Triggered Skill Dispatch

Tests that prompts correctly trigger the expected keyphrases.
Run: python3 .claude/hooks/tests/benchmark_prompts.py
"""

import json
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


@dataclass
class BenchmarkCase:
    """A test case for keyphrase dispatch."""
    prompt: str
    expected_keyphrases: list[str]
    expected_skills: list[str]
    description: str


# =============================================================================
# BENCHMARK TEST CASES
# =============================================================================
BENCHMARKS = [
    # SERVICE triggers
    BenchmarkCase(
        prompt="Create a database service with connection pooling",
        expected_keyphrases=["[EFFECT:SERVICE:CREATE]"],
        expected_skills=["effect-service-authoring"],
        description="Service creation"
    ),
    BenchmarkCase(
        prompt="How do I compose multiple layers together?",
        expected_keyphrases=["[EFFECT:SERVICE:COMPOSE]"],
        expected_skills=["effect-service-authoring"],
        description="Layer composition"
    ),
    BenchmarkCase(
        prompt="Inject dependencies into my Effect program",
        expected_keyphrases=["[EFFECT:SERVICE:PROVIDE]"],
        expected_skills=["effect-service-authoring"],
        description="Dependency injection"
    ),

    # SCHEMA triggers
    BenchmarkCase(
        prompt="Define a user schema with branded ID types",
        expected_keyphrases=["[EFFECT:SCHEMA:DEFINE]"],
        expected_skills=["effect-schema-mastery"],
        description="Schema definition with branded types"
    ),
    BenchmarkCase(
        prompt="Validate incoming JSON request body",
        expected_keyphrases=["[EFFECT:SCHEMA:VALIDATE]"],
        expected_skills=["effect-schema-mastery"],
        description="JSON validation"
    ),
    BenchmarkCase(
        prompt="Transform between API and domain types using Schema.transform",
        expected_keyphrases=["[EFFECT:SCHEMA:TRANSFORM]"],
        expected_skills=["effect-schema-mastery"],
        description="Schema transformation"
    ),

    # ERROR triggers
    BenchmarkCase(
        prompt="Create custom tagged error types for my domain",
        expected_keyphrases=["[EFFECT:ERROR:DEFINE]"],
        expected_skills=["effect-error-handling"],
        description="Tagged error definition"
    ),
    BenchmarkCase(
        prompt="Handle errors with catchTag pattern",
        expected_keyphrases=["[EFFECT:ERROR:HANDLE]"],
        expected_skills=["effect-error-handling"],
        description="Error handling"
    ),
    BenchmarkCase(
        prompt="Implement retry logic with exponential backoff",
        expected_keyphrases=["[EFFECT:ERROR:RECOVER]"],
        expected_skills=["effect-error-handling"],
        description="Retry/recovery"
    ),

    # FIBER triggers
    BenchmarkCase(
        prompt="Fork a background task for async processing",
        expected_keyphrases=["[EFFECT:FIBER:SPAWN]"],
        expected_skills=["effect-fiber-concurrency"],
        description="Fiber forking"
    ),
    BenchmarkCase(
        prompt="Wait for fiber completion with Fiber.join",
        expected_keyphrases=["[EFFECT:FIBER:JOIN]"],
        expected_skills=["effect-fiber-concurrency"],
        description="Fiber joining"
    ),
    BenchmarkCase(
        prompt="Cancel a running fiber with interrupt",
        expected_keyphrases=["[EFFECT:FIBER:INTERRUPT]"],
        expected_skills=["effect-fiber-concurrency"],
        description="Fiber interruption"
    ),

    # SCOPE triggers
    BenchmarkCase(
        prompt="Acquire database connection with proper resource management",
        expected_keyphrases=["[EFFECT:SCOPE:ACQUIRE]"],
        expected_skills=["effect-scope-resources"],
        description="Resource acquisition"
    ),
    BenchmarkCase(
        prompt="Add cleanup finalizers for resource release",
        expected_keyphrases=["[EFFECT:SCOPE:RELEASE]"],
        expected_skills=["effect-scope-resources"],
        description="Resource cleanup"
    ),

    # MATCH triggers
    BenchmarkCase(
        prompt="Pattern match exhaustively on discriminated union",
        expected_keyphrases=["[EFFECT:MATCH:EXHAUSTIVE]"],
        expected_skills=["effect-match-patterns"],
        description="Exhaustive matching"
    ),
    BenchmarkCase(
        prompt="Use _tag to discriminate union types",
        expected_keyphrases=["[EFFECT:MATCH:DISCRIMINATE]"],
        expected_skills=["effect-match-patterns"],
        description="Tagged union discrimination"
    ),

    # ATOM triggers
    BenchmarkCase(
        prompt="Update atom state in React callback using registry.set",
        expected_keyphrases=["[EFFECT:ATOM:SYNC]"],
        expected_skills=["fermion-patterns"],
        description="Sync atom mutation"
    ),
    BenchmarkCase(
        prompt="Use Atom.get inside Effect.gen",
        expected_keyphrases=["[EFFECT:ATOM:EFFECT]"],
        expected_skills=["fermion-patterns"],
        description="Effect atom access"
    ),
    BenchmarkCase(
        prompt="Create parameterized atom with Atom.family",
        expected_keyphrases=["[EFFECT:ATOM:FAMILY]"],
        expected_skills=["fermion-patterns"],
        description="Atom family pattern"
    ),
    BenchmarkCase(
        prompt="Set up Atom.runtime with global layers for my services",
        expected_keyphrases=["[EFFECT:ATOM:RUNTIME]"],
        expected_skills=["fermion-patterns"],
        description="Atom runtime pattern"
    ),
    BenchmarkCase(
        prompt="Handle loading state with Result.waiting and Result.success",
        expected_keyphrases=["[EFFECT:ATOM:RESULT]"],
        expected_skills=["fermion-patterns"],
        description="Result type pattern"
    ),
    BenchmarkCase(
        prompt="Use Atom.batch to update multiple atoms atomically",
        expected_keyphrases=["[EFFECT:ATOM:BATCH]"],
        expected_skills=["fermion-patterns"],
        description="Batch updates pattern"
    ),

    # MULTI-TRIGGER cases
    BenchmarkCase(
        prompt="Create a service that validates input with Schema and handles errors",
        expected_keyphrases=["[EFFECT:ERROR:HANDLE]", "[EFFECT:SCHEMA:VALIDATE]"],
        expected_skills=["effect-error-handling", "effect-schema-mastery"],
        description="Multi-trigger: service + schema + error"
    ),
    BenchmarkCase(
        prompt="Fork background task with retry on failure",
        expected_keyphrases=["[EFFECT:FIBER:SPAWN]", "[EFFECT:ERROR:RECOVER]"],
        expected_skills=["effect-fiber-concurrency", "effect-error-handling"],
        description="Multi-trigger: fiber + error"
    ),
]


def run_hook(prompt: str) -> dict:
    """Run the prompt context injector hook with a test prompt."""
    hook_path = Path(__file__).parent.parent / "prompt_context_injector.py"

    input_data = json.dumps({"prompt": prompt})

    result = subprocess.run(
        ["python3", str(hook_path)],
        input=input_data,
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        return {"error": result.stderr, "output": None}

    if not result.stdout.strip():
        return {"output": None, "keyphrases": [], "skills": []}

    try:
        output = json.loads(result.stdout)
        context = output.get("hookSpecificOutput", {}).get("additionalContext", "")

        # Extract keyphrases
        keyphrases = []
        for line in context.split("\n"):
            if "Keyphrases:" in line:
                keyphrases = [k.strip() for k in line.split("Keyphrases:")[1].split() if k.startswith("[EFFECT:")]

        # Extract skills
        skills = []
        for line in context.split("\n"):
            if "Skills:" in line:
                skills = [s.strip().lstrip("/").rstrip(",") for s in line.split("Skills:")[1].split(",")]

        return {"output": context, "keyphrases": keyphrases, "skills": skills}
    except json.JSONDecodeError as e:
        return {"error": f"JSON parse error: {e}", "output": result.stdout}


def run_benchmarks() -> tuple[int, int, list[dict]]:
    """Run all benchmark tests and return (passed, failed, results)."""
    passed = 0
    failed = 0
    results = []

    for case in BENCHMARKS:
        result = run_hook(case.prompt)

        # Check keyphrases
        keyphrase_match = all(
            kp in result.get("keyphrases", [])
            for kp in case.expected_keyphrases
        )

        # Check skills
        skill_match = all(
            sk in result.get("skills", [])
            for sk in case.expected_skills
        )

        success = keyphrase_match and skill_match

        if success:
            passed += 1
            status = "✅ PASS"
        else:
            failed += 1
            status = "❌ FAIL"

        results.append({
            "description": case.description,
            "prompt": case.prompt[:60] + "..." if len(case.prompt) > 60 else case.prompt,
            "expected_keyphrases": case.expected_keyphrases,
            "actual_keyphrases": result.get("keyphrases", []),
            "expected_skills": case.expected_skills,
            "actual_skills": result.get("skills", []),
            "status": status,
            "keyphrase_match": keyphrase_match,
            "skill_match": skill_match,
        })

        print(f"{status} {case.description}")
        if not success:
            print(f"   Prompt: {case.prompt[:80]}...")
            print(f"   Expected: {case.expected_keyphrases}")
            print(f"   Got: {result.get('keyphrases', [])}")

    return passed, failed, results


def main():
    print("=" * 60)
    print("KEYPHRASE DISPATCH BENCHMARK SUITE")
    print("=" * 60)
    print()

    passed, failed, results = run_benchmarks()

    print()
    print("=" * 60)
    print(f"RESULTS: {passed} passed, {failed} failed, {len(BENCHMARKS)} total")
    print("=" * 60)

    if failed > 0:
        print("\nFailed tests:")
        for r in results:
            if "FAIL" in r["status"]:
                print(f"  - {r['description']}")

        sys.exit(1)
    else:
        print("\n✅ All benchmarks passed!")
        sys.exit(0)


if __name__ == "__main__":
    main()

import Config

# ─── Jido AI: LLM Provider Configuration ────────────────────────────────────
#
# Anthropic Claude — primary provider for Melanie's deliberation.
# API key resolved from environment at runtime.
#
# Model aliases:
#   :fast     → anthropic:claude-haiku-4-5      (quick tool calls, low cost)
#   :capable  → anthropic:claude-sonnet-4        (reasoning, planning)
#   :planning → anthropic:claude-sonnet-4        (goal decomposition)
#
# API key is resolved at runtime via config/runtime.exs
# Do NOT use System.get_env here — it runs at compile time
# config :jido_ai, :models, anthropic: [api_key: "..."]

# Override model aliases if needed
# config :jido_ai, :model_aliases,
#   fast: "anthropic:claude-haiku-4-5",
#   capable: "anthropic:claude-sonnet-4-20250514"

# ─── Logger ──────────────────────────────────────────────────────────────────

config :logger, :console,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id, :agent, :strategy]

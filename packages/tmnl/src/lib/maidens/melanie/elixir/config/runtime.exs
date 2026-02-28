import Config

# ─── Runtime LLM Provider Config ──────────────────────────────────────────────
#
# API keys MUST be resolved at runtime, not compile time.
# config.exs System.get_env/1 runs during `mix compile`, when env vars
# may not be set. runtime.exs runs when the app actually starts.
#
if api_key = System.get_env("ANTHROPIC_API_KEY") do
  config :jido_ai, :models,
    anthropic: [
      api_key: api_key
    ]
end

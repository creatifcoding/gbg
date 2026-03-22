# Ensure Jido application is started (needed for AgentSupervisor)
Application.ensure_all_started(:jido)
Application.ensure_all_started(:jido_ai)

# Resolve Anthropic credentials from Pi AuthStorage
case Maiden.Melanie.Runtime.AuthBridge.configure!() do
  :ok ->
    IO.puts("[AUTH] Anthropic credentials configured via Pi AuthStorage")

  {:error, reason} ->
    IO.puts("[AUTH] No Anthropic credentials found: #{inspect(reason)}")
    IO.puts("[AUTH] Live provider tests will be skipped")
end

ExUnit.start()

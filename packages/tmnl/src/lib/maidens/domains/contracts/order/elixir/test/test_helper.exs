live_enabled? =
  System.get_env("ORDER_LIVE_E2E", "")
  |> String.downcase()
  |> then(&(&1 in ["1", "true", "yes", "on"]))

if live_enabled? do
  ExUnit.start()
else
  ExUnit.start(exclude: [:live_provider])
end

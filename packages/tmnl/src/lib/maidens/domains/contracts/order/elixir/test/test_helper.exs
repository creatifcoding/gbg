truthy = fn value ->
  value
  |> String.downcase()
  |> then(&(&1 in ["1", "true", "yes", "on"]))
end

live_enabled? = truthy.(System.get_env("ORDER_LIVE_E2E", ""))
postgres_enabled? = truthy.(System.get_env("ORDER_POSTGRES_E2E", ""))

exclude_tags =
  []
  |> then(fn tags -> if live_enabled?, do: tags, else: [:live_provider | tags] end)
  |> then(fn tags -> if postgres_enabled?, do: tags, else: [:postgres_persistence | tags] end)

ExUnit.start(exclude: exclude_tags)

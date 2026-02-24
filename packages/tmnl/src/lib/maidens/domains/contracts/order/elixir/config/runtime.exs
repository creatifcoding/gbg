import Config

parse_int_env = fn name, default ->
  case System.get_env(name) do
    nil ->
      default

    value ->
      case Integer.parse(value) do
        {parsed, ""} -> parsed
        _ -> raise "invalid integer for #{name}: #{inspect(value)}"
      end
  end
end

parse_bool_env = fn name, default ->
  case System.get_env(name) do
    nil ->
      default

    value ->
      value
      |> String.downcase()
      |> then(&(&1 in ["1", "true", "yes", "on"]))
  end
end

adapter =
  System.get_env("ORDER_PERSISTENCE_ADAPTER", "ets")
  |> String.downcase()
  |> case do
    "postgres" -> :postgres
    _ -> :ets
  end

config :maiden_order_runtime, :persistence_adapter, adapter

order_postgres_config = [
  hostname: System.get_env("ORDER_POSTGRES_HOST"),
  port: parse_int_env.("ORDER_POSTGRES_PORT", 5432),
  username: System.get_env("ORDER_POSTGRES_USER"),
  password: System.get_env("ORDER_POSTGRES_PASSWORD"),
  database: System.get_env("ORDER_POSTGRES_DATABASE"),
  ssl: parse_bool_env.("ORDER_POSTGRES_SSL", false),
  pool_size: parse_int_env.("ORDER_POSTGRES_POOL_SIZE", 5),
  timeout_ms: parse_int_env.("ORDER_POSTGRES_TIMEOUT_MS", 15_000),
  table_prefix: System.get_env("ORDER_POSTGRES_TABLE_PREFIX", "maiden_order_runtime")
]

if adapter == :postgres do
  missing_required =
    order_postgres_config
    |> Keyword.take([:hostname, :username, :database])
    |> Enum.filter(fn {_k, value} -> is_nil(value) or value == "" end)
    |> Enum.map(fn {key, _} -> key end)

  if missing_required != [] do
    raise "missing required ORDER postgres settings for adapter=postgres: #{Enum.join(Enum.map(missing_required, &Atom.to_string/1), ", ")}"
  end
end

config :maiden_order_runtime, :order_postgres, order_postgres_config

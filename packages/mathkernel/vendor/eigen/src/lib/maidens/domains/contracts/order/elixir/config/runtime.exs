import Config

parse_int_env = fn name, strict? ->
  case System.get_env(name) do
    nil ->
      nil

    value ->
      case Integer.parse(value) do
        {parsed, ""} -> parsed
        _ when strict? -> raise "invalid integer for #{name}: #{inspect(value)}"
        _ -> nil
      end
  end
end

parse_bool_env = fn name, strict? ->
  case System.get_env(name) do
    nil ->
      nil

    value ->
      case value |> String.trim() |> String.downcase() do
        truthy when truthy in ["1", "true", "yes", "on"] -> true
        falsy when falsy in ["0", "false", "no", "off"] -> false
        other when strict? -> raise "invalid boolean for #{name}: #{inspect(other)}"
        _ -> nil
      end
  end
end

adapter =
  System.get_env("ORDER_PERSISTENCE_ADAPTER", "ets")
  |> String.downcase()
  |> case do
    "postgres" -> :postgres
    "ets" -> :ets
    other -> raise "invalid ORDER_PERSISTENCE_ADAPTER: #{inspect(other)} (expected: ets|postgres)"
  end

config :maiden_order_runtime, :persistence_adapter, adapter

strict_postgres? = adapter == :postgres

postgres_schema = [
  hostname: [type: :string, required: adapter == :postgres],
  port: [type: :pos_integer, default: 5432],
  username: [type: :string, required: adapter == :postgres],
  password: [type: :string],
  database: [type: :string, required: adapter == :postgres],
  ssl: [type: :boolean, default: false],
  pool_size: [type: :pos_integer, default: 5],
  timeout_ms: [type: :pos_integer, default: 15_000],
  table_prefix: [type: :string, default: "maiden_order_runtime"]
]

order_postgres_raw =
  [
    hostname: System.get_env("ORDER_POSTGRES_HOST"),
    port: parse_int_env.("ORDER_POSTGRES_PORT", strict_postgres?),
    username: System.get_env("ORDER_POSTGRES_USER"),
    password: System.get_env("ORDER_POSTGRES_PASSWORD"),
    database: System.get_env("ORDER_POSTGRES_DATABASE"),
    ssl: parse_bool_env.("ORDER_POSTGRES_SSL", strict_postgres?),
    pool_size: parse_int_env.("ORDER_POSTGRES_POOL_SIZE", strict_postgres?),
    timeout_ms: parse_int_env.("ORDER_POSTGRES_TIMEOUT_MS", strict_postgres?),
    table_prefix: System.get_env("ORDER_POSTGRES_TABLE_PREFIX")
  ]
  |> Enum.reduce([], fn
    {_key, nil}, acc ->
      acc

    {:password, value}, acc when is_binary(value) and value == "" ->
      acc

    {:password, value}, acc when is_binary(value) ->
      [{:password, value} | acc]

    {key, value}, acc when is_binary(value) ->
      case String.trim(value) do
        "" -> acc
        trimmed -> [{key, trimmed} | acc]
      end

    entry, acc ->
      [entry | acc]
  end)
  |> Enum.reverse()

order_postgres_config =
  case NimbleOptions.validate(order_postgres_raw, postgres_schema) do
    {:ok, opts} ->
      opts

    {:error, %NimbleOptions.ValidationError{} = error} ->
      raise RuntimeError, "invalid ORDER postgres runtime config: #{Exception.message(error)}"
  end

config :maiden_order_runtime, :order_postgres, order_postgres_config

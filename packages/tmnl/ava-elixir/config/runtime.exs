import Config

runtime_mode =
  case System.get_env("AVA_RUNTIME_MODE") do
    nil ->
      :nif

    "nif" ->
      :nif

    "nats_primary" ->
      :nif

    "sidecar" ->
      :sidecar

    "phoenix_fallback" ->
      :sidecar

    other ->
      IO.warn("Unknown AVA_RUNTIME_MODE=#{inspect(other)}; defaulting to :nif")
      :nif
  end

config :ava_elixir, :runtime_mode, runtime_mode

if config_env() in [:dev, :test, :prod] do
  default_db_name =
    case config_env() do
      :test -> "ava_elixir_test"
      _ -> "ava_elixir_dev"
    end

  db_host = System.get_env("AVA_POSTGRES_HOST") || System.get_env("ORDER_POSTGRES_HOST") || "localhost"
  db_port = System.get_env("AVA_POSTGRES_PORT") || System.get_env("ORDER_POSTGRES_PORT") || "5432"
  db_user = System.get_env("AVA_POSTGRES_USER") || System.get_env("ORDER_POSTGRES_USER") || "postgres"
  db_password = System.get_env("AVA_POSTGRES_PASSWORD") || System.get_env("ORDER_POSTGRES_PASSWORD") || "postgres"

  db_name =
    System.get_env("AVA_POSTGRES_DATABASE") ||
      System.get_env("ORDER_POSTGRES_DATABASE") ||
      default_db_name

  database_url =
    System.get_env("DATABASE_URL") ||
      "ecto://#{db_user}:#{db_password}@#{db_host}:#{db_port}/#{db_name}"

  pool_size =
    case Integer.parse(System.get_env("POOL_SIZE", "10")) do
      {value, ""} when value > 0 -> value
      _ -> 10
    end

  parse_pos_int = fn env, default ->
    case Integer.parse(System.get_env(env, Integer.to_string(default))) do
      {value, ""} when value > 0 -> value
      _ -> default
    end
  end

  queue_default = parse_pos_int.("OBAN_QUEUE_DEFAULT", 10)
  queue_events = parse_pos_int.("OBAN_QUEUE_EVENTS", 5)
  queue_ava_commands = parse_pos_int.("AVA_OBAN_COMMAND_CONCURRENCY", 20)
  queue_ava_projection = parse_pos_int.("AVA_OBAN_PROJECTION_CONCURRENCY", 12)
  queue_ava_status = parse_pos_int.("AVA_OBAN_STATUS_CONCURRENCY", 8)
  queue_ava_repair = parse_pos_int.("AVA_OBAN_REPAIR_CONCURRENCY", 4)
  queue_ava_dlq = parse_pos_int.("AVA_OBAN_DLQ_CONCURRENCY", 2)
  queue_ava_outbox = parse_pos_int.("AVA_OBAN_OUTBOX_CONCURRENCY", 10)

  nats_url =
    System.get_env("NATS_URL") ||
      "nats://127.0.0.1:4222"

  config :ava_elixir, AvaElixir.Repo,
    url: database_url,
    pool_size: pool_size,
    stacktrace: true,
    show_sensitive_data_on_connection_error: config_env() != :prod

  config :ava_elixir, :nats,
    url: nats_url

  config :ava_elixir, Oban,
    repo: AvaElixir.Repo,
    plugins: [{Oban.Plugins.Pruner, max_age: 60 * 60 * 24}],
    queues: [
      default: queue_default,
      events: queue_events,
      ava_commands: queue_ava_commands,
      ava_projection: queue_ava_projection,
      ava_status: queue_ava_status,
      ava_repair: queue_ava_repair,
      ava_dlq: queue_ava_dlq,
      ava_outbox: queue_ava_outbox
    ]
end

if config_env() == :prod do
  secret_key_base =
    System.get_env("AVA_ELIXIR_SECRET_KEY_BASE") ||
      "ava_elixir_prod_secret_key_base_override_me"

  config :ava_elixir, AvaElixirWeb.Endpoint,
    secret_key_base: secret_key_base,
    server: true
end

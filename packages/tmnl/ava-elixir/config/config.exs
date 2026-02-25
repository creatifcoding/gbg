import Config

config :ava_elixir,
  runtime_mode: :nif,
  native_client: AvaElixir.Native,
  sidecar_client: AvaElixir.SidecarClient,
  channel_token_ttl_seconds: 300,
  ecto_repos: [AvaElixir.Repo],
  ash_domains: [AvaElixir.Ash.Domain]

config :ava_elixir, AvaElixir.Repo,
  migration_primary_key: [name: :id, type: :binary_id],
  migration_foreign_key: [type: :binary_id]

config :ava_elixir, Oban,
  repo: AvaElixir.Repo,
  plugins: [{Oban.Plugins.Pruner, max_age: 60 * 60 * 24}],
  queues: [default: 10, events: 5, ava_commands: 10, ava_outbox: 10]

config :phoenix, :json_library, Jason

config :ava_elixir, AvaElixirWeb.Endpoint,
  url: [host: "localhost"],
  render_errors: [formats: [json: AvaElixirWeb.ErrorJSON], layout: false],
  pubsub_server: AvaElixir.PubSub,
  live_view: [signing_salt: "ava-live-signing-salt"],
  secret_key_base: "ava_elixir_secret_key_base_for_dev_and_test_replace_in_prod_1234567890"

import_config "#{config_env()}.exs"

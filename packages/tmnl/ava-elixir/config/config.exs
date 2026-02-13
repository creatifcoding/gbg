import Config

config :ava_elixir,
  runtime_mode: :nif,
  native_client: AvaElixir.Native,
  sidecar_client: AvaElixir.SidecarClient,
  channel_token_ttl_seconds: 300

config :phoenix, :json_library, Jason

config :ava_elixir, AvaElixirWeb.Endpoint,
  url: [host: "localhost"],
  render_errors: [formats: [json: AvaElixirWeb.ErrorJSON], layout: false],
  pubsub_server: AvaElixir.PubSub,
  live_view: [signing_salt: "ava-live-signing-salt"],
  secret_key_base: "ava_elixir_secret_key_base_for_dev_and_test_replace_in_prod_1234567890"

import_config "#{config_env()}.exs"

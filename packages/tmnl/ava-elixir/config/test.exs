import Config

config :ava_elixir, AvaElixirWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 4011],
  check_origin: false,
  server: false,
  secret_key_base: "ava_elixir_test_secret_key_base_for_channel_tests_1234567890"

config :logger, level: :warning

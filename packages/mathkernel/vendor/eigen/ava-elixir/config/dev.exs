import Config

config :ava_elixir, AvaElixirWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 4010],
  debug_errors: true,
  code_reloader: false,
  check_origin: false,
  server: false

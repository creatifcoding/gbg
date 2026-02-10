import Config

runtime_mode =
  case System.get_env("AVA_RUNTIME_MODE") do
    nil ->
      :nif

    "nif" ->
      :nif

    "sidecar" ->
      :sidecar

    other ->
      IO.warn("Unknown AVA_RUNTIME_MODE=#{inspect(other)}; defaulting to :nif")
      :nif
  end

config :ava_elixir, :runtime_mode, runtime_mode

if config_env() == :prod do
  secret_key_base =
    System.get_env("AVA_ELIXIR_SECRET_KEY_BASE") ||
      "ava_elixir_prod_secret_key_base_override_me"

  config :ava_elixir, AvaElixirWeb.Endpoint,
    secret_key_base: secret_key_base,
    server: true
end

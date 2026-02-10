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

defmodule AvaElixirWeb.Endpoint do
  use Phoenix.Endpoint, otp_app: :ava_elixir

  @session_options [
    store: :cookie,
    key: "_ava_elixir_key",
    signing_salt: "phoenix-live-salt"
  ]

  socket("/socket", AvaElixirWeb.UserSocket,
    websocket: true,
    longpoll: false,
    auth_token: true
  )

  socket("/live", Phoenix.LiveView.Socket, websocket: [connect_info: [session: @session_options]])

  plug(Plug.RequestId)
  plug(Plug.Telemetry, event_prefix: [:phoenix, :endpoint])

  plug(Plug.Parsers,
    parsers: [:urlencoded, :multipart, :json],
    pass: ["*/*"],
    json_decoder: Phoenix.json_library()
  )

  plug(Plug.MethodOverride)
  plug(Plug.Head)
  plug(Plug.Session, @session_options)
  plug(AvaElixirWeb.Router)
end

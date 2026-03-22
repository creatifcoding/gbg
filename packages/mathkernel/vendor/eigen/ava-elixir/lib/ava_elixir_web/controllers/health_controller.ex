defmodule AvaElixirWeb.HealthController do
  use AvaElixirWeb, :controller

  def index(conn, _params) do
    text(conn, "ava-elixir phoenix endpoint healthy")
  end
end

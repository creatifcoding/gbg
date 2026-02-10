defmodule AvaElixirWeb.Router do
  use AvaElixirWeb, :router

  pipeline :browser do
    plug :accepts, ["html"]
    plug :fetch_session
    plug :fetch_live_flash
    plug :put_secure_browser_headers
  end

  scope "/", AvaElixirWeb do
    pipe_through :browser

    get "/", HealthController, :index
    live "/ops/:workspace_id", OpsLive, :show
  end
end

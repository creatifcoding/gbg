defmodule AvaElixir.Application do
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    AvaElixir.Supervisor.start_link()
  end

  @impl true
  def config_change(changed, removed, _extra) do
    AvaElixirWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end

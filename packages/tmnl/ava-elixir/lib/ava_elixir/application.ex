defmodule AvaElixir.Application do
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    AvaElixir.Supervisor.start_link()
  end
end

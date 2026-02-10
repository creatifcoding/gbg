defmodule AvaElixir.Supervisor do
  @moduledoc false

  use Supervisor

  @spec start_link(keyword()) :: Supervisor.on_start()
  def start_link(opts \\ []) do
    Supervisor.start_link(__MODULE__, :ok, Keyword.put_new(opts, :name, __MODULE__))
  end

  @impl true
  def init(:ok) do
    children = [
      {AvaElixir.FailureProbe, []}
    ]

    Supervisor.init(children, strategy: :one_for_one)
  end
end

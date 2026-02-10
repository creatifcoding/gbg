defmodule AvaElixir.FailureProbe do
  @moduledoc false

  use GenServer

  @spec start_link(keyword()) :: GenServer.on_start()
  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, :ok, Keyword.put_new(opts, :name, __MODULE__))
  end

  @spec pid() :: pid()
  def pid do
    GenServer.call(__MODULE__, :pid)
  end

  @spec crash() :: :ok
  def crash do
    GenServer.cast(__MODULE__, :crash)
  end

  @impl true
  def init(:ok), do: {:ok, %{}}

  @impl true
  def handle_call(:pid, _from, state), do: {:reply, self(), state}

  @impl true
  def handle_cast(:crash, state) do
    raise "failure_probe_crash"
    {:noreply, state}
  end
end

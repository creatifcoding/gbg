defmodule AvaElixir.Bridge.NatsDispatcher do
  @moduledoc """
  Compile-safe egress dispatcher process placeholder.

  Maintains an in-memory queue and periodic flush tick without external transport.
  """

  use GenServer

  require Logger

  @default_flush_interval_ms 1_000

  @type dispatch_entry :: %{subject: binary(), payload: map()}

  @type state :: %{
          flush_interval_ms: pos_integer(),
          queue: :queue.queue(dispatch_entry())
        }

  @spec start_link(keyword()) :: GenServer.on_start()
  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @spec dispatch(binary(), map()) :: :ok
  def dispatch(subject, payload) when is_binary(subject) and is_map(payload) do
    GenServer.cast(__MODULE__, {:dispatch, subject, payload})
  end

  @impl true
  @spec init(keyword()) :: {:ok, state()}
  def init(opts) do
    flush_interval_ms =
      opts
      |> Keyword.get(:flush_interval_ms, configured_flush_interval_ms())

    state = %{flush_interval_ms: flush_interval_ms, queue: :queue.new()}
    schedule_flush_tick(flush_interval_ms)

    {:ok, state}
  end

  @impl true
  def handle_cast({:dispatch, subject, payload}, %{queue: queue} = state) do
    next_queue = :queue.in(%{subject: subject, payload: payload}, queue)
    {:noreply, %{state | queue: next_queue}}
  end

  @impl true
  def handle_info(:flush_tick, %{flush_interval_ms: flush_interval_ms, queue: queue} = state) do
    queued_count = :queue.len(queue)

    if queued_count > 0 do
      Logger.debug("[nats_dispatcher] flush tick (stub) queued_count=#{queued_count}")
    end

    schedule_flush_tick(flush_interval_ms)
    {:noreply, %{state | queue: :queue.new()}}
  end

  @impl true
  def handle_info(message, state) do
    Logger.debug("[nats_dispatcher] unhandled info=#{inspect(message)}")
    {:noreply, state}
  end

  @spec configured_flush_interval_ms() :: pos_integer()
  defp configured_flush_interval_ms do
    configured =
      :ava_elixir
      |> Application.get_env(:nats, [])
      |> Keyword.get(:dispatch_flush_interval_ms, @default_flush_interval_ms)

    if is_integer(configured) and configured > 0 do
      configured
    else
      @default_flush_interval_ms
    end
  end

  @spec schedule_flush_tick(pos_integer()) :: reference()
  defp schedule_flush_tick(flush_interval_ms) do
    Process.send_after(self(), :flush_tick, flush_interval_ms)
  end
end

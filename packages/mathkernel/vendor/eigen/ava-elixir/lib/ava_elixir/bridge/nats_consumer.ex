defmodule AvaElixir.Bridge.NatsConsumer do
  @moduledoc """
  Compile-safe bridge consumer process placeholder.

  This process intentionally does not establish an external NATS connection yet.
  It exists to anchor supervisor wiring and future message handling.
  """

  use GenServer

  require Logger

  @default_subject_prefix "tmnl.ava"

  @type state :: %{
          subject_prefix: binary(),
          runtime_mode: AvaElixir.runtime_mode()
        }

  @spec start_link(keyword()) :: GenServer.on_start()
  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  @spec init(keyword()) :: {:ok, state()}
  def init(opts) do
    subject_prefix =
      opts
      |> Keyword.get(:subject_prefix, configured_subject_prefix())

    runtime_mode =
      opts
      |> Keyword.get(:runtime_mode, AvaElixir.runtime_mode())

    Logger.info("[nats_consumer] init subject_prefix=#{subject_prefix} runtime_mode=#{runtime_mode}")

    {:ok, %{subject_prefix: subject_prefix, runtime_mode: runtime_mode}}
  end

  @impl true
  def handle_info({:nats_msg, subject, payload}, state) when is_binary(subject) do
    Logger.debug("[nats_consumer] stub received subject=#{subject} payload_type=#{payload_type(payload)}")
    {:noreply, state}
  end

  @impl true
  def handle_info({:nats_msg, subject, payload, reply_to}, state)
      when is_binary(subject) and is_binary(reply_to) do
    Logger.debug(
      "[nats_consumer] stub received subject=#{subject} reply_to=#{reply_to} payload_type=#{payload_type(payload)}"
    )

    {:noreply, state}
  end

  @impl true
  def handle_info(message, state) do
    Logger.debug("[nats_consumer] unhandled info=#{inspect(message)}")
    {:noreply, state}
  end

  @spec configured_subject_prefix() :: binary()
  defp configured_subject_prefix do
    :ava_elixir
    |> Application.get_env(:nats, [])
    |> Keyword.get(:subject_prefix, @default_subject_prefix)
  end

  @spec payload_type(term()) :: binary()
  defp payload_type(payload) when is_binary(payload), do: "binary"
  defp payload_type(payload) when is_map(payload), do: "map"
  defp payload_type(payload) when is_list(payload), do: "list"
  defp payload_type(_), do: "other"
end

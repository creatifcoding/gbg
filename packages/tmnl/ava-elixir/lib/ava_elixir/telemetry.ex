defmodule AvaElixir.Telemetry do
  @moduledoc """
  Telemetry emitters for NIF call timings and mailbox pressure.
  """

  @type operation ::
          :register_spec_json
          | :get_spec_json
          | :list_specs
          | :invalidate_view
          | :subscribe
          | :unsubscribe
          | :list_subscriptions

  @spec emit_nif_call(operation(), non_neg_integer(), :ok | :error, AvaElixir.runtime_mode()) ::
          :ok
  def emit_nif_call(operation, duration_us, status, runtime_mode) do
    :telemetry.execute(
      [:ava_elixir, :nif, :call],
      %{duration_us: duration_us},
      %{operation: operation, status: status, runtime_mode: runtime_mode}
    )
  end

  @spec emit_mailbox_pressure(non_neg_integer(), map()) :: :ok
  def emit_mailbox_pressure(queue_len, metadata) do
    :telemetry.execute(
      [:ava_elixir, :mailbox, :pressure],
      %{queue_len: queue_len},
      metadata
    )
  end

  @spec emit_channel_lifecycle(:join | :leave, String.t(), String.t()) :: :ok
  def emit_channel_lifecycle(action, topic, user_id) do
    :telemetry.execute(
      [:ava_elixir, :channel, :lifecycle],
      %{count: 1},
      %{action: action, topic: topic, user_id: user_id}
    )
  end
end

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

  @type ingress_status :: :ok | :error
  @type parity_status :: :match | :mismatch | :missing_expected | :missing_actual | :error

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

  @spec emit_bridge_ingress(String.t(), ingress_status(), AvaElixir.runtime_mode(), String.t() | nil) ::
          :ok
  def emit_bridge_ingress(subject, status, runtime_mode, view_id) do
    :telemetry.execute(
      [:ava_elixir, :bridge, :ingress],
      %{count: 1},
      %{subject: subject, status: status, runtime_mode: runtime_mode, view_id: view_id}
    )
  end

  @spec emit_dual_run_parity(String.t(), parity_status(), String.t(), String.t()) :: :ok
  def emit_dual_run_parity(view_id, parity_status, expected_hash, actual_hash) do
    :telemetry.execute(
      [:ava_elixir, :bridge, :dual_run, :parity],
      %{count: 1},
      %{
        view_id: view_id,
        parity_status: parity_status,
        expected_hash: expected_hash,
        actual_hash: actual_hash
      }
    )
  end
end

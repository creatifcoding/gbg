defmodule AvaElixir.Bridge.NatsEgress do
  @moduledoc """
  NATS egress bridge stub for AVA outbound events.

  Full transport wiring is intentionally deferred; this module provides a
  compile-safe seam for Oban outbox execution.
  """

  require Logger

  @spec publish(binary(), map()) :: :ok | {:error, term()}
  def publish(subject, payload) when is_binary(subject) and is_map(payload) do
    if Application.get_env(:ava_elixir, :nats_egress_disabled, false) do
      {:error, :egress_disabled}
    else
      Logger.debug("[nats_egress] TODO publish subject=#{subject} payload_keys=#{inspect(Map.keys(payload))}")
      :ok
    end
  end

  @spec canonical_subject(:invalidate | :subscribe | :unsubscribe, binary()) :: binary()
  def canonical_subject(action, view_id) when action in [:invalidate, :subscribe, :unsubscribe] and is_binary(view_id) do
    "tmnl.ava.#{action}.#{view_id}"
  end
end

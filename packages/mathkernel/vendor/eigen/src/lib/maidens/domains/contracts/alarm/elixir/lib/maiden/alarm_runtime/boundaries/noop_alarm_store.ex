defmodule Maiden.AlarmRuntime.Boundaries.NoopAlarmStore do
  @moduledoc """
  Default no-op AlarmStore adapter.

  Replace via `config :maiden_alarm_runtime, :alarm_store_adapter, YourAdapter`.
  """

  @behaviour Maiden.AlarmRuntime.Boundaries.AlarmStore

  @impl true
  def persist_transition(_event, _metadata, _opts), do: :ok
end

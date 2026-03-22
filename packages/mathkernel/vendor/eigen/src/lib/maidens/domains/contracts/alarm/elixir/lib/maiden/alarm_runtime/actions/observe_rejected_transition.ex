defmodule Maiden.AlarmRuntime.Actions.ObserveRejectedTransition do
  @moduledoc """
  Observer action for rejected transition envelopes.

  This action intentionally does not mutate alarm state. It exists so
  `alarm.transition.rejected` signals are routed explicitly instead of
  falling through to default/no-route paths.
  """

  require Logger

  use Jido.Action,
    name: "observe_rejected_transition",
    description: "Observe preflight-rejected alarm transitions",
    schema: [
      alarm_id: [type: :string],
      from: [type: :string],
      to: [type: :string],
      at: [type: :string],
      reason: [type: :string],
      attempted_signal: [type: :string],
      trace_id: [type: :string],
      validator: [type: :atom],
      observed_at: [type: :string],
      error: [type: :any]
    ]

  @impl true
  def run(params, _context) when is_map(params) do
    Logger.warning("alarm.transition.rejected observed", rejection: params)
    {:ok, %{}}
  end

  def run(_params, _context), do: {:ok, %{}}
end

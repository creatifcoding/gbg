defmodule Maiden.LineRuntime.Actions.ObserveRejectedTransition do
  @moduledoc """
  Observer action for preflight-rejected transition envelopes.
  """

  require Logger

  use Jido.Action,
    name: "observe_rejected_transition",
    description: "Observe preflight-rejected line transitions",
    schema: [
      line_id: [type: :string],
      from: [type: :string],
      to: [type: :string],
      at: [type: :string],
      reason: [type: :string],
      initiated_by: [type: :string],
      attempted_signal: [type: :string],
      trace_id: [type: :string],
      validator: [type: :atom],
      observed_at: [type: :string],
      error: [type: :any]
    ]

  @impl true
  def run(params, _context) when is_map(params) do
    Logger.warning("line.transition.rejected observed", rejection: params)
    {:ok, %{}}
  end

  def run(_params, _context), do: {:ok, %{}}
end

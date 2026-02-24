defmodule Maiden.AssetRuntime.Actions.ObserveRejectedTransition do
  @moduledoc """
  Observer action for preflight-rejected transition envelopes.

  This action is state-local and side-effect free.
  """

  use Jido.Action,
    name: "observe_rejected_transition",
    description: "Observe preflight-rejected asset transitions",
    schema: [
      asset_id: [type: :string],
      kind: [type: :string],
      from: [type: :string],
      to: [type: :string],
      action: [type: :string],
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
  def run(params, context) when is_map(params) do
    metadata =
      context.state[:metadata]
      |> ensure_map()
      |> Map.put("last_rejected_transition", normalize_rejection(params))

    {:ok, %{metadata: metadata}}
  end

  def run(_params, _context), do: {:ok, %{}}

  defp normalize_rejection(params) do
    Enum.reduce(params, %{}, fn {key, value}, acc ->
      normalized_key = if is_atom(key), do: Atom.to_string(key), else: key
      Map.put(acc, normalized_key, value)
    end)
  end

  defp ensure_map(value) when is_map(value), do: value
  defp ensure_map(_value), do: %{}
end

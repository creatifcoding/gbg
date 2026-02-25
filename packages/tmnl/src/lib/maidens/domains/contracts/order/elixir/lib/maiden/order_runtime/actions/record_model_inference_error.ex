defmodule Maiden.OrderRuntime.Actions.RecordModelInferenceError do
  @moduledoc """
  Pure action that records model inference failure.
  """

  use Jido.Action,
    name: "record_model_inference_error",
    description: "Record model inference error",
    schema: [
      request_id: [type: :string, required: true],
      model: [type: :string],
      error: [type: :any, required: true]
    ]

  @impl true
  def run(params, context) when is_map(params) do
    request_id = fetch_param(params, :request_id)
    model = fetch_param(params, :model)
    error = fetch_param(params, :error)

    state_request_id = context.state[:model_request_id]
    state_status = context.state[:model_status]

    cond do
      state_status != "pending" ->
        {:error, "model inference error rejected: no pending request"}

      state_request_id == nil ->
        {:error, "model inference error rejected: pending request_id missing"}

      state_request_id != request_id ->
        {:error, "model inference error request_id mismatch"}

      true ->
        {:ok,
         %{
           model_request_id: request_id,
           model_name: model || context.state[:model_name],
           model_status: "failed",
           model_result: nil,
           model_error: error
         }}
    end
  end

  def run(_params, _context), do: {:error, "RecordModelInferenceError requires request_id/error"}

  defp fetch_param(params, key) do
    Map.get(params, key) || Map.get(params, Atom.to_string(key))
  end
end

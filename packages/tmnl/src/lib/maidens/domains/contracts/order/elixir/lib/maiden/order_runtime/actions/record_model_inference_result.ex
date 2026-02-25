defmodule Maiden.OrderRuntime.Actions.RecordModelInferenceResult do
  @moduledoc """
  Pure action that records successful model inference completion.
  """

  use Jido.Action,
    name: "record_model_inference_result",
    description: "Record model inference result",
    schema: [
      request_id: [type: :string, required: true],
      model: [type: :string],
      result: [type: :any, required: true]
    ]

  @impl true
  def run(params, context) when is_map(params) do
    request_id = fetch_param(params, :request_id)
    model = fetch_param(params, :model)
    result = fetch_param(params, :result)

    state_request_id = context.state[:model_request_id]
    state_status = context.state[:model_status]

    cond do
      state_status != "pending" ->
        {:error, "model inference result rejected: no pending request"}

      state_request_id == nil ->
        {:error, "model inference result rejected: pending request_id missing"}

      state_request_id != request_id ->
        {:error, "model inference result request_id mismatch"}

      true ->
        {:ok,
         %{
           model_request_id: request_id,
           model_name: model || context.state[:model_name],
           model_status: "completed",
           model_result: result,
           model_error: nil
         }}
    end
  end

  def run(_params, _context), do: {:error, "RecordModelInferenceResult requires request_id/result"}

  defp fetch_param(params, key) do
    Map.get(params, key) || Map.get(params, Atom.to_string(key))
  end
end

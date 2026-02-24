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

    if context.state[:model_request_id] in [nil, request_id] do
      {:ok,
       %{
         model_request_id: request_id,
         model_name: model || context.state[:model_name],
         model_status: "completed",
         model_result: result,
         model_error: nil
       }}
    else
      {:error, "model request_id mismatch for result"}
    end
  end

  def run(_params, _context), do: {:error, "RecordModelInferenceResult requires request_id/result"}

  defp fetch_param(params, key) do
    Map.get(params, key) || Map.get(params, Atom.to_string(key))
  end
end

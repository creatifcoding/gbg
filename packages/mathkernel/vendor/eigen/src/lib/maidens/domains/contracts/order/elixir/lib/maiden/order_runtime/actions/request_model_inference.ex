defmodule Maiden.OrderRuntime.Actions.RequestModelInference do
  @moduledoc """
  Pure action that marks model inference pending and emits inference directive.
  """

  alias Maiden.OrderRuntime.Directives.CallModelInference

  use Jido.Action,
    name: "request_model_inference",
    description: "Request model inference for order runtime",
    schema: [
      request_id: [type: :string, required: true],
      model: [type: :string, required: true],
      prompt: [type: :string, required: true],
      options: [type: :map, default: %{}]
    ]

  @impl true
  def run(params, _context) when is_map(params) do
    request_id = fetch_param(params, :request_id)
    model = fetch_param(params, :model)
    prompt = fetch_param(params, :prompt)
    options = fetch_param(params, :options) || %{}

    directive = %CallModelInference{
      request_id: request_id,
      model: model,
      prompt: prompt,
      options: options
    }

    {:ok,
     %{
       model_request_id: request_id,
       model_name: model,
       model_prompt: prompt,
       model_options: options,
       model_status: "pending",
       model_result: nil,
       model_error: nil
     }, [directive]}
  end

  def run(_params, _context), do: {:error, "RequestModelInference requires request_id/model/prompt"}

  defp fetch_param(params, key) do
    Map.get(params, key) || Map.get(params, Atom.to_string(key))
  end
end

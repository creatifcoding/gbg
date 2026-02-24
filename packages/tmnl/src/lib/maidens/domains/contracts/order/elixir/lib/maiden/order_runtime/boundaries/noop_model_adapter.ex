defmodule Maiden.OrderRuntime.Boundaries.NoopModelAdapter do
  @moduledoc """
  Default no-op model adapter.

  Replace via `config :maiden_order_runtime, :model_adapter, YourAdapter`.
  """

  @behaviour Maiden.OrderRuntime.Boundaries.ModelAdapter

  @impl true
  def infer_model(prompt, opts) do
    normalized_opts = if is_map(opts), do: opts, else: Map.new(opts)

    {:ok,
     %{
       request_id: Map.get(normalized_opts, :request_id) || Map.get(normalized_opts, "request_id"),
       model: Map.get(normalized_opts, :model) || Map.get(normalized_opts, "model") || "noop",
       content: "noop: #{prompt}"
     }}
  end
end

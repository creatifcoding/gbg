defmodule Maiden.OrderRuntime.Boundaries do
  @moduledoc """
  Boundary façade for strategy-emitted transition directives.

  Decouples Jido strategy execution from Ash/Ecto persistence and Oban queueing.
  """

  alias Maiden.OrderRuntime.Boundaries.{
    NoopJobQueue,
    NoopModelAdapter,
    NoopOrderStore,
    PiAuthModelAdapter
  }

  @app :maiden_order_runtime

  @spec persist_transition(map(), map(), keyword()) :: :ok | {:error, term()}
  def persist_transition(event, metadata, opts \\ []) when is_map(event) and is_map(metadata) do
    adapter = order_store_adapter()
    adapter.persist_transition(event, metadata, opts)
  end

  @spec enqueue_transition(map(), keyword()) :: :ok | {:error, term()}
  def enqueue_transition(event, opts \\ []) when is_map(event) do
    adapter = job_queue_adapter()
    adapter.enqueue_transition(event, opts)
  end

  @spec infer_model(String.t(), map() | keyword()) :: {:ok, term()} | {:error, term()}
  def infer_model(prompt, opts \\ []) when is_binary(prompt) and (is_map(opts) or is_list(opts)) do
    adapter = model_adapter()
    adapter.infer_model(prompt, opts)
  end

  @spec order_store_adapter() :: module()
  def order_store_adapter do
    Application.get_env(@app, :order_store_adapter, NoopOrderStore)
  end

  @spec job_queue_adapter() :: module()
  def job_queue_adapter do
    Application.get_env(@app, :job_queue_adapter, NoopJobQueue)
  end

  @spec model_adapter() :: module()
  def model_adapter do
    case Application.get_env(@app, :model_adapter) do
      nil -> default_model_adapter()
      adapter -> adapter
    end
  end

  defp default_model_adapter do
    case String.downcase(System.get_env("ORDER_MODEL_ADAPTER", "noop")) do
      "pi_auth" -> PiAuthModelAdapter
      "live" -> PiAuthModelAdapter
      _ -> NoopModelAdapter
    end
  end
end

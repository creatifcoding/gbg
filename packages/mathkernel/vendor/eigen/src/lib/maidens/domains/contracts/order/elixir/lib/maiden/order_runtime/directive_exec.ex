defimpl Jido.AgentServer.DirectiveExec, for: Maiden.OrderRuntime.Directives.PersistTransition do
  @moduledoc false

  require Logger

  alias Maiden.OrderRuntime.Boundaries

  def exec(%{event: event, metadata: metadata}, _input_signal, state) do
    case Boundaries.persist_transition(event, metadata, agent_id: state.id) do
      :ok ->
        {:ok, state}

      {:error, reason} ->
        Logger.warning("order boundary persist_transition failed: #{inspect(reason)}")
        {:ok, state}
    end
  end
end

defimpl Jido.AgentServer.DirectiveExec, for: Maiden.OrderRuntime.Directives.EnqueueTransitionJob do
  @moduledoc false

  require Logger

  alias Maiden.OrderRuntime.Boundaries

  def exec(%{event: event, opts: opts}, _input_signal, state) do
    merged_opts = Keyword.put_new(opts || [], :agent_id, state.id)

    case Boundaries.enqueue_transition(event, merged_opts) do
      :ok ->
        {:ok, state}

      {:error, reason} ->
        Logger.warning("order boundary enqueue_transition failed: #{inspect(reason)}")
        {:ok, state}
    end
  end
end

defimpl Jido.AgentServer.DirectiveExec, for: Maiden.OrderRuntime.Directives.CallModelInference do
  @moduledoc false

  require Logger

  alias Maiden.OrderRuntime.Boundaries

  def exec(%{request_id: request_id, model: model, prompt: prompt, options: options}, _input_signal, state) do
    opts = normalize_options(options, request_id, model)

    signal =
      case safe_infer_model(prompt, opts) do
        {:ok, result} ->
          Jido.Signal.new!(
            "order.model.result",
            %{request_id: request_id, model: model, result: result},
            source: "/directive/order/model-inference"
          )

        {:error, reason} ->
          Jido.Signal.new!(
            "order.model.error",
            %{request_id: request_id, model: model, error: normalize_error(reason)},
            source: "/directive/order/model-inference"
          )
      end

    send(self(), {:signal, signal})
    {:ok, state}
  end

  defp safe_infer_model(prompt, opts) do
    Boundaries.infer_model(prompt, opts)
  rescue
    error -> {:error, error}
  catch
    kind, reason -> {:error, {kind, reason}}
  end

  defp normalize_options(options, request_id, model) when is_map(options) do
    options
    |> Map.put_new(:request_id, request_id)
    |> Map.put_new(:model, model)
  end

  defp normalize_options(options, request_id, model) when is_list(options) do
    options
    |> Keyword.put_new(:request_id, request_id)
    |> Keyword.put_new(:model, model)
  end

  defp normalize_options(_, request_id, model), do: %{request_id: request_id, model: model}

  defp normalize_error(%_{} = error), do: Exception.message(error)
  defp normalize_error(error), do: error
end

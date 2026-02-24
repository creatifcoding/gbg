defimpl Jido.AgentServer.DirectiveExec,
  for: Maiden.EquipmentStateRuntime.Directives.PersistTransition do
  @moduledoc false

  require Logger

  alias Maiden.EquipmentStateRuntime.Boundaries

  def exec(%{event: event, metadata: metadata}, _input_signal, state) do
    case Boundaries.persist_transition(event, metadata, agent_id: state.id) do
      :ok ->
        {:ok, state}

      {:error, reason} ->
        Logger.warning("equipment-state boundary persist_transition failed: #{inspect(reason)}")
        {:ok, state}
    end
  end
end

defimpl Jido.AgentServer.DirectiveExec,
  for: Maiden.EquipmentStateRuntime.Directives.EnqueueTransitionJob do
  @moduledoc false

  require Logger

  alias Maiden.EquipmentStateRuntime.Boundaries

  def exec(%{event: event, opts: opts}, _input_signal, state) do
    merged_opts = Keyword.put_new(opts || [], :agent_id, state.id)

    case Boundaries.enqueue_transition(event, merged_opts) do
      :ok ->
        {:ok, state}

      {:error, reason} ->
        Logger.warning("equipment-state boundary enqueue_transition failed: #{inspect(reason)}")
        {:ok, state}
    end
  end
end

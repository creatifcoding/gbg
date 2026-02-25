defmodule Maiden.OrderRuntime.Agent do
  @moduledoc """
  Jido-facing Order runtime agent.

  Provenance:
  - Jido agent behavior/strategy: `use Jido.Agent`, FSM transitions, `cmd/2` pure contract.
  - Elixir validator behavior: external payload preflight before command dispatch.
  """

  alias Maiden.OrderRuntime.Actions.CancelOrder
  alias Maiden.OrderRuntime.Actions.ConfirmOrder
  alias Maiden.OrderRuntime.Actions.DeliverOrder
  alias Maiden.OrderRuntime.Actions.ObserveRejectedTransition
  alias Maiden.OrderRuntime.Actions.RecordModelInferenceError
  alias Maiden.OrderRuntime.Actions.RecordModelInferenceResult
  alias Maiden.OrderRuntime.Actions.RequestModelInference
  alias Maiden.OrderRuntime.Actions.ShipOrder
  alias Maiden.OrderRuntime.Boundaries
  alias Maiden.OrderRuntime.Directives.{EnqueueTransitionJob, PersistTransition}
  alias Maiden.OrderRuntime.Strategies.SignalFsm

  use Jido.Agent,
    name: "order_runtime_agent",
    description: "Order lifecycle runtime agent with FSM strategy",
    schema: [
      order_id: [type: :string],
      customer: [type: :string],
      items: [type: {:list, :map}, default: []],
      total: [type: :float, default: 0.0],
      cancelled_reason: [type: :any, default: nil],
      shipped_at: [type: :any, default: nil],
      delivered_at: [type: :any, default: nil],
      model_request_id: [type: :any, default: nil],
      model_name: [type: :any, default: nil],
      model_prompt: [type: :any, default: nil],
      model_options: [type: :map, default: %{}],
      model_status: [type: :string, default: "idle"],
      model_result: [type: :any, default: nil],
      model_error: [type: :any, default: nil]
    ],
    # Jido signal_routes surface: runtime can map matching signal types to actions.
    signal_routes: [
      {"order.transition.confirmed", ConfirmOrder},
      {"order.transition.shipped", ShipOrder},
      {"order.transition.delivered", DeliverOrder},
      {"order.transition.cancelled", CancelOrder},
      {"order.transition.rejected", ObserveRejectedTransition},
      {"order.model.request", RequestModelInference},
      {"order.model.result", RecordModelInferenceResult},
      {"order.model.error", RecordModelInferenceError}
    ],
    # Signal-first strategy delegates FSM execution + emits persistence/job directives.
    # Domain transition legality is enforced separately in Maiden.OrderRuntime.FSM.
    strategy:
      {SignalFsm,
       initial_state: "idle",
       transitions: %{
         "idle" => ["processing"],
         "processing" => ["idle", "completed", "failed"],
         "completed" => ["idle"],
         "failed" => ["idle"]
       },
       auto_transition: true,
       bridge_persistence?: true,
       bridge_jobs?: true,
       job_queue: :order_runtime_transition}

  alias Maiden.OrderRuntime.FSM
  alias Maiden.OrderRuntime.Validators.OrderValidator

  @transition_actions [ConfirmOrder, ShipOrder, DeliverOrder, CancelOrder]
  @model_actions [RequestModelInference, RecordModelInferenceResult, RecordModelInferenceError]

  @signal_to_action %{
    "order.transition.confirmed" => ConfirmOrder,
    "order.transition.shipped" => ShipOrder,
    "order.transition.delivered" => DeliverOrder,
    "order.transition.cancelled" => CancelOrder,
    "order.model.request" => RequestModelInference,
    "order.model.result" => RecordModelInferenceResult,
    "order.model.error" => RecordModelInferenceError
  }

  @persisted_contract_keys [
    :order_id,
    :customer,
    :items,
    :total,
    :cancelled_reason,
    :shipped_at,
    :delivered_at,
    :model_request_id,
    :model_name,
    :model_prompt,
    :model_options,
    :model_status,
    :model_result,
    :model_error
  ]

  @doc """
  Preflight transition payload using JSON Schema + FSM legality.
  Call this before dispatching transition-driven actions to `cmd/2`.
  """
  @spec preflight_transition(map(), keyword()) :: :ok | {:error, term()}
  def preflight_transition(payload, opts \\ []) do
    FSM.validate_transition_for_jido(payload, opts)
  end

  @doc """
  Preflight raw agent-state payload against generated Jido state contract.
  This runs before Jido's internal `validate/2` when ingesting external state snapshots.
  """
  @spec preflight_agent_state(map(), keyword()) :: :ok | {:error, term()}
  def preflight_agent_state(payload, opts \\ []) do
    OrderValidator.agent_state_validate(payload, opts)
  end

  @doc """
  Custom checkpoint serializer for Jido.Persist.

  Keeps order contract state and strategy snapshot (`:__strategy__`) for continuity.
  """
  @spec checkpoint(struct(), map()) :: {:ok, map()} | {:error, term()}
  def checkpoint(agent, _ctx) do
    {:ok,
     %{
       version: 1,
       agent_module: __MODULE__,
       id: agent.id,
       state:
         agent.state
         |> Map.take(@persisted_contract_keys ++ [:__strategy__]),
       metadata: %{
         domain: "order_runtime",
         persisted_at: DateTime.utc_now() |> DateTime.to_iso8601()
       }
     }}
  end

  @doc """
  Custom restore deserializer for Jido.Persist.

  Validates restored order contract state before rehydrating the agent.
  """
  @spec restore(map(), map()) :: {:ok, struct()} | {:error, term()}
  def restore(checkpoint, _ctx) when is_map(checkpoint) do
    with {:ok, id} <- checkpoint_id(checkpoint),
         {:ok, restored_state} <- checkpoint_state(checkpoint),
         :ok <- validate_checkpoint_state(restored_state),
         {:ok, base_agent} <- new_agent_with_id(id) do
      merged_state =
        base_agent.state
        |> Map.merge(Map.drop(restored_state, [:__strategy__]))
        |> Map.put(
          :__strategy__,
          Map.get(restored_state, :__strategy__, base_agent.state[:__strategy__])
        )

      {:ok, %{base_agent | state: merged_state}}
    end
  end

  @doc """
  Return supported transition action modules.
  """
  @spec transition_actions() :: [module()]
  def transition_actions, do: @transition_actions

  @doc """
  Resolve action module for a transition signal type.
  """
  @spec action_for_signal(String.t()) :: {:ok, module()} | {:error, :unknown_signal_type}
  def action_for_signal(signal_type) when is_binary(signal_type) do
    case Map.fetch(@signal_to_action, signal_type) do
      {:ok, action} -> {:ok, action}
      :error -> {:error, :unknown_signal_type}
    end
  end

  @doc """
  Apply transition action with preflight validation before `cmd/2`.
  """
  @spec apply_transition(struct(), module(), map(), keyword()) ::
          {:ok, Jido.Agent.cmd_result()} | {:error, term()}
  def apply_transition(agent, action, payload, opts \\ [])

  def apply_transition(agent, action, payload, opts)
      when is_map(payload) and action in @transition_actions do
    with :ok <- preflight_transition(payload, opts) do
      {:ok, cmd(agent, {action, normalize_transition_payload(payload)})}
    end
  end

  def apply_transition(_agent, _action, _payload, _opts),
    do: {:error, :unsupported_transition_action}

  @doc """
  Apply transition from signal type + payload.
  """
  @spec apply_signal(struct(), String.t(), map(), keyword()) ::
          {:ok, Jido.Agent.cmd_result()} | {:error, term()}
  def apply_signal(agent, signal_type, payload, opts \\ []) when is_map(payload) do
    with {:ok, action} <- action_for_signal(signal_type) do
      cond do
        action in @transition_actions ->
          apply_transition(agent, action, payload, opts)

        action in @model_actions ->
          {:ok, cmd(agent, {action, payload})}

        true ->
          {:error, :unsupported_signal_action}
      end
    end
  end

  @doc """
  Apply transition signal and resolve runtime RunInstruction directives synchronously.

  This simulates the AgentServer directive-execution loop for `%RunInstruction{}`:
  - execute instruction with `Jido.Exec.run/1`
  - route result back through `cmd/2` with strategy `result_action`
  - recursively resolve any additional `%RunInstruction{}` directives

  Non-RunInstruction directives are returned as unresolved external effects.
  """
  @spec apply_signal_sync(struct(), String.t(), map(), keyword()) ::
          {:ok, struct(), [term()]} | {:error, term()}
  def apply_signal_sync(agent, signal_type, payload, opts \\ []) when is_map(payload) do
    with {:ok, {next_agent, directives}} <- apply_signal(agent, signal_type, payload, opts) do
      resolve_runtime_directives(next_agent, directives)
    end
  end

  @doc """
  Resolve `%RunInstruction{}` directives and return updated agent + unresolved external directives.
  """
  @spec resolve_runtime_directives(struct(), [term()]) ::
          {:ok, struct(), [term()]} | {:error, term()}
  def resolve_runtime_directives(agent, directives) when is_list(directives) do
    Enum.reduce_while(directives, {:ok, agent, []}, fn directive,
                                                       {:ok, current_agent, unresolved} ->
      case execute_runtime_directive(current_agent, directive) do
        {:ok, updated_agent, nested_directives} ->
          case resolve_runtime_directives(updated_agent, List.wrap(nested_directives)) do
            {:ok, recursively_updated_agent, recursively_unresolved} ->
              {:cont, {:ok, recursively_updated_agent, unresolved ++ recursively_unresolved}}

            {:error, _} = error ->
              {:halt, error}
          end

        {:passthrough, passthrough_directive} ->
          {:cont, {:ok, current_agent, unresolved ++ [passthrough_directive]}}

        {:error, _} = error ->
          {:halt, error}
      end
    end)
  end

  def resolve_runtime_directives(agent, _directives), do: {:ok, agent, []}

  defp execute_runtime_directive(
         agent,
         %Jido.Agent.Directive.RunInstruction{
           instruction: instruction,
           result_action: result_action,
           meta: meta
         }
       ) do
    enriched_instruction = %{
      instruction
      | context: Map.put(instruction.context || %{}, :state, agent.state)
    }

    execution_payload =
      enriched_instruction
      |> Jido.Exec.run()
      |> normalize_result_payload()
      |> Map.put(:instruction, instruction)
      |> Map.put(:meta, meta || %{})

    {updated_agent, directives} = cmd(agent, {result_action, execution_payload})
    {:ok, updated_agent, directives}
  end

  defp execute_runtime_directive(agent, %PersistTransition{event: event, metadata: metadata}) do
    case Boundaries.persist_transition(event, metadata, caller: self()) do
      :ok -> {:ok, agent, []}
      {:error, reason} -> {:error, reason}
    end
  end

  defp execute_runtime_directive(agent, %EnqueueTransitionJob{event: event, opts: opts}) do
    case Boundaries.enqueue_transition(event, Keyword.put_new(opts || [], :caller, self())) do
      :ok -> {:ok, agent, []}
      {:error, reason} -> {:error, reason}
    end
  end

  defp execute_runtime_directive(_agent, %Jido.Agent.Directive.Error{error: error}),
    do: {:error, error}

  defp execute_runtime_directive(_agent, directive), do: {:passthrough, directive}

  defp normalize_transition_payload(payload) when is_map(payload) do
    %{}
    |> put_if_present(:order_id, payload)
    |> put_if_present(:from, payload)
    |> put_if_present(:to, payload)
    |> put_if_present(:at, payload)
    |> put_if_present(:reason, payload)
  end

  defp checkpoint_id(checkpoint) do
    case checkpoint[:id] || checkpoint["id"] do
      id when is_binary(id) -> {:ok, id}
      nil -> {:error, :missing_checkpoint_id}
      other -> {:ok, to_string(other)}
    end
  end

  defp checkpoint_state(checkpoint) do
    raw_state = checkpoint[:state] || checkpoint["state"] || %{}
    {:ok, normalize_checkpoint_state(raw_state)}
  end

  defp normalize_checkpoint_state(state) when is_map(state) do
    Enum.reduce(state, %{}, fn {key, value}, acc ->
      Map.put(acc, normalize_state_key(key), value)
    end)
  end

  defp normalize_state_key("order_id"), do: :order_id
  defp normalize_state_key("customer"), do: :customer
  defp normalize_state_key("items"), do: :items
  defp normalize_state_key("total"), do: :total
  defp normalize_state_key("cancelled_reason"), do: :cancelled_reason
  defp normalize_state_key("shipped_at"), do: :shipped_at
  defp normalize_state_key("delivered_at"), do: :delivered_at
  defp normalize_state_key("model_request_id"), do: :model_request_id
  defp normalize_state_key("model_name"), do: :model_name
  defp normalize_state_key("model_prompt"), do: :model_prompt
  defp normalize_state_key("model_options"), do: :model_options
  defp normalize_state_key("model_status"), do: :model_status
  defp normalize_state_key("model_result"), do: :model_result
  defp normalize_state_key("model_error"), do: :model_error
  defp normalize_state_key("__strategy__"), do: :__strategy__
  defp normalize_state_key(key), do: key

  defp validate_checkpoint_state(state) do
    payload =
      Enum.reduce(@persisted_contract_keys, %{}, fn key, acc ->
        Map.put(acc, Atom.to_string(key), Map.get(state, key))
      end)

    preflight_agent_state(payload)
  end

  defp new_agent_with_id(id) do
    case new(id: id) do
      agent when is_struct(agent) -> {:ok, agent}
      {:ok, agent} -> {:ok, agent}
      {:error, _} = error -> error
    end
  end

  defp put_if_present(acc, key, payload) do
    case fetch_payload(payload, key) do
      nil -> acc
      value -> Map.put(acc, key, value)
    end
  end

  defp fetch_payload(payload, key) do
    Map.get(payload, key) || Map.get(payload, Atom.to_string(key))
  end

  defp normalize_result_payload({:ok, result}) do
    %{status: :ok, result: result, effects: []}
  end

  defp normalize_result_payload({:ok, result, effects}) do
    %{status: :ok, result: result, effects: List.wrap(effects)}
  end

  defp normalize_result_payload({:error, reason}) do
    %{status: :error, reason: reason, effects: []}
  end

  defp normalize_result_payload({:error, reason, effects}) do
    %{status: :error, reason: reason, effects: List.wrap(effects)}
  end
end

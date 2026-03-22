defmodule Maiden.SensorAssetRuntime.Agent do
  @moduledoc """
  Jido-facing sensor-asset runtime agent.

  ISA-95 alignment:
  - Sensor asset is a control-module lane (leaf instrumentation) under machine/work-cell hierarchy.
  """

  alias Maiden.SensorAssetRuntime.Actions.{ObserveRejectedTransition, SetSensorAssetStatus}
  alias Maiden.SensorAssetRuntime.Boundaries
  alias Maiden.SensorAssetRuntime.Directives.{EnqueueTransitionJob, PersistTransition}
  alias Maiden.SensorAssetRuntime.FSM
  alias Maiden.SensorAssetRuntime.Strategies.SignalFsm
  alias Maiden.SensorAssetRuntime.Validators.SensorAssetValidator

  use Jido.Agent,
    name: "sensor_asset_runtime_agent",
    description: "Sensor-asset lifecycle runtime agent with signal-first strategy",
    schema: [
      sensor_id: [type: :string],
      name: [type: :string],
      status: [type: :string],
      sensor_type: [type: :string],
      unit: [type: :string],
      sample_rate_ms: [type: :any, default: nil],
      threshold_high: [type: :any, default: nil],
      threshold_critical: [type: :any, default: nil],
      threshold_low: [type: :any, default: nil],
      threshold_critical_low: [type: :any, default: nil],
      last_calibration_date: [type: :any, default: nil],
      next_calibration_date: [type: :any, default: nil],
      opc_ua_node_id: [type: :any, default: nil],
      description: [type: :any, default: nil],
      location: [type: :any, default: nil],
      metadata: [type: :map, default: %{}],
      hierarchy_path: [type: :string],
      enterprise_id: [type: :any, default: nil],
      site_id: [type: :any, default: nil],
      area_id: [type: :any, default: nil],
      plant_id: [type: :any, default: nil],
      line_id: [type: :any, default: nil],
      work_cell_id: [type: :any, default: nil],
      machine_id: [type: :any, default: nil],
      created_at: [type: :string],
      updated_at: [type: :any, default: nil]
    ],
    signal_routes: [
      {"sensor_asset.transition.active", SetSensorAssetStatus},
      {"sensor_asset.transition.calibrating", SetSensorAssetStatus},
      {"sensor_asset.transition.needs_calibration", SetSensorAssetStatus},
      {"sensor_asset.transition.faulted", SetSensorAssetStatus},
      {"sensor_asset.transition.offline", SetSensorAssetStatus},
      {"sensor_asset.transition.decommissioned", SetSensorAssetStatus},
      {"sensor_asset.transition.rejected", ObserveRejectedTransition}
    ],
    strategy:
      {SignalFsm,
       # Strategy FSM models instruction execution flow; canonical domain
       # transitions are enforced by Maiden.SensorAssetRuntime.FSM.
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
       job_queue: :sensor_asset_runtime_transition}

  @transition_actions [SetSensorAssetStatus]
  @observation_actions [ObserveRejectedTransition]

  @signal_to_action %{
    "sensor_asset.transition.active" => SetSensorAssetStatus,
    "sensor_asset.transition.calibrating" => SetSensorAssetStatus,
    "sensor_asset.transition.needs_calibration" => SetSensorAssetStatus,
    "sensor_asset.transition.faulted" => SetSensorAssetStatus,
    "sensor_asset.transition.offline" => SetSensorAssetStatus,
    "sensor_asset.transition.decommissioned" => SetSensorAssetStatus,
    "sensor_asset.transition.rejected" => ObserveRejectedTransition
  }

  @persisted_contract_keys [
    :sensor_id,
    :name,
    :status,
    :sensor_type,
    :unit,
    :sample_rate_ms,
    :threshold_high,
    :threshold_critical,
    :threshold_low,
    :threshold_critical_low,
    :last_calibration_date,
    :next_calibration_date,
    :opc_ua_node_id,
    :description,
    :location,
    :metadata,
    :hierarchy_path,
    :enterprise_id,
    :site_id,
    :area_id,
    :plant_id,
    :line_id,
    :work_cell_id,
    :machine_id,
    :created_at,
    :updated_at
  ]

  @spec preflight_transition(map(), keyword()) :: :ok | {:error, term()}
  def preflight_transition(payload, opts \\ []),
    do: FSM.validate_transition_for_runtime(payload, opts)

  @spec preflight_agent_state(map(), keyword()) :: :ok | {:error, term()}
  def preflight_agent_state(payload, opts \\ []),
    do: SensorAssetValidator.agent_state_validate(payload, opts)

  @spec checkpoint(struct(), map()) :: {:ok, map()} | {:error, term()}
  def checkpoint(agent, _ctx) do
    {:ok,
     %{
       version: 1,
       agent_module: __MODULE__,
       id: agent.id,
       state: Map.take(agent.state, @persisted_contract_keys ++ [:__strategy__]),
       metadata: %{
         domain: "sensor_asset_runtime",
         persisted_at: DateTime.utc_now() |> DateTime.to_iso8601()
       }
     }}
  end

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

  @spec transition_actions() :: [module()]
  def transition_actions, do: @transition_actions

  @spec action_for_signal(String.t()) :: {:ok, module()} | {:error, :unknown_signal_type}
  def action_for_signal(signal_type) when is_binary(signal_type) do
    case Map.fetch(@signal_to_action, signal_type) do
      {:ok, action} -> {:ok, action}
      :error -> {:error, :unknown_signal_type}
    end
  end

  @spec apply_transition(struct(), module(), map(), keyword()) ::
          {:ok, Jido.Agent.cmd_result()} | {:error, term()}
  def apply_transition(agent, action, payload, opts \\ [])

  def apply_transition(agent, action, payload, opts)
      when is_map(payload) and action in @transition_actions do
    with :ok <- preflight_transition(payload, opts) do
      {:ok, cmd(agent, {action, normalize_transition_payload(payload)})}
    end
  end

  def apply_transition(agent, action, payload, _opts)
      when is_map(payload) and action in @observation_actions do
    {:ok, cmd(agent, {action, payload})}
  end

  def apply_transition(_agent, _action, _payload, _opts),
    do: {:error, :unsupported_transition_action}

  @spec apply_signal(struct(), String.t(), map(), keyword()) ::
          {:ok, Jido.Agent.cmd_result()} | {:error, term()}
  def apply_signal(agent, signal_type, payload, opts \\ []) when is_map(payload) do
    with {:ok, action} <- action_for_signal(signal_type) do
      apply_transition(agent, action, payload, opts)
    end
  end

  @spec apply_signal_sync(struct(), String.t(), map(), keyword()) ::
          {:ok, struct(), [term()]} | {:error, term()}
  def apply_signal_sync(agent, signal_type, payload, opts \\ []) when is_map(payload) do
    with {:ok, {next_agent, directives}} <- apply_signal(agent, signal_type, payload, opts) do
      resolve_runtime_directives(next_agent, directives)
    end
  end

  @spec resolve_runtime_directives(struct(), [term()]) ::
          {:ok, struct(), [term()]} | {:error, term()}
  def resolve_runtime_directives(agent, directives) when is_list(directives) do
    Enum.reduce_while(directives, {:ok, agent, []}, fn directive, {:ok, current_agent, unresolved} ->
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
    enriched_instruction =
      %{instruction | context: Map.put(instruction.context || %{}, :state, agent.state)}

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
    |> put_if_present(:sensor_id, payload)
    |> put_if_present(:from, payload)
    |> put_if_present(:to, payload)
    |> put_if_present(:action, payload)
    |> put_if_present(:at, payload)
    |> put_if_present(:reason, payload)
    |> put_if_present(:initiated_by, payload)
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

  defp normalize_state_key("sensor_id"), do: :sensor_id
  defp normalize_state_key("name"), do: :name
  defp normalize_state_key("status"), do: :status
  defp normalize_state_key("sensor_type"), do: :sensor_type
  defp normalize_state_key("unit"), do: :unit
  defp normalize_state_key("sample_rate_ms"), do: :sample_rate_ms
  defp normalize_state_key("threshold_high"), do: :threshold_high
  defp normalize_state_key("threshold_critical"), do: :threshold_critical
  defp normalize_state_key("threshold_low"), do: :threshold_low
  defp normalize_state_key("threshold_critical_low"), do: :threshold_critical_low
  defp normalize_state_key("last_calibration_date"), do: :last_calibration_date
  defp normalize_state_key("next_calibration_date"), do: :next_calibration_date
  defp normalize_state_key("opc_ua_node_id"), do: :opc_ua_node_id
  defp normalize_state_key("description"), do: :description
  defp normalize_state_key("location"), do: :location
  defp normalize_state_key("metadata"), do: :metadata
  defp normalize_state_key("hierarchy_path"), do: :hierarchy_path
  defp normalize_state_key("enterprise_id"), do: :enterprise_id
  defp normalize_state_key("site_id"), do: :site_id
  defp normalize_state_key("area_id"), do: :area_id
  defp normalize_state_key("plant_id"), do: :plant_id
  defp normalize_state_key("line_id"), do: :line_id
  defp normalize_state_key("work_cell_id"), do: :work_cell_id
  defp normalize_state_key("machine_id"), do: :machine_id
  defp normalize_state_key("created_at"), do: :created_at
  defp normalize_state_key("updated_at"), do: :updated_at
  defp normalize_state_key("__strategy__"), do: :__strategy__
  defp normalize_state_key(key), do: key

  defp validate_checkpoint_state(state) do
    payload =
      Enum.reduce(@persisted_contract_keys, %{}, fn key, acc ->
        Map.put(acc, Atom.to_string(key), normalize_payload_value(Map.get(state, key)))
      end)

    preflight_agent_state(payload)
  end

  defp normalize_payload_value(value) when is_map(value) do
    Enum.reduce(value, %{}, fn {key, nested_value}, acc ->
      normalized_key = if is_atom(key), do: Atom.to_string(key), else: key
      Map.put(acc, normalized_key, normalize_payload_value(nested_value))
    end)
  end

  defp normalize_payload_value(value) when is_list(value),
    do: Enum.map(value, &normalize_payload_value/1)

  defp normalize_payload_value(value), do: value

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

  defp fetch_payload(payload, key), do: Map.get(payload, key) || Map.get(payload, Atom.to_string(key))

  defp normalize_result_payload({:ok, result}), do: %{status: :ok, result: result, effects: []}

  defp normalize_result_payload({:ok, result, effects}),
    do: %{status: :ok, result: result, effects: List.wrap(effects)}

  defp normalize_result_payload({:error, reason}),
    do: %{status: :error, reason: reason, effects: []}

  defp normalize_result_payload({:error, reason, effects}),
    do: %{status: :error, reason: reason, effects: List.wrap(effects)}
end

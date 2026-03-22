defmodule Maiden.AssetRuntime.Validators.AssetValidator do
  @moduledoc """
  Cross-runtime payload validator for the Asset domain.

  Validation layers:
  1. JSON Schema parity against generated Effect contracts
  2. ISA-95 hierarchy semantics across enterprise/site/area/plant/line/workcell/machine
  3. Transition kind/action consistency checks
  """

  @asset_schema_path Path.expand("../../../../../schemas/asset.schema.json", __DIR__)
  @transition_schema_path Path.expand("../../../../../schemas/asset_transition.schema.json", __DIR__)

  @agent_state_schema_path Path.expand(
                             "../../../../../schemas/asset_agent_state.schema.json",
                             __DIR__
                           )

  @external_resource @asset_schema_path
  @external_resource @transition_schema_path
  @external_resource @agent_state_schema_path

  @asset_schema_runtime @asset_schema_path
                        |> File.read!()
                        |> Jason.decode!()
                        |> ExJsonSchema.Schema.resolve()

  @transition_schema_runtime @transition_schema_path
                             |> File.read!()
                             |> Jason.decode!()
                             |> ExJsonSchema.Schema.resolve()

  @agent_state_schema_runtime @agent_state_schema_path
                              |> File.read!()
                              |> Jason.decode!()
                              |> ExJsonSchema.Schema.resolve()

  @hierarchy_keys [
    "enterprise_id",
    "site_id",
    "area_id",
    "plant_id",
    "line_id",
    "work_cell_id",
    "machine_id"
  ]

  @required_by_kind %{
    "enterprise" => ["enterprise_id"],
    "site" => ["enterprise_id", "site_id"],
    "area" => ["enterprise_id", "site_id", "area_id"],
    "plant" => ["enterprise_id", "site_id", "area_id", "plant_id"],
    "line" => ["enterprise_id", "site_id", "area_id", "plant_id", "line_id"],
    "workcell" => ["enterprise_id", "site_id", "area_id", "plant_id", "line_id", "work_cell_id"],
    "machine" => [
      "enterprise_id",
      "site_id",
      "area_id",
      "plant_id",
      "line_id",
      "work_cell_id",
      "machine_id"
    ],
    "sensor" => [
      "enterprise_id",
      "site_id",
      "area_id",
      "plant_id",
      "line_id",
      "work_cell_id",
      "machine_id"
    ],
    "device" => [
      "enterprise_id",
      "site_id",
      "area_id",
      "plant_id",
      "line_id",
      "work_cell_id",
      "machine_id"
    ]
  }

  @self_key_by_kind %{
    "enterprise" => "enterprise_id",
    "site" => "site_id",
    "area" => "area_id",
    "plant" => "plant_id",
    "line" => "line_id",
    "workcell" => "work_cell_id",
    "machine" => "machine_id"
  }

  @parent_key_by_kind %{
    "site" => "enterprise_id",
    "area" => "site_id",
    "plant" => "area_id",
    "line" => "plant_id",
    "workcell" => "line_id",
    "machine" => "work_cell_id",
    "sensor" => "machine_id",
    "device" => "machine_id"
  }

  @kind_prefix %{
    "enterprise" => "ENT",
    "site" => "SIT",
    "area" => "ARA",
    "plant" => "PLT",
    "line" => "LIN",
    "workcell" => "WCL",
    "machine" => "MCH",
    "sensor" => "SNS",
    "device" => "DEV"
  }

  @id_key_prefix %{
    "enterprise_id" => "ENT",
    "site_id" => "SIT",
    "area_id" => "ARA",
    "plant_id" => "PLT",
    "line_id" => "LIN",
    "work_cell_id" => "WCL",
    "machine_id" => "MCH"
  }

  @action_to_target %{
    "Activate" => "active",
    "Deactivate" => "inactive",
    "StartMaintenance" => "maintenance",
    "CompleteMaintenance" => "active",
    "Decommission" => "decommissioned"
  }

  @exonerate_compatible false

  @type engine :: :auto | :exonerate | :ex_json_schema

  @spec engine_status() :: %{preferred: atom(), exonerate_compatible: boolean()}
  def engine_status do
    %{
      preferred: if(@exonerate_compatible, do: :exonerate, else: :ex_json_schema),
      exonerate_compatible: @exonerate_compatible
    }
  end

  @spec asset_validate(map(), keyword()) :: :ok | {:error, map()}
  def asset_validate(payload, opts \\ []) when is_map(payload) do
    with :ok <- validate(payload, :asset, Keyword.get(opts, :engine, :auto)),
         :ok <- validate_hierarchy_semantics(payload) do
      :ok
    end
  end

  @spec transition_event_validate(map(), keyword()) :: :ok | {:error, map()}
  def transition_event_validate(payload, opts \\ []) when is_map(payload) do
    with :ok <- validate(payload, :transition, Keyword.get(opts, :engine, :auto)),
         :ok <- validate_transition_semantics(payload) do
      :ok
    end
  end

  @spec agent_state_validate(map(), keyword()) :: :ok | {:error, map()}
  def agent_state_validate(payload, opts \\ []) when is_map(payload) do
    with :ok <- validate(payload, :agent_state, Keyword.get(opts, :engine, :auto)),
         :ok <- validate_hierarchy_semantics(payload) do
      :ok
    end
  end

  defp validate(payload, kind, :auto) do
    if @exonerate_compatible do
      validate(payload, kind, :exonerate)
    else
      validate(payload, kind, :ex_json_schema)
    end
  end

  defp validate(_payload, _kind, :exonerate) do
    {:error,
     %{
       validator: :exonerate,
       reason:
         "Exonerate disabled for current generated schemas; use :ex_json_schema until compatibility normalizer is finalized"
     }}
  end

  defp validate(payload, :asset, :ex_json_schema),
    do: normalize_ex_json_schema(ExJsonSchema.Validator.validate(@asset_schema_runtime, payload))

  defp validate(payload, :transition, :ex_json_schema),
    do:
      normalize_ex_json_schema(ExJsonSchema.Validator.validate(@transition_schema_runtime, payload))

  defp validate(payload, :agent_state, :ex_json_schema),
    do:
      normalize_ex_json_schema(ExJsonSchema.Validator.validate(@agent_state_schema_runtime, payload))

  defp normalize_ex_json_schema(:ok), do: :ok

  defp normalize_ex_json_schema({:error, errors}) do
    {:error, %{validator: :ex_json_schema, errors: errors}}
  end

  defp validate_hierarchy_semantics(payload) do
    kind = fetch(payload, "kind")
    asset_id = fetch(payload, "asset_id")

    with true <- is_binary(kind),
         {:ok, required_keys} <- required_keys_for(kind),
         :ok <- ensure_asset_id_kind_parity(asset_id, kind),
         :ok <- ensure_required_hierarchy_ids(payload, required_keys),
         :ok <- ensure_self_key_matches_asset_id(payload, kind, asset_id),
         :ok <- ensure_parent_semantics(payload, kind),
         :ok <- ensure_descendants_are_nil(payload, required_keys),
         :ok <- ensure_hierarchy_path(payload, required_keys, asset_id) do
      :ok
    else
      false -> {:error, %{validator: :hierarchy, reason: :missing_kind}}
      {:error, _} = error -> error
    end
  end

  defp validate_transition_semantics(payload) do
    asset_id = fetch(payload, "asset_id")

    with :ok <- maybe_validate_transition_kind_parity(asset_id, fetch(payload, "kind")),
         :ok <- maybe_validate_action_target(fetch(payload, "action"), fetch(payload, "to")) do
      :ok
    end
  end

  defp maybe_validate_transition_kind_parity(_asset_id, nil), do: :ok

  defp maybe_validate_transition_kind_parity(asset_id, kind) when is_binary(kind) do
    ensure_asset_id_kind_parity(asset_id, kind)
  end

  defp maybe_validate_transition_kind_parity(_asset_id, _kind) do
    {:error, %{validator: :hierarchy, reason: :invalid_kind}}
  end

  defp maybe_validate_action_target(nil, _to), do: :ok

  defp maybe_validate_action_target(action, to)
       when is_binary(action) and is_binary(to) do
    case Map.get(@action_to_target, action) do
      nil -> {:error, %{validator: :hierarchy, reason: :unknown_transition_action, action: action}}
      ^to -> :ok
      expected ->
        {:error,
         %{
           validator: :hierarchy,
           reason: :transition_action_target_mismatch,
           action: action,
           expected_to: expected,
           actual_to: to
         }}
    end
  end

  defp maybe_validate_action_target(_, _), do: :ok

  defp required_keys_for(kind) do
    case Map.fetch(@required_by_kind, kind) do
      {:ok, keys} -> {:ok, keys}
      :error -> {:error, %{validator: :hierarchy, reason: :unsupported_kind, kind: kind}}
    end
  end

  defp ensure_asset_id_kind_parity(asset_id, kind)
       when is_binary(asset_id) and is_binary(kind) do
    expected_prefix = Map.get(@kind_prefix, kind)

    if is_binary(expected_prefix) and String.starts_with?(asset_id, expected_prefix <> "-") do
      :ok
    else
      {:error,
       %{
         validator: :hierarchy,
         reason: :asset_id_kind_mismatch,
         kind: kind,
         asset_id: asset_id,
         expected_prefix: expected_prefix
       }}
    end
  end

  defp ensure_asset_id_kind_parity(_asset_id, kind) do
    {:error, %{validator: :hierarchy, reason: :invalid_asset_id_for_kind, kind: kind}}
  end

  defp ensure_required_hierarchy_ids(payload, required_keys) do
    Enum.reduce_while(required_keys, :ok, fn key, :ok ->
      case fetch(payload, key) do
        value when is_binary(value) ->
          expected_prefix = Map.fetch!(@id_key_prefix, key)

          if String.starts_with?(value, expected_prefix <> "-") do
            {:cont, :ok}
          else
            {:halt,
             {:error,
              %{
                validator: :hierarchy,
                reason: :invalid_hierarchy_id_prefix,
                field: key,
                expected_prefix: expected_prefix,
                value: value
              }}}
          end

        _ ->
          {:halt,
           {:error,
            %{validator: :hierarchy, reason: :missing_required_hierarchy_id, field: key}}}
      end
    end)
  end

  defp ensure_self_key_matches_asset_id(payload, kind, asset_id) do
    case Map.get(@self_key_by_kind, kind) do
      nil ->
        :ok

      key ->
        self_value = fetch(payload, key)

        if self_value == asset_id do
          :ok
        else
          {:error,
           %{
             validator: :hierarchy,
             reason: :self_identifier_mismatch,
             field: key,
             expected: asset_id,
             actual: self_value
           }}
        end
    end
  end

  defp ensure_parent_semantics(payload, "enterprise") do
    case fetch(payload, "parent_id") do
      nil -> :ok

      value ->
        {:error,
         %{validator: :hierarchy, reason: :enterprise_parent_must_be_nil, parent_id: value}}
    end
  end

  defp ensure_parent_semantics(payload, kind) do
    parent_key = Map.get(@parent_key_by_kind, kind)
    expected_parent = fetch(payload, parent_key)
    parent_id = fetch(payload, "parent_id")

    cond do
      not is_binary(expected_parent) ->
        {:error,
         %{validator: :hierarchy, reason: :missing_parent_reference, field: parent_key}}

      parent_id == expected_parent ->
        :ok

      true ->
        {:error,
         %{
           validator: :hierarchy,
           reason: :parent_id_mismatch,
           expected_parent: expected_parent,
           parent_id: parent_id,
           parent_field: parent_key
         }}
    end
  end

  defp ensure_descendants_are_nil(payload, required_keys) do
    descendants = @hierarchy_keys -- required_keys

    Enum.reduce_while(descendants, :ok, fn key, :ok ->
      case fetch(payload, key) do
        nil ->
          {:cont, :ok}

        value ->
          {:halt,
           {:error,
            %{
              validator: :hierarchy,
              reason: :descendant_identifier_must_be_nil,
              field: key,
              value: value
            }}}
      end
    end)
  end

  defp ensure_hierarchy_path(payload, required_keys, asset_id) do
    path = fetch(payload, "hierarchy_path")

    case path do
      value when is_binary(value) and value != "" ->
        expected_ids =
          required_keys
          |> Enum.map(&fetch(payload, &1))
          |> Enum.filter(&is_binary/1)
          |> append_if_needed(asset_id)

        if ordered_members?(value, expected_ids) do
          :ok
        else
          {:error,
           %{
             validator: :hierarchy,
             reason: :invalid_hierarchy_path,
             hierarchy_path: value,
             expected_sequence: expected_ids
           }}
        end

      _ ->
        {:error, %{validator: :hierarchy, reason: :missing_hierarchy_path}}
    end
  end

  defp append_if_needed(ids, asset_id) do
    case List.last(ids) do
      ^asset_id -> ids
      _ -> ids ++ [asset_id]
    end
  end

  defp ordered_members?(path, ids) do
    ids
    |> Enum.reduce_while({:ok, -1}, fn id, {:ok, previous_index} ->
      case :binary.match(path, id) do
        :nomatch ->
          {:halt, :error}

        {index, _len} when index > previous_index ->
          {:cont, {:ok, index}}

        _ ->
          {:halt, :error}
      end
    end)
    |> case do
      {:ok, _} -> true
      :error -> false
    end
  end

  defp fetch(payload, key) when is_binary(key) do
    case Map.fetch(payload, key) do
      {:ok, value} -> value
      :error -> fetch_existing_atom_key(payload, key)
    end
  end

  defp fetch(payload, key) when is_atom(key),
    do: Map.get(payload, key) || Map.get(payload, Atom.to_string(key))

  defp fetch_existing_atom_key(payload, key) do
    try do
      Map.get(payload, String.to_existing_atom(key))
    rescue
      ArgumentError -> nil
    end
  end
end

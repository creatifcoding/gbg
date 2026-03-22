defmodule Maiden.EnterpriseRuntime.EnterpriseValidatorTest do
  use ExUnit.Case, async: true

  alias Maiden.EnterpriseRuntime.EnterpriseFactory
  alias Maiden.EnterpriseRuntime.FSM
  alias Maiden.EnterpriseRuntime.Validators.EnterpriseValidator

  test "validates canonical enterprise payload" do
    payload =
      EnterpriseFactory.new_enterprise(%{slug: "acme-corp"})
      |> stringify_keys()

    assert :ok = EnterpriseValidator.enterprise_validate(payload)
    assert :ok = EnterpriseValidator.agent_state_validate(payload)
  end

  test "rejects transition payload with invalid status" do
    payload = %{
      "enterprise_id" => "ENT-acme-corp",
      "from" => "active",
      "to" => "invalid-status",
      "at" => "2026-02-24T00:03:00Z"
    }

    assert {:error, %{validator: :ex_json_schema, errors: [_ | _]}} =
             EnterpriseValidator.transition_event_validate(payload)
  end

  @tag :negative_gate
  test "rejects schema-valid but FSM-illegal transitions" do
    payload =
      EnterpriseFactory.new_transition_event(%{
        slug: "acme-corp",
        from: "merged",
        to: "active",
        at: "2026-02-24T00:03:00Z"
      })
      |> stringify_keys()

    assert :ok = EnterpriseValidator.transition_event_validate(payload)

    assert {:error,
            %{validator: :fsm, from: "merged", to: "active", allowed_next: []}} =
             FSM.validate_transition_for_jido(payload)
  end

  defp stringify_keys(map) do
    Map.new(map, fn {key, value} -> {to_string(key), value} end)
  end
end

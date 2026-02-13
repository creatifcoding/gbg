defmodule AvaElixir.ContractsTest do
  use ExUnit.Case, async: true

  alias AvaElixir.Contracts

  @fixture_path Path.expand("fixtures/view_profile_spec.json", __DIR__)

  test "decodes and validates fixture view spec" do
    json = File.read!(@fixture_path)

    assert {:ok, payload} = Contracts.decode_view_spec_json(json)
    assert payload["id"] == "view-001"
    assert payload["assemblage_id"] == "assembly-alpha"
  end

  test "returns missing key error for incomplete payload" do
    assert {:error, {:missing_keys, missing}} =
             Contracts.validate_view_spec(%{"id" => "x", "name" => "y"})

    assert :assemblage_id in missing
    assert :version in missing
    assert :channels in missing
  end

  test "rejects invalid field types and values" do
    assert {:error, {:invalid_type, :version, :integer}} =
             Contracts.validate_view_spec(%{
               "id" => "view-x",
               "name" => "Demo",
               "assemblage_id" => "alpha",
               "version" => "1",
               "channels" => []
             })

    assert {:error, {:invalid_value, :id, :empty_string}} =
             Contracts.validate_view_spec(%{
               "id" => "   ",
               "name" => "Demo",
               "assemblage_id" => "alpha",
               "version" => 1,
               "channels" => []
             })
  end

  test "builds canonical bridge events" do
    sub_ref = make_ref()

    assert {:ava_artifact, ^sub_ref, %{id: "artifact-1"}} =
             Contracts.artifact_event(sub_ref, %{id: "artifact-1"})

    assert {:ava_error, ^sub_ref, "invalid_spec", "missing channels"} =
             Contracts.error_event(sub_ref, "invalid_spec", "missing channels")

    assert {:ava_lagged, ^sub_ref, 7} = Contracts.lag_event(sub_ref, 7)
  end
end

defmodule AvaElixir.ContractDriftTest do
  use ExUnit.Case, async: true

  alias AvaElixir.Bridge.NatsIngress

  @contract_path "../src/lib/ava/contracts/ava_contract_v1.json"

  defp read_contract! do
    @contract_path
    |> Path.expand(File.cwd!())
    |> File.read!()
    |> Jason.decode!()
  end

  test "namespace prefix stays canonical" do
    contract = read_contract!()

    assert contract["namespacePrefix"] == "tmnl.ava"
  end

  test "command templates parse through NatsIngress with same action + view_id" do
    contract = read_contract!()
    commands = contract["commands"] || %{}
    view_id = "view-contract-drift"

    for {command, action} <- [
          {"invalidate", :invalidate},
          {"subscribe", :subscribe},
          {"unsubscribe", :unsubscribe}
        ] do
      template = get_in(commands, [command, "subjectTemplate"])
      assert is_binary(template)

      subject = String.replace(template, "{view_id}", view_id)

      assert {:ok, ^action, ^view_id} = NatsIngress.parse_subject(subject)
    end
  end

  test "casing contract forbids camelCase alias viewId" do
    contract = read_contract!()
    forbidden_aliases = get_in(contract, ["casingContract", "forbiddenAliases"]) || []

    assert "viewId" in forbidden_aliases
  end
end

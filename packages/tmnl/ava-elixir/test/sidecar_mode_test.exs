defmodule AvaElixir.SidecarModeTest do
  use ExUnit.Case, async: false

  setup do
    prev_mode = Application.get_env(:ava_elixir, :runtime_mode)
    prev_sidecar_client = Application.get_env(:ava_elixir, :sidecar_client)

    Application.put_env(:ava_elixir, :runtime_mode, :sidecar)
    Application.put_env(:ava_elixir, :sidecar_client, AvaElixir.SidecarClient)

    AvaElixir.SidecarClient.reset()

    on_exit(fn ->
      if prev_mode == nil,
        do: Application.delete_env(:ava_elixir, :runtime_mode),
        else: Application.put_env(:ava_elixir, :runtime_mode, prev_mode)

      if prev_sidecar_client == nil,
        do: Application.delete_env(:ava_elixir, :sidecar_client),
        else: Application.put_env(:ava_elixir, :sidecar_client, prev_sidecar_client)
    end)

    :ok
  end

  test "sidecar register/get/list/invalidate lifecycle" do
    spec_json =
      ~s({"id":"sidecar-view-1","name":"Sidecar","assemblage_id":"alpha","version":1,"channels":[]})

    assert AvaElixir.runtime_mode() == :sidecar
    assert {:ok, "registered:sidecar-view-1"} = AvaElixir.register_spec_json(spec_json)

    assert {:ok, raw} = AvaElixir.get_spec_json("sidecar-view-1")
    assert {:ok, decoded} = Jason.decode(raw)
    assert decoded["id"] == "sidecar-view-1"

    assert {:ok, ["sidecar-view-1"]} = AvaElixir.list_specs()
    assert {:ok, "invalidated:sidecar-view-1"} = AvaElixir.invalidate_view("sidecar-view-1")

    assert {:error, {:view_not_found, "sidecar-view-1"}} =
             AvaElixir.get_spec_json("sidecar-view-1")
  end

  test "sidecar subscribe/unsubscribe lifecycle" do
    spec_json =
      ~s({"id":"sidecar-view-sub","name":"Sidecar","assemblage_id":"alpha","version":1,"channels":[]})

    assert {:ok, _} = AvaElixir.register_spec_json(spec_json)
    assert {:ok, sub_id} = AvaElixir.subscribe("sidecar-view-sub", interval_ms: 10, pid: self())

    assert_receive {:ava_artifact, ^sub_id, %{view_id: "sidecar-view-sub", sequence: _}}, 500

    assert {:ok, ids} = AvaElixir.list_subscriptions()
    assert sub_id in ids

    assert {:ok, "unsubscribed:" <> ^sub_id} = AvaElixir.unsubscribe(sub_id)
  end
end

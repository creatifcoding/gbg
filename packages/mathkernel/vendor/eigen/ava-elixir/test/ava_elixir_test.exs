defmodule AvaElixirTest do
  use ExUnit.Case

  setup do
    prev_mode = Application.get_env(:ava_elixir, :runtime_mode)
    prev_client = Application.get_env(:ava_elixir, :native_client)
    prev_sidecar_client = Application.get_env(:ava_elixir, :sidecar_client)

    Application.put_env(:ava_elixir, :runtime_mode, :nif)
    Application.put_env(:ava_elixir, :native_client, AvaElixir.Native)
    Application.put_env(:ava_elixir, :sidecar_client, AvaElixir.SidecarClient)

    AvaElixir.SidecarClient.reset()

    on_exit(fn ->
      if prev_mode == nil,
        do: Application.delete_env(:ava_elixir, :runtime_mode),
        else: Application.put_env(:ava_elixir, :runtime_mode, prev_mode)

      if prev_client == nil,
        do: Application.delete_env(:ava_elixir, :native_client),
        else: Application.put_env(:ava_elixir, :native_client, prev_client)

      if prev_sidecar_client == nil,
        do: Application.delete_env(:ava_elixir, :sidecar_client),
        else: Application.put_env(:ava_elixir, :sidecar_client, prev_sidecar_client)
    end)

    :ok
  end

  test "nif version is available" do
    assert AvaElixir.nif_version() == "0.2.0"
  end

  test "runtime ping passes through rustler bridge" do
    assert AvaElixir.ping("probe") == "ava-runtime:probe"
  end

  test "register/get/list/invalidate control-plane lifecycle" do
    spec_json =
      ~s({"id":"view-42","name":"Demo","assemblage_id":"alpha","version":1,"channels":[]})

    assert {:ok, "registered:view-42"} = AvaElixir.register_spec_json(spec_json)

    assert {:ok, raw} = AvaElixir.get_spec_json("view-42")
    assert {:ok, decoded} = Jason.decode(raw)
    assert decoded["id"] == "view-42"

    assert {:ok, specs} = AvaElixir.list_specs()
    assert "view-42" in specs

    assert {:ok, "invalidated:view-42"} = AvaElixir.invalidate_view("view-42")
    assert {:error, {:view_not_found, "view-42"}} = AvaElixir.get_spec_json("view-42")
  end

  test "subscription bridge emits artifact tuples to BEAM mailbox" do
    spec_json =
      ~s({"id":"view-sub","name":"Sub","assemblage_id":"alpha","version":1,"channels":[]})

    assert {:ok, _} = AvaElixir.register_spec_json(spec_json)
    assert {:ok, subscription_id} = AvaElixir.subscribe("view-sub", interval_ms: 10, pid: self())

    assert_receive {:ava_artifact, ^subscription_id, %{view_id: "view-sub", sequence: _seq}}, 500

    assert {:ok, subscriptions} = AvaElixir.list_subscriptions()
    assert subscription_id in subscriptions

    assert {:ok, "unsubscribed:" <> ^subscription_id} = AvaElixir.unsubscribe(subscription_id)
  end

  test "invalidate auto-cancels subscriptions for a view" do
    spec_json =
      ~s({"id":"view-cancel","name":"Cancel","assemblage_id":"alpha","version":1,"channels":[]})

    assert {:ok, _} = AvaElixir.register_spec_json(spec_json)
    assert {:ok, subscription_id} = AvaElixir.subscribe("view-cancel", interval_ms: 10)

    assert {:ok, "invalidated:view-cancel"} = AvaElixir.invalidate_view("view-cancel")

    assert {:ok, active} = AvaElixir.list_subscriptions()
    refute subscription_id in active
  end

  test "invalidate errors when id is unknown" do
    assert {:error, {:view_not_found, "does-not-exist"}} =
             AvaElixir.invalidate_view("does-not-exist")
  end

  test "invalid json is normalized for callers" do
    assert {:error, {:invalid_json, _detail}} = AvaElixir.register_spec_json("{")
  end

  test "sidecar mode provides functional rollback runtime" do
    Application.put_env(:ava_elixir, :runtime_mode, :sidecar)

    spec_json =
      ~s({"id":"view-sidecar","name":"Sidecar","assemblage_id":"alpha","version":1,"channels":[]})

    assert AvaElixir.runtime_mode() == :sidecar
    assert AvaElixir.nif_version() == "sidecar-0.1.0"
    assert AvaElixir.ping("probe-sidecar") == "ava-runtime:probe-sidecar"

    assert {:ok, "registered:view-sidecar"} = AvaElixir.register_spec_json(spec_json)
    assert {:ok, "invalidated:view-sidecar"} = AvaElixir.invalidate_view("view-sidecar")

    assert {:ok, "registered:view-sidecar"} = AvaElixir.register_spec_json(spec_json)
    assert {:ok, sub_id} = AvaElixir.subscribe("view-sidecar", interval_ms: 10, pid: self())

    assert_receive {:ava_artifact, ^sub_id, %{view_id: "view-sidecar", sequence: _seq}}, 500

    assert {:ok, "unsubscribed:" <> ^sub_id} = AvaElixir.unsubscribe(sub_id)
    assert {:ok, "invalidated:view-sidecar"} = AvaElixir.invalidate_view("view-sidecar")
  end
end

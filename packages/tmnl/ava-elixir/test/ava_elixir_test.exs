defmodule AvaElixirTest do
  use ExUnit.Case

  setup do
    prev_mode = Application.get_env(:ava_elixir, :runtime_mode)
    prev_client = Application.get_env(:ava_elixir, :native_client)

    Application.put_env(:ava_elixir, :runtime_mode, :nif)
    Application.put_env(:ava_elixir, :native_client, AvaElixir.Native)

    on_exit(fn ->
      if prev_mode == nil,
        do: Application.delete_env(:ava_elixir, :runtime_mode),
        else: Application.put_env(:ava_elixir, :runtime_mode, prev_mode)

      if prev_client == nil,
        do: Application.delete_env(:ava_elixir, :native_client),
        else: Application.put_env(:ava_elixir, :native_client, prev_client)
    end)

    :ok
  end

  test "nif version is available" do
    assert AvaElixir.nif_version() == "0.1.0"
  end

  test "runtime ping passes through rustler bridge" do
    assert AvaElixir.ping("probe") == "ava-runtime:probe"
  end

  test "register and invalidate control-plane stubs" do
    spec_json =
      ~s({"id":"view-42","name":"Demo","assemblage_id":"alpha","version":1,"channels":[]})

    assert {:ok, "registered:view-42"} = AvaElixir.register_spec_json(spec_json)
    assert {:ok, "invalidated:view-42"} = AvaElixir.invalidate_view("view-42")
  end

  test "invalidate errors when id is unknown" do
    assert {:error, {:view_not_found, "does-not-exist"}} =
             AvaElixir.invalidate_view("does-not-exist")
  end

  test "invalid json is normalized for callers" do
    assert {:error, {:invalid_json, _detail}} = AvaElixir.register_spec_json("{")
  end

  test "sidecar mode is a safe fallback" do
    Application.put_env(:ava_elixir, :runtime_mode, :sidecar)

    assert AvaElixir.runtime_mode() == :sidecar
    assert {:error, :sidecar_not_implemented} = AvaElixir.register_spec_json("{}")
    assert {:error, :sidecar_not_implemented} = AvaElixir.invalidate_view("view-1")
  end
end

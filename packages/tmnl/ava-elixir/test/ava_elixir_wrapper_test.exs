defmodule AvaElixir.NativeStub do
  @behaviour AvaElixir.NativeBehaviour

  @impl true
  def nif_version, do: "stub"

  @impl true
  def runtime_ping(payload), do: "stub:#{payload}"

  @impl true
  def register_spec_json(_json), do: {:error, "missing_id"}

  @impl true
  def get_spec_json(_view_id), do: {:error, "view_not_found:view-1"}

  @impl true
  def list_specs, do: {:ok, ["view-a", "view-b"]}

  @impl true
  def invalidate_view(_view_id), do: {:error, :opaque_error_atom}

  @impl true
  def subscribe_view(_view_id, _interval_ms, _pid), do: {:ok, "sub-stub"}

  @impl true
  def unsubscribe(_subscription_id), do: {:error, "subscription_not_found:sub-x"}

  @impl true
  def list_subscriptions, do: {:ok, ["sub-a"]}
end

defmodule AvaElixirWrapperTest do
  use ExUnit.Case, async: false

  setup do
    prev_mode = Application.get_env(:ava_elixir, :runtime_mode)
    prev_client = Application.get_env(:ava_elixir, :native_client)

    Application.put_env(:ava_elixir, :runtime_mode, :nif)
    Application.put_env(:ava_elixir, :native_client, AvaElixir.NativeStub)

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

  test "normalizes known native reasons" do
    assert {:error, :missing_id} = AvaElixir.register_spec_json("{}")
    assert {:error, {:view_not_found, "view-1"}} = AvaElixir.get_spec_json("view-1")
    assert {:error, {:subscription_not_found, "sub-x"}} = AvaElixir.unsubscribe("sub-x")
  end

  test "normalizes unknown native reasons" do
    assert {:error, {:native_error, ":opaque_error_atom"}} = AvaElixir.invalidate_view("v1")
  end

  test "passes through list helpers" do
    assert {:ok, ["view-a", "view-b"]} = AvaElixir.list_specs()
    assert {:ok, ["sub-a"]} = AvaElixir.list_subscriptions()
  end
end

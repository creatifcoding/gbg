defmodule AvaElixir.NativeStub do
  @behaviour AvaElixir.NativeBehaviour

  @impl true
  def nif_version, do: "stub"

  @impl true
  def runtime_ping(payload), do: "stub:#{payload}"

  @impl true
  def register_spec_json(_json), do: {:error, "missing_id"}

  @impl true
  def invalidate_view(_view_id), do: {:error, :opaque_error_atom}
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
  end

  test "normalizes unknown native reasons" do
    assert {:error, {:native_error, ":opaque_error_atom"}} = AvaElixir.invalidate_view("v1")
  end
end

defmodule Maiden.DeviceRuntime.DeviceRuntimeTest do
  use ExUnit.Case, async: false

  alias Maiden.DeviceRuntime
  alias Maiden.DeviceRuntime.Agent
  alias Maiden.DeviceRuntime.DeviceFactory

  setup_all do
    Application.ensure_all_started(:jido)

    case Jido.start() do
      {:ok, _pid} -> :ok
      {:error, {:already_started, _pid}} -> :ok
    end

    :ok
  end

  test "storage/1 resolves default ETS table" do
    assert {Jido.Storage.ETS, opts} = DeviceRuntime.storage()
    assert Keyword.get(opts, :table) == :maiden_device_runtime
  end

  test "apply_signal_sync runs legal transition through runtime loop" do
    agent =
      Agent.new(
        id: "device-runtime-loop-001",
        state:
          DeviceFactory.new_device(
            slug: "runtime-loop-001",
            name: "Runtime Loop Device",
            status: "provisioned",
            device_type: "servo",
            machine_id: "MCH-runtime-1",
            created_at: "2026-02-24T00:00:00Z"
          )
      )

    {:ok, updated_agent, unresolved} =
      Agent.apply_signal_sync(agent, "device.transition.online", %{
        "device_id" => agent.state.device_id,
        "from" => "provisioned",
        "to" => "online",
        "action" => "GoOnline",
        "at" => "2026-02-24T00:20:00Z",
        "reason" => "initial_startup",
        "initiated_by" => "ops-1"
      })

    assert updated_agent.state.status == "online"
    assert updated_agent.state.updated_at == "2026-02-24T00:20:00Z"
    assert updated_agent.state.__strategy__.machine.status == "idle"
    assert unresolved == []
  end
end

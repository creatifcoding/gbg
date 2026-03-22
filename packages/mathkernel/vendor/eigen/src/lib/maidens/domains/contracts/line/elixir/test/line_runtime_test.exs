defmodule Maiden.LineRuntime.LineRuntimeTest do
  use ExUnit.Case, async: false

  alias Maiden.LineRuntime
  alias Maiden.LineRuntime.Agent
  alias Maiden.LineRuntime.LineFactory

  setup_all do
    Application.ensure_all_started(:jido)

    case Jido.start() do
      {:ok, _pid} -> :ok
      {:error, {:already_started, _pid}} -> :ok
    end

    :ok
  end

  test "storage/1 resolves default ETS table" do
    assert {Jido.Storage.ETS, opts} = LineRuntime.storage()
    assert Keyword.get(opts, :table) == :maiden_line_runtime
  end

  test "apply_signal_sync runs legal transition through runtime loop" do
    agent =
      Agent.new(
        id: "line-runtime-loop-001",
        state:
          LineFactory.new_line(
            slug: "runtime-loop-001",
            name: "Runtime Loop Line",
            status: "idle",
            created_at: "2026-02-24T00:00:00Z"
          )
      )

    {:ok, updated_agent, unresolved} =
      Agent.apply_signal_sync(agent, "line.transition.running", %{
        "line_id" => agent.state.line_id,
        "from" => "idle",
        "to" => "running",
        "at" => "2026-02-24T00:20:00Z",
        "reason" => "initial_startup",
        "initiated_by" => "ops-1"
      })

    assert updated_agent.state.status == "running"
    assert updated_agent.state.updated_at == "2026-02-24T00:20:00Z"
    assert updated_agent.state.__strategy__.machine.status == "idle"
    assert unresolved == []
  end
end

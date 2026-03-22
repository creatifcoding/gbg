defmodule Maiden.EnterpriseRuntime.StrategyBoundaryTest do
  use ExUnit.Case, async: false

  alias Jido.AgentServer
  alias Jido.Sensor.Runtime, as: SensorRuntime
  alias Maiden.EnterpriseRuntime.Agent
  alias Maiden.EnterpriseRuntime.Boundaries.{EnterpriseStore, JobQueue}
  alias Maiden.EnterpriseRuntime.EnterpriseFactory
  alias Maiden.EnterpriseRuntime.Sensors.TransitionSensor
  alias Maiden.EnterpriseRuntime.Strategies.SignalFsm

  defmodule EnterpriseStoreProbe do
    @behaviour EnterpriseStore

    @impl true
    def persist_transition(event, metadata, opts) do
      if pid = Application.get_env(:maiden_enterprise_runtime, :boundary_probe_pid) do
        send(pid, {:persist_transition, event, metadata, opts})
      end

      :ok
    end
  end

  defmodule JobQueueProbe do
    @behaviour JobQueue

    @impl true
    def enqueue_transition(event, opts) do
      if pid = Application.get_env(:maiden_enterprise_runtime, :boundary_probe_pid) do
        send(pid, {:enqueue_transition, event, opts})
      end

      :ok
    end
  end

  setup_all do
    Application.ensure_all_started(:jido)
    :ok
  end

  setup do
    flush_mailbox()

    old_store = Application.get_env(:maiden_enterprise_runtime, :enterprise_store_adapter)
    old_queue = Application.get_env(:maiden_enterprise_runtime, :job_queue_adapter)
    old_probe = Application.get_env(:maiden_enterprise_runtime, :boundary_probe_pid)

    Application.put_env(:maiden_enterprise_runtime, :enterprise_store_adapter, EnterpriseStoreProbe)
    Application.put_env(:maiden_enterprise_runtime, :job_queue_adapter, JobQueueProbe)
    Application.put_env(:maiden_enterprise_runtime, :boundary_probe_pid, self())

    on_exit(fn ->
      restore_env(:enterprise_store_adapter, old_store)
      restore_env(:job_queue_adapter, old_queue)
      restore_env(:boundary_probe_pid, old_probe)
    end)

    :ok
  end

  test "strategy emits boundary directives for successful transition" do
    agent =
      Agent.new(
        id: "enterprise-agent-boundary-001",
        state: EnterpriseFactory.new_enterprise(%{slug: "acme-corp", status: "active"})
      )

    {:ok, next_agent, unresolved} =
      Agent.apply_signal_sync(agent, "enterprise.transition.restructuring", %{
        "enterprise_id" => "ENT-acme-corp",
        "from" => "active",
        "to" => "restructuring",
        "at" => "2026-02-24T00:03:00Z"
      })

    assert next_agent.state.status == "restructuring"
    assert next_agent.state.updated_at == "2026-02-24T00:03:00Z"
    assert unresolved == []

    assert_receive {:persist_transition, event, metadata, _opts}, 1_000
    assert event.to == "restructuring"
    assert event.enterprise_id == "ENT-acme-corp"
    assert metadata.strategy == SignalFsm

    assert_receive {:enqueue_transition, job_event, job_opts}, 1_000
    assert job_event.to == "restructuring"
    assert Keyword.get(job_opts, :queue) == :enterprise_runtime_transition
  end

  test "agent server executes boundary directive handlers on sensor signal path" do
    agent_id = "enterprise-agent-boundary-server-#{System.unique_integer([:positive])}"
    jido_instance = String.to_atom("Jido.EnterpriseBoundary#{System.unique_integer([:positive])}")

    {:ok, _jido_pid} = Jido.start(name: jido_instance)

    on_exit(fn ->
      case Process.whereis(jido_instance) do
        nil -> :ok
        pid -> Process.exit(pid, :normal)
      end
    end)

    {:ok, agent_server_pid} =
      AgentServer.start_link(
        jido: jido_instance,
        agent: Agent,
        id: agent_id,
        initial_state: EnterpriseFactory.new_enterprise(%{slug: "acme-sensor", status: "active"})
      )

    on_exit(fn -> Process.exit(agent_server_pid, :normal) end)

    {:ok, sensor_pid} =
      SensorRuntime.start_link(
        sensor: TransitionSensor,
        config: %{source: "/sensor/enterprise-boundary"},
        context: %{agent_ref: agent_server_pid},
        id: "enterprise-sensor-boundary-#{System.unique_integer([:positive])}"
      )

    on_exit(fn -> Process.exit(sensor_pid, :normal) end)

    :ok =
      SensorRuntime.event(sensor_pid, %{
        "enterprise_id" => "ENT-acme-sensor",
        "from" => "active",
        "to" => "merged",
        "at" => "2026-02-24T00:10:00Z"
      })

    {:ok, server_state} =
      await_agent_server_state(agent_server_pid, fn state ->
        state.agent.state.status == "merged"
      end)

    assert server_state.agent.state.status == "merged"
    assert server_state.agent.state.updated_at == "2026-02-24T00:10:00Z"

    assert_receive {:persist_transition, event, metadata, _opts}, 1_000
    assert event.to == "merged"
    assert metadata.strategy == SignalFsm

    assert_receive {:enqueue_transition, event, opts}, 1_000
    assert event.to == "merged"
    assert Keyword.get(opts, :queue) == :enterprise_runtime_transition
  end

  test "illegal transitions do not emit boundary directives" do
    agent =
      Agent.new(
        id: "enterprise-agent-boundary-illegal",
        state: EnterpriseFactory.new_enterprise(%{slug: "acme-illegal", status: "merged"})
      )

    assert {:error, %{validator: :fsm}} =
             Agent.apply_signal_sync(agent, "enterprise.transition.active", %{
               "enterprise_id" => "ENT-acme-illegal",
               "from" => "merged",
               "to" => "active",
               "at" => "2026-02-24T00:20:00Z"
             })

    refute_receive {:persist_transition, _, _, _}, 200
    refute_receive {:enqueue_transition, _, _}, 200
  end

  test "strategy routes reserve high priority for orchestration signals" do
    routes = SignalFsm.signal_routes(%{agent_module: Agent, strategy_opts: []})

    assert {"enterprise.runtime.strategy.tick", {:strategy_tick}, tick_priority} =
             Enum.find(routes, fn {type, _, _} -> type == "enterprise.runtime.strategy.tick" end)

    assert {"enterprise.runtime.persist.flush", {:strategy_cmd, :flush_persistence}, flush_priority} =
             Enum.find(routes, fn {type, _, _} -> type == "enterprise.runtime.persist.flush" end)

    assert tick_priority >= 50
    assert flush_priority >= 50
  end

  defp restore_env(key, nil), do: Application.delete_env(:maiden_enterprise_runtime, key)

  defp restore_env(key, value) do
    Application.put_env(:maiden_enterprise_runtime, key, value)
  end

  defp await_agent_server_state(agent_server_pid, predicate, attempts \\ 20)

  defp await_agent_server_state(_agent_server_pid, _predicate, 0), do: {:error, :timeout}

  defp await_agent_server_state(agent_server_pid, predicate, attempts) do
    case AgentServer.state(agent_server_pid) do
      {:ok, state} ->
        if predicate.(state) do
          {:ok, state}
        else
          Process.sleep(50)
          await_agent_server_state(agent_server_pid, predicate, attempts - 1)
        end

      error ->
        error
    end
  end

  defp flush_mailbox do
    receive do
      _ -> flush_mailbox()
    after
      0 -> :ok
    end
  end
end

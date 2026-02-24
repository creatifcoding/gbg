defmodule Maiden.SiteRuntime.StrategyBoundaryTest do
  use ExUnit.Case, async: false

  alias Jido.AgentServer
  alias Jido.Sensor.Runtime, as: SensorRuntime
  alias Maiden.SiteRuntime.Agent
  alias Maiden.SiteRuntime.Boundaries.{JobQueue, SiteStore}
  alias Maiden.SiteRuntime.SiteFactory
  alias Maiden.SiteRuntime.Strategies.SignalFsm

  defmodule SiteStoreProbe do
    @behaviour SiteStore

    @impl true
    def persist_transition(event, metadata, opts) do
      if pid = Application.get_env(:maiden_site_runtime, :boundary_probe_pid) do
        send(pid, {:persist_transition, event, metadata, opts})
      end

      :ok
    end
  end

  defmodule JobQueueProbe do
    @behaviour JobQueue

    @impl true
    def enqueue_transition(event, opts) do
      if pid = Application.get_env(:maiden_site_runtime, :boundary_probe_pid) do
        send(pid, {:enqueue_transition, event, opts})
      end

      :ok
    end
  end

  setup_all do
    Application.ensure_all_started(:jido)

    case Jido.start() do
      {:ok, _pid} -> :ok
      {:error, {:already_started, _pid}} -> :ok
    end

    :ok
  end

  setup do
    flush_mailbox()
    old_store = Application.get_env(:maiden_site_runtime, :site_store_adapter)
    old_queue = Application.get_env(:maiden_site_runtime, :job_queue_adapter)
    old_probe = Application.get_env(:maiden_site_runtime, :boundary_probe_pid)

    Application.put_env(:maiden_site_runtime, :site_store_adapter, SiteStoreProbe)
    Application.put_env(:maiden_site_runtime, :job_queue_adapter, JobQueueProbe)
    Application.put_env(:maiden_site_runtime, :boundary_probe_pid, self())

    on_exit(fn ->
      restore_env(:site_store_adapter, old_store)
      restore_env(:job_queue_adapter, old_queue)
      restore_env(:boundary_probe_pid, old_probe)
    end)

    :ok
  end

  test "strategy emits boundary directives for successful transition" do
    agent = Agent.new(id: "site-agent-boundary-001", state: site_state("SIT-boundary-main", "planned"))

    {:ok, next_agent, unresolved} =
      Agent.apply_signal_sync(agent, "site.transition.begin_construction", %{
        "site_id" => "SIT-boundary-main",
        "from" => "planned",
        "to" => "under_construction",
        "action" => "BeginConstruction",
        "at" => "2026-02-24T02:00:00Z"
      })

    assert next_agent.state.status == "under_construction"
    assert unresolved == []

    assert_receive {:persist_transition, event, metadata, _opts}, 1_000
    assert event.to == "under_construction"
    assert event.site_id == "SIT-boundary-main"
    assert metadata.strategy == SignalFsm

    assert_receive {:enqueue_transition, job_event, job_opts}, 1_000
    assert job_event.to == "under_construction"
    assert Keyword.get(job_opts, :queue) == :site_runtime_transition
  end

  test "agent server executes boundary directive handlers on sensor path" do
    agent_id = "site-agent-boundary-server-#{System.unique_integer([:positive])}"

    {:ok, agent_server_pid} =
      AgentServer.start_link(
        jido: Jido.default_instance(),
        agent: Agent,
        id: agent_id,
        initial_state: site_state("SIT-boundary-server", "planned")
      )

    on_exit(fn -> Process.exit(agent_server_pid, :normal) end)

    {:ok, sensor_pid} =
      SensorRuntime.start_link(
        sensor: Maiden.SiteRuntime.Sensors.TransitionSensor,
        config: %{source: "/sensor/site-boundary"},
        context: %{agent_ref: agent_server_pid},
        id: "sensor-boundary-#{System.unique_integer([:positive])}"
      )

    on_exit(fn -> Process.exit(sensor_pid, :normal) end)

    :ok =
      SensorRuntime.event(sensor_pid, %{
        "site_id" => "SIT-boundary-server",
        "from" => "planned",
        "to" => "under_construction",
        "at" => "2026-02-24T02:10:00Z"
      })

    {:ok, server_state} =
      await_agent_server_state(agent_server_pid, fn state ->
        state.agent.state.status == "under_construction"
      end)

    assert server_state.agent.state.status == "under_construction"

    assert_receive {:persist_transition, event, metadata, _opts}, 1_000
    assert event.to == "under_construction"
    assert metadata.strategy == SignalFsm

    assert_receive {:enqueue_transition, event, opts}, 1_000
    assert event.to == "under_construction"
    assert Keyword.get(opts, :queue) == :site_runtime_transition
  end

  test "illegal transitions do not emit boundary directives" do
    agent = Agent.new(id: "site-agent-boundary-illegal", state: site_state("SIT-boundary-illegal", "planned"))

    assert {:error, %{validator: :fsm}} =
             Agent.apply_signal_sync(agent, "site.transition.close", %{
               "site_id" => "SIT-boundary-illegal",
               "from" => "planned",
               "to" => "closed",
               "at" => "2026-02-24T02:20:00Z"
             })

    refute_receive {:persist_transition, _, _, _}, 200
    refute_receive {:enqueue_transition, _, _}, 200
  end

  test "strategy routes reserve high priority orchestration signals" do
    routes = SignalFsm.signal_routes(%{agent_module: Agent, strategy_opts: []})

    assert {"site.runtime.strategy.tick", {:strategy_tick}, tick_priority} =
             Enum.find(routes, fn {type, _, _} -> type == "site.runtime.strategy.tick" end)

    assert {"site.runtime.persist.flush", {:strategy_cmd, :flush_persistence}, flush_priority} =
             Enum.find(routes, fn {type, _, _} -> type == "site.runtime.persist.flush" end)

    assert tick_priority >= 50
    assert flush_priority >= 50
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

  defp restore_env(key, nil), do: Application.delete_env(:maiden_site_runtime, key)

  defp restore_env(key, value), do: Application.put_env(:maiden_site_runtime, key, value)

  defp flush_mailbox do
    receive do
      _ -> flush_mailbox()
    after
      0 -> :ok
    end
  end

  defp site_state(site_id, status) do
    payload =
      SiteFactory.new_site(
        slug: String.replace_prefix(site_id, "SIT-", ""),
        name: "Boundary Site",
        status: status,
        timezone: "UTC",
        enterprise_id: "ENT-acme",
        hierarchy_path: "/ENT-acme/#{site_id}",
        created_at: "2026-02-24T02:00:00Z"
      )

    %{
      site_id: payload["site_id"],
      name: payload["name"],
      status: payload["status"],
      timezone: payload["timezone"],
      address: payload["address"],
      city: payload["city"],
      state: payload["state"],
      country: payload["country"],
      postal_code: payload["postal_code"],
      description: payload["description"],
      location: payload["location"],
      metadata: payload["metadata"],
      hierarchy_path: payload["hierarchy_path"],
      enterprise_id: payload["enterprise_id"],
      created_at: payload["created_at"],
      updated_at: payload["updated_at"]
    }
  end
end

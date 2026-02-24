defmodule Maiden.SiteRuntime.PersistenceTest do
  use ExUnit.Case, async: false

  alias Jido.AgentServer
  alias Jido.Sensor.Runtime, as: SensorRuntime
  alias Maiden.SiteRuntime
  alias Maiden.SiteRuntime.Agent
  alias Maiden.SiteRuntime.SiteFactory

  setup_all do
    Application.ensure_all_started(:jido)

    case Jido.start() do
      {:ok, _pid} -> :ok
      {:error, {:already_started, _pid}} -> :ok
    end

    :ok
  end

  describe "snapshot/thaw" do
    test "round-trips persisted site runtime state" do
      table = unique_table(:site_runtime_roundtrip)

      base_agent =
        Agent.new(
          id: "site-persist-001",
          state: site_state("SIT-persist-main", "planned")
        )

      {:ok, transitioned_agent, []} =
        Agent.apply_signal_sync(base_agent, "site.transition.begin_construction", %{
          "site_id" => "SIT-persist-main",
          "from" => "planned",
          "to" => "under_construction",
          "action" => "BeginConstruction",
          "at" => "2026-02-24T03:00:00Z"
        })

      assert :ok = SiteRuntime.snapshot(transitioned_agent, table: table)

      assert {:ok, restored_agent} =
               SiteRuntime.thaw("site-persist-001", table: table)

      assert restored_agent.state.site_id == "SIT-persist-main"
      assert restored_agent.state.status == "under_construction"
      assert restored_agent.state.updated_at == "2026-02-24T03:00:00Z"
      assert restored_agent.state.__strategy__.machine.status == "idle"
    end

    test "delete_snapshot removes persisted checkpoint" do
      table = unique_table(:site_runtime_delete)

      agent =
        Agent.new(
          id: "site-persist-delete",
          state: site_state("SIT-persist-delete", "planned")
        )

      assert :ok = SiteRuntime.snapshot(agent, table: table)
      assert :ok = SiteRuntime.delete_snapshot("site-persist-delete", table: table)
      assert {:error, :not_found} = SiteRuntime.thaw("site-persist-delete", table: table)
    end
  end

  describe "restart continuity" do
    test "thaw + AgentServer restart resumes lifecycle transitions" do
      table = unique_table(:site_runtime_restart)
      agent_id = "site-persist-restart-#{System.unique_integer([:positive])}"

      base_agent =
        Agent.new(
          id: agent_id,
          state: site_state("SIT-persist-restart", "planned")
        )

      {:ok, under_construction_agent, []} =
        Agent.apply_signal_sync(base_agent, "site.transition.begin_construction", %{
          "site_id" => "SIT-persist-restart",
          "from" => "planned",
          "to" => "under_construction",
          "action" => "BeginConstruction",
          "at" => "2026-02-24T03:10:00Z"
        })

      assert :ok = SiteRuntime.snapshot(under_construction_agent, table: table)
      assert {:ok, restored_agent} = SiteRuntime.thaw(agent_id, table: table)
      assert restored_agent.state.status == "under_construction"

      {:ok, agent_server_pid} =
        AgentServer.start_link(
          jido: Jido.default_instance(),
          agent: restored_agent,
          agent_module: Agent
        )

      on_exit(fn -> Process.exit(agent_server_pid, :normal) end)

      {:ok, sensor_pid} =
        SensorRuntime.start_link(
          sensor: Maiden.SiteRuntime.Sensors.TransitionSensor,
          config: %{source: "/sensor/site-transition"},
          context: %{agent_ref: agent_server_pid},
          id: "sensor-restart-#{System.unique_integer([:positive])}"
        )

      on_exit(fn -> Process.exit(sensor_pid, :normal) end)

      :ok =
        SensorRuntime.event(sensor_pid, %{
          "site_id" => "SIT-persist-restart",
          "from" => "under_construction",
          "to" => "operational",
          "action" => "Commission",
          "at" => "2026-02-24T03:15:00Z"
        })

      {:ok, server_state} =
        await_agent_server_state(agent_server_pid, fn state ->
          state.agent.state.status == "operational" and
            state.agent.state.updated_at == "2026-02-24T03:15:00Z" and
            state.agent.state.__strategy__.machine.status == "idle"
        end)

      assert server_state.agent.state.site_id == "SIT-persist-restart"
      assert server_state.agent.state.status == "operational"
      assert server_state.agent.state.updated_at == "2026-02-24T03:15:00Z"
    end
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

  defp unique_table(prefix) do
    String.to_atom("#{prefix}_#{System.unique_integer([:positive])}")
  end

  defp site_state(site_id, status) do
    payload =
      SiteFactory.new_site(
        slug: String.replace_prefix(site_id, "SIT-", ""),
        name: "Persist Site",
        status: status,
        timezone: "UTC",
        enterprise_id: "ENT-acme",
        hierarchy_path: "/ENT-acme/#{site_id}",
        created_at: "2026-02-24T03:00:00Z"
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

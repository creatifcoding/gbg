defmodule Maiden.EnterpriseRuntime.PersistenceTest.StoreAdapter do
  @behaviour Maiden.EnterpriseRuntime.Boundaries.EnterpriseStore

  @impl true
  def persist_transition(event, metadata, opts) do
    send(self(), {:persist_transition, event, metadata, opts})
    :ok
  end
end

defmodule Maiden.EnterpriseRuntime.PersistenceTest.JobQueueAdapter do
  @behaviour Maiden.EnterpriseRuntime.Boundaries.JobQueue

  @impl true
  def enqueue_transition(event, opts) do
    send(self(), {:enqueue_transition, event, opts})
    :ok
  end
end

defmodule Maiden.EnterpriseRuntime.PersistenceTest do
  use ExUnit.Case, async: false

  alias Jido.AgentServer.DirectiveExec
  alias Maiden.EnterpriseRuntime
  alias Maiden.EnterpriseRuntime.Agent
  alias Maiden.EnterpriseRuntime.Boundaries
  alias Maiden.EnterpriseRuntime.Directives.EnqueueTransitionJob
  alias Maiden.EnterpriseRuntime.Directives.PersistTransition
  alias Maiden.EnterpriseRuntime.EnterpriseFactory

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

    app = :maiden_enterprise_runtime

    previous_store = Application.get_env(app, :enterprise_store_adapter)
    previous_queue = Application.get_env(app, :job_queue_adapter)

    Application.put_env(app, :enterprise_store_adapter, Maiden.EnterpriseRuntime.PersistenceTest.StoreAdapter)
    Application.put_env(app, :job_queue_adapter, Maiden.EnterpriseRuntime.PersistenceTest.JobQueueAdapter)

    on_exit(fn ->
      if previous_store do
        Application.put_env(app, :enterprise_store_adapter, previous_store)
      else
        Application.delete_env(app, :enterprise_store_adapter)
      end

      if previous_queue do
        Application.put_env(app, :job_queue_adapter, previous_queue)
      else
        Application.delete_env(app, :job_queue_adapter)
      end
    end)

    :ok
  end

  test "persist_transition delegates to configured boundary adapter" do
    event = %{enterprise_id: "ENT-acme-corp", from: "active", to: "restructuring"}
    metadata = %{trace_id: "trace-enterprise-1"}

    assert :ok = Boundaries.persist_transition(event, metadata, agent_id: "enterprise-agent-1")

    assert_receive {:persist_transition, ^event, ^metadata, [agent_id: "enterprise-agent-1"]}
  end

  test "directive exec for PersistTransition routes through boundary adapter" do
    event = %{enterprise_id: "ENT-acme-corp", from: "active", to: "merged"}
    metadata = %{trace_id: "trace-enterprise-2"}

    directive = %PersistTransition{event: event, metadata: metadata}

    assert {:ok, %{id: "enterprise-agent-1"}} =
             DirectiveExec.exec(directive, nil, %{id: "enterprise-agent-1"})

    assert_receive {:persist_transition, ^event, ^metadata, [agent_id: "enterprise-agent-1"]}
  end

  test "directive exec for EnqueueTransitionJob injects agent_id into options" do
    event = %{enterprise_id: "ENT-acme-corp", from: "active", to: "dissolved"}

    directive =
      %EnqueueTransitionJob{event: event, opts: [queue: :enterprise_runtime_transition]}

    assert {:ok, %{id: "enterprise-agent-1"}} =
             DirectiveExec.exec(directive, nil, %{id: "enterprise-agent-1"})

    assert_receive {:enqueue_transition, ^event, opts}
    assert opts[:queue] == :enterprise_runtime_transition
    assert opts[:agent_id] == "enterprise-agent-1"
  end

  describe "snapshot/thaw" do
    test "round-trips persisted enterprise runtime state" do
      table = unique_table(:enterprise_runtime_roundtrip)

      base_agent =
        Agent.new(
          id: "enterprise-persist-001",
          state: EnterpriseFactory.new_enterprise(%{slug: "acme-corp", status: "active"})
        )

      {:ok, transitioned_agent, []} =
        Agent.apply_signal_sync(base_agent, "enterprise.transition.restructuring", %{
          "enterprise_id" => "ENT-acme-corp",
          "from" => "active",
          "to" => "restructuring",
          "at" => "2026-02-24T00:22:00Z"
        })

      assert transitioned_agent.state.status == "restructuring"
      assert :ok = EnterpriseRuntime.snapshot(transitioned_agent, table: table)

      assert {:ok, restored_agent} = EnterpriseRuntime.thaw("enterprise-persist-001", table: table)

      assert restored_agent.state.enterprise_id == "ENT-acme-corp"
      assert restored_agent.state.status == "restructuring"
      assert restored_agent.state.updated_at == "2026-02-24T00:22:00Z"
      assert restored_agent.state.__strategy__.machine.status == "idle"
    end

    test "restore rejects invalid checkpoint state payload" do
      table = unique_table(:enterprise_runtime_invalid)
      key = {Agent, "enterprise-persist-invalid"}

      invalid_checkpoint = %{
        version: 1,
        agent_module: Agent,
        id: "enterprise-persist-invalid",
        state: %{
          enterprise_id: "ENT-acme-invalid",
          name: "ACME Invalid",
          status: "unknown",
          industry: nil,
          legal_name: nil,
          tax_id: nil,
          headquarters: nil,
          description: nil,
          metadata: %{},
          hierarchy_path: "/ENT-acme-invalid",
          created_at: "2026-02-24T00:00:00Z",
          updated_at: nil
        }
      }

      assert :ok = Jido.Storage.ETS.put_checkpoint(key, invalid_checkpoint, table: table)

      assert {:error, %{validator: :ex_json_schema}} =
               EnterpriseRuntime.thaw("enterprise-persist-invalid", table: table)
    end

    test "delete_snapshot removes persisted checkpoint" do
      table = unique_table(:enterprise_runtime_delete)

      agent =
        Agent.new(
          id: "enterprise-persist-delete",
          state: EnterpriseFactory.new_enterprise(%{slug: "acme-delete", status: "active"})
        )

      assert :ok = EnterpriseRuntime.snapshot(agent, table: table)
      assert :ok = EnterpriseRuntime.delete_snapshot("enterprise-persist-delete", table: table)
      assert {:error, :not_found} = EnterpriseRuntime.thaw("enterprise-persist-delete", table: table)
    end
  end

  defp unique_table(prefix) do
    String.to_atom("#{prefix}_#{System.unique_integer([:positive])}")
  end

  defp flush_mailbox do
    receive do
      _ -> flush_mailbox()
    after
      0 -> :ok
    end
  end
end

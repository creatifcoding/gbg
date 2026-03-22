defmodule Maiden.SiteRuntime.ValidatorTest do
  use ExUnit.Case, async: false

  alias Jido.Agent.Directive.RunInstruction
  alias Jido.Sensor.Runtime, as: SensorRuntime
  alias Maiden.SiteRuntime.Agent
  alias Maiden.SiteRuntime.FSM
  alias Maiden.SiteRuntime.SiteFactory
  alias Maiden.SiteRuntime.Validators.SiteValidator
  alias Maiden.SiteRuntime.Sensors.TransitionSensor

  setup_all do
    Application.ensure_all_started(:jido)

    case Jido.start() do
      {:ok, _pid} -> :ok
      {:error, {:already_started, _pid}} -> :ok
    end

    :ok
  end

  describe "site_validate/2" do
    test "accepts valid site payload" do
      payload =
        SiteFactory.new_site(
          slug: "chicago-main",
          status: "operational",
          timezone: "America/Chicago",
          enterprise_id: "ENT-acme",
          metadata: %{"owner" => "operations"}
        )

      assert :ok = SiteValidator.site_validate(payload)
      assert :ok = SiteValidator.agent_state_validate(payload)
    end

    test "rejects invalid enum payload" do
      payload =
        SiteFactory.new_site(
          slug: "chicago-main",
          status: "active"
        )

      assert {:error, %{validator: :skeleton, field: "status", reason: :invalid_enum}} =
               SiteValidator.site_validate(payload)
    end
  end

  describe "transition_event_validate/2 + FSM legality" do
    test "accepts legal transition event" do
      payload =
        SiteFactory.new_transition_event(
          slug: "chicago-main",
          from: "planned",
          to: "under_construction",
          at: "2026-02-24T01:05:00Z",
          action: "BeginConstruction"
        )

      assert :ok = SiteValidator.transition_event_validate(payload)
      assert :ok = FSM.validate_transition_for_jido(payload)
    end

    @tag :negative_gate
    test "rejects schema-valid but FSM-illegal transition" do
      payload =
        SiteFactory.new_transition_event(
          slug: "chicago-main",
          from: "under_construction",
          to: "closed",
          at: "2026-02-24T01:06:00Z"
        )

      assert :ok = SiteValidator.transition_event_validate(payload)

      assert {:error,
              %{
                validator: :fsm,
                from: "under_construction",
                to: "closed",
                allowed_next: ["operational"]
              }} = FSM.validate_transition_for_jido(payload)
    end
  end

  describe "Jido agent preflight + transition execution" do
    test "maps transition signal to explicit action and emits RunInstruction" do
      agent = Agent.new(id: "site-agent-001", state: site_state("SIT-chicago-main", "planned"))

      payload =
        SiteFactory.new_transition_event(
          slug: "chicago-main",
          from: "planned",
          to: "under_construction",
          at: "2026-02-24T01:10:00Z"
        )

      {:ok, {next_agent, directives}} =
        Agent.apply_signal(agent, "site.transition.begin_construction", payload)

      assert next_agent.state.__strategy__.machine.status == "processing"
      assert Enum.any?(directives, &match?(%RunInstruction{}, &1))
    end

    test "resolves RunInstruction and mutates state through strategy result" do
      agent = Agent.new(id: "site-agent-002", state: site_state("SIT-chicago-main", "planned"))

      payload =
        SiteFactory.new_transition_event(
          slug: "chicago-main",
          from: "planned",
          to: "under_construction",
          at: "2026-02-24T01:11:00Z"
        )

      {:ok, updated_agent, unresolved_directives} =
        Agent.apply_signal_sync(agent, "site.transition.begin_construction", payload)

      assert updated_agent.state.status == "under_construction"
      assert updated_agent.state.updated_at == "2026-02-24T01:11:00Z"
      assert updated_agent.state.__strategy__.machine.status == "idle"
      assert unresolved_directives == []
    end

    test "rejects unsupported signal types" do
      agent = Agent.new(id: "site-agent-unknown", state: site_state("SIT-chicago-main", "planned"))

      assert {:error, :unknown_signal_type} =
               Agent.apply_signal(agent, "site.transition.unknown", %{})
    end

    @tag :negative_gate
    test "rejects schema-valid but FSM-illegal transition before cmd" do
      agent = Agent.new(id: "site-agent-illegal", state: site_state("SIT-chicago-main", "planned"))

      payload =
        SiteFactory.new_transition_event(
          slug: "chicago-main",
          from: "planned",
          to: "closed",
          at: "2026-02-24T01:12:00Z"
        )

      assert {:error, %{validator: :fsm}} =
               Agent.apply_signal(agent, "site.transition.close", payload)
    end
  end

  describe "sensor ingress" do
    test "sensor emits transition signal only after preflight succeeds" do
      {:ok, sensor_pid} =
        SensorRuntime.start_link(
          sensor: TransitionSensor,
          config: %{source: "/sensor/site-transition", emit_rejections: true},
          context: %{agent_ref: self()},
          id: "sensor-self-#{System.unique_integer([:positive])}"
        )

      on_exit(fn -> Process.exit(sensor_pid, :normal) end)

      :ok =
        SensorRuntime.event(sensor_pid, %{
          "site_id" => "SIT-chicago-main",
          "from" => "planned",
          "to" => "under_construction",
          "at" => "2026-02-24T01:13:00Z"
        })

      assert_receive {:signal, signal}, 1_000
      assert signal.type == "site.transition.begin_construction"
      assert signal.data.action == "BeginConstruction"

      :ok =
        SensorRuntime.event(sensor_pid, %{
          "site_id" => "SIT-chicago-main",
          "from" => "planned",
          "to" => "closed",
          "at" => "2026-02-24T01:14:00Z"
        })

      assert_receive {:signal, rejection_signal}, 1_000
      assert rejection_signal.type == "site.transition.rejected"
      assert rejection_signal.data.to == "closed"
      assert rejection_signal.data.validator == :fsm
      assert is_binary(rejection_signal.data.trace_id)
    end
  end

  defp site_state(site_id, status) do
    %{
      site_id: site_id,
      name: "Chicago Main",
      status: status,
      timezone: "America/Chicago",
      address: nil,
      city: nil,
      state: nil,
      country: nil,
      postal_code: nil,
      description: nil,
      location: nil,
      metadata: %{},
      hierarchy_path: "/ENT-acme/#{site_id}",
      enterprise_id: "ENT-acme",
      created_at: "2026-02-24T01:00:00Z",
      updated_at: nil
    }
  end
end

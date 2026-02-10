defmodule AvaElixir.TelemetryTest do
  use ExUnit.Case, async: false

  test "emits nif call and mailbox pressure telemetry" do
    handler_id = "ava-elixir-telemetry-test-#{System.unique_integer([:positive])}"

    events = [
      [:ava_elixir, :nif, :call],
      [:ava_elixir, :mailbox, :pressure]
    ]

    :ok =
      :telemetry.attach_many(
        handler_id,
        events,
        fn event, measurements, metadata, pid ->
          send(pid, {:telemetry_event, event, measurements, metadata})
        end,
        self()
      )

    on_exit(fn -> :telemetry.detach(handler_id) end)

    spec_json =
      ~s({"id":"telemetry-view","name":"Telemetry","assemblage_id":"alpha","version":1,"channels":[]})

    assert {:ok, _} = AvaElixir.register_spec_json(spec_json)
    assert {:ok, _} = AvaElixir.SoakHarness.run(iterations: 1, interval_ms: 10)

    assert_receive {:telemetry_event, [:ava_elixir, :nif, :call], %{duration_us: _},
                    %{operation: _, status: _, runtime_mode: _}},
                   500

    assert_receive {:telemetry_event, [:ava_elixir, :mailbox, :pressure], %{queue_len: _},
                    %{subscription_id: _}},
                   500
  end
end

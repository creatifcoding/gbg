defmodule AvaElixir.SoakHarnessTest do
  use ExUnit.Case, async: false

  test "soak harness executes bounded subscribe/unsubscribe cycles" do
    assert {:ok, stats} = AvaElixir.SoakHarness.run(iterations: 3, interval_ms: 10)

    assert stats.iterations == 3
    assert stats.events_received == 3
    assert stats.subscription_failures == 0
    assert stats.invalidation_failures == 0
    assert stats.unsubscribe_failures == 0
  end
end

defmodule AvaElixir.FailureInjectionTest do
  use ExUnit.Case, async: false

  test "supervisor restarts failure probe after injected crash" do
    initial_pid = AvaElixir.FailureProbe.pid()

    AvaElixir.FailureProbe.crash()
    Process.sleep(100)

    restarted_pid = AvaElixir.FailureProbe.pid()

    assert is_pid(initial_pid)
    assert is_pid(restarted_pid)
    refute initial_pid == restarted_pid
  end

  test "native boundary reports malformed payloads without crashing app" do
    assert {:error, {:invalid_json, _}} = AvaElixir.register_spec_json("{")

    assert Process.alive?(Process.whereis(AvaElixir.Supervisor))
    assert Process.alive?(Process.whereis(AvaElixir.FailureProbe))
  end
end

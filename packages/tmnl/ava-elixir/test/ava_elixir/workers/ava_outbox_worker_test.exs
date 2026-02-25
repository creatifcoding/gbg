defmodule AvaElixir.Workers.AvaOutboxWorkerTest do
  use ExUnit.Case, async: true

  alias AvaElixir.Workers.AvaOutboxWorker
  alias Oban.Job

  describe "new/2 uniqueness semantics" do
    test "worker config encodes idempotency keys for duplicate args" do
      opts = AvaOutboxWorker.__opts__()
      unique_opts = Keyword.fetch!(opts, :unique)

      assert Keyword.fetch!(unique_opts, :keys) == [:subject, :event_id]
      assert Keyword.fetch!(unique_opts, :fields) == [:worker, :queue, :args]
      assert Keyword.fetch!(unique_opts, :period) == 120

      assert :retryable in Keyword.fetch!(unique_opts, :states)
      assert :scheduled in Keyword.fetch!(unique_opts, :states)
    end

    test "new/2 builds stable queue+worker metadata for duplicate jobs" do
      args = %{"subject" => "ava.events", "event_id" => "evt-123", "payload" => %{}}

      first = AvaOutboxWorker.new(args)
      second = AvaOutboxWorker.new(args)

      assert Ecto.Changeset.get_change(first, :worker) ==
               "AvaElixir.Workers.AvaOutboxWorker"

      assert Ecto.Changeset.get_change(first, :queue) == "ava_outbox"
      assert Ecto.Changeset.get_change(first, :args) == Ecto.Changeset.get_change(second, :args)
    end
  end

  describe "backoff/1" do
    test "is monotonic and bounded" do
      values =
        1..50
        |> Enum.map(fn attempt ->
          AvaOutboxWorker.backoff(%Job{attempt: attempt})
        end)

      assert values == Enum.sort(values)
      assert Enum.max(values) <= 600
      assert hd(values) >= 0
    end
  end

  describe "perform/1" do
    test "malformed args return :ok and do not crash" do
      malformed = [
        %{},
        %{"subject" => "ava.events"},
        %{"payload" => %{}},
        %{"subject" => 100, "payload" => %{}},
        %{"subject" => "ava.events", "payload" => "not-a-map"}
      ]

      for args <- malformed do
        assert :ok = AvaOutboxWorker.perform(%Job{args: args})
      end
    end
  end
end

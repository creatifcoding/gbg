defmodule AvaElixir.Workers.AvaCommandWorkerTest do
  use ExUnit.Case, async: true

  alias AvaElixir.Workers.AvaCommandWorker
  alias Oban.Job

  describe "new/2 uniqueness semantics" do
    test "worker config encodes idempotency keys for duplicate args" do
      opts = AvaCommandWorker.__opts__()
      unique_opts = Keyword.fetch!(opts, :unique)

      assert Keyword.fetch!(unique_opts, :keys) == [:action, :view_id]
      assert Keyword.fetch!(unique_opts, :fields) == [:worker, :queue, :args]
      assert Keyword.fetch!(unique_opts, :period) == 60

      assert :retryable in Keyword.fetch!(unique_opts, :states)
      assert :executing in Keyword.fetch!(unique_opts, :states)
    end

    test "new/2 builds stable queue+worker metadata for duplicate jobs" do
      args = %{"action" => "invalidate", "view_id" => "view-123", "trace" => "a"}

      first = AvaCommandWorker.new(args)
      second = AvaCommandWorker.new(args)

      assert Ecto.Changeset.get_change(first, :worker) ==
               "AvaElixir.Workers.AvaCommandWorker"

      assert Ecto.Changeset.get_change(first, :queue) == "ava_commands"
      assert Ecto.Changeset.get_change(first, :args) == Ecto.Changeset.get_change(second, :args)
    end
  end

  describe "backoff/1" do
    test "is monotonic and bounded" do
      values =
        1..25
        |> Enum.map(fn attempt ->
          AvaCommandWorker.backoff(%Job{attempt: attempt})
        end)

      assert values == Enum.sort(values)
      assert Enum.max(values) <= 300
      assert hd(values) >= 0
    end
  end

  describe "perform/1" do
    test "malformed args return :ok and do not crash" do
      malformed = [
        %{},
        %{"action" => "invalidate"},
        %{"view_id" => "view-123"},
        %{"action" => 100, "view_id" => "view-123"},
        %{"action" => "invalidate", "view_id" => nil}
      ]

      for args <- malformed do
        assert :ok = AvaCommandWorker.perform(%Job{args: args})
      end
    end
  end
end

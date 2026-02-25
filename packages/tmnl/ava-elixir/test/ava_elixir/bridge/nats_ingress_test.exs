defmodule AvaElixir.Bridge.NatsIngressTest do
  use ExUnit.Case, async: false

  import Ecto.Query

  alias AvaElixir.Bridge.NatsIngress
  alias AvaElixir.Repo
  alias Oban.Job

  setup do
    Repo.delete_all(Job)
    :ok
  end

  describe "parse_subject/1" do
    test "parses canonical subjects and rejects unsupported subjects" do
      assert {:ok, :invalidate, "view-1"} = NatsIngress.parse_subject("tmnl.ava.invalidate.view-1")
      assert {:ok, :subscribe, "view-2"} = NatsIngress.parse_subject("tmnl.ava.subscribe.view-2")
      assert {:ok, :unsubscribe, "view-3"} = NatsIngress.parse_subject("tmnl.ava.unsubscribe.view-3")

      assert {:error, :unsupported_subject} =
               NatsIngress.parse_subject("tmnl.ava.unknown.view-9")

      assert {:error, :unsupported_subject} =
               NatsIngress.parse_subject("tmnl.ava.invalidate.")
    end
  end

  describe "ingest/2" do
    test "accepts snake_case view_id and enqueues ava_commands job" do
      assert :ok =
               NatsIngress.ingest("tmnl.ava.invalidate.view-123", %{
                 "view_id" => "view-123",
                 "reason" => "test"
               })

      job =
        Job
        |> where([j], j.queue == "ava_commands")
        |> order_by([j], desc: j.id)
        |> limit(1)
        |> Repo.one()

      assert job
      assert job.args["action"] == "invalidate"
      assert job.args["view_id"] == "view-123"
      assert job.args["subject"] == "tmnl.ava.invalidate.view-123"
      assert is_map(job.args["payload"])
    end

    test "rejects camelCase viewId payload" do
      assert {:error, :missing_view_id} =
               NatsIngress.ingest("tmnl.ava.invalidate.view-123", %{"viewId" => "view-123"})
    end

    test "rejects subject/payload view_id mismatch" do
      assert {:error, :view_id_subject_mismatch} =
               NatsIngress.ingest("tmnl.ava.subscribe.view-123", %{"view_id" => "view-999"})
    end

    test "rejects malformed envelope with invalid JSON shape" do
      assert {:error, :invalid_payload_shape} =
               NatsIngress.ingest("tmnl.ava.unsubscribe.view-321", "[1,2,3]")
    end
  end
end

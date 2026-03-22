defmodule Mix.Tasks.Ava.Outbox.Redrive do
  @shortdoc "Redrive unpublished outbox rows"
  @moduledoc """
  Redrive unpublished rows from `ava_outbox`.

  Usage:

      mix ava.outbox.redrive [--limit N] [--dry-run] [--no-dry-run] [--all]

  Defaults:

    * limit: 100
    * dry-run: true
    * only failed + unpublished rows (`published_at IS NULL AND last_error IS NOT NULL`)

  `--all` widens selection to all unpublished rows (`published_at IS NULL`).
  """

  use Mix.Task

  alias AvaElixir.Repo
  alias AvaElixir.Telemetry
  alias AvaElixir.Workers.AvaOutboxWorker

  @switches [limit: :integer, dry_run: :boolean, all: :boolean]

  @impl Mix.Task
  def run(args) do
    Mix.Task.run("app.start")

    {opts, _argv, _invalid} = OptionParser.parse(args, strict: @switches)

    limit = max(1, Keyword.get(opts, :limit, 100))
    dry_run? = Keyword.get(opts, :dry_run, true)
    all? = Keyword.get(opts, :all, false)

    rows = fetch_rows(limit, all?)
    selected = length(rows)

    Telemetry.emit_redrive_selection(selected, dry_run?, all?)

    sample_ids = rows |> Enum.take(10) |> Enum.map_join(", ", & &1.id)

    Mix.shell().info(
      "[ava.outbox.redrive] selected=#{selected} limit=#{limit} dry_run=#{dry_run?} all=#{all?}"
    )

    Mix.shell().info("[ava.outbox.redrive] sample_ids=#{if(sample_ids == "", do: "(none)", else: sample_ids)}")

    if dry_run? do
      Mix.shell().info("[ava.outbox.redrive] dry-run: would enqueue #{selected} jobs")
      Telemetry.emit_redrive_summary(selected, 0, 0, true)
      {:ok, %{selected: selected, enqueued: 0, dry_run: true, all: all?}}
    else
      enqueued = enqueue_rows(rows)
      failed = selected - enqueued
      Mix.shell().info("[ava.outbox.redrive] enqueued #{enqueued} jobs")
      Telemetry.emit_redrive_summary(selected, enqueued, failed, false)
      {:ok, %{selected: selected, enqueued: enqueued, dry_run: false, all: all?}}
    end
  end

  defp fetch_rows(limit, all?) do
    where_clause = if all?, do: "published_at IS NULL", else: "published_at IS NULL AND last_error IS NOT NULL"

    sql = """
    SELECT id, event_id::text, topic, payload
    FROM ava_outbox
    WHERE #{where_clause}
    ORDER BY inserted_at ASC
    LIMIT $1
    """

    case Repo.query(sql, [limit]) do
      {:ok, %{rows: rows}} -> Enum.map(rows, &row_to_map/1)
      {:error, reason} ->
        Mix.raise("[ava.outbox.redrive] query failed: #{inspect(reason)}")
    end
  end

  defp row_to_map([id, event_id, topic, payload]) do
    %{id: uuid_to_string(id), event_id: event_id, topic: topic, payload: payload}
  end

  defp uuid_to_string(id) when is_binary(id) do
    case Ecto.UUID.load(id) do
      {:ok, uuid} -> uuid
      :error -> id
    end
  end

  defp uuid_to_string(id), do: to_string(id)

  defp enqueue_rows(rows) do
    Enum.reduce(rows, 0, fn row, acc ->
      args = %{
        "subject" => row.topic,
        "topic" => row.topic,
        "payload" => row.payload,
        "event_id" => row.event_id,
        "outbox_id" => row.id
      }

      case Oban.insert(AvaOutboxWorker.new(args)) do
        {:ok, _job} ->
          Telemetry.emit_redrive_enqueue(:ok, row.id)
          acc + 1

        {:error, reason} ->
          Telemetry.emit_redrive_enqueue(:error, row.id)
          Mix.shell().error("[ava.outbox.redrive] failed outbox_id=#{row.id} reason=#{inspect(reason)}")
          acc
      end
    end)
  end
end

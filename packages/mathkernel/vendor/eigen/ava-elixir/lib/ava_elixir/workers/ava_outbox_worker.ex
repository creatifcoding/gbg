defmodule AvaElixir.Workers.AvaOutboxWorker do
  @moduledoc """
  Oban worker for outbound NATS publishing.

  Persistence updates (publish attempts, published markers, errors) are
  performed through the Ash API boundary with explicit job-context options.
  """

  require Logger

  alias Ash.Query
  alias AvaElixir.Ash.Api
  alias AvaElixir.Bridge.NatsEgress
  alias AvaElixir.Resources.AvaOutbox

  if Code.ensure_loaded?(Oban.Worker) do
    use Oban.Worker,
      queue: :ava_outbox,
      max_attempts: 12,
      unique: [
        period: 120,
        fields: [:worker, :queue, :args],
        keys: [:subject, :event_id],
        states: [:available, :scheduled, :executing, :retryable]
      ]

    @impl Oban.Worker
    def perform(%Oban.Job{args: args}) when is_map(args), do: do_perform(args)

    @impl Oban.Worker
    def backoff(%Oban.Job{attempt: attempt}) when is_integer(attempt), do: min(600, attempt * 15)
  else
    @spec perform(map()) :: :ok
    def perform(%{args: args}) when is_map(args), do: do_perform(args)
    def perform(args) when is_map(args), do: do_perform(args)

    @spec backoff(map()) :: non_neg_integer()
    def backoff(_), do: 15
  end

  defp do_perform(%{"subject" => subject, "payload" => payload} = args)
       when is_binary(subject) and is_map(payload) do
    job_opts = Api.job_context_opts(args)

    case NatsEgress.publish(subject, payload) do
      :ok ->
        maybe_mark_published(args, job_opts)
        :ok

      {:error, reason} ->
        Logger.warning("[ava_outbox_worker] publish failed subject=#{subject} reason=#{inspect(reason)}")
        maybe_record_failure(args, reason, job_opts)
        :ok
    end
  end

  defp do_perform(args) do
    Logger.info("[ava_outbox_worker] TODO outbox payload mapping not finalized args=#{inspect(args)}")
    :ok
  end

  defp maybe_mark_published(args, job_opts) do
    case load_outbox(args, job_opts) do
      {:ok, row} ->
        row
        |> Ash.Changeset.for_update(:update, %{published_at: DateTime.utc_now(), last_error: nil})
        |> Api.update(job_opts)
        |> case do
          {:ok, _} -> :ok
          {:error, reason} ->
            Logger.warning("[ava_outbox_worker] ash mark published failed reason=#{inspect(reason)}")
            :ok
        end

      {:error, reason} ->
        Logger.warning("[ava_outbox_worker] ash load outbox failed reason=#{inspect(reason)}")
        :ok
    end
  end

  defp maybe_record_failure(args, reason, job_opts) do
    case load_outbox(args, job_opts) do
      {:ok, row} ->
        attempts = (row.publish_attempts || 0) + 1

        row
        |> Ash.Changeset.for_update(:update, %{publish_attempts: attempts, last_error: inspect(reason)})
        |> Api.update(job_opts)
        |> case do
          {:ok, _} -> :ok
          {:error, update_reason} ->
            Logger.warning("[ava_outbox_worker] ash failure update failed reason=#{inspect(update_reason)}")
            :ok
        end

      {:error, load_reason} ->
        Logger.warning("[ava_outbox_worker] ash load outbox failed reason=#{inspect(load_reason)}")
        :ok
    end
  end

  defp load_outbox(%{"outbox_id" => outbox_id}, job_opts) when is_binary(outbox_id) do
    Api.get(AvaOutbox, outbox_id, job_opts)
  end

  defp load_outbox(%{"event_id" => event_id}, job_opts) when is_binary(event_id) do
    AvaOutbox
    |> Query.filter_input(%{event_id: event_id})
    |> Query.limit(1)
    |> Api.read(job_opts)
    |> case do
      {:ok, [row | _]} -> {:ok, row}
      {:ok, []} -> {:error, :outbox_not_found}
      {:error, reason} -> {:error, reason}
    end
  end

  defp load_outbox(_args, _job_opts), do: {:error, :missing_outbox_identifier}
end

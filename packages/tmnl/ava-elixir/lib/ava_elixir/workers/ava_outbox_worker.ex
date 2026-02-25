defmodule AvaElixir.Workers.AvaOutboxWorker do
  @moduledoc """
  Oban worker for outbound NATS publishing.

  This currently provides a safe execution seam with TODO-grade behavior while
  domain outbox sourcing is integrated by adjacent tracks.
  """

  require Logger

  alias AvaElixir.Bridge.NatsEgress

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
    def backoff(%Oban.Job{attempt: attempt}) when is_integer(attempt) do
      min(600, attempt * 15)
    end
  else
    @spec perform(map()) :: :ok
    def perform(%{args: args}) when is_map(args), do: do_perform(args)
    def perform(args) when is_map(args), do: do_perform(args)

    @spec backoff(map()) :: non_neg_integer()
    def backoff(_), do: 15
  end

  defp do_perform(%{"subject" => subject, "payload" => payload})
       when is_binary(subject) and is_map(payload) do
    case NatsEgress.publish(subject, payload) do
      :ok -> :ok
      {:error, reason} ->
        Logger.warning("[ava_outbox_worker] publish failed subject=#{subject} reason=#{inspect(reason)}")
        :ok
    end
  end

  defp do_perform(args) do
    Logger.info("[ava_outbox_worker] TODO outbox payload mapping not finalized args=#{inspect(args)}")
    :ok
  end
end

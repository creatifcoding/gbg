defmodule AvaElixir.Workers.AvaCommandWorker do
  @moduledoc """
  Oban worker that executes AVA control commands from NATS ingress.

  Current behavior is intentionally safe/stubbed where domain integrations are
  still owned by downstream tracks.
  """

  require Logger

  if Code.ensure_loaded?(Oban.Worker) do
    use Oban.Worker,
      queue: :ava_commands,
      max_attempts: 8,
      unique: [
        period: 60,
        fields: [:worker, :queue, :args],
        keys: [:action, :view_id],
        states: [:available, :scheduled, :executing, :retryable]
      ]

    @impl Oban.Worker
    def perform(%Oban.Job{args: args}) when is_map(args) do
      do_perform(args)
    end

    @impl Oban.Worker
    def backoff(%Oban.Job{attempt: attempt}) when is_integer(attempt) do
      min(300, attempt * attempt + 5)
    end
  else
    @spec perform(map()) :: :ok
    def perform(%{args: args}) when is_map(args), do: do_perform(args)
    def perform(args) when is_map(args), do: do_perform(args)

    @spec backoff(map()) :: non_neg_integer()
    def backoff(_), do: 5
  end

  defp do_perform(%{"action" => action, "view_id" => view_id} = args)
       when is_binary(action) and is_binary(view_id) do
    case action do
      "invalidate" ->
        case AvaElixir.invalidate_view(view_id) do
          {:ok, _} -> :ok
          {:error, reason} ->
            Logger.warning("[ava_command_worker] invalidate failed view_id=#{view_id} reason=#{inspect(reason)}")
            :ok
        end

      "subscribe" ->
        case AvaElixir.subscribe(view_id) do
          {:ok, _} -> :ok
          {:error, reason} ->
            Logger.warning("[ava_command_worker] subscribe failed view_id=#{view_id} reason=#{inspect(reason)}")
            :ok
        end

      "unsubscribe" ->
        Logger.info("[ava_command_worker] TODO unsubscribe domain wiring action payload=#{inspect(args)}")
        :ok

      other ->
        Logger.warning("[ava_command_worker] unsupported action=#{other} args=#{inspect(args)}")
        :ok
    end
  end

  defp do_perform(args) do
    Logger.warning("[ava_command_worker] missing required args #{inspect(args)}")
    :ok
  end
end

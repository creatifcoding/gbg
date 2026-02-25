defmodule AvaElixir.Workers.AvaCommandWorker do
  @moduledoc """
  Oban worker that executes AVA control commands from NATS ingress.

  Ash-centric boundary: command ingestion is persisted via Ash resources
  (`AvaCommand`, `AvaEvent`, `AvaOutbox`) and downstream IO is delegated to the
  outbox pipeline.
  """

  require Logger

  alias AvaElixir.Ash.Api
  alias AvaElixir.Resources.AvaCommand
  alias AvaElixir.Resources.AvaEvent
  alias AvaElixir.Resources.AvaOutbox

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
    def perform(%Oban.Job{args: args}) when is_map(args), do: do_perform(args)

    @impl Oban.Worker
    def backoff(%Oban.Job{attempt: attempt}) when is_integer(attempt), do: min(300, attempt * attempt + 5)
  else
    @spec perform(map()) :: :ok
    def perform(%{args: args}) when is_map(args), do: do_perform(args)
    def perform(args) when is_map(args), do: do_perform(args)

    @spec backoff(map()) :: non_neg_integer()
    def backoff(_), do: 5
  end

  defp do_perform(%{"action" => action, "view_id" => view_id} = args)
       when is_binary(action) and is_binary(view_id) do
    if action in ["invalidate", "subscribe", "unsubscribe"] do
      persist_command_pipeline(action, view_id, args)
    else
      Logger.warning("[ava_command_worker] unsupported action=#{action} args=#{inspect(args)}")
    end

    :ok
  end

  defp do_perform(args) do
    Logger.warning("[ava_command_worker] missing required args #{inspect(args)}")
    :ok
  end

  defp persist_command_pipeline(action, view_id, args) do
    job_opts = Api.job_context_opts(args)

    with {:ok, command} <- create_command(action, view_id, args, job_opts),
         {:ok, event} <- create_event(command, action, view_id, args, job_opts),
         {:ok, _outbox} <- create_outbox(command, event, action, view_id, args, job_opts) do
      :ok
    else
      {:error, reason} ->
        Logger.warning("[ava_command_worker] ash pipeline failed action=#{action} view_id=#{view_id} reason=#{inspect(reason)}")
        :ok
    end
  end

  defp create_command(action, view_id, args, job_opts) do
    idempotency_key =
      Map.get(args, "idempotency_key") ||
        Map.get(args, "command_id") ||
        "#{action}:#{view_id}:#{Map.get(args, "trace") || "na"}"

    attrs = %{
      command_type: action,
      idempotency_key: idempotency_key,
      stream_name: Map.get(args, "stream_name") || "ava.commands",
      stream_key: Map.get(args, "stream_key") || view_id,
      expected_stream_version: Map.get(args, "expected_stream_version"),
      payload: args,
      metadata: %{
        source: "ava_command_worker",
        trace: Map.get(args, "trace"),
        job_context: true,
        actor_role: "system_job"
      }
    }

    AvaCommand
    |> Ash.Changeset.for_create(:create, attrs)
    |> Api.create(job_opts)
  end

  defp create_event(command, action, view_id, args, job_opts) do
    attrs = %{
      command_id: command.id,
      event_type: "ava.command.#{action}",
      stream_name: "ava.events",
      stream_key: view_id,
      stream_version: Map.get(args, "stream_version") || 0,
      global_position: System.unique_integer([:positive, :monotonic]),
      causation_id: Map.get(args, "causation_id"),
      correlation_id: Map.get(args, "correlation_id"),
      payload: %{
        action: action,
        view_id: view_id,
        command_id: command.id,
        command_payload: args
      },
      metadata: %{
        source: "ava_command_worker",
        job_context: true,
        actor_role: "system_job"
      }
    }

    AvaEvent
    |> Ash.Changeset.for_create(:create, attrs)
    |> Api.create(job_opts)
  end

  defp create_outbox(command, event, action, view_id, args, job_opts) do
    attrs = %{
      event_id: event.id,
      topic: "tmnl.ava.#{action}.#{view_id}",
      partition_key: view_id,
      payload: %{
        action: action,
        view_id: view_id,
        command_id: command.id,
        event_id: event.id,
        command_payload: args
      },
      headers: %{
        schema_version: "1.0.0",
        source: "ava_command_worker",
        job_context: true
      },
      publish_attempts: 0,
      available_at: DateTime.utc_now(),
      last_error: nil
    }

    AvaOutbox
    |> Ash.Changeset.for_create(:create, attrs)
    |> Api.create(job_opts)
  end
end

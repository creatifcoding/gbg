defmodule AvaElixir.SoakHarness do
  @moduledoc """
  Streaming soak harness for subscribe/invalidate/unsubscribe lifecycle.

  The harness is intentionally deterministic and low-overhead so it can run
  in CI with bounded runtime.
  """

  @type stats :: %{
          iterations: non_neg_integer(),
          events_received: non_neg_integer(),
          subscription_failures: non_neg_integer(),
          invalidation_failures: non_neg_integer(),
          unsubscribe_failures: non_neg_integer()
        }

  @spec run(keyword()) :: {:ok, stats()} | {:error, term()}
  def run(opts \\ []) do
    iterations = Keyword.get(opts, :iterations, 25)
    interval_ms = Keyword.get(opts, :interval_ms, 10)

    result =
      Enum.reduce(1..iterations, initial_stats(iterations), fn index, acc ->
        view_id = "soak-view-#{index}"

        case AvaElixir.register_spec_json(build_spec(view_id)) do
          {:ok, _} ->
            run_iteration(view_id, interval_ms, acc)

          {:error, _reason} ->
            %{acc | subscription_failures: acc.subscription_failures + 1}
        end
      end)

    {:ok, result}
  end

  @spec run_iteration(String.t(), non_neg_integer(), stats()) :: stats()
  defp run_iteration(view_id, interval_ms, acc) do
    with {:ok, sub_id} <- AvaElixir.subscribe(view_id, interval_ms: interval_ms, pid: self()),
         true <- wait_for_event(sub_id),
         {:ok, _} <- AvaElixir.unsubscribe(sub_id),
         {:ok, _} <- AvaElixir.invalidate_view(view_id) do
      %{acc | events_received: acc.events_received + 1}
    else
      {:error, {:subscription_not_found, _}} ->
        %{acc | unsubscribe_failures: acc.unsubscribe_failures + 1}

      {:error, {:view_not_found, _}} ->
        %{acc | invalidation_failures: acc.invalidation_failures + 1}

      {:error, _reason} ->
        %{acc | subscription_failures: acc.subscription_failures + 1}

      false ->
        %{acc | subscription_failures: acc.subscription_failures + 1}
    end
  end

  @spec wait_for_event(String.t()) :: boolean()
  defp wait_for_event(sub_id) do
    queue_len =
      self()
      |> Process.info(:message_queue_len)
      |> case do
        {:message_queue_len, len} -> len
        _ -> 0
      end

    AvaElixir.Telemetry.emit_mailbox_pressure(queue_len, %{subscription_id: sub_id})

    receive do
      {:ava_artifact, ^sub_id, %{view_id: _view_id, sequence: _seq}} -> true
    after
      250 -> false
    end
  end

  @spec build_spec(String.t()) :: String.t()
  defp build_spec(view_id) do
    Jason.encode!(%{
      id: view_id,
      name: "Soak",
      assemblage_id: "alpha",
      version: 1,
      channels: []
    })
  end

  @spec initial_stats(non_neg_integer()) :: stats()
  defp initial_stats(iterations) do
    %{
      iterations: iterations,
      events_received: 0,
      subscription_failures: 0,
      invalidation_failures: 0,
      unsubscribe_failures: 0
    }
  end
end

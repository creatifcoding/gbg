defmodule AvaElixir.Bridge.NatsIngress do
  @moduledoc """
  NATS ingress bridge for canonical TMNL AVA control subjects.

  Supported subjects:
    * `tmnl.ava.invalidate.*`
    * `tmnl.ava.subscribe.*`
    * `tmnl.ava.unsubscribe.*`

  Payloads are expected to include `view_id`.
  """

  require Logger

  alias AvaElixir.Telemetry
  alias AvaElixir.Workers.AvaCommandWorker

  @type action :: :invalidate | :subscribe | :unsubscribe

  @spec ingest(binary(), map() | binary()) :: :ok | {:error, term()}
  def ingest(subject, payload) when is_binary(subject) do
    with {:ok, action, subject_view_id} <- parse_subject(subject),
         {:ok, normalized} <- normalize_payload(payload),
         {:ok, view_id} <- extract_view_id(normalized),
         :ok <- ensure_view_id_match(subject_view_id, view_id) do
      result = enqueue_command(action, view_id, subject, normalized)
      emit_ingress_metric(subject, result, view_id)
      result
    else
      {:error, reason} = error ->
        Logger.warning("[nats_ingress] dropped message subject=#{subject} reason=#{inspect(reason)}")
        emit_ingress_metric(subject, error, nil)
        error
    end
  end

  @spec parse_subject(binary()) ::
          {:ok, action(), binary()} | {:error, :unsupported_subject}
  def parse_subject("tmnl.ava.invalidate." <> view_id) when byte_size(view_id) > 0,
    do: {:ok, :invalidate, view_id}

  def parse_subject("tmnl.ava.subscribe." <> view_id) when byte_size(view_id) > 0,
    do: {:ok, :subscribe, view_id}

  def parse_subject("tmnl.ava.unsubscribe." <> view_id) when byte_size(view_id) > 0,
    do: {:ok, :unsubscribe, view_id}

  def parse_subject(_), do: {:error, :unsupported_subject}

  @spec normalize_payload(map() | binary()) :: {:ok, map()} | {:error, term()}
  defp normalize_payload(payload) when is_map(payload), do: {:ok, payload}

  defp normalize_payload(payload) when is_binary(payload) do
    case Jason.decode(payload) do
      {:ok, decoded} when is_map(decoded) -> {:ok, decoded}
      {:ok, _} -> {:error, :invalid_payload_shape}
      {:error, reason} -> {:error, {:invalid_payload_json, reason}}
    end
  end

  defp normalize_payload(_), do: {:error, :invalid_payload_type}

  @spec extract_view_id(map()) :: {:ok, binary()} | {:error, :missing_view_id}
  defp extract_view_id(%{"view_id" => view_id}) when is_binary(view_id) and byte_size(view_id) > 0,
    do: {:ok, view_id}

  defp extract_view_id(%{view_id: view_id}) when is_binary(view_id) and byte_size(view_id) > 0,
    do: {:ok, view_id}

  defp extract_view_id(_), do: {:error, :missing_view_id}

  @spec ensure_view_id_match(binary(), binary()) :: :ok | {:error, :view_id_subject_mismatch}
  defp ensure_view_id_match(view_id, view_id), do: :ok
  defp ensure_view_id_match(_, _), do: {:error, :view_id_subject_mismatch}

  defp enqueue_command(action, view_id, subject, payload) do
    args = %{"action" => Atom.to_string(action), "view_id" => view_id, "subject" => subject, "payload" => payload}

    if Code.ensure_loaded?(Oban) do
      case Oban.insert(AvaCommandWorker.new(args)) do
        {:ok, _job} -> :ok
        {:error, reason} -> {:error, {:oban_insert_failed, reason}}
      end
    else
      Logger.info("[nats_ingress] Oban unavailable, noop for action=#{action} view_id=#{view_id}")
      :ok
    end
  end

  @spec emit_ingress_metric(binary(), :ok | {:error, term()}, binary() | nil) :: :ok
  defp emit_ingress_metric(subject, result, view_id) do
    status = if result == :ok, do: :ok, else: :error
    Telemetry.emit_bridge_ingress(subject, status, AvaElixir.runtime_mode(), view_id)
  end
end

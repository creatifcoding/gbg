Mix.Task.run("app.start")

alias AvaElixir.Bridge.NatsConsumer
alias AvaElixir.Bridge.NatsIngress

supervisor = AvaElixir.Supervisor
child_id = NatsConsumer

before_pid = Process.whereis(child_id)

if is_nil(before_pid) do
  raise "[bridge_restart_drill] NatsConsumer not running before restart"
end

IO.puts("[bridge_restart_drill] before_pid=#{inspect(before_pid)}")

case Supervisor.terminate_child(supervisor, child_id) do
  :ok ->
    :ok

  {:error, reason} ->
    raise "[bridge_restart_drill] terminate_child failed: #{inspect(reason)}"
end

restart_pid =
  case Supervisor.restart_child(supervisor, child_id) do
    {:ok, pid} when is_pid(pid) ->
      pid

    {:ok, pid, _info} when is_pid(pid) ->
      pid

    {:error, reason} ->
      raise "[bridge_restart_drill] restart_child failed: #{inspect(reason)}"
  end

after_pid = Process.whereis(child_id)

if is_nil(after_pid) do
  raise "[bridge_restart_drill] NatsConsumer not running after restart"
end

IO.puts("[bridge_restart_drill] after_pid=#{inspect(after_pid)} restart_pid=#{inspect(restart_pid)}")

if before_pid == after_pid do
  IO.puts("[bridge_restart_drill] warning: pid unchanged after restart")
end

subject = "tmnl.ava.invalidate.bridge-restart-drill-view"
payload = %{"view_id" => "bridge-restart-drill-view", "reason" => "phase-b-restart-drill"}

case NatsIngress.ingest(subject, payload) do
  :ok ->
    IO.puts("[bridge_restart_drill] ingest_result=:ok")

  {:error, reason} ->
    raise "[bridge_restart_drill] ingest failed after restart: #{inspect(reason)}"
end

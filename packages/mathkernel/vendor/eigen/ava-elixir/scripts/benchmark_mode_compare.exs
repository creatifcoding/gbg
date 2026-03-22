Mix.Task.run("app.start")

iterations =
  case System.get_env("AVA_BENCH_ITERATIONS") do
    nil -> 1_000
    raw -> String.to_integer(raw)
  end

build_spec = fn i ->
  Jason.encode!(%{
    id: "bench-view-#{i}",
    name: "Bench",
    assemblage_id: "alpha",
    version: 1,
    channels: []
  })
end

bench = fn label, fun ->
  {micros, _} = :timer.tc(fun)
  per_iter = micros / iterations
  IO.puts("#{label}: total=#{micros}µs avg=#{Float.round(per_iter, 2)}µs")
end

IO.puts("AVA mode benchmark iterations=#{iterations}")

Application.put_env(:ava_elixir, :runtime_mode, :nif)

bench.("nif.register_spec_json", fn ->
  Enum.each(1..iterations, fn i ->
    _ = AvaElixir.register_spec_json(build_spec.(i))
  end)
end)

Application.put_env(:ava_elixir, :runtime_mode, :sidecar)

bench.("sidecar.register_spec_json", fn ->
  Enum.each(1..iterations, fn i ->
    _ = AvaElixir.register_spec_json(build_spec.(i))
  end)
end)

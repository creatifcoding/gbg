#!/usr/bin/env elixir
defmodule WordStats do
  def run(args) do
    case args do
      [path] -> path |> File.read!() |> summarize()
      _ -> IO.puts("Usage: elixir word_stats.exs <file>")
    end
  end
  defp summarize(text) do
    words =
      text
      |> String.downcase()
      |> String.replace(~r/[^a-z0-9\s]/u, " ")
      |> String.split(~r/\s+/, trim: true)
    total = length(words)
    unique = words |> MapSet.new() |> MapSet.size()
    chars = text |> String.replace(~r/\s+/u, "") |> String.length()
    avg = if total > 0, do: Float.round(chars / total, 2), else: 0.0
    IO.puts("Total words: #{total}")
    IO.puts("Unique words: #{unique}")
    IO.puts("Average word length: #{avg}")
    IO.puts("Top 10:")
    IO.puts(String.duplicate("-", 20))
    words
    |> Enum.frequencies()
    |> Enum.sort_by(fn {_w, c} -> -c end)
    |> Enum.take(10)
    |> Enum.each(fn {w, c} -> IO.puts("#{w}: #{c}") end)
  end
end; WordStats.run(System.argv())

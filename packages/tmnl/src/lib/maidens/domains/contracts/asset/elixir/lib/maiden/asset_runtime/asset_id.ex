defmodule Maiden.AssetRuntime.AssetId do
  @moduledoc """
  Generic ISA-95 asset identifier constructor + validator.

  Accepted prefixes: ENT, SIT, ARA, PLT, LIN, WCL, MCH, SNS, DEV
  """

  @pattern ~r/^(ENT|SIT|ARA|PLT|LIN|WCL|MCH|SNS|DEV)-[a-zA-Z0-9-]+$/

  @prefix_by_kind %{
    "enterprise" => "ENT",
    "site" => "SIT",
    "area" => "ARA",
    "plant" => "PLT",
    "line" => "LIN",
    "workcell" => "WCL",
    "machine" => "MCH",
    "sensor" => "SNS",
    "device" => "DEV"
  }

  @spec make(String.t(), String.t()) :: String.t()
  def make(kind, slug) when is_binary(kind) and is_binary(slug) do
    prefix = Map.fetch!(@prefix_by_kind, kind)

    normalized =
      slug
      |> String.trim()
      |> String.downcase()
      |> String.replace(~r/\s+/, "-")
      |> String.replace(~r/[^a-z0-9-]/, "-")
      |> String.replace(~r/-+/, "-")
      |> String.trim("-")

    prefix <> "-" <> normalized
  end

  @spec valid?(String.t()) :: boolean()
  def valid?(value) when is_binary(value), do: Regex.match?(@pattern, value)
  def valid?(_), do: false
end

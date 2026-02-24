defmodule Maiden.OrderRuntime.Support.UUIDv4 do
  @moduledoc false

  @spec cast(String.t()) :: {:ok, String.t()} | :error
  def cast(uuid) when is_binary(uuid) do
    normalized = String.trim(uuid)

    cond do
      Code.ensure_loaded?(Ecto.UUID) ->
        with {:ok, canonical} <- apply(Ecto.UUID, :cast, [normalized]),
             {:ok, %Uniq.UUID{version: 4}} <- Uniq.UUID.parse(canonical) do
          {:ok, canonical}
        else
          _ -> :error
        end

      true ->
        case Uniq.UUID.parse(normalized) do
          {:ok, %Uniq.UUID{version: 4} = parsed} -> {:ok, Uniq.UUID.to_string(parsed)}
          _ -> :error
        end
    end
  end
end

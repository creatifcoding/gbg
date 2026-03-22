defmodule MathKernel.NIF do
  @moduledoc """
  MathKernel NIF — C++/Eigen math kernels callable from BEAM.

  Built with fine (elixir-nx/fine) for automatic argument encoding/decoding.
  The shared library `mathkernel_nif.so` is compiled from the same C++ sources
  as the WASM target, gated by `#ifdef MATHKERNEL_NIF`.

  ## Usage

      iex> MathKernel.NIF.mmult([1.0, 2.0, 3.0, 4.0], 2, 2, [5.0, 6.0, 7.0, 8.0], 2, 2)
      [19.0, 22.0, 43.0, 50.0]

      iex> MathKernel.NIF.det([1.0, 2.0, 3.0, 4.0], 2)
      -2.0
  """

  @on_load :load_nif

  def load_nif do
    path = :filename.join(:code.priv_dir(:math_kernel), ~c"mathkernel_nif")
    :erlang.load_nif(path, 0)
  end

  @doc "Matrix multiply: A(rows_a × cols_a) × B(rows_b × cols_b) → C (flat row-major)"
  @spec mmult([float()], integer(), integer(), [float()], integer(), integer()) :: [float()]
  def mmult(_a, _rows_a, _cols_a, _b, _rows_b, _cols_b), do: :erlang.nif_error(:not_loaded)

  @doc "Determinant of square matrix (n × n)"
  @spec det([float()], integer()) :: float()
  def det(_a, _n), do: :erlang.nif_error(:not_loaded)

  @doc "Inverse of square matrix (n × n)"
  @spec inverse([float()], integer()) :: [float()]
  def inverse(_a, _n), do: :erlang.nif_error(:not_loaded)
end

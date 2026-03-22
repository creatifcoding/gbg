defmodule MathKernel.NIFTest do
  use ExUnit.Case, async: true

  describe "mmult/6" do
    test "2x2 identity * 2x2 matrix = same matrix" do
      identity = [1.0, 0.0, 0.0, 1.0]
      matrix = [5.0, 6.0, 7.0, 8.0]

      result = MathKernel.NIF.mmult(identity, 2, 2, matrix, 2, 2)
      assert_close(result, [5.0, 6.0, 7.0, 8.0])
    end

    test "2x2 * 2x2 = correct product" do
      a = [1.0, 2.0, 3.0, 4.0]
      b = [5.0, 6.0, 7.0, 8.0]

      result = MathKernel.NIF.mmult(a, 2, 2, b, 2, 2)
      assert_close(result, [19.0, 22.0, 43.0, 50.0])
    end
  end

  describe "det/2" do
    test "2x2 determinant" do
      result = MathKernel.NIF.det([1.0, 2.0, 3.0, 4.0], 2)
      assert_in_delta(result, -2.0, 1.0e-10)
    end

    test "identity determinant = 1" do
      result = MathKernel.NIF.det([1.0, 0.0, 0.0, 1.0], 2)
      assert_in_delta(result, 1.0, 1.0e-10)
    end
  end

  describe "inverse/2" do
    test "2x2 inverse" do
      result = MathKernel.NIF.inverse([1.0, 2.0, 3.0, 4.0], 2)
      assert_close(result, [-2.0, 1.0, 1.5, -0.5])
    end
  end

  defp assert_close(actual, expected, tol \\ 1.0e-10) do
    Enum.zip(actual, expected)
    |> Enum.each(fn {a, e} -> assert_in_delta(a, e, tol) end)
  end
end

defmodule Test.BlackScholes.Normal do
  @moduledoc false

  @spec cdf(number) :: float
  def cdf(value) when is_number(value) do
    0.5 * (1.0 + :math.erf(value / :math.sqrt(2.0)))
  end
end

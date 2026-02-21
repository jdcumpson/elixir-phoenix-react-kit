defmodule Test.BlackScholes do
  @moduledoc """
  Black-Scholes style option pricing with simple defaults.
  """

  alias Test.BlackScholes.Normal

  @default_days_to_expiry 30
  @default_risk_free_rate 0.02
  @default_dividend_yield 0.0
  @default_carry_rate 0.0
  @default_contract_size 100
  @default_steps 75

  @type option_side :: :buy | :write | :long | :short | String.t()
  @type option_kind :: :call | :put | String.t()
  @type rate_point :: {pos_integer, number}
  @type price_range :: Range.t() | [number] | {number, number, number}
  @type date_range ::
          Date.Range.t()
          | [Date.t() | NaiveDateTime.t() | DateTime.t() | String.t()]
          | {Date.t(), Date.t()}
          | {Date.t(), Date.t(), pos_integer}

  @doc """
  Prices an option and returns the total premium across contracts.

  Defaults can be overridden with:
  - `:days_to_expiry` or `:years_to_expiry`
  - `:risk_free_rate`
  - `:risk_free_curve` (list of `{days, rate}` points)
  - `:dividend_yield`
  - `:carry_rate`
  - `:contract_size`
  - `:american` (boolean, uses binomial tree)
  - `:steps` (tree steps, positive integer)

  If both `:risk_free_curve` and `:risk_free_rate` are provided, the curve is used.
  """
  @spec price(number, option_side, option_kind, number, number, number) :: float
  @spec price(number, option_side, option_kind, number, number, number, keyword) :: float
  def price(
        underlying_price,
        buy_or_write,
        call_or_put,
        strike_price,
        contracts,
        implied_volatility,
        opts \\ []
      ) do
    side_multiplier = normalize_side(buy_or_write)
    contracts = validate_non_negative!(contracts, :contracts)

    contract_size =
      opts
      |> Keyword.get(:contract_size, @default_contract_size)
      |> validate_positive!(:contract_size)

    price_per_share =
      price_per_share(underlying_price, call_or_put, strike_price, implied_volatility, opts)

    (price_per_share * contracts * contract_size * side_multiplier)
    |> Float.round(2)
  end

  @doc """
  Prices an option per share (one unit of the underlying).
  """
  @spec price_per_share(number, option_kind, number, number) :: float
  @spec price_per_share(number, option_kind, number, number, keyword) :: float
  def price_per_share(underlying_price, call_or_put, strike_price, implied_volatility, opts \\ []) do
    underlying_price = validate_positive!(underlying_price, :underlying_price)
    strike_price = validate_positive!(strike_price, :strike_price)
    implied_volatility = validate_positive!(implied_volatility, :implied_volatility)
    call_or_put = normalize_call_or_put(call_or_put)

    days_to_expiry = days_to_expiry(opts)
    time_to_expiry = days_to_expiry / 365.0
    risk_free_rate = risk_free_rate_from_opts(opts, days_to_expiry)
    dividend_yield = fetch_number(opts, :dividend_yield, @default_dividend_yield)
    carry_rate = fetch_number(opts, :carry_rate, @default_carry_rate)
    american = fetch_boolean(opts, :american, false)

    if american do
      steps = opts |> Keyword.get(:steps, @default_steps) |> validate_steps!()

      price_per_share_american(
        underlying_price,
        call_or_put,
        strike_price,
        implied_volatility,
        time_to_expiry,
        risk_free_rate,
        dividend_yield,
        carry_rate,
        steps
      )
    else
      price_per_share_european(
        underlying_price,
        call_or_put,
        strike_price,
        implied_volatility,
        time_to_expiry,
        risk_free_rate,
        dividend_yield,
        carry_rate
      )
    end
  end

  @doc """
  Solves implied volatility from an observed option premium.

  The `market_price` is treated as an absolute premium. By default it is the total
  premium for `contracts` and `:contract_size`; set `:price_is_per_share` to true
  to pass a per-share price.
  """
  @spec implied_volatility(
          number,
          option_side,
          option_kind,
          number,
          number,
          number
        ) :: float
  @spec implied_volatility(
          number,
          option_side,
          option_kind,
          number,
          number,
          number,
          keyword
        ) :: float
  def implied_volatility(
        underlying_price,
        buy_or_write,
        call_or_put,
        strike_price,
        contracts,
        market_price,
        opts \\ []
      ) do
    _ = normalize_side(buy_or_write)
    underlying_price = validate_positive!(underlying_price, :underlying_price)
    strike_price = validate_positive!(strike_price, :strike_price)
    call_or_put = normalize_call_or_put(call_or_put)
    contracts = validate_positive!(contracts, :contracts)

    contract_size =
      opts
      |> Keyword.get(:contract_size, @default_contract_size)
      |> validate_positive!(:contract_size)

    price_is_per_share = fetch_boolean(opts, :price_is_per_share, false)
    market_price = normalize_market_price!(market_price)

    target_price_per_share =
      if price_is_per_share do
        market_price
      else
        market_price / (contracts * contract_size)
      end

    vol_lower =
      opts
      |> Keyword.get(:vol_lower, 0.0001)
      |> validate_positive!(:vol_lower)

    vol_upper =
      opts
      |> Keyword.get(:vol_upper, 5.0)
      |> validate_positive!(:vol_upper)

    if vol_upper <= vol_lower do
      raise ArgumentError,
            "vol_upper must be greater than vol_lower, got: #{inspect({vol_lower, vol_upper})}"
    end

    tolerance =
      opts
      |> Keyword.get(:vol_tolerance, 1.0e-6)
      |> validate_positive!(:vol_tolerance)

    max_iterations =
      opts
      |> Keyword.get(:max_iterations, 100)
      |> validate_positive_integer!(:max_iterations)

    price_opts =
      opts
      |> Keyword.delete(:price_is_per_share)
      |> Keyword.delete(:vol_lower)
      |> Keyword.delete(:vol_upper)
      |> Keyword.delete(:vol_tolerance)
      |> Keyword.delete(:max_iterations)

    price_lower =
      price_per_share(underlying_price, call_or_put, strike_price, vol_lower, price_opts)

    price_upper =
      price_per_share(underlying_price, call_or_put, strike_price, vol_upper, price_opts)

    cond do
      abs(target_price_per_share - price_lower) <= tolerance ->
        vol_lower

      abs(target_price_per_share - price_upper) <= tolerance ->
        vol_upper

      true ->
        1..max_iterations
        |> Enum.reduce_while({vol_lower, vol_upper}, fn _, {low, high} ->
          mid = (low + high) / 2.0

          price_mid =
            price_per_share(underlying_price, call_or_put, strike_price, mid, price_opts)

          diff = price_mid - target_price_per_share

          if abs(diff) <= tolerance do
            {:halt, mid}
          else
            if diff > 0 do
              {:cont, {low, mid}}
            else
              {:cont, {mid, high}}
            end
          end
        end)
        |> case do
          vol when is_number(vol) -> vol
          {low, high} -> (low + high) / 2.0
        end
    end
  end

  @doc """
  Builds a 2D price surface across a price range and a date range.

  The `price_range` can be a list of prices, a `Range`, or `{min, max, step}`.
  The `date_range` can be a `Date.Range`, a list of dates, `{start_date, end_date}`,
  or `{start_date, end_date, steps}` where `steps` is the number of business-day
  points to sample across the range.
  Dates are treated as the beginning of each day and require `:expiry_date` in `opts`.

  The returned list is indexed as `[price_index][date_index]`, matching the order
  of the provided price and date ranges. Weekends are excluded. Dates must be
  strictly before the expiry date.
  """
  def price_for_range(
        price_range,
        date_range,
        buy_or_write,
        call_or_put,
        option_price,
        strike_price,
        contracts,
        implied_volatility,
        opts \\ []
      ) do
    prices = expand_price_range(price_range)
    dates = expand_date_range(date_range)
    expiry_date = fetch_expiry_date!(opts)
    days_to_expiry_list = Enum.map(dates, &days_until_expiry!(expiry_date, &1))
    date_pairs = Enum.zip(dates, days_to_expiry_list)

    base_opts =
      opts
      |> Keyword.delete(:years_to_expiry)
      |> Keyword.delete(:days_to_expiry)

    date_pricing_inputs = build_date_pricing_inputs(date_pairs, base_opts)

    Stream.flat_map(prices, fn underlying_price ->
      Stream.map(date_pricing_inputs, fn {date, days_to_expiry, price_opts} ->
        %{
          underlying_price: underlying_price,
          days_to_expiry: days_to_expiry,
          date: date,
          price:
            price(
              underlying_price,
              buy_or_write,
              call_or_put,
              strike_price,
              contracts,
              implied_volatility,
              price_opts
            ),
          cost: option_price * contracts * 100
        }
      end)
    end)
  end

  @doc """
  Selects a risk-free rate from a curve for a given number of days.

  The curve is a list of `{days, rate}` tuples. If an exact match is not found,
  the rate is linearly interpolated between the nearest points. When the target
  day is outside the curve, the nearest endpoint rate is used. The target `days`
  may be fractional.
  """
  @spec risk_free_rate_for_days(number, [rate_point]) :: float
  def risk_free_rate_for_days(days, curve) when is_number(days) and days >= 0 do
    curve
    |> validate_curve!()
    |> risk_free_rate_for_days_from_curve(days)
  end

  defp risk_free_rate_for_days_from_curve(curve, days) do
    case Enum.find(curve, fn {d, _} -> d == days end) do
      {_, rate} ->
        rate

      nil ->
        {lower, upper} = bounding_points(curve, days)
        interpolate_rate(lower, upper, days)
    end
  end

  defp build_date_pricing_inputs(date_pairs, opts) do
    case Keyword.fetch(opts, :risk_free_curve) do
      {:ok, curve} ->
        curve = validate_curve!(curve)

        base_opts =
          opts
          |> Keyword.delete(:risk_free_curve)
          |> Keyword.delete(:risk_free_rate)

        Enum.map(date_pairs, fn {date, days_to_expiry} ->
          risk_free_rate = risk_free_rate_for_days_from_curve(curve, days_to_expiry)

          price_opts =
            base_opts
            |> Keyword.put(:days_to_expiry, days_to_expiry)
            |> Keyword.put(:risk_free_rate, risk_free_rate)

          {date, days_to_expiry, price_opts}
        end)

      :error ->
        Enum.map(date_pairs, fn {date, days_to_expiry} ->
          {date, days_to_expiry, Keyword.put(opts, :days_to_expiry, days_to_expiry)}
        end)
    end
  end

  defp price_per_share_european(
         underlying_price,
         call_or_put,
         strike_price,
         implied_volatility,
         time_to_expiry,
         risk_free_rate,
         dividend_yield,
         carry_rate
       ) do
    cost_of_carry = risk_free_rate - dividend_yield + carry_rate

    discounted_spot =
      underlying_price * :math.exp((cost_of_carry - risk_free_rate) * time_to_expiry)

    discounted_strike = strike_price * :math.exp(-risk_free_rate * time_to_expiry)

    vol_sqrt_t = implied_volatility * :math.sqrt(time_to_expiry)

    d1 =
      (:math.log(underlying_price / strike_price) +
         (cost_of_carry + 0.5 * implied_volatility * implied_volatility) * time_to_expiry) /
        vol_sqrt_t

    d2 = d1 - vol_sqrt_t

    case call_or_put do
      :call ->
        discounted_spot * Normal.cdf(d1) - discounted_strike * Normal.cdf(d2)

      :put ->
        discounted_strike * Normal.cdf(-d2) - discounted_spot * Normal.cdf(-d1)
    end
  end

  defp price_per_share_american(
         underlying_price,
         call_or_put,
         strike_price,
         implied_volatility,
         time_to_expiry,
         risk_free_rate,
         dividend_yield,
         carry_rate,
         steps
       ) do
    cost_of_carry = risk_free_rate - dividend_yield + carry_rate
    dt = time_to_expiry / steps

    {u, d, p} =
      american_tree_params(implied_volatility, dt, cost_of_carry)

    discount = :math.exp(-risk_free_rate * dt)
    terminal_prices = stock_prices_for_step(underlying_price, u, d, steps)

    terminal_values =
      Enum.map(terminal_prices, fn price ->
        intrinsic_value(call_or_put, price, strike_price)
      end)

    0..(steps - 1)
    |> Enum.reverse()
    |> Enum.reduce(terminal_values, fn step, values ->
      step_prices = stock_prices_for_step(underlying_price, u, d, step)
      american_step(step_prices, values, p, discount, call_or_put, strike_price)
    end)
    |> hd()
  end

  defp days_to_expiry(opts) do
    case Keyword.fetch(opts, :years_to_expiry) do
      {:ok, years} ->
        validate_positive!(years, :years_to_expiry) * 365.0

      :error ->
        days = Keyword.get(opts, :days_to_expiry, @default_days_to_expiry)
        validate_positive!(days, :days_to_expiry)
    end
  end

  defp expand_price_range(%Range{} = range) do
    range
    |> Enum.to_list()
    |> Enum.map(&validate_positive!(&1, :price_range))
  end

  defp expand_price_range({min, max, step}) do
    min = validate_positive!(min, :price_range_min)
    max = validate_positive!(max, :price_range_max)
    step = validate_positive!(step, :price_range_step)

    if max < min do
      raise ArgumentError,
            "price_range max must be greater than or equal to min, got: #{inspect({min, max})}"
    end

    epsilon = step / 1.0e6

    Stream.iterate(min, &(&1 + step))
    |> Enum.take_while(&(&1 <= max + epsilon))
  end

  defp expand_price_range(prices) when is_list(prices) do
    if prices == [] do
      raise ArgumentError, "price_range list must not be empty"
    end

    Enum.map(prices, &validate_positive!(&1, :price_range))
  end

  defp expand_price_range(other),
    do:
      raise(
        ArgumentError,
        "price_range must be a range, list, or {min, max, step}, got: #{inspect(other)}"
      )

  defp expand_date_range(%Date.Range{} = range) do
    dates =
      range
      |> Enum.to_list()
      |> Enum.filter(&business_day?/1)

    ensure_non_empty_dates!(dates)
  end

  defp expand_date_range({%Date{} = start_date, %Date{} = end_date}) do
    dates =
      Date.range(start_date, end_date)
      |> Enum.to_list()
      |> Enum.filter(&business_day?/1)

    ensure_non_empty_dates!(dates)
  end

  defp expand_date_range({%Date{} = start_date, %Date{} = end_date, steps}) do
    steps = validate_date_steps!(steps)

    dates =
      Date.range(start_date, end_date)
      |> Enum.to_list()
      |> Enum.filter(&business_day?/1)
      |> ensure_non_empty_dates!()

    sample_business_days(dates, steps)
  end

  defp expand_date_range(dates) when is_list(dates) do
    if dates == [] do
      raise ArgumentError, "date_range list must not be empty"
    end

    dates
    |> Enum.map(&normalize_date!/1)
    |> Enum.filter(&business_day?/1)
    |> ensure_non_empty_dates!()
  end

  defp expand_date_range(other),
    do:
      raise(
        ArgumentError,
        "date_range must be a Date.Range, list, or {start_date, end_date}, got: #{inspect(other)}"
      )

  defp fetch_expiry_date!(opts) do
    case Keyword.fetch(opts, :expiry_date) do
      {:ok, date} -> normalize_date!(date)
      :error -> raise ArgumentError, "price_for_range requires :expiry_date in opts"
    end
  end

  defp normalize_date!(%Date{} = date), do: date
  defp normalize_date!(%NaiveDateTime{} = datetime), do: NaiveDateTime.to_date(datetime)
  defp normalize_date!(%DateTime{} = datetime), do: DateTime.to_date(datetime)

  defp normalize_date!(date) when is_binary(date) do
    case Date.from_iso8601(date) do
      {:ok, parsed} ->
        parsed

      {:error, reason} ->
        raise ArgumentError, "invalid date string #{inspect(date)}: #{inspect(reason)}"
    end
  end

  defp normalize_date!(other),
    do:
      raise(
        ArgumentError,
        "date must be a Date, DateTime, NaiveDateTime, or ISO8601 string, got: #{inspect(other)}"
      )

  defp ensure_non_empty_dates!(dates) do
    if dates == [] do
      raise ArgumentError, "date_range must include at least one weekday"
    end

    dates
  end

  defp validate_date_steps!(value) when is_integer(value) and value > 0, do: value

  defp validate_date_steps!(value) when is_float(value) and value > 0 do
    if value == Float.floor(value) do
      trunc(value)
    else
      raise ArgumentError, "date steps must be a positive integer, got: #{inspect(value)}"
    end
  end

  defp validate_date_steps!(value),
    do: raise(ArgumentError, "date steps must be a positive integer, got: #{inspect(value)}")

  defp validate_positive_integer!(value, _name) when is_integer(value) and value > 0, do: value

  defp validate_positive_integer!(value, name) when is_float(value) and value > 0 do
    if value == Float.floor(value) do
      trunc(value)
    else
      raise ArgumentError, "#{name} must be a positive integer, got: #{inspect(value)}"
    end
  end

  defp validate_positive_integer!(value, name),
    do: raise(ArgumentError, "#{name} must be a positive integer, got: #{inspect(value)}")

  defp normalize_market_price!(value) do
    if is_number(value) do
      abs(value) * 1.0
    else
      raise ArgumentError, "market_price must be a number, got: #{inspect(value)}"
    end
  end

  defp sample_business_days(dates, steps) do
    total = length(dates)

    cond do
      steps <= 1 ->
        [hd(dates)]

      steps >= total ->
        dates

      true ->
        last_index = total - 1
        step_size = last_index / (steps - 1)

        0..(steps - 1)
        |> Enum.map(fn index -> trunc(Float.floor(index * step_size)) end)
        |> Enum.map(&Enum.at(dates, &1))
    end
  end

  defp business_day?(%Date{} = date) do
    day = Date.day_of_week(date)
    day >= 1 and day <= 5
  end

  defp days_until_expiry!(expiry_date, date) do
    days = Date.diff(expiry_date, date)

    if days < 0 do
      raise ArgumentError,
            "date #{Date.to_iso8601(date)} must be before expiry_date #{Date.to_iso8601(expiry_date)}"
    end

    days * 1.0
  end

  defp normalize_side(value) when is_atom(value) do
    case value do
      :buy -> 1.0
      :long -> 1.0
      :write -> -1.0
      :short -> -1.0
      _ -> raise ArgumentError, "buy_or_write must be :buy, :write, :long, or :short"
    end
  end

  defp normalize_side(value) when is_binary(value) do
    case String.downcase(value) do
      "buy" -> 1.0
      "long" -> 1.0
      "write" -> -1.0
      "short" -> -1.0
      _ -> raise ArgumentError, "buy_or_write must be buy, write, long, or short"
    end
  end

  defp normalize_side(value),
    do: raise(ArgumentError, "buy_or_write must be an atom or string, got: #{inspect(value)}")

  defp normalize_call_or_put(value) when is_atom(value) do
    case value do
      :call -> :call
      :put -> :put
      _ -> raise ArgumentError, "call_or_put must be :call or :put"
    end
  end

  defp normalize_call_or_put(value) when is_binary(value) do
    case String.downcase(value) do
      "call" -> :call
      "put" -> :put
      _ -> raise ArgumentError, "call_or_put must be call or put"
    end
  end

  defp normalize_call_or_put(value),
    do: raise(ArgumentError, "call_or_put must be an atom or string, got: #{inspect(value)}")

  defp fetch_number(opts, key, default) do
    value = Keyword.get(opts, key, default)

    if is_number(value) do
      value * 1.0
    else
      raise ArgumentError, "#{key} must be a number, got: #{inspect(value)}"
    end
  end

  defp risk_free_rate_from_opts(opts, days_to_expiry) do
    case Keyword.fetch(opts, :risk_free_curve) do
      {:ok, curve} -> risk_free_rate_for_days(days_to_expiry, curve)
      :error -> fetch_number(opts, :risk_free_rate, @default_risk_free_rate)
    end
  end

  defp fetch_boolean(opts, key, default) do
    value = Keyword.get(opts, key, default)

    if is_boolean(value) do
      value
    else
      raise ArgumentError, "#{key} must be a boolean, got: #{inspect(value)}"
    end
  end

  defp validate_steps!(value) when is_integer(value) and value > 0, do: value

  defp validate_steps!(value) when is_float(value) and value > 0 do
    if value == Float.floor(value) do
      trunc(value)
    else
      raise ArgumentError, "steps must be a positive integer, got: #{inspect(value)}"
    end
  end

  defp validate_steps!(value),
    do: raise(ArgumentError, "steps must be a positive integer, got: #{inspect(value)}")

  defp validate_probability!(value) do
    if value >= 0.0 and value <= 1.0 do
      value
    else
      raise ArgumentError, "invalid probability computed for binomial tree: #{inspect(value)}"
    end
  end

  defp american_tree_params(implied_volatility, dt, cost_of_carry) do
    vol_sqrt_dt = implied_volatility * :math.sqrt(dt)
    u = :math.exp(vol_sqrt_dt)
    d = 1.0 / u
    denom = u - d

    {u, d, p} =
      cond do
        abs(denom) < 1.0e-12 ->
          drift = cost_of_carry * dt
          u = :math.exp(drift)
          d = u
          {u, d, 0.5}

        true ->
          p = (:math.exp(cost_of_carry * dt) - d) / denom

          if p >= 0.0 and p <= 1.0 do
            {u, d, p}
          else
            drift = (cost_of_carry - 0.5 * implied_volatility * implied_volatility) * dt
            u = :math.exp(drift + vol_sqrt_dt)
            d = :math.exp(drift - vol_sqrt_dt)
            {u, d, 0.5}
          end
      end

    {u, d, validate_probability!(p)}
  end

  defp validate_curve!(curve) when is_list(curve) and curve != [] do
    curve
    |> Enum.map(fn
      {days, rate} when is_integer(days) and days > 0 and is_number(rate) ->
        {days, rate * 1.0}

      other ->
        raise ArgumentError,
              "curve points must be {positive_integer_days, rate}, got: #{inspect(other)}"
    end)
    |> Enum.sort_by(fn {days, _} -> days end)
  end

  defp validate_curve!(_curve),
    do: raise(ArgumentError, "curve must be a non-empty list of {days, rate} tuples")

  defp bounding_points([{days, rate} | _], target) when target < days do
    {{days, rate}, {days, rate}}
  end

  defp bounding_points(curve, target) do
    {lower, upper} =
      curve
      |> Enum.reduce({nil, nil}, fn {days, rate}, {low, high} ->
        cond do
          days <= target -> {{days, rate}, high}
          high == nil -> {low, {days, rate}}
          true -> {low, high}
        end
      end)

    case {lower, upper} do
      {nil, {days, rate}} -> {{days, rate}, {days, rate}}
      {{days, rate}, nil} -> {{days, rate}, {days, rate}}
      {low, high} -> {low, high}
    end
  end

  defp interpolate_rate({days, rate}, {days, rate}, _target), do: rate

  defp interpolate_rate({d1, r1}, {d2, r2}, target) do
    weight = (target - d1) / (d2 - d1)
    r1 + weight * (r2 - r1)
  end

  defp stock_prices_for_step(underlying_price, u, d, step) do
    start = underlying_price * :math.pow(d, step)
    ratio = u / d

    0..step
    |> Enum.map_reduce(start, fn _, price ->
      {price, price * ratio}
    end)
    |> elem(0)
  end

  defp intrinsic_value(:call, price, strike_price), do: max(price - strike_price, 0.0)
  defp intrinsic_value(:put, price, strike_price), do: max(strike_price - price, 0.0)

  defp american_step(prices, values, p, discount, call_or_put, strike_price) do
    values
    |> Enum.zip(tl(values))
    |> Enum.zip(prices)
    |> Enum.map(fn {{down, up}, price} ->
      continuation = discount * (p * up + (1.0 - p) * down)
      intrinsic = intrinsic_value(call_or_put, price, strike_price)
      max(continuation, intrinsic)
    end)
  end

  defp validate_positive!(value, name) do
    cond do
      not is_number(value) ->
        raise ArgumentError, "#{name} must be a number, got: #{inspect(value)}"

      value < 0 ->
        raise ArgumentError, "#{name} must be greater than 0, got: #{inspect(value)}"

      true ->
        value * 1.0
    end
  end

  defp validate_non_negative!(value, name) do
    cond do
      not is_number(value) ->
        raise ArgumentError, "#{name} must be a number, got: #{inspect(value)}"

      value < 0 ->
        raise ArgumentError, "#{name} must be greater than or equal to 0, got: #{inspect(value)}"

      true ->
        value * 1.0
    end
  end
end

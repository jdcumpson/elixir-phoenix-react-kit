defmodule Test.BlackScholes.RateCurve do
  @moduledoc """
  Helpers for fetching and parsing risk-free rate curves.
  """

  @type curve_point :: {pos_integer, float}

  @treasury_base_url "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/all"
  @treasury_bill_field_map %{
    "4 WEEKS COUPON EQUIVALENT" => 28,
    "8 WEEKS COUPON EQUIVALENT" => 56,
    "13 WEEKS COUPON EQUIVALENT" => 91,
    "17 WEEKS COUPON EQUIVALENT" => 119,
    "26 WEEKS COUPON EQUIVALENT" => 182,
    "52 WEEKS COUPON EQUIVALENT" => 364
  }

  @fred_base_url "https://api.stlouisfed.org/fred/series/observations"
  @fred_series_map %{
    "DGS1MO" => 30,
    "DGS3MO" => 90,
    "DGS6MO" => 180,
    "DGS1" => 365,
    "DGS2" => 730,
    "DGS3" => 1095,
    "DGS5" => 1825,
    "DGS7" => 2555,
    "DGS10" => 3650,
    "DGS20" => 7300,
    "DGS30" => 10950
  }

  @doc """
  Fetches Treasury.gov daily bill rates via the CSV endpoint.

  Options:
  - `:date` - "YYYY-MM-DD" or Date (defaults to the latest available in the month)
  - `:month` - "YYYYMM" or integer like 202602 (defaults to month from `:date` or today)
  - `:url` - override base URL
  - `:field_map` - map of field names to curve days
  - `:rate_scale` - factor applied to the rates (default 0.01 for percent to decimal)
  """
  @spec fetch_treasury_curve(keyword) :: {:ok, [curve_point]} | {:error, term}
  def fetch_treasury_curve(opts \\ []) do
    url = Keyword.get(opts, :url, @treasury_base_url)
    date = Keyword.get(opts, :date)
    month = treasury_month(opts)
    field_map = Keyword.get(opts, :field_map, @treasury_bill_field_map)
    rate_scale = Keyword.get(opts, :rate_scale, 0.01)

    csv_url = treasury_csv_url(url, month)

    with {:ok, csv} <- http_get_csv(csv_url),
         {:ok, curve} <- treasury_curve_from_csv(csv, date, field_map, rate_scale) do
      {:ok, curve}
    end
  end

  @doc """
  Fetches Treasury yields from the St. Louis Fed (FRED).

  Options:
  - `:api_key` - required FRED API key
  - `:date` - "YYYY-MM-DD" (defaults to the latest available)
  - `:url` - override base URL
  - `:series_map` - map of series IDs to curve days
  - `:rate_scale` - factor applied to the rates (default 0.01 for percent to decimal)
  """
  @spec fetch_fred_curve(keyword) :: {:ok, [curve_point]} | {:error, term}
  def fetch_fred_curve(opts \\ []) do
    api_key = Keyword.fetch!(opts, :api_key)
    date = Keyword.get(opts, :date)
    url = Keyword.get(opts, :url, @fred_base_url)
    series_map = Keyword.get(opts, :series_map, @fred_series_map)
    rate_scale = Keyword.get(opts, :rate_scale, 0.01)

    series_map
    |> Enum.reduce_while({:ok, []}, fn {series_id, days}, {:ok, acc} ->
      case fred_series_rate(url, series_id, api_key, date, rate_scale) do
        {:ok, nil} -> {:cont, {:ok, acc}}
        {:ok, rate} -> {:cont, {:ok, [{days, rate} | acc]}}
        {:error, reason} -> {:halt, {:error, {series_id, reason}}}
      end
    end)
    |> case do
      {:ok, curve} ->
        curve = Enum.sort_by(curve, &elem(&1, 0))

        if curve == [] do
          {:error, :no_rates}
        else
          {:ok, curve}
        end

      other ->
        other
    end
  end

  defp treasury_month(opts) do
    cond do
      Keyword.has_key?(opts, :month) -> normalize_month!(Keyword.fetch!(opts, :month))
      Keyword.has_key?(opts, :date) -> month_from_date!(Keyword.fetch!(opts, :date))
      true -> month_from_date!(Date.utc_today())
    end
  end

  defp normalize_month!(month) when is_integer(month) do
    month
    |> Integer.to_string()
    |> String.pad_leading(6, "0")
  end

  defp normalize_month!(month) when is_binary(month) do
    normalized =
      month
      |> String.trim()
      |> String.replace("-", "")

    if String.length(normalized) == 6 and normalized =~ ~r/^\d{6}$/ do
      normalized
    else
      raise ArgumentError, "month must be in YYYYMM or YYYY-MM format, got: #{inspect(month)}"
    end
  end

  defp normalize_month!(month),
    do: raise(ArgumentError, "month must be in YYYYMM or YYYY-MM format, got: #{inspect(month)}")

  defp month_from_date!(%Date{} = date), do: format_month(date)

  defp month_from_date!(date) when is_binary(date) do
    case Date.from_iso8601(date) do
      {:ok, parsed} ->
        format_month(parsed)

      {:error, reason} ->
        raise ArgumentError, "invalid date string #{inspect(date)}: #{inspect(reason)}"
    end
  end

  defp month_from_date!(date),
    do: raise(ArgumentError, "date must be a Date or ISO8601 string, got: #{inspect(date)}")

  defp format_month(%Date{year: year, month: month}) do
    year_part = Integer.to_string(year)
    month_part = month |> Integer.to_string() |> String.pad_leading(2, "0")
    year_part <> month_part
  end

  defp treasury_csv_url(base_url, month) do
    query =
      URI.encode_query(%{
        "type" => "daily_treasury_bill_rates",
        "field_tdr_date_value_month" => month,
        "page" => "",
        "_format" => "csv"
      })

    base_url <> "/" <> month <> "?" <> query
  end

  defp http_get_json(url, query) do
    full_url = url <> "?" <> URI.encode_query(query)

    with {:ok, body} <- http_get(full_url) do
      case body do
        %{} = json -> {:ok, json}
        binary when is_binary(binary) -> Jason.decode(binary)
        other -> {:error, {:unexpected_body, other}}
      end
    end
  end

  defp http_get_csv(url) do
    with {:ok, body} <- http_get(url) do
      if is_binary(body) do
        {:ok, body}
      else
        {:error, {:unexpected_body, body}}
      end
    end
  end

  defp http_get(url) do
    case Req.get(url, receive_timeout: 10_000) do
      {:ok, %Req.Response{status: 200, body: body}} ->
        {:ok, body}

      {:ok, %Req.Response{status: status, body: body}} ->
        {:error, {:http_status, status, body}}

      {:error, error} ->
        {:error, error}
    end
  end

  defp treasury_curve_from_csv(csv, date, field_map, rate_scale) do
    with {:ok, {headers, rows}} <- parse_csv(csv),
         {:ok, date_index} <- header_index(headers, "Date"),
         {:ok, row} <- select_csv_row(rows, date_index, date),
         {:ok, curve} <- curve_from_row(headers, row, field_map, rate_scale) do
      {:ok, curve}
    end
  end

  defp parse_csv(csv) do
    lines = String.split(csv, ~r/\r\n|\n|\r/, trim: true)

    case lines do
      [] ->
        {:error, :empty_csv}

      [header_line | data_lines] ->
        headers = parse_csv_line(header_line)

        if headers == [] do
          {:error, :empty_header}
        else
          rows =
            data_lines
            |> Enum.map(&parse_csv_line/1)
            |> Enum.reject(&(&1 == []))

          {:ok, {headers, rows}}
        end
    end
  end

  defp parse_csv_line(line) do
    line = String.trim(line)

    if line == "" do
      []
    else
      parse_csv_chars(String.to_charlist(line), [], [], false)
    end
  end

  defp parse_csv_chars([], field, fields, _in_quotes) do
    fields = [field |> Enum.reverse() |> List.to_string() | fields]
    fields |> Enum.reverse() |> Enum.map(&String.trim/1)
  end

  defp parse_csv_chars([?", ?" | rest], field, fields, true) do
    parse_csv_chars(rest, [?" | field], fields, true)
  end

  defp parse_csv_chars([?" | rest], field, fields, in_quotes) do
    parse_csv_chars(rest, field, fields, not in_quotes)
  end

  defp parse_csv_chars([?, | rest], field, fields, false) do
    parse_csv_chars(rest, [], [field |> Enum.reverse() |> List.to_string() | fields], false)
  end

  defp parse_csv_chars([char | rest], field, fields, in_quotes) do
    parse_csv_chars(rest, [char | field], fields, in_quotes)
  end

  defp header_index(headers, header_name) do
    headers
    |> Enum.with_index()
    |> Enum.find(fn {header, _} ->
      String.downcase(header) == String.downcase(header_name)
    end)
    |> case do
      {_, index} -> {:ok, index}
      nil -> {:error, {:missing_header, header_name}}
    end
  end

  defp select_csv_row(rows, date_index, nil) do
    rows
    |> Enum.map(&row_with_date(&1, date_index))
    |> Enum.reject(&is_nil/1)
    |> case do
      [] -> {:error, :no_data}
      dated_rows -> {:ok, Enum.max_by(dated_rows, &elem(&1, 0)) |> elem(1)}
    end
  end

  defp select_csv_row(rows, date_index, date) do
    target_date = normalize_date!(date)

    rows
    |> Enum.map(&row_with_date(&1, date_index))
    |> Enum.find(fn
      {date_value, _} -> date_value == target_date
      nil -> false
    end)
    |> case do
      {_, row} -> {:ok, row}
      nil -> {:error, {:missing_date, Date.to_iso8601(target_date)}}
    end
  end

  defp row_with_date(row, date_index) do
    [month, day, year] =
      Enum.at(row, date_index, "")
      |> String.split("/")
      |> Enum.map(&String.to_integer/1)

    case Date.new(year, month, day) do
      {:ok, date} ->
        {date,
         List.replace_at(row, date_index, date)
         |> Enum.with_index()
         |> Enum.map(fn {val, index} ->
           if index == date_index do
             val
           else
             String.to_float(val)
           end
         end)}

      {:error, _} ->
        nil
    end
  end

  defp curve_from_row(headers, row, field_map, rate_scale) do
    header_positions = headers |> Enum.with_index() |> Map.new()

    curve =
      field_map
      |> Enum.map(fn {field, days} ->
        case Map.get(header_positions, field) do
          nil ->
            []

          index ->
            rate =
              row
              |> Enum.at(index, 0.0)

            {days, rate * rate_scale}
        end
      end)
      |> Enum.sort_by(&elem(&1, 0))

    if curve == [] do
      {:error, :no_rates}
    else
      {:ok, curve}
    end
  end

  defp fred_series_rate(url, series_id, api_key, nil, rate_scale) do
    query = %{
      "series_id" => series_id,
      "api_key" => api_key,
      "file_type" => "json",
      "sort_order" => "desc",
      "limit" => "1"
    }

    with {:ok, body} <- http_get_json(url, query),
         {:ok, value} <- first_observation_value(body) do
      parse_rate(value, rate_scale)
    end
  end

  defp fred_series_rate(url, series_id, api_key, date, rate_scale) do
    query = %{
      "series_id" => series_id,
      "api_key" => api_key,
      "file_type" => "json",
      "observation_start" => date,
      "observation_end" => date
    }

    with {:ok, body} <- http_get_json(url, query),
         {:ok, value} <- first_observation_value(body) do
      parse_rate(value, rate_scale)
    end
  end

  defp first_observation_value(%{"observations" => [observation | _]}) when is_map(observation) do
    {:ok, Map.get(observation, "value")}
  end

  defp first_observation_value(%{"observations" => []}), do: {:ok, nil}
  defp first_observation_value(other), do: {:error, {:unexpected_body, other}}

  defp parse_rate(value, rate_scale) when is_number(value), do: {:ok, value * rate_scale}

  defp parse_rate(value, rate_scale) when is_binary(value) do
    case Float.parse(value) do
      {rate, _} -> {:ok, rate * rate_scale}
      :error -> {:ok, nil}
    end
  end

  defp parse_rate(_value, _rate_scale), do: {:ok, nil}

  defp normalize_date!(%Date{} = date), do: date

  defp normalize_date!(date) when is_binary(date) do
    case Date.from_iso8601(date) do
      {:ok, parsed} ->
        parsed

      {:error, reason} ->
        raise ArgumentError, "invalid date string #{inspect(date)}: #{inspect(reason)}"
    end
  end

  defp normalize_date!(other),
    do: raise(ArgumentError, "date must be a Date or ISO8601 string, got: #{inspect(other)}")
end

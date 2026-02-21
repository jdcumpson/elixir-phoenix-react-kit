# TODO: move yahoo queries to it's own module -- this is actuall just for SEC
# ticker caching
defmodule Test.Equities do
  use GenServer

  @sec_company_tickers_url "https://www.sec.gov/files/company_tickers.json"
  @default_symbols ~w(GME AMC TSLA MSTR)

  defstruct [:tickers]

  def start_link(args) do
    GenServer.start_link(__MODULE__, args, name: __MODULE__)
  end

  @impl true
  def init(_opts \\ []) do
    with {:ok, %{body: body, status_code: _status_code} = _request} <-
           HTTPoison.get(
             @sec_company_tickers_url,
             [
               {"Accept",
                "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7"},
               {"Accept-Encoding", "gzip, deflate, br, zstd"},
               {"Accept-Language", "en-US,en;q=0.9"},
               {"Cache-Control", "no-cache"},
               {"Referer", "https://www.sec.gov/file/company-tickers"},
               {"Sec-Ch-Ca",
                "\"Not(A:Brand\";v=\"8\", \"Chromium\";v=\"144\", \"Google Chrome\";v=\"144\""},
               {"Sec-Ch-Ua-Mobile", "?0"},
               {"Sec-Ch-Ua-Platform", "\"macOS\""},
               {"Sec-Fetch-Dest", "document"},
               {"Sec-Fetch-Mode", "navigate"},
               {"Sec-Fetch-Site", "none"},
               {"Sec-Fetch-User", "?1"},
               {"Upgrade-Insecure-Requests", "1"},
               {"Sec-Ch-Ua-Mobile", "?0"},
               {"User-Agent",
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36"}
             ]
           ) do
      {:ok, tickers} = Jason.decode(:zlib.gunzip(body))

      tickers =
        Enum.map(tickers, fn {index, data} ->
          {String.to_integer(index), data}
        end)
        |> Enum.sort(fn {index, _}, {other_index, _} ->
          index < other_index
        end)
        |> Enum.map(fn {_, %{"cik_str" => cik, "title" => title, "ticker" => ticker}} ->
          title = String.split(title) |> Enum.map(&String.capitalize/1) |> Enum.join(" ")
          %{"symbol" => ticker, "name" => title, "id" => cik}
        end)

      tickers =
        (tickers ++
           [
             %{"symbol" => "VOO", "name" => "Vanguard S&P 500 ETF", "id" => "NYSEARCA: VOO"},
             %{"symbol" => "QQQ", "name" => "Invesco QQQ Trust", "id" => "QQQ"},
             %{"symbol" => "SPY", "name" => "SPDR S&P 500 ETF Trust", "id" => "SPY"}
           ])
        |> Enum.map(fn data ->
          {Map.get(data, "symbol"), data}
        end)

      table = :ets.new(Module.concat([__MODULE__, "tickers"]), [:set])
      true = :ets.insert(table, tickers)

      {:ok,
       %__MODULE__{
         tickers: table
       }}
    end
  end

  def search(string) do
    GenServer.call(__MODULE__, {:search, string})
  end

  def all do
    GenServer.call(__MODULE__, :all)
  end

  @impl true
  def handle_call(
        {:search, string},
        _from,
        %{tickers: tickers} = state
      ) do
    trimmed =
      string
      |> to_string()
      |> String.trim()
      |> String.downcase()

    results =
      cond do
        trimmed == "" ->
          :ets.foldl(
            fn {_symbol, ticker}, acc ->
              if Enum.member?(@default_symbols, Map.get(ticker, "symbol")) do
                [ticker | acc]
              else
                acc
              end
            end,
            [],
            tickers
          )
          |> Enum.reverse()

        String.length(trimmed) < 2 ->
          []

        true ->
          :ets.foldl(
            fn {_symbol, ticker}, acc ->
              case ranked_match(ticker, trimmed) do
                {:ok, ranked_ticker} -> [ranked_ticker | acc]
                :nomatch -> acc
              end
            end,
            [],
            tickers
          )
          |> Enum.sort_by(fn {score, _ticker} -> score end, :desc)
          |> Enum.map(fn {_score, ticker} -> ticker end)
      end

    {:reply, results, state}
  end

  @impl GenServer
  def handle_call(:all, _from, %{tickers: tickers} = state) do
    results =
      :ets.tab2list(tickers)
      |> Enum.map(fn {_symbol, ticker} -> ticker end)

    {:reply, results, state}
  end

  defp ranked_match(ticker, trimmed) do
    symbol = Map.get(ticker, "symbol", "") |> String.downcase()
    name = Map.get(ticker, "name", "") |> String.downcase()

    name_distance = String.jaro_distance(name, trimmed)
    symbol_distance = String.jaro_distance(symbol, trimmed)

    name_match =
      String.split(name)
      |> Enum.any?(fn part ->
        String.starts_with?(part, trimmed)
      end)

    symbol_match = symbol == trimmed
    symbol_startswith = String.starts_with?(symbol, trimmed)

    if symbol_match or symbol_startswith or name_match or symbol_distance > 0.9 or
         name_distance > 0.8 do
      {:ok,
       {{bool_score(symbol_match), bool_score(symbol_startswith), symbol_distance,
         bool_score(name_match), name_distance}, ticker}}
    else
      :nomatch
    end
  end

  defp bool_score(true), do: 1
  defp bool_score(false), do: 0
end

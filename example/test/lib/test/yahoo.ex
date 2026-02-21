defmodule Test.Yahoo do
  use GenServer
  require Logger

  @yahoo_domain "query2.finance.yahoo.com"
  @yahoo_base "https://#{@yahoo_domain}/v7/finance"
  @default_query %{
    "formatted" => "true",
    "lang" => "en-US",
    "region" => "US"
  }
  @quote_cache_ttl_ms :timer.seconds(1)
  @options_cache_ttl_ms :timer.minutes(5)

  def start_link(arg \\ []) do
    GenServer.start_link(__MODULE__, arg, name: __MODULE__)
  end

  @impl GenServer
  def init(_init_arg) do
    {crumb, headers} =
      case get_crumb() do
        {:ok, {crumb, headers}} ->
          {crumb, headers}

        {:error, reason} ->
          Logger.warning("Failed to initialize Yahoo crumb: #{inspect(reason)}")
          {nil, []}
      end

    {:ok,
     %{
       headers: headers,
       crumb: crumb,
       cache: :ets.new(Module.concat([__MODULE__, "cache"]), [:set]),
       inflight: :ets.new(Module.concat([__MODULE__, "inflight"]), [:bag])
     }}
  end

  def symbol_options(symbol, query_params \\ %{}, request_opts \\ []) do
    GenServer.call(__MODULE__, {:options, symbol, query_params, request_opts}, 30_000)
  end

  def symbol_quote(symbol, request_opts \\ []) do
    GenServer.call(__MODULE__, {:quote, symbol, request_opts}, 30_000)
  end

  @impl GenServer
  def handle_call({:options, symbol, query_params, request_opts}, from, state) do
    crumb = Keyword.get(request_opts, :crumb, state.crumb)
    headers = Keyword.get(request_opts, :headers, state.headers)

    request = %{
      type: :options,
      symbol: symbol,
      url: "#{@yahoo_base}/options/#{symbol}",
      params: %{"crumb" => crumb} |> Map.merge(query_params)
    }

    reply_or_enqueue(request, headers, from, state)
  end

  @impl GenServer
  def handle_call({:quote, symbol, request_opts}, from, state) do
    crumb = Keyword.get(request_opts, :crumb, state.crumb)
    headers = Keyword.get(request_opts, :headers, state.headers)

    request = %{
      type: :quote,
      symbol: symbol,
      url: "#{@yahoo_base}/quote",
      params: Map.merge(@default_query, %{"crumb" => crumb}) |> Map.put("symbols", symbol)
    }

    reply_or_enqueue(request, headers, from, state)
  end

  @impl GenServer
  def handle_info({:request_result, key, result}, state) do
    entries = inflight_take(state.inflight, key)

    case inflight_unpack(entries) do
      :error ->
        {:noreply, state}

      {:ok, monitor_ref, request, waiters} ->
        Process.demonitor(monitor_ref, [:flush])
        cache_put(state.cache, key, result, cache_ttl_ms(request))
        Enum.each(waiters, &GenServer.reply(&1, result))
        {:noreply, state}
    end
  end

  @impl GenServer
  def handle_info({:DOWN, ref, :process, _pid, reason}, state) do
    with {:ok, key} <- inflight_key_for_ref(state.inflight, ref),
         entries <- inflight_take(state.inflight, key),
         {:ok, _monitor_ref, request, waiters} <- inflight_unpack(entries) do
      Logger.warning(
        "Yahoo request crashed for #{inspect({request.url, request.params})}: #{inspect(reason)}"
      )

      result = down_result(request, reason)
      cache_put(state.cache, key, result, cache_ttl_ms(request))
      Enum.each(waiters, &GenServer.reply(&1, result))
      {:noreply, state}
    else
      _ ->
        {:noreply, state}
    end
  end

  defp decode_body(<<0x1F, 0x8B, 0x08, _rest::binary>> = gz),
    do: decode_body(:zlib.gunzip(gz))

  defp decode_body(body) when is_binary(body), do: Jason.decode(body)
  defp decode_body(body) when is_map(body), do: {:ok, body}
  defp decode_body(_body), do: {:error, :unexpected_body}

  defp extract_quote(%{"quoteResponse" => %{"result" => [result]}}) do
    {:ok, result}
  end

  defp extract_quote(_data), do: {:error, :missing_result}

  defp extract_options_error(%{"optionChain" => %{"error" => error}}) when not is_nil(error),
    do: error

  defp extract_options_error(%{"finance" => %{"error" => error}}) when not is_nil(error),
    do: error

  defp extract_options_error(_data), do: nil

  defp reply_or_enqueue(request, headers, from, state) do
    key = cache_key(request.url, request.params)

    case cache_get(state.cache, key) do
      {:ok, result} ->
        {:reply, result, state}

      :miss ->
        if inflight_has_meta?(state.inflight, key) do
          inflight_add_waiter(state.inflight, key, from)
          {:noreply, state}
        else
          parent = self()

          {_pid, monitor_ref} =
            spawn_monitor(fn ->
              result = perform_request(request, headers)
              send(parent, {:request_result, key, result})
            end)

          inflight_start(state.inflight, key, monitor_ref, request, from)
          {:noreply, state}
        end
    end
  end

  defp perform_request(%{type: :options, symbol: symbol, url: url, params: params}, headers) do
    with {:ok, %HTTPoison.Response{body: body, status_code: status}} <-
           HTTPoison.get(url, headers, params: params, recv_timeout: 30_000),
         {:ok, data} <- decode_body(body) do
      if status == 200 do
        {:ok, data}
      else
        {:error, {symbol, {:http_error, status, extract_options_error(data)}}}
      end
    else
      {:error, reason} ->
        {:error, {symbol, reason}}

      _ ->
        {:error, {symbol, :unexpected_response}}
    end
  end

  defp perform_request(%{type: :quote, symbol: symbol, url: url, params: params}, headers) do
    result =
      with {:ok, %HTTPoison.Response{body: body, status_code: 200}} <-
             HTTPoison.get(url, headers,
               params: params,
               recv_timeout: 30_000
             ),
           {:ok, data} <- decode_body(body),
           {:ok, quote_data} <- extract_quote(data) do
        {:ok, {symbol, quote_data}}
      else
        {:ok, %HTTPoison.Response{status_code: status}} ->
          {:error, {symbol, {:http_error, status}}}

        {:error, reason} ->
          {:error, {symbol, reason}}

        _ ->
          {:error, {symbol, :missing_price}}
      end

    {:ok, result}
  end

  defp cache_key(url, params) do
    {:get, url, Enum.sort_by(params, fn {key, _value} -> key end)}
  end

  defp cache_get(cache, key) do
    now = System.monotonic_time(:millisecond)

    case :ets.lookup(cache, key) do
      [{^key, result, expires_at}] when expires_at > now ->
        {:ok, result}

      [{^key, _result, _expires_at}] ->
        :ets.delete(cache, key)
        :miss

      [] ->
        :miss
    end
  end

  defp cache_put(cache, key, result, ttl_ms) do
    expires_at = System.monotonic_time(:millisecond) + ttl_ms
    true = :ets.insert(cache, {key, result, expires_at})
    :ok
  end

  defp cache_ttl_ms(%{type: :quote}), do: @quote_cache_ttl_ms
  defp cache_ttl_ms(%{type: :options}), do: @options_cache_ttl_ms

  defp down_result(%{type: :options, symbol: symbol}, reason),
    do: {:error, {symbol, {:request_down, reason}}}

  defp down_result(%{type: :quote, symbol: symbol}, reason),
    do: {:ok, {:error, {symbol, {:request_down, reason}}}}

  defp inflight_start(inflight, key, monitor_ref, request, waiter) do
    true =
      :ets.insert(inflight, [
        {key, :meta, monitor_ref, request},
        {key, :waiter, waiter}
      ])

    :ok
  end

  defp inflight_add_waiter(inflight, key, waiter) do
    true = :ets.insert(inflight, {key, :waiter, waiter})
    :ok
  end

  defp inflight_has_meta?(inflight, key) do
    inflight
    |> :ets.lookup(key)
    |> Enum.any?(fn
      {^key, :meta, _monitor_ref, _request} -> true
      _ -> false
    end)
  end

  defp inflight_take(inflight, key) do
    :ets.take(inflight, key)
  end

  defp inflight_unpack(entries) do
    {monitor_ref, request, waiters} =
      Enum.reduce(entries, {nil, nil, []}, fn
        {_key, :meta, monitor_ref, request}, {_current_monitor_ref, _current_request, waiters} ->
          {monitor_ref, request, waiters}

        {_key, :waiter, waiter}, {monitor_ref, request, waiters} ->
          {monitor_ref, request, [waiter | waiters]}
      end)

    if is_nil(monitor_ref) or is_nil(request) do
      :error
    else
      {:ok, monitor_ref, request, waiters}
    end
  end

  defp inflight_key_for_ref(inflight, monitor_ref) do
    case :ets.match_object(inflight, {:_, :meta, monitor_ref, :_}) do
      [{key, :meta, ^monitor_ref, _request} | _rest] -> {:ok, key}
      [] -> :error
    end
  end

  def get_crumb() do
    with {:ok, %HTTPoison.Response{status_code: status, body: body, headers: response_headers}} <-
           HTTPoison.get(
             "https://#{@yahoo_domain}/v1/test/getcrumb",
             crumb_request_headers(),
             recv_timeout: 30_000
           ),
         :ok <- validate_crumb_status(status, body),
         {:ok, crumb} <- extract_crumb(body) do
      cookie_string = build_cookie_string(response_headers)
      {:ok, {crumb, build_yahoo_headers(cookie_string)}}
    else
      {:error, reason} ->
        {:error, reason}

      {:ok, %HTTPoison.Response{status_code: status, body: body}} ->
        {:error, {:http_error, status, body}}
    end
  end

  defp validate_crumb_status(429, body), do: {:error, {:rate_limited, 429, body}}
  defp validate_crumb_status(status, _body) when status in 200..299, do: :ok
  defp validate_crumb_status(status, body), do: {:error, {:http_error, status, body}}

  defp extract_crumb(body) when is_binary(body) do
    crumb = String.trim(body)

    cond do
      crumb == "" ->
        {:error, :missing_crumb}

      String.contains?(String.downcase(crumb), "too many requests") ->
        {:error, {:rate_limited, 429, crumb}}

      true ->
        {:ok, crumb}
    end
  end

  defp extract_crumb(_body), do: {:error, :invalid_crumb_body}

  defp build_cookie_string(response_headers) do
    response_headers
    |> Enum.filter(fn
      {"Set-Cookie", _} -> true
      _ -> false
    end)
    |> Enum.map(fn {_, cookie} ->
      String.split(cookie, ";")
      |> hd()
    end)
    |> Enum.join(";")
  end

  defp crumb_request_headers do
    [
      {"Accept",
       "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7"},
      {"Accept-Encoding", "gzip, deflate, br, zstd"},
      {"Accept-Language", "en-US,en;q=0.9"},
      {"Cache-Control", "no-cache"},
      {"Referer", "https://finance.yahoo.com"},
      {"Priority", "u=1, i"},
      {"Sec-Ch-Ua-Mobile", "?0"},
      {"Sec-Ch-Ua-Platform", "\"macOS\""},
      {"Sec-Fetch-Dest", "empty"},
      {"Sec-Fetch-Mode", "cors"},
      {"Sec-Fetch-Site", "same-site"},
      {"Upgrade-Insecure-Requests", "1"},
      {"Sec-Ch-Ua-Mobile", "?0"},
      {"User-Agent",
       "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36"},
      {"Origin", "https://finance.yahoo.com"},
      {"Content-Type", "text/plain"}
    ]
  end

  defp build_yahoo_headers(cookie_string) do
    [
      {"Accept",
       "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7"},
      {"Accept-Encoding", "gzip"},
      {"Accept-Language", "en-US,en;q=0.9"},
      {"Cache-Control", "no-cache"},
      {"Referer", "https://finance.yahoo.com/"},
      {"Priority", "u=1, i"},
      {"Sec-Ch-Ua-Mobile", "?0"},
      {"Sec-Ch-Ua-Platform", "\"macOS\""},
      {"Sec-Fetch-Dest", "empty"},
      {"Sec-Fetch-Mode", "cors"},
      {"Sec-Fetch-Site", "same-site"},
      {"Upgrade-Insecure-Requests", "1"},
      {"Sec-Ch-Ua-Mobile", "?0"},
      {"User-Agent",
       "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36"},
      {"Origin", "https://finance.yahoo.com"},
      {"Content-Type", "application/json;charset=utf-8"},
      {"Cookie", cookie_string}
    ]
  end
end

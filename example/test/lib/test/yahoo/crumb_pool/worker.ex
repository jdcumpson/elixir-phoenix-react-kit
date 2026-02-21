defmodule Test.Yahoo.CrumbPool.Worker do
  use GenServer
  require Logger

  alias Test.Yahoo

  @min_backoff_ms 500
  @max_backoff_ms :timer.minutes(2)

  def start_link(worker_id) do
    GenServer.start_link(__MODULE__, worker_id)
  end

  def symbol_quote(server, symbol, timeout \\ :infinity) do
    GenServer.call(server, {:quote, symbol}, timeout)
  end

  def symbol_options(server, symbol, query_params, timeout \\ :infinity) do
    GenServer.call(server, {:options, symbol, query_params}, timeout)
  end

  @impl true
  def init(worker_id) do
    {:ok, %{worker_id: worker_id, crumb: nil, headers: [], backoff_ms: @min_backoff_ms}}
  end

  @impl true
  def handle_call({:quote, symbol}, _from, state) do
    {result, state} = perform_request({:quote, symbol}, state)
    {:reply, result, state}
  end

  @impl true
  def handle_call({:options, symbol, query_params}, _from, state) do
    {result, state} = perform_request({:options, symbol, query_params}, state)
    {:reply, result, state}
  end

  defp perform_request(request, state) do
    {:ok, state} = ensure_credentials(state)
    result = dispatch_request(request, state)

    if rate_limited?(result) do
      sleep_ms = state.backoff_ms
      next_backoff_ms = min(sleep_ms * 2, @max_backoff_ms)

      Logger.warning(
        "Yahoo pool worker #{state.worker_id} hit rate limit; rotating crumb after #{sleep_ms}ms"
      )

      Process.sleep(sleep_ms)

      perform_request(request, %{
        state
        | crumb: nil,
          headers: [],
          backoff_ms: next_backoff_ms
      })
    else
      {result, %{state | backoff_ms: @min_backoff_ms}}
    end
  end

  defp ensure_credentials(%{crumb: crumb, headers: headers} = state)
       when is_binary(crumb) and is_list(headers) and headers != [] do
    {:ok, state}
  end

  defp ensure_credentials(state) do
    case Yahoo.get_crumb() do
      {:ok, {crumb, headers}} ->
        {:ok, %{state | crumb: crumb, headers: headers, backoff_ms: @min_backoff_ms}}

      {:error, reason} ->
        sleep_ms = state.backoff_ms
        next_backoff_ms = min(sleep_ms * 2, @max_backoff_ms)

        Logger.warning(
          "Yahoo pool worker #{state.worker_id} failed to get crumb: #{inspect(reason)}; retrying in #{sleep_ms}ms"
        )

        Process.sleep(sleep_ms)
        ensure_credentials(%{state | backoff_ms: next_backoff_ms})
    end
  end

  defp dispatch_request({:quote, symbol}, state) do
    Yahoo.symbol_quote(symbol, crumb: state.crumb, headers: state.headers)
  end

  defp dispatch_request({:options, symbol, query_params}, state) do
    Yahoo.symbol_options(symbol, query_params, crumb: state.crumb, headers: state.headers)
  end

  defp rate_limited?({:ok, {:error, {_symbol, {:http_error, 429}}}}), do: true
  defp rate_limited?({:ok, {:error, {_symbol, {:http_error, 429, _details}}}}), do: true
  defp rate_limited?({:error, {_symbol, {:http_error, 429}}}), do: true
  defp rate_limited?({:error, {_symbol, {:http_error, 429, _details}}}), do: true

  defp rate_limited?({:error, {_symbol, %Jason.DecodeError{data: "Edge: Too Many Requests"}}}),
    do: true

  defp rate_limited?(_result), do: false
end

defmodule Test.Ticker.Watcher do
  use GenServer
  require Logger

  alias Test.Yahoo.CrumbPool

  @poll_interval :timer.seconds(15)
  @call_timeout 35_000

  def start_link(symbol) do
    GenServer.start_link(__MODULE__, symbol, name: Test.Ticker.watcher_name(symbol))
  end

  def get(server) do
    GenServer.call(server, :get, @call_timeout)
  end

  def subscribe(server) do
    GenServer.cast(server, :subscribe)
  end

  def unsubscribe(server) do
    GenServer.cast(server, :unsubscribe)
  end

  @impl true
  def init(symbol) when is_binary(symbol) do
    {:ok,
     %{
       symbol: symbol,
       data: nil,
       subscribers: 0,
       polling?: false
     }}
  end

  @impl true
  def handle_call(:get, _from, %{data: nil} = state) do
    case fetch_and_maybe_cache(state, false) do
      {:ok, data, state} ->
        {:reply, {:ok, data}, state}

      {:stop, reason, state} ->
        Logger.warning(
          "Stopping ticker watcher #{inspect(state.symbol)} due to terminal error #{inspect(reason)}"
        )

        {:stop, :normal, {:ok, nil}, state}
    end
  end

  @impl true
  def handle_call(:get, _from, state) do
    {:reply, {:ok, state.data}, state}
  end

  @impl true
  def handle_cast(:subscribe, state) do
    subscribers = state.subscribers + 1
    state = %{state | subscribers: subscribers}

    state =
      if subscribers == 1 and not state.polling? do
        send(self(), :poll)
        %{state | polling?: true}
      else
        state
      end

    {:noreply, state}
  end

  @impl true
  def handle_cast(:unsubscribe, state) do
    subscribers = max(state.subscribers - 1, 0)
    state = %{state | subscribers: subscribers}

    state =
      if subscribers == 0 do
        %{state | polling?: false}
      else
        state
      end

    {:noreply, state}
  end

  @impl true
  def handle_info(:poll, %{subscribers: subscribers} = state) when subscribers > 0 do
    case fetch_and_maybe_cache(state, true) do
      {:ok, _data, state} ->
        Process.send_after(self(), :poll, @poll_interval)
        {:noreply, state}

      {:stop, reason, state} ->
        Logger.warning(
          "Stopping ticker watcher #{inspect(state.symbol)} due to terminal error #{inspect(reason)}"
        )

        {:stop, :normal, state}
    end
  end

  @impl true
  def handle_info(:poll, state) do
    {:noreply, %{state | polling?: false}}
  end

  defp fetch_and_maybe_cache(state, broadcast?) do
    case fetch(state.symbol) do
      {:ok, data} ->
        if broadcast? do
          TestWeb.Endpoint.broadcast!("ticker:#{state.symbol}", "update", data)
        end

        {:ok, data, %{state | data: data}}

      {:error, reason} ->
        if terminal_error?(reason) do
          {:stop, reason, state}
        else
          Logger.error("Error fetching quote #{inspect({state.symbol, reason})}")
          {:ok, state.data, state}
        end
    end
  end

  defp fetch(symbol) do
    try do
      case CrumbPool.symbol_quote(symbol) do
        {:ok, {:ok, {_symbol, data}}} ->
          {:ok, data}

        {:ok, {:error, {_symbol, reason}}} ->
          {:error, reason}

        {:error, reason} ->
          {:error, {:crumb_pool, reason}}
      end
    catch
      :exit, reason ->
        {:error, {:crumb_pool_exit, reason}}
    end
  end

  defp terminal_error?({:http_error, status}) when status in [400, 404], do: true
  defp terminal_error?({:http_error, status, _details}) when status in [400, 404], do: true
  defp terminal_error?(_reason), do: false
end

defmodule Test.Options.Watcher do
  use GenServer
  require Logger

  alias Test.Yahoo.CrumbPool

  @poll_interval :timer.minutes(5)
  @call_timeout 35_000

  def start_link({symbol, expiration} = init_arg) do
    GenServer.start_link(__MODULE__, init_arg,
      name: Test.Options.watcher_name(symbol, expiration)
    )
  end

  def get(server) do
    GenServer.call(server, :get, @call_timeout)
  end

  @impl true
  def init({symbol, expiration}) do
    Process.send_after(self(), :poll, 0)

    {:ok,
     %{
       symbol: symbol,
       expiration: expiration,
       result: nil
     }}
  end

  @impl true
  def handle_call(:get, _from, %{result: nil} = state) do
    case fetch_and_maybe_cache(state) do
      {:ok, result, state} ->
        {:reply, result, state}

      {:stop, reason, state} ->
        Logger.warning(
          "Stopping options watcher #{inspect({state.symbol, state.expiration})} due to terminal error #{inspect(reason)}"
        )

        {:stop, :normal, {:error, reason}, state}
    end
  end

  @impl true
  def handle_call(:get, _from, state) do
    {:reply, state.result, state}
  end

  @impl true
  def handle_info(:poll, state) do
    case fetch_and_maybe_cache(state) do
      {:ok, _result, state} ->
        Process.send_after(self(), :poll, @poll_interval)
        {:noreply, state}

      {:stop, reason, state} ->
        Logger.warning(
          "Stopping options watcher #{inspect({state.symbol, state.expiration})} due to terminal error #{inspect(reason)}"
        )

        {:stop, :normal, state}
    end
  end

  defp fetch_and_maybe_cache(state) do
    result = fetch(state.symbol, state.expiration)

    case result do
      {:ok, _payload} ->
        {:ok, result, %{state | result: result}}

      {:error, reason} ->
        if terminal_error?(reason) do
          {:stop, reason, state}
        else
          {:ok, {:error, reason}, state}
        end
    end
  end

  defp fetch(symbol, expiration) do
    query_params =
      case expiration do
        nil -> %{}
        value -> %{"date" => value}
      end

    try do
      case CrumbPool.symbol_options(symbol, query_params) do
        {:ok, _result} = result -> result
        {:error, reason} -> {:error, {:crumb_pool, reason}}
      end
    catch
      :exit, reason ->
        {:error, {:crumb_pool_exit, reason}}
    end
  end

  defp terminal_error?({_symbol, {:http_error, status, _details}}) when status in [400, 404],
    do: true

  defp terminal_error?({_symbol, {:http_error, status}}) when status in [400, 404],
    do: true

  defp terminal_error?(_reason), do: false
end

defmodule Test.Ticker do
  use DynamicSupervisor

  alias Test.Equities
  alias Test.Ticker.Watcher

  @registry Module.concat(__MODULE__, Registry)
  @bootstrap_concurrency System.schedulers_online() * 2

  def start_link(arg \\ []) do
    case DynamicSupervisor.start_link(__MODULE__, arg, name: __MODULE__) do
      {:ok, pid} ->
        Task.start(fn -> bootstrap_watchers() end)
        {:ok, pid}

      other ->
        other
    end
  end

  def subscribe(symbol) do
    case ensure_watcher(symbol) do
      {:ok, watcher} ->
        Watcher.subscribe(watcher)
        :ok

      {:error, _reason} ->
        :ok
    end
  end

  def unsubscribe(symbol) do
    case lookup_watcher(symbol) do
      {:ok, watcher} ->
        Watcher.unsubscribe(watcher)
        :ok

      :error ->
        :ok
    end
  end

  def get(symbol) do
    with {:ok, watcher} <- ensure_watcher(symbol) do
      Watcher.get(watcher)
    else
      {:error, _reason} ->
        {:ok, nil}
    end
  end

  def watcher_name(symbol) do
    {:via, Registry, {@registry, symbol}}
  end

  @impl true
  def init(_init_arg \\ []) do
    DynamicSupervisor.init(strategy: :one_for_one)
  end

  defp ensure_watcher(symbol) do
    case lookup_watcher(symbol) do
      {:ok, pid} ->
        {:ok, pid}

      :error ->
        start_watcher(symbol)
    end
  end

  defp start_watcher(symbol) do
    child_spec =
      Supervisor.child_spec(
        {Watcher, symbol},
        restart: :transient
      )

    case DynamicSupervisor.start_child(__MODULE__, child_spec) do
      {:ok, pid} ->
        {:ok, pid}

      {:error, {:already_started, pid}} ->
        {:ok, pid}

      {:error, {:shutdown, {:failed_to_start_child, _child, {:already_started, pid}}}} ->
        {:ok, pid}

      {:error, _reason} = error ->
        case lookup_watcher(symbol) do
          {:ok, pid} -> {:ok, pid}
          :error -> error
        end
    end
  end

  defp lookup_watcher(symbol) do
    case Registry.lookup(@registry, symbol) do
      [{pid, _}] -> {:ok, pid}
      [] -> :error
    end
  end

  defp bootstrap_watchers do
    Equities.all()
    |> Task.async_stream(
      fn %{"symbol" => symbol} ->
        _ = ensure_watcher(symbol)
        Process.sleep(5000)
        :ok
      end,
      max_concurrency: @bootstrap_concurrency,
      ordered: false,
      timeout: :infinity
    )
    |> Stream.run()
  catch
    :exit, _reason ->
      :ok
  end
end

defmodule Test.Options do
  use DynamicSupervisor

  alias Test.Options.Watcher

  @registry Module.concat(__MODULE__, Registry)

  def start_link(arg \\ []) do
    case DynamicSupervisor.start_link(__MODULE__, arg, name: __MODULE__) do
      {:ok, pid} ->
        Task.start(fn -> bootstrap_watchers() end)
        {:ok, pid}

      other ->
        other
    end
  end

  def get(symbol, options \\ []) do
    expiration = Keyword.get(options, :expiration)

    with {:ok, watcher} <- ensure_watcher(symbol, expiration) do
      Watcher.get(watcher)
    end
  end

  def watcher_name(symbol, expiration) do
    {:via, Registry, {@registry, {symbol, expiration}}}
  end

  @impl true
  def init(_init_arg \\ []) do
    DynamicSupervisor.init(strategy: :one_for_one)
  end

  defp ensure_watcher(symbol, expiration) do
    case lookup_watcher(symbol, expiration) do
      {:ok, pid} ->
        {:ok, pid}

      :error ->
        start_watcher(symbol, expiration)
    end
  end

  defp start_watcher(symbol, expiration) do
    child_spec =
      Supervisor.child_spec(
        {Watcher, {symbol, expiration}},
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
        case lookup_watcher(symbol, expiration) do
          {:ok, pid} -> {:ok, pid}
          :error -> error
        end
    end
  end

  defp lookup_watcher(symbol, expiration) do
    case Registry.lookup(@registry, {symbol, expiration}) do
      [{pid, _}] -> {:ok, pid}
      [] -> :error
    end
  end

  defp bootstrap_watchers do
  catch
    :exit, _reason ->
      :ok
  end
end

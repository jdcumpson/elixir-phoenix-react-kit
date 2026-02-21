defmodule Test.Yahoo.CrumbPool do
  use GenServer
  require Logger

  alias Test.Yahoo.CrumbPool.Worker

  @default_pool_size 4
  @checkout_timeout 5_000
  @request_timeout :infinity
  @ensure_pool_delay_ms 1_000

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  def symbol_quote(symbol, timeout \\ @request_timeout) do
    with {:ok, worker} <- checkout_worker() do
      Worker.symbol_quote(worker, symbol, timeout)
    end
  end

  def symbol_options(symbol, query_params \\ %{}, timeout \\ @request_timeout) do
    with {:ok, worker} <- checkout_worker() do
      Worker.symbol_options(worker, symbol, query_params, timeout)
    end
  end

  @impl true
  def init(opts) do
    Process.flag(:trap_exit, true)

    state = %{
      workers: :queue.new(),
      pool_size: max(Keyword.get(opts, :pool_size, @default_pool_size), 1),
      next_worker_id: 1
    }

    state = ensure_pool_size(state)
    {:ok, state}
  end

  @impl true
  def handle_call(:checkout_worker, _from, state) do
    state = ensure_pool_size(state)

    case queue_next_worker(state.workers) do
      {:ok, worker, workers} ->
        {:reply, {:ok, worker}, %{state | workers: workers}}

      {:empty, workers} ->
        state = %{state | workers: workers} |> ensure_pool_size()

        case queue_next_worker(state.workers) do
          {:ok, worker, workers} ->
            {:reply, {:ok, worker}, %{state | workers: workers}}

          {:empty, workers} ->
            Process.send_after(self(), :ensure_pool, @ensure_pool_delay_ms)
            {:reply, {:error, :empty_pool}, %{state | workers: workers}}
        end
    end
  end

  @impl true
  def handle_info(:ensure_pool, state) do
    {:noreply, ensure_pool_size(state)}
  end

  @impl true
  def handle_info({:EXIT, pid, reason}, state) do
    if worker_in_pool?(state.workers, pid) do
      Logger.warning("Yahoo pool worker exited #{inspect(pid)} with #{inspect(reason)}")

      state =
        %{state | workers: remove_worker(state.workers, pid)}
        |> ensure_pool_size()

      {:noreply, state}
    else
      {:noreply, state}
    end
  end

  defp checkout_worker do
    GenServer.call(__MODULE__, :checkout_worker, @checkout_timeout)
  end

  defp ensure_pool_size(state) do
    missing = state.pool_size - :queue.len(state.workers)

    if missing <= 0 do
      state
    else
      Enum.reduce(1..missing, state, fn _, state ->
        case start_worker(state.next_worker_id) do
          {:ok, pid} ->
            %{
              state
              | workers: :queue.in(pid, state.workers),
                next_worker_id: state.next_worker_id + 1
            }

          {:error, reason} ->
            Logger.warning("Failed to start Yahoo pool worker: #{inspect(reason)}")
            Process.send_after(self(), :ensure_pool, @ensure_pool_delay_ms)
            %{state | next_worker_id: state.next_worker_id + 1}
        end
      end)
    end
  end

  defp start_worker(worker_id) do
    Worker.start_link(worker_id)
  end

  defp queue_next_worker(queue) do
    case :queue.out(queue) do
      {{:value, worker}, rest} ->
        if Process.alive?(worker) do
          {:ok, worker, :queue.in(worker, rest)}
        else
          queue_next_worker(rest)
        end

      {:empty, _queue} ->
        {:empty, queue}
    end
  end

  defp worker_in_pool?(queue, worker) do
    queue
    |> :queue.to_list()
    |> Enum.member?(worker)
  end

  defp remove_worker(queue, worker) do
    queue
    |> :queue.to_list()
    |> Enum.reject(&(&1 == worker))
    |> :queue.from_list()
  end
end

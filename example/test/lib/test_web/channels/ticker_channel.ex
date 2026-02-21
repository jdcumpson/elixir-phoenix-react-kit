defmodule TestWeb.TickerChannel do
  alias Test.Options
  alias Test.Ticker
  use TestWeb, :channel

  intercept ["update"]

  @impl Phoenix.Channel
  def join("ticker:" <> symbol, _payload, socket) do
    Ticker.subscribe(symbol)

    Process.send_after(self(), {:after_join, symbol}, 0)
    {:ok, %{}, assign(socket, :symbol, symbol)}
  end

  @impl Phoenix.Channel
  def handle_info({:after_join, symbol}, socket) do
    {:ok, payload} =
      Ticker.get(symbol)

    push(socket, "action", %{type: "ticker/update", payload: payload})
    {:noreply, socket}
  end

  @impl Phoenix.Channel
  def terminate(_reason, socket) do
    Ticker.unsubscribe(socket.assigns[:symbol])
  end

  @impl Phoenix.Channel
  def handle_out("update", payload, socket) do
    push(socket, "action", %{
      type: "ticker/update",
      payload: Map.put(payload, "timestamp", DateTime.utc_now() |> DateTime.to_unix())
    })

    {:noreply, socket}
  end

  @impl Phoenix.Channel
  def handle_in("options", %{"id" => _id, "expirationDate" => expiration}, socket) do
    case Options.get(socket.assigns[:symbol], expiration: expiration) do
      {:ok,
       %{
         "optionChain" => %{
           "error" => error
         }
       }}
      when not is_nil(error) ->
        {:reply, {:error, error}, socket}

      {:ok,
       %{
         "optionChain" => %{
           "result" => [
             %{
               "expirationDates" => expiration_dates,
               "options" => [options],
               "strikes" => strikes,
               "quote" => quote_data
             }
           ]
         }
       }} ->
        {:reply,
         {:ok,
          %{
            options: options,
            strikes: strikes,
            quote: quote_data,
            expirationDates: expiration_dates
          }}, socket}
    end
  end
end

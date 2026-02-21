defmodule TestWeb.UserChannel do
  alias Test.Ticker
  alias Test.Equities
  alias Test.BlackScholes.RateCurve
  alias Test.BlackScholes
  use TestWeb, :channel

  @impl Phoenix.Channel
  def join("user:" <> user_id, payload, socket) do
    if authorized?(payload) do
      send(self(), {:after_join, payload})
      socket = assign(socket, :user_id, user_id)

      {:ok,
       %{
         user: %{
           id: user_id
         }
       }, socket}
    else
      {:error, %{reason: "unauthorized"}}
    end
  end

  @impl true
  def handle_info({:after_join, _payload}, socket) do
    user_id = socket.assigns[:user_id]

    # Example: fetch something for this user

    # set the current user information
    push(socket, "action", %{
      type: "user/set",
      payload: %{
        id: user_id,
        name: "User#{user_id}"
      }
    })

    # Example: push a new location to the client
    # push(socket, "navigate", %{
    #   path: "/"
    # })

    {:noreply, socket}
  end

  # Channels can be used in a request/response fashion
  # by sending replies to requests from the client
  @impl true
  def handle_in("ping", payload, socket) do
    {:reply, {:ok, payload}, socket}
  end

  def handle_in(
        "predictions",
        %{
          "id" => id,
          "symbol" => symbol,
          "option" =>
            %{
              "expirationDate" => expiration,
              "strike" => strike_price,
              "price" => option_price,
              "type" => type,
              "buyOrWrite" => buy_or_write
            } = input_option
        } = payload,
        socket
      ) do
    {:ok, data} = Ticker.get(symbol)

    underlying_asset_price =
      get_in(data, ["postMarketPrice", "raw"]) || get_in(data, ["regularMarketPrice", "raw"]) ||
        raise "Invalid price"

    [start_price, end_price] =
      case Map.get(payload, "range", [underlying_asset_price * 0.5, underlying_asset_price * 1.5]) do
        [nil, nil] -> [underlying_asset_price * 0.5, underlying_asset_price * 1.5]
        [nil, upper] -> [underlying_asset_price * 0.5, upper]
        [lower, nil] -> [lower, underlying_asset_price * 1.5]
        [lower, upper] -> [lower, upper]
      end

    step = (end_price - start_price) / 25

    contracts = Map.get(payload, "contracts", 1)

    expiry =
      expiration
      |> DateTime.from_unix!()
      |> DateTime.to_date()

    today = DateTime.utc_now() |> DateTime.to_date()
    days_to_expiry = Date.diff(expiry, today)

    buy_or_write = String.to_existing_atom(buy_or_write)
    type = String.to_existing_atom(type)

    {:ok, curve} =
      RateCurve.fetch_treasury_curve()

    Task.start(fn ->
      iv =
        Map.get(input_option, "iv") ||
          BlackScholes.implied_volatility(
            underlying_asset_price,
            buy_or_write,
            type,
            strike_price,
            contracts,
            option_price * contracts * 100,
            days_to_expiry: days_to_expiry,
            american: true,
            steps: 200,
            risk_free_curve: curve
          )

      BlackScholes.price_for_range(
        {start_price, end_price, step},
        {today, expiry, 25},
        buy_or_write,
        type,
        option_price,
        strike_price,
        contracts,
        iv,
        expiry_date: expiry,
        risk_free_curve: curve,
        american: true
      )
      |> Stream.chunk_every(25)
      |> Stream.map(fn maps ->
        # push(socket, "options:#{uuid}", %{data: map})
        push(socket, "action", %{
          type: "predictions/stream",
          payload: %{
            id: id,
            data: maps
          }
        })
      end)
      |> Stream.run()

      push(socket, "action", %{
        type: "predictions/receive",
        payload: %{
          id: id
        }
      })
    end)

    {:reply, {:ok, id}, socket}
  end

  def handle_in("equities_search", %{"id" => _id, "search" => search}, socket) do
    result = Equities.search(search)

    {:reply, {:ok, result}, socket}
  end

  # Add authorization logic here as required.
  defp authorized?(_payload) do
    true
  end
end

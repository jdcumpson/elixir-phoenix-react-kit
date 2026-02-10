defmodule TestWeb.UserChannel do
  alias Test.BlackScholes.RateCurve
  alias Test.BlackScholes
  alias Ecto.UUID
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
  def handle_info({:after_join, payload}, socket) do
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

  def handle_in("options", _payload, socket) do
    uuid = UUID.autogenerate()

    contracts = 1
    underlying_asset_price = 25
    expiry = ~D[2026-03-24]
    strike_price = 32

    {:ok, curve} =
      RateCurve.fetch_treasury_curve()

    Task.start(fn ->
      iv =
        BlackScholes.implied_volatility(
          underlying_asset_price,
          :buy,
          :call,
          strike_price,
          contracts,
          1.32,
          days_to_expiry: 45,
          american: true,
          steps: 200,
          risk_free_curve: curve
        )
        |> dbg

      range =
        BlackScholes.price_for_range(
          {15, 35, 1},
          {~D[2026-02-01], expiry, 25},
          :buy,
          :call,
          underlying_asset_price,
          contracts,
          iv,
          expiry_date: expiry,
          risk_free_curve: curve,
          american: true
        )
        |> dbg

      push(socket, "options:#{uuid}", %{data: range})
      push(socket, "options:#{uuid}:done", %{})
    end)

    {:reply, {:ok, uuid}, socket}
  end

  # It is also common to receive messages from the client and
  # broadcast to everyone in the current topic (general:lobby).
  @impl true
  def handle_in("shout", payload, socket) do
    broadcast(socket, "shout", payload)
    {:noreply, socket}
  end

  # Add authorization logic here as required.
  defp authorized?(payload) do
    true
  end
end

defmodule TestWeb.UserChannel do
  use TestWeb, :channel

  @impl Phoenix.Channel
  def join("user:" <> user_id, payload, socket) do
    dbg(socket)

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

  # It is also common to receive messages from the client and
  # broadcast to everyone in the current topic (general:lobby).
  @impl true
  def handle_in("shout", payload, socket) do
    broadcast(socket, "shout", payload)
    {:noreply, socket}
  end

  # Add authorization logic here as required.
  defp authorized?(payload) do
    dbg(payload)

    true
  end
end

defmodule TestWeb.PageController do
  alias PhoenixReactKit.SSR
  use TestWeb, :controller

  def ssr(conn, _params) do
    SSR.render(conn, %{
      "state" => %{"application" => %{"csrfToken" => get_csrf_token()}}
    })
  end
end

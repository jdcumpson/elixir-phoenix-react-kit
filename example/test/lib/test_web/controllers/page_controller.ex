defmodule TestWeb.PageController do
  alias PhoenixReactKit.SSR
  use TestWeb, :controller

  def ssr(conn, _params) do
    text = SSR.render(%{"state" => %{"application" => %{"foo" => "bar"}}})
    html(conn, text)
  end
end

defmodule PhoenixReactKit.SSR do
  require Logger

  @default_max_retries 5
  @default_timeout_ms 5_000
  @hop_by_hop ~w(
    connection keep-alive proxy-authenticate proxy-authorization te trailers
    transfer-encoding upgrade content-length
  )a

  def render(conn, assigns, opts \\ []) do
    attempts = Keyword.get(opts, :attempts, 0)
    max_attempts = Keyword.get(opts, :max_attempts, @default_max_retries)
    timeout = Keyword.get(opts, :timeout, @default_timeout_ms)

    try do
      response =
        HTTPoison.post!(
          "#{url()}#{conn.request_path}",
          Jason.encode!(
            %{assigns: assigns},
            escape: :javascript_safe
          ),
          [
            {"Content-Type", "text/html"},
            {"Accept", "*"}
          ],
          recv_timeout: 100_000,
          stream_to: self(),
          async: :once
        )

      loop(conn, response)
    rescue
      HTTPoison.Error ->
        if attempts < max_attempts do
          Logger.warning("Retrying ssr fetch, attempt: #{attempts + 1}")
          Process.sleep(timeout)
          render(conn, assigns, Keyword.put(opts, :attempts, attempts + 1))
        else
          {:error, :cannot_fetch_ssr}
        end
    end
  end

  defp url do
    profile = Application.get_env(:phoenix_react_kit, :test)
    url = Keyword.get(profile, :url)
    scheme = Keyword.get(url, :scheme)
    host = Keyword.get(url, :host)
    port = Keyword.get(url, :port)

    case port do
      nil ->
        "#{scheme}://#{host}"

      p ->
        "#{scheme}://#{host}:#{p}"
    end
  end

  defp loop(%Plug.Conn{} = conn, %HTTPoison.AsyncResponse{id: id} = response, status \\ 200) do
    receive do
      %HTTPoison.AsyncStatus{id: ^id, code: code} ->
        {:ok, response} = HTTPoison.stream_next(response)
        loop(conn, response, code)

      %HTTPoison.AsyncHeaders{id: ^id, headers: headers} ->
        conn =
          Enum.reduce(headers, conn, fn {k, v}, conn ->
            k_down = String.downcase(k)

            if k_down in @hop_by_hop do
              conn
            else
              Plug.Conn.put_resp_header(conn, k_down, v)
            end
          end)

        conn =
          Enum.reduce(headers, conn, fn {k, v}, conn ->
            k = String.downcase(k)

            if k in @hop_by_hop do
              conn
            else
              # use replace for most headers
              if k == "set-cookie" do
                # allow multiple cookies
                Plug.Conn.put_resp_header(conn, k, v)
              else
                # or replace_resp_header (see below)
                Plug.Conn.put_resp_header(conn, k, v)
              end
            end
          end)

        # Nuke these no matter what happened upstream or earlier in the stack
        conn =
          conn
          |> Plug.Conn.delete_resp_header("transfer-encoding")
          |> Plug.Conn.delete_resp_header("content-length")
          |> Plug.Conn.delete_resp_header("connection")

        conn = Plug.Conn.send_chunked(conn, status)

        {:ok, response} = HTTPoison.stream_next(response)
        loop(conn, response, status)

      %HTTPoison.AsyncChunk{id: ^id, chunk: chunk} ->
        {:ok, conn} = Plug.Conn.chunk(conn, chunk)
        {:ok, response} = HTTPoison.stream_next(response)
        loop(conn, response, status)

      %HTTPoison.AsyncEnd{id: ^id} ->
        conn
    end
  end
end

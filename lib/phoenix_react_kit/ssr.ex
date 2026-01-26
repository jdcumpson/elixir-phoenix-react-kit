defmodule PhoenixReactKit.SSR do
  require Logger

  @default_max_retries 5
  @default_timeout_ms 5_000

  def render(assigns, opts \\ []) do
    attempts = Keyword.get(opts, :attempts, 0)
    max_attempts = Keyword.get(opts, :max_attempts, @default_max_retries)
    timeout = Keyword.get(opts, :timeout, @default_timeout_ms)

    try do
      %HTTPoison.Response{body: body} =
        HTTPoison.post!(
          url(),
          Jason.encode!(
            %{assigns: assigns},
            escape: :javascript_safe
          ),
          [
            {"Content-Type", "text/html"},
            {"Accept", "*"}
          ],
          recv_timeout: 100_000
        )

      body
    rescue
      HTTPoison.Error ->
        if attempts < max_attempts do
          Logger.warning("Retrying ssr fetch, attempt: #{attempts + 1}")
          Process.sleep(timeout)
          render(assigns, Keyword.put(opts, :attempts, attempts + 1))
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
end

defmodule PhoenixReactKit.Vite do
  @latest_version "0.25.0"

  def install_and_run(profile, args) do
    # start_unique_install_worker()
    run(profile, args)
  end

  def run(profile, extra_args) when is_atom(profile) and is_list(extra_args) do
    config = config_for!(profile)
    args = config[:args] || []

    # if args == [] and extra_args == [] do
    #   raise "no arguments passed to esbuild"
    # end

    opts = [
      cd: config[:cd] || File.cwd!(),
      env: normalize_env(config[:env] || %{}),
      into: IO.stream(:stdio, :line),
      stderr_to_stdout: true
    ]

    # bin_path()
    [binary | args] = args ++ extra_args

    System.cmd(binary, args, opts)
    |> elem(1)
  end

  defp start_unique_install_worker() do
    ref =
      __MODULE__.Supervisor
      |> Supervisor.start_child(
        Supervisor.child_spec({Task, &install/0}, restart: :transient, id: __MODULE__.Installer)
      )
      |> case do
        {:ok, pid} -> pid
        {:error, {:already_started, pid}} -> pid
      end
      |> Process.monitor()

    receive do
      {:DOWN, ^ref, _, _, _} -> :ok
    end
  end

  def install do
  end

  def config_for!(profile) when is_atom(profile) do
    Application.get_env(:phoenix_react_kit, profile) ||
      raise ArgumentError, """
      unknown esbuild profile. Make sure the profile is defined in your config/config.exs file, such as:

          config :phoenix_react_kit,
            #{profile}: [
              args: ~w(js/app.js --bundle --target=es2016 --outdir=../priv/static/assets),
              cd: Path.expand("../assets", __DIR__),
              env: %{"NODE_PATH" => Path.expand("../deps", __DIR__)}
            ]
      """
  end

  defp normalize_env(env) do
    Map.new(env, fn
      {key, value} when is_list(value) -> {key, Enum.join(value, path_sep())}
      other -> other
    end)
  end

  def bin_path do
    name = "vite-#{target()}"

    Application.get_env(:esbuild, :path) ||
      if Code.ensure_loaded?(Mix.Project) do
        Path.join(Path.dirname(Mix.Project.build_path()), name)
      else
        Path.expand("_build/#{name}")
      end
  end

  defp target do
    case :os.type() do
      # Assuming it's an x86 CPU
      {:win32, _} ->
        wordsize = :erlang.system_info(:wordsize)

        if wordsize == 8 do
          "win32-x64"
        else
          "win32-ia32"
        end

      {:unix, osname} ->
        arch_str = :erlang.system_info(:system_architecture)
        [arch | _] = arch_str |> List.to_string() |> String.split("-")

        case arch do
          "amd64" -> "#{osname}-x64"
          "x86_64" -> "#{osname}-x64"
          "i686" -> "#{osname}-ia32"
          "i386" -> "#{osname}-ia32"
          "aarch64" -> "#{osname}-arm64"
          "riscv64" -> "#{osname}-riscv64"
          # TODO: remove when we require OTP 24
          "arm" when osname == :darwin -> "darwin-arm64"
          "arm" -> "#{osname}-arm"
          "armv7" <> _ -> "#{osname}-arm"
          _ -> raise "esbuild is not available for architecture: #{arch_str}"
        end
    end
  end

  @doc false
  # Latest known version at the time of publishing.
  def latest_version, do: @latest_version

  def configured_version do
    Application.get_env(:esbuild, :version, latest_version())
  end

  defp path_sep do
    case :os.type() do
      {:win32, _} -> ";"
      {:unix, _} -> ":"
    end
  end
end

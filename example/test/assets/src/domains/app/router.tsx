import { useCallback, useMemo } from "react"


import { match, MatchFunction, pathToRegexp } from "path-to-regexp"
import { ErrorBoundary } from "react-error-boundary"

import ErrorPage from "@/domains/app/ErrorPage"
import { HistoryWatcher } from "@/domains/app/history"
import { useDispatch, useSelector } from "@/redux"


export type Route<P> = {
  path: string
  regexp: RegExp
  fn: MatchFunction<Partial<Record<string, string | string[]>>>
  Component: React.ComponentType<P>
  props?: P
  responseOptions?: {
    status?: number
  }
}

export const route = <P,>(path: string, Component: React.ComponentType<P>, props?: P): Route<P> => {
  const { regexp } = pathToRegexp(path)
  return { fn: match(path), regexp, Component, path, props }
}

type UnknownRoute = Route<unknown>

export class BaseError extends Error {
  status: number = 500;
}

export class NotFoundError extends BaseError {
  status = 404;
  message: string = 'Not Found'
}


const ThrowError = (props: { error: { message: string, stack?: string } }) => {
  throw props.error
}

export const useRouter = (
  routes: readonly UnknownRoute[],
  options?: { errorHandler?: React.ComponentType<{ error: { message: string, stack?: string } }> }
) => {
  const Router = useCallback(() => {
    const path = useSelector((state) => state.application.path)
    const errorInfo = useSelector(state => state.application.responseOptions?.errorInfo)
    const dispatch = useDispatch()
    const ErrorComponent = options?.errorHandler ?? ErrorPage

    const element = useMemo(() => {
      if (errorInfo != null) {
        return <ErrorComponent error={errorInfo} />
      }

      for (const route of routes) {
        if (route.fn(path) !== false) {
          return <route.Component {...(route.props ?? {})} />
        }
      }
      return <ThrowError error={new NotFoundError()} />
    }, [path, errorInfo, routes, options?.errorHandler])

    const FallbackComponent = useMemo(() => {
      return function FallbackComponent({ error }: { error: unknown }) {
        if (error instanceof Error) {
          return <ErrorComponent error={{ message: error.message, stack: error.stack }} />
        }
        return <>{JSON.stringify(error)}</>
      }
    }, [])

    return (
      <>
        <HistoryWatcher />
        <ErrorBoundary onReset={() => {
          dispatch({
            type: 'application/routeResult', payload: {
              status: 200,
            }
          })
        }} onError={(error) => {
          if (error instanceof BaseError) {
            dispatch({
              type: 'application/routeResult', payload: {
                status: error.status,
                errorInfo: {
                  message: error.message,
                  stack: error.stack
                }
              }
            })
          } else if (error instanceof Error) {
            dispatch({
              type: 'application/routeResult', payload: {
                status: 500,
                errorInfo: {
                  message: error.message,
                  stack: error.stack
                }
              }
            })
          } else {
            let stack: string | undefined
            try { throw new Error('unknown') } catch (e) {
              if (e instanceof Error) {
                stack = e.stack
              }
            }
            dispatch({
              type: 'application/routeResult', payload: {
                status: 500,
                errorInfo: {
                  message: `unknown: ${String(error)}`,
                  stack
                }
              }
            })
          }

        }} resetKeys={[path]} FallbackComponent={FallbackComponent}>
          {element}
        </ErrorBoundary>
      </>)
  }, [routes, options])

  return { Router }
}

import { useEffect } from "react"

import { createBrowserHistory, createMemoryHistory } from "history"
import merge from "lodash.merge"

import { useDispatch } from "@/redux"


const history =
  typeof window === 'undefined' ? createMemoryHistory() : createBrowserHistory()


export const useHistory = () => {
  return {
    ...(history),
    push(url: string, state = 'NOT_FIRST_ROUTE') {
      history?.push(url, state)
      window.scrollTo({ top: 0, behavior: 'instant' })
    },
    backOrPush(url: string, state = 'NOT_FIRST_ROUTE') {
      history?.push(url, state)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
  }
}

export const HistoryWatcher = () => {
  const history = useHistory()
  const dispatch = useDispatch()

  useEffect(() => {
    return history.listen(() => {
      const url = new URL(location.toString())
      const queryArgs = Object.fromEntries(url.searchParams.entries())
      const pathArgs = {}

      dispatch({
        type: 'application/setPath', payload: {
          path: url.pathname,
          queryArgs,
          pathArgs,
          args: merge(queryArgs, pathArgs),
        }
      })
    })
  }, [history])

  return null
}
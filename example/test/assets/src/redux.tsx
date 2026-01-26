import React from 'react'

import {
  combineReducers,
  configureStore,
  Dispatch,
  ThunkDispatch,
} from '@reduxjs/toolkit'
import { TypedUseSelectorHook } from 'react-redux'
import {
  useSelector as genericUseSelector,
  useDispatch as genericUseDispatch,
} from 'react-redux'

import {
  ApplicationActions,
  applicationReducer,
} from '@/domains/app/redux'

export const createStore = (ssrState: Record<string, unknown>) => {
  return configureStore({
    reducer: combineReducers({
      application: applicationReducer,
    }),
    middleware: (getDefaultMiddleware) => getDefaultMiddleware(),
    devTools: true,
    preloadedState: ssrState,
  })
}

export type ApplicationStore = ReturnType<typeof createStore>
export type AppState = ReturnType<ApplicationStore['getState']>
export type AppDispatch = Dispatch<ApplicationActions>
export type AppGetState = () => AppState

export const useSelector: TypedUseSelectorHook<AppState> = (
  fn: (state: AppState) => ReturnType<typeof genericUseSelector<AppState>>,
) => {
  const callback = React.useCallback(fn, [])
  return genericUseSelector(callback)
}

export const useDispatch: () => ThunkDispatch<
  AppState,
  unknown,
  ApplicationActions
> = genericUseDispatch

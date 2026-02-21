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

import { ApplicationActions, applicationReducer } from '@/domains/app/redux'
import {
  Actions as OptionsActions,
  reducer as optionsReducer,
} from '@/domains/options/redux'
import { UserActions, userReducer } from '@/domains/user/redux'

export const createStore = (ssrState: Record<string, unknown>) => {
  return configureStore({
    reducer: combineReducers({
      application: applicationReducer,
      user: userReducer,
      options: optionsReducer,
    }),
    middleware: (getDefaultMiddleware) => getDefaultMiddleware(),
    devTools: {
      maxAge: 1000,
    },
    preloadedState: ssrState,
  })
}

export type ApplicationStore = ReturnType<typeof createStore>
export type AppState = ReturnType<ApplicationStore['getState']>
export type AppActions = ApplicationActions | UserActions | OptionsActions
export type AppDispatch = Dispatch<AppActions>
export type AppGetState = () => AppState

export const useSelector: TypedUseSelectorHook<AppState> = (
  fn: (state: AppState) => ReturnType<typeof genericUseSelector<AppState>>,
) => {
  const callback = React.useCallback(fn, [])
  return genericUseSelector(callback)
}

export const useDispatch: () => ThunkDispatch<AppState, unknown, AppActions> =
  genericUseDispatch

import merge from "lodash.merge"
import { ParsedQuery } from "query-string"
import { Reducer, UnknownAction } from "redux"

import { AppState } from "@/redux"


export enum ClientSize {
  XL = 0,
  DESKTOP = 1,
  LAPTOP = 2,
  TABLET = 3,
  MOBILE = 4,
}

export interface ResponseOptions {
  status?: number, statusText?: string, errorInfo?: {
    message: string
    stack?: string
  } | null
}


export interface ApplicationState {
  path: string
  canGoBack: boolean
  previousLocation: string | null
  urlArgs: ParsedQuery
  pathArgs: ParsedQuery
  args: ParsedQuery
  clientSize: ClientSize
  cfSiteKey: string | null
  responseOptions?: ResponseOptions
  locale: string
}

export const DEFAULT_STATE: ApplicationState = {
  path: '/',
  canGoBack: false,
  previousLocation: null,
  urlArgs: {},
  pathArgs: {},
  args: {},
  clientSize: ClientSize.DESKTOP,
  cfSiteKey: null,
  responseOptions: {
    status: 200,
    statusText: 'OK',
    errorInfo: null
  },
  locale: 'en-US'
}

interface SetPathAction extends UnknownAction {
  type: 'application/setPath'
  // TODO: fixup payload type
  payload: {
    path: string
    queryArgs?: ParsedQuery
    pathArgs?: ParsedQuery
    args?: ParsedQuery
  }
}

interface SetClientSize extends UnknownAction {
  type: 'application/setClientSize'
  payload: ClientSize
}

interface RouteResult extends UnknownAction {
  type: 'application/routeResult',
  payload: {
    status?: number
    statusText?: string,
    errorInfo?: {
      message: string
      stack?: string
    }
  }
}

export interface Merge extends UnknownAction {
  type: 'merge',
  payload: Partial<AppState>
}


export type ApplicationActions = | SetPathAction | SetClientSize | RouteResult | Merge

export const applicationReducer: Reducer<ApplicationState, ApplicationActions> = (state: ApplicationState = DEFAULT_STATE, action) => {

  switch (action.type) {
    case 'application/setPath': {
      return {
        ...state,
        path: action.payload.path,
        queryArgs: action.payload.queryArgs ?? {},
        pathArgs: action.payload.pathArgs ?? {},
        args: action.payload.args ?? {},
        responseOptions: {
          errorInfo: null
        }
      }
    }

    case 'application/setClientSize': {
      return { ...state, clientSize: action.payload }
    }

    case 'application/routeResult': {
      return {
        ...state, responseOptions: {
          ...(state.responseOptions ?? {}),
          status: action.payload.status,
          statusText: action.payload.statusText,
          errorInfo: action.payload.errorInfo ?? null
        }
      }
    }

    case 'merge': {
      return merge({}, state, action.payload.application)
    }

    default: {
      return state
    }
  }
}
import { ParsedQuery } from "query-string"
import { Reducer, UnknownAction } from "redux"


export enum ClientSize {
  XL = 0,
  DESKTOP = 1,
  LAPTOP = 2,
  TABLET = 3,
  MOBILE = 4,
}

export interface Metadata {
  title: string
  meta?: {
    description?: string
  }
}

export interface ResponseOptions { status?: number, statusText?: string }


export interface ApplicationState {
  path: string
  canGoBack: boolean
  previousLocation: string | null
  urlArgs: ParsedQuery
  pathArgs: ParsedQuery
  args: ParsedQuery
  clientSize: ClientSize
  cfSiteKey: string | null
  metadata: Metadata
  responseOptions?: ResponseOptions
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
  metadata: {
    title: '',
    meta: {}
  },
  responseOptions: {
    status: 200,
    statusText: 'OK',
  }
}

interface SetPathAction extends UnknownAction {
  type: 'application/setPath'
  // TODO: fixup payload type
  payload: {
    path: string
    queryArgs?: Record<string, string | string[]>
    pathArgs?: Record<string, string>
    args?: SetPathAction['payload']['queryArgs'] &
    SetPathAction['payload']['pathArgs']
    metadata: Metadata
  }
}

interface SetClientSize extends UnknownAction {
  type: 'application/setClientSize'
  payload: ClientSize
}


export type ApplicationActions = | SetPathAction | SetClientSize

export const applicationReducer: Reducer<ApplicationState, ApplicationActions> = (state: ApplicationState = DEFAULT_STATE, action) => {

  switch (action.type) {
    case 'application/setPath': {
      return { ...state }
    }

    case 'application/setClientSize': {
      return { ...state, clientSize: action.payload }
    }

    default: {
      return state
    }
  }
}
import merge from "lodash.merge"
import { Reducer } from "redux"

import { Merge } from "@/domains/app/redux"

export interface UserState {
  id: string | null
}

export type UserActions = | Merge

export const DEFAULT_STATE = {
  id: null
}

export const userReducer: Reducer<UserState, UserActions> = (state: UserState = DEFAULT_STATE, action) => {
  switch (action.type) {
    case 'merge': {
      return merge({}, state, action.payload.user)
    }
  }
  return state
}
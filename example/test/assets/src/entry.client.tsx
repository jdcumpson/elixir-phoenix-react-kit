// import './index.css'
import { StrictMode } from 'react'

import merge from 'lodash.merge'
import { hydrateRoot } from 'react-dom/client'

import App from '@/App'
import { DEFAULT_STATE } from '@/domains/app/redux'
import { createStore, type AppState } from '@/redux'

declare global {
  interface Window {
    __STATE__?: AppState
  }
}

const state = window.__STATE__ || {}

const defaultState = {
  application: {
    ...DEFAULT_STATE
  },
}
const store = createStore(merge({}, defaultState, state))


hydrateRoot(
  document,
  <StrictMode>
    <App store={store} />
  </StrictMode>,
)

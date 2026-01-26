// import './index.css'
import { StrictMode } from 'react'

import { hydrateRoot } from 'react-dom/client'

import App from '@/App'
import type { AppState } from '@/redux'

declare global {
  interface Window {
    __STATE__?: AppState
  }
}

const state = window.__STATE__ || {}
const container = document.getElementById('app')

if (container) {
  hydrateRoot(
    container,
    <StrictMode>
      <App state={state} />
    </StrictMode>,
  )
}

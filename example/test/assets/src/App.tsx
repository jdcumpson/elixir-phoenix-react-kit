import React from "react"

import CssBaseline from "@mui/material/CssBaseline"
import { Provider } from "react-redux"

import { WatchClientSize } from "@/domains/app/client-size"
import ErrorPage from "@/domains/app/ErrorPage"
import { route, useRouter } from "@/domains/app/router"
import AppTheme from "@/domains/app/theme"
import { ApplicationStore } from "@/redux"

const HomePage = React.lazy(() => import('@/domains/home/HomePage'))
const OtherPage = React.lazy(() => import('@/domains/other/OtherPage'))

export default function App(props: { store: ApplicationStore }) {

  const { Router } = useRouter([
    route('/', HomePage),
    route('/other', OtherPage)
  ], { errorHandler: ErrorPage })


  return (
    <html>
      <head>
        <meta charSet="UTF-8" />
        <link rel="icon" type="image/svg+xml" href="/vite.svg" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body>
        <Provider store={props.store}>
          <AppTheme>
            <CssBaseline enableColorScheme />
            <WatchClientSize />
            <Router />
          </AppTheme>
        </Provider>
      </body>
    </html>
  )
}

import React, { use, useEffect, useState } from "react"

import CssBaseline from "@mui/material/CssBaseline"
import { Channel, Socket } from "phoenix"
import { Provider, useDispatch } from "react-redux"

import { WatchClientSize } from "@/domains/app/client-size"
import ErrorPage from "@/domains/app/ErrorPage"
import { useHistory } from "@/domains/app/history"
import { route, useRouter } from "@/domains/app/router"
import { UserSocketContext } from "@/domains/app/socket"
import AppTheme from "@/domains/app/theme"
import { ApplicationStore, useSelector } from "@/redux"

const HomePage = React.lazy(() => import('@/domains/home/HomePage'))
const OtherPage = React.lazy(() => import('@/domains/other/OtherPage'))

const ChannelListener = () => {
  const { socket } = use(UserSocketContext)
  const dispatch = useDispatch()
  const history = useHistory()
  const applicationState = useSelector(state => state.application)
  const [channel, setChannel] = useState<Channel | null>(null)

  useEffect(() => {
    if (socket == null) {
      return
    }
    const channel = socket.channel('user:1234', { application_state: applicationState })
    setChannel(channel)
  }, [socket])

  useEffect(() => {
    if (!channel) {
      return
    }
    channel.on('action', action => {
      dispatch(action)
    })
    channel.on('navigate', action => {
      if (location.pathname !== action.path) {
        history.push(action.path)
      }
    })

    channel.join().receive('ok', (resp) => {
      dispatch({ type: "merge", payload: resp })
    }).receive('error', (resp) => {
      console.error(resp)
    })
    return () => {
      channel.off('action')
      channel.off('navigate')
    }
  }, [channel])

  return null
}

export default function App(props: { store: ApplicationStore }) {

  const { Router } = useRouter([
    route('/', HomePage),
    route('/other', OtherPage)
  ], { errorHandler: ErrorPage })

  const [userSocket, setUserSocket] = useState<Socket | null>(null)


  useEffect(() => {
    const socket = new Socket('/socket')
    void socket.connect()
    setUserSocket(socket)
  }, [])


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
            <UserSocketContext value={{ socket: userSocket }}>
              <ChannelListener />
              <Router />
            </UserSocketContext>
          </AppTheme>
        </Provider>
      </body>
    </html>
  )
}

import React, { use, useEffect, useState } from 'react'

import CssBaseline from '@mui/material/CssBaseline'
import { Channel, Socket } from 'phoenix'
import { Provider, useDispatch } from 'react-redux'

import { WatchClientSize } from '@/domains/app/client-size'
import ErrorPage from '@/domains/app/ErrorPage'
import { useHistory } from '@/domains/app/history'
import { route, useRouter } from '@/domains/app/router'
import { UserSocketContext } from '@/domains/app/socket'
import AppTheme from '@/domains/app/theme'
import { ApplicationStore, useSelector } from '@/redux'

const HomePage = React.lazy(() => import('@/domains/home/HomePage'))
const OtherPage = React.lazy(() => import('@/domains/other/OtherPage'))
const OptionsPage = React.lazy(() => import('@/domains/options/OptionsPage'))

const ChannelListener = ({ children }: React.PropsWithChildren) => {
  const userContext = use(UserSocketContext)
  const { socket: contextSocket } = userContext
  const dispatch = useDispatch()
  const history = useHistory()
  const applicationState = useSelector((state) => state.application)
  const [socket, setSocket] = useState<Socket | null>(contextSocket)
  const [channel, setChannel] = useState<Channel | null>(null)
  const [value, setValue] = useState<typeof userContext>(userContext)

  useEffect(() => {
    if (contextSocket != null) {
      return
    }
    const socket = new Socket('/socket')
    void socket.connect()
    userContext.socket = socket
    setSocket(socket)
  }, [contextSocket])

  useEffect(() => {
    if (socket == null) {
      return
    }
    const channel = socket.channel('user:1234', {
      application_state: applicationState,
    })
    userContext.userChannel = channel
    setChannel(channel)
  }, [socket])

  useEffect(() => {
    if (!channel) {
      return
    }
    channel.on('action', (action) => {
      dispatch(action)
    })
    channel.on('navigate', (action) => {
      if (location.pathname !== action.path) {
        history.push(action.path)
      }
    })

    channel
      .join()
      .receive('ok', (resp) => {
        dispatch({ type: 'merge', payload: resp })
        setValue({ ...userContext })
      })
      .receive('error', (resp) => {
        console.error(resp)
      })
    return () => {
      channel.off('action')
      channel.off('navigate')
    }
  }, [channel])

  return <UserSocketContext value={value}>{children}</UserSocketContext>
}

export default function App(props: { store: ApplicationStore }) {
  const { Router } = useRouter(
    [
      route('/other', OtherPage),
      route('/options', OptionsPage),
      route('/', HomePage),
    ],
    { errorHandler: ErrorPage },
  )

  return (
    <html>
      <head>
        <meta charSet='UTF-8' />
        <link rel='icon' type='image/svg+xml' href='/vite.svg' />
        <meta name='viewport' content='width=device-width, initial-scale=1.0' />
      </head>
      <body>
        <Provider store={props.store}>
          <AppTheme>
            <CssBaseline enableColorScheme />
            <WatchClientSize />
            <ChannelListener>
              <Router />
            </ChannelListener>
          </AppTheme>
        </Provider>
      </body>
    </html>
  )
}

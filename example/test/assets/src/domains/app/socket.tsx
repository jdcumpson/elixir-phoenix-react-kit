import * as React from 'react'

import { Channel, Socket } from 'phoenix'

export const UserSocketContext = React.createContext<{
  socket: Socket | null
  userChannel: Channel | null
  tickerChannel: Channel | null
}>({
  socket: null,
  userChannel: null,
  tickerChannel: null,
})
